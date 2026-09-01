import {
  classifyRoleFamily,
  normalizeWorkplaceMode,
  type RoleFamily,
  type WorkplaceEvidence,
  type WorkplaceMode,
} from "./marketplace.js";
import { canonicalHash } from "./receipts.js";

export type RoleSource =
  | "manual"
  | "allowlisted_url"
  | "greenhouse"
  | "lever"
  | "ashby"
  | "smartrecruiters"
  | "licensed_feed";

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
  roleFamily?: RoleFamily | undefined;
  workplaceEvidence?: readonly WorkplaceEvidence[] | undefined;
  observedAt?: string | undefined;
  sourcePostedAt?: string | undefined;
  sourceUpdatedAt?: string | undefined;
  validThrough?: string | undefined;
  rawPayload?: Readonly<Record<string, unknown>> | undefined;
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
  workMode: WorkplaceMode;
  url: string;
  requirements: string[];
  roleFamily?: RoleFamily;
  workplaceEvidence?: WorkplaceEvidence[];
  observedAt?: string;
  sourcePostedAt?: string | null;
  sourceUpdatedAt?: string | null;
  validThrough?: string | null;
  rawPayload?: Record<string, unknown> | null;
  capability: "deep_link";
  sourceMeta: Record<string, unknown>;
  contentHash: string;
}>;

/** Hash the complete normalized Role content that downstream decisions depend on.
 * Observation time is provenance rather than content, so an identical recheck does
 * not invalidate an otherwise unchanged Match Publication. */
export function roleSnapshotHash(role: {
  source: string;
  title: string;
  company: string;
  description: string;
  location: string;
  workMode: string;
  roleFamily?: RoleFamily;
  workplaceEvidence?: readonly WorkplaceEvidence[];
  url: string;
  requirements: readonly string[];
  sourcePostedAt?: string | null;
  sourceUpdatedAt?: string | null;
  validThrough?: string | null;
  availability?: {
    sourcePostedAt?: string | null;
    sourceUpdatedAt?: string | null;
    validThrough?: string | null;
  };
  capability: string;
  sourceMeta: Readonly<Record<string, unknown>>;
}): string {
  // Some persistence adapters retain the observation timestamp alongside
  // source metadata for display. It is provenance, not decision content, just
  // like the top-level observedAt field, so repeated observation cannot make
  // an otherwise identical role stale.
  const {
    observedAt: _observedAt,
    workplaceEvidence: _persistedWorkplaceEvidence,
    ...decisionSourceMeta
  } = role.sourceMeta;
  return canonicalHash({
    schemaVersion: "role_snapshot_v1",
    source: role.source,
    title: role.title,
    company: role.company,
    description: role.description,
    location: role.location,
    workMode: role.workMode,
    roleFamily: role.roleFamily ?? null,
    workplaceEvidence: role.workplaceEvidence ?? [],
    url: role.url,
    requirements: role.requirements,
    sourcePostedAt: role.sourcePostedAt ?? role.availability?.sourcePostedAt ?? null,
    sourceUpdatedAt: role.sourceUpdatedAt ?? role.availability?.sourceUpdatedAt ?? null,
    validThrough: role.validThrough ?? role.availability?.validThrough ?? null,
    capability: role.capability,
    sourceMeta: decisionSourceMeta,
  });
}

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
  const observedAt = normalized(observation.observedAt ?? "") || new Date().toISOString();
  const workplaceEvidence = (observation.workplaceEvidence ?? []).map((evidence) => ({
    ...evidence,
    sourceText: normalized(evidence.sourceText),
    sourceFieldOrLocator: normalized(evidence.sourceFieldOrLocator),
  }));
  return {
    source: observation.source,
    sourceJobId: required(observation.sourceRoleId, "ROLE_SOURCE_ID_REQUIRED"),
    title: required(observation.title, "ROLE_TITLE_REQUIRED"),
    company: required(observation.company, "ROLE_COMPANY_REQUIRED"),
    description: required(observation.description, "ROLE_DESCRIPTION_REQUIRED"),
    location: normalized(observation.location ?? ""),
    workMode: normalizeWorkplaceMode(observation.workMode),
    url: normalized(observation.url ?? ""),
    requirements: (observation.requirements ?? [])
      .map(normalized)
      .filter((requirement) => requirement.length > 0),
    roleFamily: observation.roleFamily ?? classifyRoleFamily(observation.title),
    workplaceEvidence,
    observedAt,
    sourcePostedAt: normalized(observation.sourcePostedAt ?? "") || null,
    sourceUpdatedAt: normalized(observation.sourceUpdatedAt ?? "") || null,
    validThrough: normalized(observation.validThrough ?? "") || null,
    rawPayload: observation.rawPayload ? { ...observation.rawPayload } : null,
    capability: "deep_link",
    sourceMeta: { ...observation.sourceMeta },
    contentHash: required(observation.contentHash, "ROLE_SOURCE_HASH_REQUIRED"),
  };
}

/** Normalize source input and derive the only content hash downstream
 * publications may bind to. Source-provided fingerprints remain run
 * provenance and never substitute for this complete normalized snapshot. */
export function normalizeRoleSnapshot(
  observation: Omit<RoleObservation, "contentHash">,
): CurrentRole {
  const normalizedRole = normalizeRoleObservation({
    ...observation,
    contentHash: "pending-normalized-role-snapshot",
  });
  return {
    ...normalizedRole,
    contentHash: roleSnapshotHash(normalizedRole),
  };
}
