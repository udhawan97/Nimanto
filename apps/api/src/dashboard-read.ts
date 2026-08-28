import { type SessionIdentity, NimantoStore } from "@nimanto/database";
import { freshH1bLabel } from "@nimanto/domain";
import { JOB_SOURCE_REGISTRY, routeAtsLink } from "@nimanto/providers";

export class DashboardRead {
  constructor(
    private readonly store: NimantoStore,
    private readonly externalActionsEnabled: () => boolean,
  ) {}

  /** Assemble one tenant-scoped Dashboard from a coherent database view. Exact
   * latest-record selection stays in persistence; this module owns query
   * orchestration, enrichment, and counts-only candidate outcome aggregation. */
  read(person: SessionIdentity) {
    return this.store.transaction(async (database) => {
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
      const withAtsRoute = <T extends (typeof jobs)[number]>(job: T) => ({
        ...job,
        atsRoute: routeAtsLink({
          source: job.source,
          sourceJobId: job.sourceJobId,
          url: job.url,
          sourceMeta: job.sourceMeta,
        }),
      });

      return {
        identity: person,
        profile,
        evidence,
        jobs: jobs.map(withAtsRoute),
        matches: matches.map((match) => ({ ...match, job: withAtsRoute(match.job) })),
        h1bSignals: signals.map((signal) => ({ ...signal, ...freshH1bLabel(signal) })),
        applications,
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
        runtime: { externalActionsEnabled: this.externalActionsEnabled() },
      };
    });
  }
}
