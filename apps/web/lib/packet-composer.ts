type ComposerEvidence = {
  id: string;
  status: string;
  value: string;
  kind: string;
  sourceName: string;
  locator: string;
};

type ComposerApplication = { jobId: string; profileVersionId: string | null };
type ComposerProfile = { id: string; claimIds: string[] };
type ComposerJob = { id: string; contentHash: string };
type ComposerMatch = {
  id: string;
  jobId: string;
  profileVersionId: string | null;
  jobContentHash: string;
  result: {
    requirements: Array<{ requirement: string; state: string; evidenceIds: string[] }>;
  };
};

export type PacketEvidenceOption = ComposerEvidence & {
  requirements: string[];
};

export type PacketComposerProjection =
  | { ready: false; reason: string; options: PacketEvidenceOption[]; matchId: null }
  | { ready: true; reason: null; options: PacketEvidenceOption[]; matchId: string };

/**
 * Build the exact candidate-selectable evidence inventory for one Application.
 * The server repeats every currentness check under the tenant lock; this pure
 * projection exists for preview and clear fail-closed guidance only.
 */
export function projectPacketComposer(input: {
  application: ComposerApplication;
  profile: ComposerProfile | null;
  job: ComposerJob | null;
  match: ComposerMatch | null;
  evidence: ComposerEvidence[];
}): PacketComposerProjection {
  const profile = input.profile;
  if (!profile || input.application.profileVersionId !== profile.id) {
    return {
      ready: false,
      reason: "Save the Application's exact Profile Version first.",
      options: [],
      matchId: null,
    };
  }
  const job = input.job;
  const match = input.match;
  if (
    !job ||
    !match ||
    match.jobId !== input.application.jobId ||
    match.profileVersionId !== profile.id ||
    match.jobContentHash !== job.contentHash
  ) {
    return {
      ready: false,
      reason: "Publish a current Match for this exact Role and Profile before composing.",
      options: [],
      matchId: null,
    };
  }
  const evidenceById = new Map(input.evidence.map((claim) => [claim.id, claim]));
  const options = profile.claimIds.flatMap((id) => {
    const claim = evidenceById.get(id);
    if (!claim || claim.status !== "confirmed") return [];
    const requirements = match.result.requirements
      .filter((requirement) => requirement.evidenceIds.includes(id))
      .map((requirement) => requirement.requirement);
    return [{ ...claim, requirements }];
  });
  if (options.length === 0) {
    return {
      ready: false,
      reason: "This Profile has no confirmed evidence available for a Packet.",
      options: [],
      matchId: null,
    };
  }
  return { ready: true, reason: null, options, matchId: match.id };
}

export function movePacketEvidence(
  evidenceIds: readonly string[],
  id: string,
  direction: -1 | 1,
): string[] {
  const from = evidenceIds.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= evidenceIds.length) return [...evidenceIds];
  const next = [...evidenceIds];
  [next[from], next[to]] = [next[to]!, next[from]!];
  return next;
}
