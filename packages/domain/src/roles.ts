export type RoleSource = "manual" | "allowlisted_url" | "greenhouse" | "lever" | "ashby";

/** Source adapters own identity, hashing, provenance, retrieval, and parsing. */
export type RoleObservation = Readonly<{
  source: RoleSource;
  sourceRoleId: string;
  title: string;
  company: string;
  description: string;
  location?: string;
  workMode?: string;
  url?: string;
  requirements?: readonly string[];
  contentHash: string;
  sourceMeta: Readonly<Record<string, unknown>>;
}>;

/**
 * The normalized shape written to Nimanto's current mutable Role record.
 * This is intentionally not an immutable observation history or dedupe model.
 */
export type CurrentRole = Readonly<{
  source: RoleSource;
  sourceJobId: string;
  title: string;
  company: string;
  description: string;
  location: string;
  workMode: string;
  url: string;
  requirements: string[];
  capability: "deep_link";
  sourceMeta: Record<string, unknown>;
  contentHash: string;
}>;

function normalized(value: string): string {
  return value.normalize("NFC").trim();
}

function required(value: string, code: string): string {
  const result = normalized(value);
  if (!result) throw new Error(code);
  return result;
}

/** Common normalization only; source-specific facts stay adapter-owned. */
export function normalizeRoleObservation(observation: RoleObservation): CurrentRole {
  return {
    source: observation.source,
    sourceJobId: required(observation.sourceRoleId, "ROLE_SOURCE_ID_REQUIRED"),
    title: required(observation.title, "ROLE_TITLE_REQUIRED"),
    company: required(observation.company, "ROLE_COMPANY_REQUIRED"),
    description: required(observation.description, "ROLE_DESCRIPTION_REQUIRED"),
    location: normalized(observation.location ?? ""),
    workMode: normalized(observation.workMode ?? "") || "unspecified",
    url: normalized(observation.url ?? ""),
    requirements: (observation.requirements ?? [])
      .map(normalized)
      .filter((requirement) => requirement.length > 0),
    capability: "deep_link",
    sourceMeta: { ...observation.sourceMeta },
    contentHash: required(observation.contentHash, "ROLE_SOURCE_HASH_REQUIRED"),
  };
}
