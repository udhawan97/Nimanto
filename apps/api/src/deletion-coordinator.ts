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
};

export class DeletionCoordinator {
  constructor(
    private readonly store: NimantoStore,
    private readonly artifactDirectory: string,
    private readonly outboxDirectory: string,
    private readonly removePath: RemovePath = rm,
  ) {}

  async start(tenantId: string) {
    const run = await this.store.beginTenantDeletion(tenantId);
    try {
      return { run, completedAt: await this.finish(run), pending: false as const };
    } catch {
      return { run, completedAt: null, pending: true as const };
    }
  }

  async resume(token: string) {
    const run = await this.store.deletionRunByToken(token);
    if (!run) throw new Error("DELETION_NOT_FOUND");
    if (run.state === "completed") return { run, completedAt: null, pending: false as const };
    try {
      return { run, completedAt: await this.finish(run), pending: false as const };
    } catch {
      return { run, completedAt: null, pending: true as const };
    }
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
