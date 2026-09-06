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
  | {
      ready: false;
      reason: string;
      rebindAvailable: boolean;
      options: PacketEvidenceOption[];
      matchId: null;
    }
  | {
      ready: true;
      reason: null;
      rebindAvailable: false;
      options: PacketEvidenceOption[];
      matchId: string;
    };

/* An Application is pinned to the Profile Version it was created against. Once
 * the candidate saves a newer one, every composer, action and submission path
 * for that Application fails closed, so the gap has to name both versions and
 * say which single recovery clears it. Null means the Application predates any
 * Profile Version, which the same rebind fixes. */
export function profileVersionRebindReason(
  application: { profileVersionId: string | null },
  profile: { id: string } | null,
): string | null {
  if (!profile || application.profileVersionId === profile.id) return null;
  const latest = `the latest Profile Version is ${profile.id.slice(0, 8)}.`;
  return application.profileVersionId
    ? `This Application is bound to Profile Version ${application.profileVersionId.slice(0, 8)}; ${latest}`
    : `This Application is not bound to a Profile Version; ${latest}`;
}

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
  const rebindReason = profileVersionRebindReason(input.application, profile);
  if (!profile || rebindReason) {
    return {
      ready: false,
      reason: rebindReason ?? "Save the Application's exact Profile Version first.",
      rebindAvailable: rebindReason !== null,
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
      rebindAvailable: false,
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
      rebindAvailable: false,
      options: [],
      matchId: null,
    };
  }
  return { ready: true, reason: null, rebindAvailable: false, options, matchId: match.id };
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
