export const SUBMISSION_CHANNELS = ["employer_portal", "email", "referral", "other"] as const;

export type SubmissionChannel = (typeof SUBMISSION_CHANNELS)[number];

export const PACKET_ARTIFACT_FORMATS = [
  "json",
  "txt",
  "modern_docx",
  "modern_pdf",
  "ats_docx",
  "ats_pdf",
] as const;

export type PacketArtifactFormat = (typeof PACKET_ARTIFACT_FORMATS)[number];

export type CandidateSubmissionInput = Readonly<{
  materialsCaptured: boolean;
  packetId: string | null;
  artifactFormats: PacketArtifactFormat[];
  channel: SubmissionChannel;
  destination: string;
  submittedAt: string;
}>;

const MAX_DESTINATION_LENGTH = 500;
const CLOCK_SKEW_MS = 5 * 60 * 1_000;

function clean(value: string): string {
  return value.normalize("NFC").trim();
}

/**
 * Validate the candidate-authored part of a Submission Record. Packet
 * ownership, currentness, approval, hashes, and available formats belong to
 * persistence because they require one tenant-locked database snapshot.
 */
export function normalizeCandidateSubmission(
  input: CandidateSubmissionInput,
  now = new Date(),
): CandidateSubmissionInput {
  if (!SUBMISSION_CHANNELS.includes(input.channel)) throw new Error("INVALID_SUBMISSION_CHANNEL");
  const destination = clean(input.destination);
  if (!destination || destination.length > MAX_DESTINATION_LENGTH) {
    throw new Error("INVALID_SUBMISSION_DESTINATION");
  }
  const submittedAtMs = Date.parse(input.submittedAt);
  if (!Number.isFinite(submittedAtMs) || submittedAtMs > now.getTime() + CLOCK_SKEW_MS) {
    throw new Error("INVALID_SUBMISSION_TIME");
  }
  const artifactFormats = [...new Set(input.artifactFormats)];
  if (
    artifactFormats.some((format) => !PACKET_ARTIFACT_FORMATS.includes(format)) ||
    artifactFormats.length !== input.artifactFormats.length
  ) {
    throw new Error("INVALID_SUBMISSION_FORMATS");
  }
  const packetId = input.packetId ? clean(input.packetId) : null;
  if (input.materialsCaptured) {
    if (!packetId) throw new Error("SUBMISSION_PACKET_REQUIRED");
    if (artifactFormats.length === 0) throw new Error("SUBMISSION_FORMAT_REQUIRED");
  } else if (packetId || artifactFormats.length > 0) {
    throw new Error("SUBMISSION_MATERIALS_CONFLICT");
  }
  return {
    materialsCaptured: input.materialsCaptured,
    packetId,
    artifactFormats,
    channel: input.channel,
    destination,
    submittedAt: new Date(submittedAtMs).toISOString(),
  };
}
