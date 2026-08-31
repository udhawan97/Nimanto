export type MatchEvidenceStrengthBasis = {
  ruleVersion: string;
  calculation: string;
  supportedRequirementCount: number;
  sourceLinkedRequirementCount: number;
  candidateAttestedOnlyRequirementCount: number;
  thresholdPerThousand: { sourceStrong: number; sourceMixed: number };
};

export type MatchEvidenceResult = {
  ruleVersion: string;
  band: string;
  coverage: string;
  evidenceStrength?: string;
  evidenceStrengthBasis?: MatchEvidenceStrengthBasis;
  requirements: Array<{ state: string }>;
};

export type MatchEvidenceLensProjection = {
  supportedRequirementCount: number;
  requirementCount: number;
  sourceLinkedRequirementCount: number | null;
  candidateAttestedOnlyRequirementCount: number | null;
  strength: string;
  strengthRuleVersion: string | null;
  sourceLinkageSummary: string;
  calculationLimit: string;
};

export function projectMatchEvidenceLens(result: MatchEvidenceResult): MatchEvidenceLensProjection {
  const supportedRequirementCount = result.requirements.filter(
    (requirement) => requirement.state === "supported",
  ).length;
  const basis = result.evidenceStrengthBasis;
  if (!basis) {
    return {
      supportedRequirementCount,
      requirementCount: result.requirements.length,
      sourceLinkedRequirementCount: null,
      candidateAttestedOnlyRequirementCount: null,
      strength: result.evidenceStrength ?? "not_recorded",
      strengthRuleVersion: null,
      sourceLinkageSummary:
        "Exact source-linkage counts were not stored with this historical Match Publication.",
      calculationLimit:
        "This historical result keeps its stored ordinal. Re-run the explanation to record an inspectable calculation basis.",
    };
  }

  const supported = Math.max(0, basis.supportedRequirementCount);
  const sourced = Math.min(supported, Math.max(0, basis.sourceLinkedRequirementCount));
  const attestedOnly = Math.min(
    supported - sourced,
    Math.max(0, basis.candidateAttestedOnlyRequirementCount),
  );
  return {
    supportedRequirementCount,
    requirementCount: result.requirements.length,
    sourceLinkedRequirementCount: sourced,
    candidateAttestedOnlyRequirementCount: attestedOnly,
    strength: result.evidenceStrength ?? "not_recorded",
    strengthRuleVersion: basis.ruleVersion,
    sourceLinkageSummary:
      supported === 0
        ? "No supported requirements are available for a source-linkage assessment."
        : `${sourced} of ${supported} supported requirement${supported === 1 ? "" : "s"} include source-linked evidence; ${attestedOnly} rely only on candidate attestation.`,
    calculationLimit:
      "Source linkage currently uses an unweighted count of supported requirements. It does not change the fit band.",
  };
}
