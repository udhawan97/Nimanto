type DossierSubmission = {
  id: string;
  packetId: string | null;
  materialsCaptured: boolean;
  artifactFormats: string[];
  channel: string;
  destination: string;
  submittedAt: string;
  packetArtifactHash: string | null;
};

type DossierApplication = {
  id: string;
  jobId: string;
  outcomes?: unknown[];
  notes?: unknown[];
  statusEvents?: unknown[];
  submissions?: DossierSubmission[];
};

type ApplicationOwned = { applicationId: string };
type PacketLike = ApplicationOwned & { id: string };
type ActionLike = { packetId: string | null };
type ContactLike = { applicationLinks: Array<{ applicationId: string }> };

export function projectApplicationDossier<
  TJob,
  TMatch,
  TPacket extends PacketLike,
  TAction extends ActionLike,
  TReceipt extends { material?: unknown },
>(input: {
  application: DossierApplication;
  jobs: Array<TJob & { id: string }>;
  matches: Array<TMatch & { jobId: string }>;
  packets: TPacket[];
  actionPackets: TPacket[];
  actions: TAction[];
  receipts: TReceipt[];
  careerOperations: {
    activities: ApplicationOwned[];
    contacts: ContactLike[];
    interviews: ApplicationOwned[];
    offers: ApplicationOwned[];
  };
}) {
  const applicationId = input.application.id;
  const packetMap = new Map(
    [...input.packets, ...input.actionPackets]
      .filter((packet) => packet.applicationId === applicationId)
      .map((packet) => [packet.id, packet]),
  );
  const packetIds = new Set(packetMap.keys());
  return {
    application: input.application,
    job: input.jobs.find((job) => job.id === input.application.jobId) ?? null,
    match: input.matches.find((match) => match.jobId === input.application.jobId) ?? null,
    packets: [...packetMap.values()],
    actions: input.actions.filter((action) => action.packetId && packetIds.has(action.packetId)),
    receipts: input.receipts.filter((receipt) => {
      const material = receipt.material;
      if (!material || typeof material !== "object" || Array.isArray(material)) return false;
      const record = material as Record<string, unknown>;
      return (
        record.applicationId === applicationId ||
        (typeof record.packetId === "string" && packetIds.has(record.packetId))
      );
    }),
    activities: input.careerOperations.activities.filter(
      (activity) => activity.applicationId === applicationId,
    ),
    contacts: input.careerOperations.contacts.filter((contact) =>
      contact.applicationLinks.some((link) => link.applicationId === applicationId),
    ),
    interviews: input.careerOperations.interviews.filter(
      (interview) => interview.applicationId === applicationId,
    ),
    offers: input.careerOperations.offers.filter((offer) => offer.applicationId === applicationId),
    outcomes: input.application.outcomes ?? [],
    notes: input.application.notes ?? [],
    statusEvents: input.application.statusEvents ?? [],
    submissions: input.application.submissions ?? [],
  };
}
