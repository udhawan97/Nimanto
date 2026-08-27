import type { NimantoStore } from "@nimanto/database";
import { canonicalHash, normalizeRoleObservation, type CurrentRole } from "@nimanto/domain";
import {
  fetchProviderJobsResult,
  type JobProvider,
  type ProviderFetchResult,
  type ProviderFetchRun,
  type ProviderJob,
} from "@nimanto/providers";
import { publishMatch } from "./match-publication.js";

type EnabledProvider = Exclude<JobProvider, "smartrecruiters">;
type EnabledProviderRequest = { provider: EnabledProvider; board: string };
type ProviderJobLike = Omit<
  ProviderJob,
  "workMode" | "workplaceEvidence" | "observedAt" | "rawPayload"
> & {
  workMode: string;
  workplaceEvidence?: ProviderJob["workplaceEvidence"] | undefined;
  observedAt?: string | undefined;
  rawPayload?: ProviderJob["rawPayload"] | undefined;
};
export type ProviderJobsFetcher = (
  request: EnabledProviderRequest,
) => Promise<ProviderFetchResult | ProviderJobLike[]>;

function normalizeProviderRole(job: ProviderJobLike, board: string): CurrentRole {
  return normalizeRoleObservation({
    ...job,
    sourceRoleId: job.sourceJobId,
    sourceMeta: { ...job.sourceMeta, board: job.sourceMeta.board ?? board },
  });
}

function normalizeFetchResult(
  request: EnabledProviderRequest,
  result: ProviderFetchResult | ProviderJobLike[],
): { jobs: ProviderJobLike[]; run: ProviderFetchRun } {
  if (!Array.isArray(result)) return result;
  const completedAt = new Date().toISOString();
  const capped = result.slice(0, 500);
  return {
    jobs: capped,
    run: {
      source: request.provider,
      boardId: request.board,
      startedAt: completedAt,
      completedAt,
      complete: result.length <= 500,
      pagesRead: 1,
      sourceItemCount: result.length,
      responseFingerprint: canonicalHash(capped.map((job) => [job.sourceJobId, job.contentHash])),
      retryAfterObserved: false,
      sourcePolicyVersion: "injected_provider_v1",
    },
  };
}

export class DiscoveryCycle {
  constructor(
    private readonly store: NimantoStore,
    private readonly fetchJobs: ProviderJobsFetcher = fetchProviderJobsResult,
  ) {}

  private async persist(
    database: NimantoStore,
    tenantId: string,
    fetchResult: { jobs: ProviderJobLike[]; run: ProviderFetchRun },
    roles: readonly CurrentRole[],
    publish: boolean,
  ) {
    const observation = await database.recordSourceObservation(tenantId, fetchResult.run, roles);
    const jobs = observation.jobs;
    if (!publish || jobs.length === 0) return { imported: jobs.length, matched: 0, jobs };
    for (const job of jobs) {
      await publishMatch(database, tenantId, job.id, "scheduled_discovery");
    }
    return { imported: jobs.length, matched: jobs.length, jobs };
  }

  async directImport(tenantId: string, provider: EnabledProvider, board: string) {
    const request = { provider, board };
    const fetched = normalizeFetchResult(request, await this.fetchJobs(request));
    const roles = fetched.jobs.slice(0, 500).map((job) => normalizeProviderRole(job, board));
    return this.store.transaction(async (database) => {
      await database.assertTenantActive(tenantId);
      return this.persist(database, tenantId, fetched, roles, false);
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
        const request = {
          provider: claim.schedule.provider,
          board: claim.schedule.board,
        };
        const fetched = normalizeFetchResult(request, await this.fetchJobs(request));
        const roles = fetched.jobs
          .slice(0, 500)
          .map((job) => normalizeProviderRole(job, claim.schedule.board));
        const execution = await this.store.executeSourceSchedule(
          claim.schedule.id,
          claim.leaseToken,
          (database) => this.persist(database, claim.schedule.tenantId, fetched, roles, true),
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
