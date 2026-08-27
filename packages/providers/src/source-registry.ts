export type JobSourceId =
  | "greenhouse"
  | "lever"
  | "ashby"
  | "smartrecruiters"
  | "adzuna"
  | "jooble"
  | "linkup"
  | "lightcast"
  | "usajobs"
  | "we_work_remotely"
  | "remotive"
  | "linkedin"
  | "indeed"
  | "glassdoor";

export type SourceRegistryEntry = Readonly<{
  id: JobSourceId;
  label: string;
  accessClass: "public_api" | "public_feed" | "licensed_api" | "partner_api";
  state: "candidate" | "approved" | "enabled" | "paused" | "revoked";
  executionEnabled: boolean;
  emergencyPausedAt: string | null;
  owner: string;
  termsUrl: string;
  termsVersion: string;
  termsReviewedAt: string | null;
  commercialUseDecision: "allowed" | "prohibited" | "unclear";
  deepLinkAllowed: boolean;
  derivedFieldsAllowed: boolean;
  rawBodyTtlHours: number;
  normalizedRetentionDays: number;
  deletionUpdateSlaHours: number;
  terminationPurgeRequired: boolean;
  aiOrTrainingUseAllowed: false;
  supportsCompleteSnapshot: boolean;
  attribution: Readonly<{ label: string; linkRequired: boolean }> | null;
  limitation: string;
}>;

const enabledAts = (
  id: Extract<JobSourceId, "greenhouse" | "lever" | "ashby">,
  label: string,
  termsUrl: string,
): SourceRegistryEntry => ({
  id,
  label,
  accessClass: "public_api",
  state: "enabled",
  executionEnabled: true,
  emergencyPausedAt: null,
  owner: "Nimanto local operator",
  termsUrl,
  termsVersion: "reviewed_2026-08-26",
  termsReviewedAt: "2026-08-26",
  commercialUseDecision: "unclear",
  deepLinkAllowed: true,
  derivedFieldsAllowed: true,
  rawBodyTtlHours: 0,
  normalizedRetentionDays: 365,
  deletionUpdateSlaHours: 24,
  terminationPurgeRequired: true,
  aiOrTrainingUseAllowed: false,
  supportsCompleteSnapshot: true,
  attribution: null,
  limitation: "Company-scoped public ATS intake already used by the local workbench.",
});

const disabled = (
  id: JobSourceId,
  label: string,
  accessClass: SourceRegistryEntry["accessClass"],
  termsUrl: string,
  limitation: string,
  commercialUseDecision: SourceRegistryEntry["commercialUseDecision"] = "unclear",
): SourceRegistryEntry => ({
  id,
  label,
  accessClass,
  state: "candidate",
  executionEnabled: false,
  emergencyPausedAt: null,
  owner: "unassigned",
  termsUrl,
  termsVersion: "unapproved_2026-08-26",
  termsReviewedAt: null,
  commercialUseDecision,
  deepLinkAllowed: false,
  derivedFieldsAllowed: false,
  rawBodyTtlHours: 0,
  normalizedRetentionDays: 0,
  deletionUpdateSlaHours: 0,
  terminationPurgeRequired: true,
  aiOrTrainingUseAllowed: false,
  supportsCompleteSnapshot: false,
  attribution: null,
  limitation,
});

export const JOB_SOURCE_REGISTRY: readonly SourceRegistryEntry[] = [
  enabledAts("greenhouse", "Greenhouse", "https://docs.greenhouse.io/job-board.html"),
  enabledAts("lever", "Lever", "https://github.com/lever/postings-api"),
  enabledAts("ashby", "Ashby", "https://developers.ashbyhq.com/docs/public-job-posting-api"),
  disabled(
    "smartrecruiters",
    "SmartRecruiters",
    "public_api",
    "https://developers.smartrecruiters.com/docs/endpoints",
    "Adapter implemented; source-specific rights approval is still required before execution.",
  ),
  disabled(
    "adzuna",
    "Adzuna",
    "licensed_api",
    "https://developer.adzuna.com/docs/terms_of_service",
    "Requires written display, retention, canonical-link, and employer-recheck rights.",
  ),
  disabled(
    "jooble",
    "Jooble",
    "licensed_api",
    "https://help.jooble.org/en/support/solutions/articles/60001448238-rest-api-documentation",
    "Production display, caching, retention, quota, and regional scope are unresolved.",
  ),
  disabled(
    "linkup",
    "LinkUp",
    "licensed_api",
    "https://www.linkup.com/data",
    "Commercial contract and product-specific display/retention rights are required.",
  ),
  disabled(
    "lightcast",
    "Lightcast",
    "licensed_api",
    "https://docs.lightcast.io/lightcast-api/reference/overview-global-job-postings",
    "Commercial contract and product-specific display/retention rights are required.",
  ),
  disabled(
    "usajobs",
    "USAJOBS",
    "public_api",
    "https://developer.usajobs.gov/apirequest/index",
    "Requires approval of Nimanto's declared use plan.",
  ),
  disabled(
    "we_work_remotely",
    "We Work Remotely",
    "public_feed",
    "https://weworkremotely.com/api-terms-and-guidelines",
    "Current terms prohibit using the data to build a job-search service and prohibit storage.",
    "prohibited",
  ),
  disabled(
    "remotive",
    "Remotive",
    "public_api",
    "https://remotive.com/remote-jobs/api",
    "Private/invite workbench use requires explicit approval or a private API agreement.",
  ),
  disabled(
    "linkedin",
    "LinkedIn",
    "partner_api",
    "https://www.linkedin.com/legal/l/job-posting-api-terms",
    "Vetted partner access is required; scraping is prohibited.",
    "prohibited",
  ),
  disabled(
    "indeed",
    "Indeed",
    "partner_api",
    "https://docs.indeed.com/legal-terms/developer-agreement",
    "Written developer approval is required; scraping and product replication are prohibited.",
    "prohibited",
  ),
  disabled(
    "glassdoor",
    "Glassdoor",
    "partner_api",
    "https://www.glassdoor.com/about/terms/",
    "Written permission is required for automated extraction and competitive use.",
    "prohibited",
  ),
];

export function sourceRegistryEntry(id: string): SourceRegistryEntry | null {
  return JOB_SOURCE_REGISTRY.find((entry) => entry.id === id) ?? null;
}

export function assertSourceExecutionEnabled(id: string): SourceRegistryEntry {
  const source = sourceRegistryEntry(id);
  if (!source) throw new Error("SOURCE_NOT_REGISTERED");
  if (source.state !== "enabled" || !source.executionEnabled || source.emergencyPausedAt) {
    throw new Error("SOURCE_EXECUTION_DISABLED");
  }
  return source;
}

export function enabledAtsSourceIds(): Array<"greenhouse" | "lever" | "ashby"> {
  return JOB_SOURCE_REGISTRY.filter(
    (entry): entry is SourceRegistryEntry & { id: "greenhouse" | "lever" | "ashby" } =>
      entry.executionEnabled &&
      (entry.id === "greenhouse" || entry.id === "lever" || entry.id === "ashby"),
  ).map((entry) => entry.id);
}
