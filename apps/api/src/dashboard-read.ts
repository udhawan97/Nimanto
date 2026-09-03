import { type SessionIdentity, NimantoStore } from "@nimanto/database";
import { freshH1bLabel } from "@nimanto/domain";
import { JOB_SOURCE_REGISTRY, routeAtsLink } from "@nimanto/providers";
import type { ExternalActionCapability } from "./external-action-lifecycle.js";

export class DashboardRead {
  constructor(
    private readonly store: NimantoStore,
    private readonly externalActionCapability: (
      tenantId: string,
    ) => Promise<ExternalActionCapability>,
  ) {}

  /** Assemble one tenant-scoped Dashboard from a coherent database view. Exact
   * latest-record selection stays in persistence; this module owns query
   * orchestration, enrichment, and counts-only candidate outcome aggregation.
   * The read uses the same REPEATABLE READ READ ONLY snapshot seam as export,
   * so no Dashboard query can write. */
  read(person: SessionIdentity) {
    return this.store.readSnapshot(async (database) => {
      const [
        evidence,
        jobs,
        matches,
        signals,
        applications,
        packets,
        actions,
        receipts,
        profile,
        schedules,
        discoveryProfile,
        sourceRuns,
        latestRoleObservations,
        latestVerificationAttempts,
        roleWordingReviews,
        careerOperations,
        runtime,
      ] = await Promise.all([
        database.listEvidence(person.tenantId),
        database.listJobs(person.tenantId),
        database.listLatestMatches(person.tenantId),
        database.listH1bSignals(person.tenantId),
        database.listApplications(person.tenantId),
        database.listLatestPackets(person.tenantId),
        database.listExternalActions(person.tenantId),
        database.listReceipts(person.tenantId),
        database.latestProfileVersion(person.tenantId),
        database.listSourceSchedules(person.tenantId),
        database.latestDiscoveryProfile(person.tenantId),
        database.listSourceRuns(person.tenantId),
        database.listLatestRoleObservations(person.tenantId),
        database.listLatestVerificationAttempts(person.tenantId),
        database.listRoleWordingReviews(person.tenantId),
        database.readCareerOperations(person.tenantId, false),
        this.externalActionCapability(person.tenantId),
      ]);
      const actionPackets = await database.listPacketsByIds(
        person.tenantId,
        actions.map((action) => action.packetId).filter((id): id is string => id !== null),
      );
      const assurancePackets = [
        ...new Map([...packets, ...actionPackets].map((packet) => [packet.id, packet])).values(),
      ];
      const assurances = await database.listLatestAssurancesForPackets(
        person.tenantId,
        assurancePackets.map((packet) => packet.id),
      );
      const assuranceByPacket = new Map(
        assurances.map((assurance) => [assurance.packetId, assurance]),
      );
      const activitiesByApplication = new Map<string, typeof careerOperations.activities>();
      for (const activity of careerOperations.activities) {
        const activities = activitiesByApplication.get(activity.applicationId);
        if (activities) activities.push(activity);
        else activitiesByApplication.set(activity.applicationId, [activity]);
      }
      const sourceRunById = new Map(sourceRuns.map((run) => [run.id, run]));
      const observationByJob = new Map(
        latestRoleObservations.map((observation) => [observation.jobId, observation]),
      );
      const verificationByJob = new Map(
        latestVerificationAttempts.map((attempt) => [attempt.jobId, attempt]),
      );
      const evidenceText = (evidence: Record<string, unknown>, key: string) => {
        const value = evidence[key];
        return typeof value === "string" && value ? value : null;
      };
      const withAtsRoute = <T extends (typeof jobs)[number]>(job: T) => ({
        ...job,
        atsRoute: routeAtsLink({
          source: job.source,
          sourceJobId: job.sourceJobId,
          url: job.url,
          sourceMeta: job.sourceMeta,
        }),
        provenance: (() => {
          const observation = observationByJob.get(job.id) ?? null;
          const verificationAttempt = verificationByJob.get(job.id) ?? null;
          const sourceRun = observation?.sourceRunId
            ? (sourceRunById.get(observation.sourceRunId) ?? null)
            : null;
          const verificationSourceRun = verificationAttempt?.sourceRunId
            ? (sourceRunById.get(verificationAttempt.sourceRunId) ?? null)
            : null;
          return {
            observation: observation
              ? {
                  id: observation.id,
                  sourceRunId: observation.sourceRunId,
                  observedAt: observation.observedAt,
                  contentHash: observation.contentHash,
                  sourcePayloadHash: observation.sourcePayloadHash,
                  normalizerVersion: observation.normalizerVersion,
                }
              : null,
            verificationAttempt: verificationAttempt
              ? {
                  id: verificationAttempt.id,
                  sourceRunId: verificationAttempt.sourceRunId,
                  attemptedAt: verificationAttempt.attemptedAt,
                  authority: verificationAttempt.authority,
                  method: verificationAttempt.method,
                  result: verificationAttempt.result,
                  responseFingerprint: evidenceText(
                    verificationAttempt.evidence,
                    "responseFingerprint",
                  ),
                  policyVersion:
                    evidenceText(verificationAttempt.evidence, "verificationPolicyVersion") ??
                    evidenceText(verificationAttempt.evidence, "ruleVersion"),
                  failureCode:
                    evidenceText(verificationAttempt.evidence, "failureCode") ??
                    evidenceText(verificationAttempt.evidence, "errorCode"),
                }
              : null,
            sourceRun,
            verificationSourceRun,
          };
        })(),
      });

      return {
        identity: person,
        profile,
        evidence,
        jobs: jobs.map(withAtsRoute),
        matches: matches.map((match) => ({ ...match, job: withAtsRoute(match.job) })),
        h1bSignals: signals.map((signal) => ({ ...signal, ...freshH1bLabel(signal) })),
        roleWordingReviews,
        careerOperations,
        applications: applications.map((application) => ({
          ...application,
          activities: activitiesByApplication.get(application.id) ?? [],
        })),
        packets: packets.map((packet) => ({
          ...packet,
          latestAssurance: assuranceByPacket.get(packet.id) ?? null,
        })),
        actionPackets: actionPackets.map((packet) => ({
          ...packet,
          latestAssurance: assuranceByPacket.get(packet.id) ?? null,
        })),
        externalActions: actions,
        receipts,
        schedules,
        discoveryProfile,
        sourceRuns,
        sourceRegistry: JOB_SOURCE_REGISTRY,
        personalFunnel: {
          sampleSize: applications.length,
          replies: applications.filter((application) =>
            application.outcomes?.some((outcome) => outcome.type === "reply"),
          ).length,
          screens: applications.filter((application) =>
            application.outcomes?.some((outcome) => outcome.type === "screen"),
          ).length,
          interviews: applications.filter((application) =>
            application.outcomes?.some((outcome) => outcome.type === "interview"),
          ).length,
          offers: applications.filter((application) =>
            application.outcomes?.some((outcome) => outcome.type === "offer"),
          ).length,
          scope: "Candidate-reported outcomes in this local workspace; not a hiring probability.",
        },
        runtime,
      };
    });
  }
}
