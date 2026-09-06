import type {
  EvidenceClaim,
  EvidenceStrength,
  EvidenceStrengthBasis,
  JobForMatching,
  MatchBand,
  MatchBlocker,
  MatchDimension,
  MatchResult,
  RequirementExplanation,
} from "./types.js";
import { isValidatedRoleFamily } from "./marketplace.js";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "be",
  "build",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
  "work",
]);

const IDENTITY_PATTERNS = [
  /\b(?:graduated|graduation|class of)\s+(?:19|20)\d{2}\b/giu,
  /\b(?:19|20)\d{2}\b/gu,
  /\b(?:he|him|his|she|her|hers|they|them|theirs)\b/giu,
];

function tokens(value: string): string[] {
  const normalized = value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ");

  return normalized
    .split(/\s+/u)
    .map((token) => token.replace(/(?:ing|ed|es)$/u, ""))
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function normalizedCandidateProjection(claim: EvidenceClaim): string {
  let value = claim.value.normalize("NFKC");
  const dashIndex = value.indexOf("—");
  if (dashIndex > 0 && dashIndex < 60) value = value.slice(dashIndex + 1);
  for (const pattern of IDENTITY_PATTERNS) value = value.replace(pattern, " ");
  return unique(tokens(value)).sort().join(" ");
}

function evidenceMatches(requirement: string, evidence: EvidenceClaim[]): EvidenceClaim[] {
  const requirementTokens = new Set(tokens(requirement));
  if (requirementTokens.size === 0) return [];

  return evidence.filter((claim) => {
    const claimTokens = new Set(tokens(normalizedCandidateProjection(claim)));
    let overlap = 0;
    for (const token of requirementTokens) if (claimTokens.has(token)) overlap += 1;
    return overlap >= Math.max(1, Math.ceil(requirementTokens.size * 0.5));
  });
}

function blockerText(job: JobForMatching): MatchBlocker[] {
  const result: MatchBlocker[] = [];
  const checks: Array<{
    code: MatchBlocker["code"];
    pattern: RegExp;
    consequence: MatchBlocker["consequence"];
  }> = [
    {
      code: "no_sponsorship_of_any_kind",
      pattern:
        /(?:cannot|can't|unable to|do not|don't|no)\s+(?:provide\s+)?(?:sponsor|sponsorship|visa)|without\s+(?:current or future\s+)?sponsorship/iu,
      consequence: "visible_warning",
    },
    {
      code: "citizenship_required",
      pattern: /(?:u\.?s\.?|united states)\s+citizen(?:ship)?\s+(?:is\s+)?required/iu,
      consequence: "visible_warning",
    },
    {
      code: "clearance_required",
      pattern: /(?:active\s+)?(?:security|secret|top secret)\s+clearance\s+(?:is\s+)?required/iu,
      consequence: "visible_warning",
    },
  ];

  for (const check of checks) {
    const match = job.description.match(check.pattern);
    if (match?.[0]) {
      result.push({
        code: check.code,
        sourceText: match[0],
        sourceLocator: job.descriptionLocator ?? `role:${job.id}:description`,
        observedAt: job.observedAt,
        candidateConfirmed: false,
        consequence: check.consequence,
      });
    }
  }
  return result;
}

function locationBlockers(job: JobForMatching, evidence: EvidenceClaim[]): MatchBlocker[] {
  const preferences = evidence.filter(
    (claim) => claim.status === "confirmed" && claim.kind === "preference",
  );
  const workMode = job.workMode?.toLocaleLowerCase("en-US") ?? "";
  const location = job.location?.toLocaleLowerCase("en-US") ?? "";
  for (const preference of preferences) {
    const value = preference.value.toLocaleLowerCase("en-US");
    if (/\bremote[- ]only\b|\brequire(?:s|d)? remote\b/u.test(value) && workMode === "onsite") {
      return [
        {
          code: "location_conflict",
          sourceText: `${job.workMode ?? "onsite"}: ${job.location ?? "location unspecified"}`,
          consequence: "visible_warning",
        },
      ];
    }
    const exact = /\blocation:\s*([^,;]+?)\s+only\b/u.exec(value)?.[1]?.trim();
    if (exact && location && !location.includes(exact)) {
      return [
        {
          code: "location_conflict",
          sourceText: job.location ?? "location unspecified",
          consequence: "visible_warning",
        },
      ];
    }
  }
  return [];
}

function stateFromRatio(value: number): MatchDimension["state"] {
  if (value >= 0.8) return "supported";
  if (value >= 0.4) return "partial";
  return "missing";
}

function bandFromValue(value: number): MatchBand {
  if (value >= 0.8) return "strong_evidence";
  if (value >= 0.65) return "promising_evidence";
  if (value >= 0.45) return "partial_evidence";
  return "weak_evidence";
}

/* The contract defines this as the share of supported requirements backed by
 * source-linked evidence "rather than only user_attested evidence". Counting
 * `evidenceIds.length > 0` measured nothing: a requirement is only `supported`
 * when it has matches, so that ratio was always 1 and source_mixed was
 * unreachable. A requirement counts as sourced when at least one of the claims
 * behind it carries a source rather than the candidate's own attestation. */
function evidenceStrength(
  explanations: RequirementExplanation[],
  evidence: EvidenceClaim[],
): { value: EvidenceStrength; basis: EvidenceStrengthBasis } {
  const supported = explanations.filter((item) => item.state === "supported");
  const attested = new Set(
    evidence.filter((claim) => claim.userAttested === true).map((claim) => claim.id),
  );
  const sourced = supported.filter((item) =>
    item.evidenceIds.some((id) => !attested.has(id)),
  ).length;
  const linked = supported.length > 0 ? sourced / supported.length : 0;
  const value: EvidenceStrength =
    linked >= 0.8 ? "source_strong" : linked >= 0.5 ? "source_mixed" : "source_limited";
  return {
    value,
    basis: {
      ruleVersion: "evidence_strength_unweighted_v1",
      calculation: "unweighted_supported_requirements",
      supportedRequirementCount: supported.length,
      sourceLinkedRequirementCount: sourced,
      candidateAttestedOnlyRequirementCount: supported.length - sourced,
      thresholdPerThousand: { sourceStrong: 800, sourceMixed: 500 },
    },
  };
}

export function matchJob(input: { evidence: EvidenceClaim[]; job: JobForMatching }): MatchResult {
  const evidence = input.evidence.filter((claim) => claim.status === "confirmed");
  const requirements: RequirementExplanation[] = input.job.requirements.map((requirement) => {
    const matches = evidenceMatches(requirement, evidence);
    return {
      requirement,
      state: matches.length > 0 ? "supported" : "missing",
      evidenceIds: matches.map((claim) => claim.id),
      reason:
        matches.length > 0
          ? `Supported by ${matches.length} confirmed evidence item${matches.length === 1 ? "" : "s"}.`
          : "No confirmed evidence currently supports this requirement.",
    };
  });

  const supported = requirements.filter((item) => item.state === "supported");
  const coverageValue = requirements.length > 0 ? supported.length / requirements.length : 0;
  const qualificationRatio = requirements.length > 0 ? supported.length / requirements.length : 0;
  const accomplishmentIds = unique(
    supported.flatMap((item) =>
      evidence
        .filter(
          (claim) =>
            item.evidenceIds.includes(claim.id) &&
            (claim.kind === "accomplishment" || claim.kind === "project"),
        )
        .map((claim) => claim.id),
    ),
  );
  const roleTokens = new Set(tokens(input.job.title));
  const levelEvidence = evidence.filter(
    (claim) =>
      claim.kind === "employment" &&
      tokens(normalizedCandidateProjection(claim)).some((token) => roleTokens.has(token)),
  );
  const allJobTokens = new Set(tokens(`${input.job.title} ${input.job.description}`));
  const skillEvidence = evidence.filter((claim) =>
    tokens(normalizedCandidateProjection(claim)).some((token) => allJobTokens.has(token)),
  );

  const accomplishmentRatio = accomplishmentIds.length > 0 ? 1 : qualificationRatio * 0.5;
  const levelRatio = levelEvidence.length > 0 ? 1 : 0.35;
  const skillsRatio =
    evidence.length > 0 ? Math.min(1, skillEvidence.length / Math.min(3, evidence.length)) : 0;
  const score =
    qualificationRatio * 0.35 + accomplishmentRatio * 0.3 + levelRatio * 0.2 + skillsRatio * 0.15;
  const roleFamilyValidated = input.job.roleFamily
    ? isValidatedRoleFamily(input.job.roleFamily)
    : true;

  const dimensions: MatchDimension[] = [
    {
      name: "required_qualifications",
      state: requirements.length === 0 ? "unknown" : stateFromRatio(qualificationRatio),
      weightUnits: 35,
      evidenceIds: unique(supported.flatMap((item) => item.evidenceIds)),
    },
    {
      name: "relevant_accomplishments",
      state: stateFromRatio(accomplishmentRatio),
      weightUnits: 30,
      evidenceIds: accomplishmentIds,
    },
    {
      name: "role_level_alignment",
      state: stateFromRatio(levelRatio),
      weightUnits: 20,
      evidenceIds: levelEvidence.map((claim) => claim.id),
    },
    {
      name: "skills_domain_overlap",
      state: stateFromRatio(skillsRatio),
      weightUnits: 15,
      evidenceIds: skillEvidence.map((claim) => claim.id),
    },
  ];
  const strength = evidenceStrength(requirements, evidence);

  return {
    ruleVersion: "scoring_rules_v1",
    band: coverageValue < 0.6 || !roleFamilyValidated ? "not_scored" : bandFromValue(score),
    coverage: coverageValue < 0.6 || !roleFamilyValidated ? "coverage_low" : "coverage_sufficient",
    evidenceStrength: strength.value,
    evidenceStrengthBasis: strength.basis,
    requirements,
    dimensions,
    blockers: [...blockerText(input.job), ...locationBlockers(input.job, evidence)],
    exclusions: [
      "Pronouns, standalone year cues, and a conventional name prefix before an em dash are removed from the normalized free-text match projection.",
      "This local beta does not claim comprehensive de-identification: do not import sensitive identity details as match evidence.",
      "The band is not a hiring probability or immigration determination.",
      ...(!roleFamilyValidated
        ? ["This role family is experimental_unvalidated and is not given a fit band."]
        : []),
    ],
  };
}
