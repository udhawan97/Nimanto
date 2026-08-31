export type EvidenceStatus = "pending" | "confirmed" | "rejected" | "superseded";
export type EvidenceConfidence = "high" | "medium" | "low";
export type EvidenceState =
  "supported" | "user_attested" | "inferred" | "missing" | "unknown" | "blocker";

export type MatchBand =
  "strong_evidence" | "promising_evidence" | "partial_evidence" | "weak_evidence" | "not_scored";

export type EvidenceStrength = "source_strong" | "source_mixed" | "source_limited";
export type CoverageState = "coverage_sufficient" | "coverage_low";

export interface EvidenceStrengthBasis {
  ruleVersion: "evidence_strength_unweighted_v1";
  calculation: "unweighted_supported_requirements";
  supportedRequirementCount: number;
  sourceLinkedRequirementCount: number;
  candidateAttestedOnlyRequirementCount: number;
  thresholdPerThousand: {
    sourceStrong: 800;
    sourceMixed: 500;
  };
}

export interface EvidenceClaim {
  id: string;
  kind:
    | "employment"
    | "education"
    | "project"
    | "certification"
    | "accomplishment"
    | "skill"
    | "preference"
    | "authorization_wording";
  value: string;
  status: EvidenceStatus;
  confidence: EvidenceConfidence;
  sourceName: string;
  locator: string;
  userAttested?: boolean;
}

export interface JobForMatching {
  id: string;
  title: string;
  company: string;
  description: string;
  requirements: string[];
  location?: string;
  workMode?: string;
  roleFamily?: import("./marketplace.js").RoleFamily;
  descriptionLocator?: string;
  observedAt?: string | undefined;
}

export interface RequirementExplanation {
  requirement: string;
  state: EvidenceState;
  evidenceIds: string[];
  reason: string;
}

export interface MatchBlocker {
  code:
    | "no_sponsorship_of_any_kind"
    | "citizenship_required"
    | "clearance_required"
    | "location_conflict";
  sourceText: string;
  sourceLocator?: string;
  observedAt?: string | undefined;
  candidateConfirmed?: boolean;
  consequence: "visible_warning" | "exclude_from_recommendations";
}

export interface MatchDimension {
  name:
    | "required_qualifications"
    | "relevant_accomplishments"
    | "role_level_alignment"
    | "skills_domain_overlap";
  state: "supported" | "partial" | "missing" | "unknown";
  weightUnits: 35 | 30 | 20 | 15;
  evidenceIds: string[];
}

export interface MatchResult {
  ruleVersion: "scoring_rules_v1";
  band: MatchBand;
  coverage: CoverageState;
  evidenceStrength: EvidenceStrength;
  evidenceStrengthBasis: EvidenceStrengthBasis;
  requirements: RequirementExplanation[];
  dimensions: MatchDimension[];
  blockers: MatchBlocker[];
  exclusions: string[];
}

export type ApplicationStatus =
  "tracked" | "prepared" | "approved_for_export" | "submitted_externally" | "withdrawn";

export type OutcomeType = "reply" | "screen" | "interview" | "offer" | "rejection" | "withdrawal";

export type H1bSignalLabel =
  | "current_role_transfer_support"
  | "current_company_policy_support"
  | "recent_positive_history"
  | "possible"
  | "uncertain"
  | "no_sponsorship_of_any_kind"
  | "no_new_cap_petitions"
  | "no_permanent_sponsorship"
  | "unspecified_negative";

export type ExternalActionProvider = "deep_link" | "test_outbox";

export type ExternalActionState =
  | "draft"
  | "pending_approval"
  | "approved"
  | "executing"
  | "succeeded"
  | "failed"
  | "ambiguous"
  | "cancelled";
