import type { NimantoStore } from "@nimanto/database";
import { fetchProviderJobs } from "@nimanto/providers";
import { publishMatch } from "./match-publication.js";

export type ProviderJobsFetcher = typeof fetchProviderJobs;
type Provider = "greenhouse" | "lever" | "ashby";

export class DiscoveryCycle {
  constructor(
    private readonly store: NimantoStore,
    private readonly fetchJobs: ProviderJobsFetcher = fetchProviderJobs,
  ) {}

  private async persist(
    database: NimantoStore,
    tenantId: string,
    remote: Awaited<ReturnType<ProviderJobsFetcher>>,
    publish: boolean,
  ) {
    const jobs = [];
    for (const job of remote.slice(0, 500)) {
      jobs.push(await database.upsertJob(tenantId, { ...job, capability: "deep_link" }));
    }
    if (!publish || jobs.length === 0) return { imported: jobs.length, matched: 0, jobs };
    for (const job of jobs) {
      await publishMatch(database, tenantId, job.id, "scheduled_discovery");
    }
    return { imported: jobs.length, matched: jobs.length, jobs };
  }

  async directImport(tenantId: string, provider: Provider, board: string) {
    const remote = await this.fetchJobs({ provider, board });
    return this.store.transaction(async (database) => {
      await database.assertTenantActive(tenantId);
      return this.persist(database, tenantId, remote, false);
    });
  }

  private errorCode(error: unknown): string {
    const message = error instanceof Error ? error.message : "";
    return /^(?:PROVIDER_[A-Z0-9_]+|INVALID_BOARD_IDENTIFIER)$/u.test(message)
      ? message
      : "PROVIDER_REFRESH_FAILED";
  }

  async runWorkerCycle() {
    const totals = { processed: 0, failed: 0, imported: 0, matched: 0 };
    for (let index = 0; index < 3; index += 1) {
      const claim = await this.store.claimDueSourceSchedule();
      if (!claim) break;
      totals.processed += 1;
      try {
        const remote = await this.fetchJobs({
          provider: claim.schedule.provider,
          board: claim.schedule.board,
        });
        const execution = await this.store.executeSourceSchedule(
          claim.schedule.id,
          claim.leaseToken,
          (database) => this.persist(database, claim.schedule.tenantId, remote, true),
        );
        totals.imported += execution.result.imported;
        totals.matched += execution.result.matched;
      } catch (error) {
        totals.failed += 1;
        try {
          await this.store.failSourceSchedule(
            claim.schedule.id,
            claim.leaseToken,
            this.errorCode(error),
          );
        } catch (leaseError) {
          if (!(leaseError instanceof Error && leaseError.message === "SCHEDULE_LEASE_INVALID")) {
            throw leaseError;
          }
        }
      }
    }
    return totals;
  }
}
