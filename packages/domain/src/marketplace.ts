export const WORKPLACE_MODES = ["remote", "hybrid", "onsite", "unknown", "conflicting"] as const;
export type WorkplaceMode = (typeof WORKPLACE_MODES)[number];

export type RoleFamily =
  | "ai_ml"
  | "software_technical"
  | "data_analytics"
  | "product"
  | "business_strategy_operations_solutions"
  | "other";

export const VALIDATED_ROLE_FAMILIES: ReadonlySet<RoleFamily> = new Set([
  "ai_ml",
  "software_technical",
]);

export type StructuredArea = Readonly<{
  displayLabel: string;
  countryCode: string | null;
  subdivisionCode: string | null;
  metroId: string | null;
  timeZone: string | null;
  resolution: "confirmed" | "unknown";
}>;

export type WorkplaceEvidence = Readonly<{
  mode: WorkplaceMode;
  method: "source_structured" | "posting_text" | "candidate_reviewed" | "unknown";
  sourceText: string;
  sourceFieldOrLocator: string;
  observedAt: string;
  normalizerVersion: "workplace_normalizer_v1";
  confidence: "high" | "medium" | "low";
  eligibleRemoteAreas: readonly StructuredArea[];
  physicalLocations: readonly StructuredArea[];
}>;

export type PublicationState = "active" | "possibly_closed" | "closed" | "expired";
export type VerificationHealth =
  "verified" | "provider_reported" | "blocked" | "overdue" | "unknown";
export type VerificationAuthority =
  | "employer_ats"
  | "licensed_provider"
  | "authorized_employer_page"
  | "candidate_review"
  | "unknown";
export type VerificationMethod =
  | "complete_list"
  | "detail_get"
  | "provider_feed"
  | "structured_employer_page"
  | "valid_through"
  | "manual";
export type VerificationResult =
  "present" | "not_found" | "absent_from_complete_list" | "expired" | "blocked" | "error";

export type DiscoveryProfileInput = Readonly<{
  profileVersionId: string | null;
  roleFamilies: readonly RoleFamily[];
  includeTitles: readonly string[];
  excludeTitles: readonly string[];
  seniorityLevels: readonly string[];
  industries: readonly string[];
  mustHaveSkills: readonly string[];
  preferredSkills: readonly string[];
  acceptedPhysicalAreas: readonly StructuredArea[];
  commuteRadiusMiles: number | null;
  relocationPreference: "no" | "consider" | "yes";
  workModes: readonly WorkplaceMode[];
  eligibleRemoteAreas: readonly StructuredArea[];
  minimumCompensation: Readonly<{ amount: number; currency: string }> | null;
  currentPostingSponsorshipFilter: "show_all" | "hide_confirmed_exact_conflicts_from_recommended";
  authorizationStatementVersionId: string | null;
  authorizationStatementExpiresAt: string | null;
  freshnessMaximumHours: number;
  sourceIds: readonly string[];
  matcherVersion: "scoring_rules_v1";
  normalizerVersion: "discovery_profile_v1";
}>;

export function normalizeWorkplaceMode(value: string | null | undefined): WorkplaceMode {
  const normalized = (value ?? "")
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[ _]+/gu, "-");
  if (["remote", "telecommute", "telework"].includes(normalized)) return "remote";
  if (["hybrid", "flex-hybrid"].includes(normalized)) return "hybrid";
  if (["onsite", "on-site", "in-office", "office"].includes(normalized)) return "onsite";
  if (normalized === "conflicting") return "conflicting";
  return "unknown";
}

export function classifyRoleFamily(title: string): RoleFamily {
  const value = title.normalize("NFKC").toLocaleLowerCase("en-US");
  if (/\b(?:machine learning|ml|artificial intelligence|ai|llm|data scientist)\b/u.test(value)) {
    return "ai_ml";
  }
  if (
    /\b(?:software|developer|engineer|engineering|devops|sre|security|architect)\b/u.test(value)
  ) {
    return "software_technical";
  }
  if (/\b(?:data|analytics|analyst|business intelligence)\b/u.test(value)) {
    return "data_analytics";
  }
  if (/\b(?:product manager|product owner|product operations)\b/u.test(value)) return "product";
  if (/\b(?:strategy|operations|solutions|consultant|business)\b/u.test(value)) {
    return "business_strategy_operations_solutions";
  }
  return "other";
}

export function isValidatedRoleFamily(family: RoleFamily): boolean {
  return VALIDATED_ROLE_FAMILIES.has(family);
}

export function validateStructuredArea(area: StructuredArea): StructuredArea {
  const displayLabel = area.displayLabel.normalize("NFC").trim();
  if (!displayLabel) throw new Error("DISCOVERY_AREA_LABEL_REQUIRED");
  if (area.resolution === "unknown") {
    return {
      displayLabel,
      countryCode: null,
      subdivisionCode: null,
      metroId: null,
      timeZone: null,
      resolution: "unknown",
    };
  }
  const countryCode = area.countryCode?.toUpperCase() ?? null;
  const subdivisionCode = area.subdivisionCode?.toUpperCase() ?? null;
  const timeZone = area.timeZone?.trim() ?? null;
  if (countryCode !== null && !/^[A-Z]{2}$/u.test(countryCode)) {
    throw new Error("DISCOVERY_AREA_COUNTRY_INVALID");
  }
  if (subdivisionCode !== null && !/^[A-Z]{2}-[A-Z0-9]{1,3}$/u.test(subdivisionCode)) {
    throw new Error("DISCOVERY_AREA_SUBDIVISION_INVALID");
  }
  if (timeZone !== null) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
    } catch {
      throw new Error("DISCOVERY_AREA_TIMEZONE_INVALID");
    }
  }
  if (!countryCode && !subdivisionCode && !area.metroId?.trim() && !timeZone) {
    throw new Error("DISCOVERY_AREA_IDENTIFIER_REQUIRED");
  }
  return {
    displayLabel,
    countryCode,
    subdivisionCode,
    metroId: area.metroId?.normalize("NFC").trim() || null,
    timeZone,
    resolution: "confirmed",
  };
}

export function workModeConflict(evidence: readonly WorkplaceEvidence[]): WorkplaceMode {
  const modes = new Set(
    evidence
      .filter((item) => item.confidence === "high" && item.mode !== "unknown")
      .map((item) => item.mode),
  );
  if (modes.size > 1) return "conflicting";
  return modes.values().next().value ?? evidence[0]?.mode ?? "unknown";
}
