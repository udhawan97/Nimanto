import { rm } from "node:fs/promises";
import path from "node:path";
import type { NimantoStore } from "@nimanto/database";

type RemovePath = (
  target: string,
  settings: { recursive?: boolean; force?: boolean },
) => Promise<void>;
type DeletionRun = {
  id: string;
  tenantId: string;
  state: string;
  actionIds: string[];
  completedAt?: string | null;
};

/** Files are left on disk and only the operator can act on that. The run id is
 * the whole line: the candidate's status token is in scope at both call sites
 * and must never reach a log. */
function warnCleanupPending(runId: string): void {
  console.warn(JSON.stringify({ level: "warn", code: "FILESYSTEM_CLEANUP_PENDING", runId }));
}

export class DeletionCoordinator {
  constructor(
    private readonly store: NimantoStore,
    private readonly artifactDirectory: string,
    private readonly outboxDirectory: string,
    private readonly removePath: RemovePath = rm,
    private readonly clearTenantRuntime: (tenantId: string) => void = () => {},
  ) {}

  async start(tenantId: string) {
    await this.store.pruneCompletedDeletionRuns();
    this.clearTenantRuntime(tenantId);
    const run = await this.store.beginTenantDeletion(tenantId);
    try {
      return { run, completedAt: await this.finish(run), pending: false as const };
    } catch {
      warnCleanupPending(run.id);
      return { run, completedAt: null, pending: true as const };
    }
  }

  async resume(token: string) {
    await this.store.pruneCompletedDeletionRuns();
    const run = await this.store.deletionRunByToken(token);
    if (!run) throw new Error("DELETION_NOT_FOUND");
    this.clearTenantRuntime(run.tenantId);
    /* A completed run reports the timestamp it already recorded. Reporting null
     * made resume contradict the status route for the same token. */
    if (run.state === "completed") {
      return { run, completedAt: run.completedAt ?? null, pending: false as const };
    }
    try {
      return { run, completedAt: await this.finish(run), pending: false as const };
    } catch {
      warnCleanupPending(run.id);
      return { run, completedAt: null, pending: true as const };
    }
  }

  /** Internal recovery path. It is intentionally not bearer-gated: the local
   * operator process already owns the data directory and must be able to finish
   * cleanup after a candidate status token expires. */
  async recoverPending(): Promise<{ recovered: number; pending: number }> {
    const runs = await this.store.recoverableDeletionRuns();
    let recovered = 0;
    let pending = 0;
    for (const run of runs) {
      this.clearTenantRuntime(run.tenantId);
      try {
        await this.finish(run);
        recovered += 1;
      } catch {
        pending += 1;
      }
    }
    await this.store.pruneCompletedDeletionRuns();
    return { recovered, pending };
  }

  private async finish(run: DeletionRun): Promise<string> {
    try {
      if (run.state !== "database_deleted") {
        await this.store.purgeTenantForDeletion(run.id, run.tenantId);
      }
      await this.removePath(path.join(this.artifactDirectory, run.tenantId), {
        recursive: true,
        force: true,
      });
      for (const actionId of run.actionIds) {
        await this.removePath(path.join(this.outboxDirectory, `${actionId}.json`), { force: true });
      }
      return await this.store.completeDeletion(run.id);
    } catch (error) {
      await this.store.markDeletionCleanupPending(run.id, "FILESYSTEM_CLEANUP_FAILED");
      throw error;
    }
  }
}
