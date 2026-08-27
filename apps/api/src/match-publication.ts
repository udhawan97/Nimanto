import { randomUUID } from "node:crypto";
import { type NimantoStore, type MatchRunRecord } from "@nimanto/database";
import { canonicalHash, createReceipt, matchJob } from "@nimanto/domain";

function uniqueEvidenceIds(result: MatchRunRecord["result"]): string[] {
  return [
    ...new Set([
      ...result.requirements.flatMap((requirement) => requirement.evidenceIds),
      ...result.dimensions.flatMap((dimension) => dimension.evidenceIds),
    ]),
  ].toSorted();
}

export async function publishMatch(
  store: NimantoStore,
  tenantId: string,
  jobId: string,
  source: "manual" | "scheduled_discovery",
): Promise<MatchRunRecord> {
  return store.transaction(async (database) => {
    await database.lockTenantActive(tenantId);
    const [job, profile] = await Promise.all([
      database.getJob(tenantId, jobId),
      database.latestProfileVersion(tenantId),
    ]);
    if (!job) throw new Error("JOB_NOT_FOUND");
    if (!profile) throw new Error("PROFILE_VERSION_REQUIRED");

    const evidence = await database.listEvidenceByIds(tenantId, profile.claimIds);
    const confirmed = evidence.filter((claim) => claim.status === "confirmed");
    if (
      confirmed.length !== profile.claimIds.length ||
      new Set(confirmed.map((claim) => claim.id)).size !== profile.claimIds.length
    ) {
      throw new Error("PROFILE_EVIDENCE_CHANGED");
    }

    const result = matchJob({
      job: {
        id: job.id,
        title: job.title,
        company: job.company,
        description: job.description,
        requirements: job.requirements,
        location: job.location,
        workMode: job.workMode,
        roleFamily: job.roleFamily,
        descriptionLocator: job.url || `${job.source}:${job.sourceJobId}`,
        observedAt: job.availability.lastSeenAt,
      },
      evidence: confirmed,
    });
    const inputHash = canonicalHash({
      job: {
        id: job.id,
        contentHash: job.contentHash,
        title: job.title,
        company: job.company,
        description: job.description,
        requirements: job.requirements,
        location: job.location,
        workMode: job.workMode,
        roleFamily: job.roleFamily,
        descriptionLocator: job.url || `${job.source}:${job.sourceJobId}`,
        observedAt: job.availability.lastSeenAt,
      },
      profile: {
        id: profile.id,
        inputHash: profile.inputHash,
        claimIds: profile.claimIds.toSorted(),
      },
      ruleVersion: result.ruleVersion,
    });
    const saved = await database.saveMatch(tenantId, job.id, profile.id, result, inputHash);
    const receipt = createReceipt({
      id: randomUUID(),
      type: "match.published",
      occurredAt: new Date().toISOString(),
      input: {
        jobId: job.id,
        profileVersionId: profile.id,
        inputHash,
        source,
      },
      artifact: {
        artifactHash: saved.artifactHash,
        ruleVersion: saved.ruleVersion,
        band: result.band,
      },
    });
    await database.saveReceipt(tenantId, receipt, {
      jobId: job.id,
      matchRunId: saved.id,
      profileVersionId: profile.id,
      jobContentHash: job.contentHash,
      evidenceIds: uniqueEvidenceIds(result),
    });
    return saved;
  });
}
