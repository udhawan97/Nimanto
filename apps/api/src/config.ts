import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  GovernmentDatasetProvenance,
  GovernmentEvidenceLanguageReview,
} from "@nimanto/domain";
import type { LocalModelStatus } from "@nimanto/providers";
import type { ProviderJobsFetcher } from "./discovery-cycle.js";
import type { ProviderJobVerifier } from "./ats-verification.js";

export type LocalModelAdapter = {
  status: () => Promise<LocalModelStatus>;
  draftSummary: (input: {
    model: string;
    role: string;
    company: string;
    evidence: string[];
  }) => Promise<{ text: string; model: string; label: "unverified_local_draft" }>;
};

export type AllowlistedJobPageFetcher = (input: {
  url: string;
  allowedHosts: string[];
}) => Promise<{ canonicalUrl: string; text: string; observedAt: string }>;

export interface TrustedEmployerResolutionEvaluation {
  datasetChecksum: string;
  registryChecksum: string;
  reviewedAt: string;
  reviewer: string;
  fixtures: ReadonlyArray<{ sourceName: string; expectedId: string | null }>;
}

export interface GovernmentDatasetTrust {
  employerResolutionEvaluation?: TrustedEmployerResolutionEvaluation;
  provenance?: ReadonlyArray<GovernmentDatasetProvenance>;
  languageReviews?: ReadonlyArray<GovernmentEvidenceLanguageReview>;
}

export interface NimantoApiOptions {
  dataDirectory: string;
  artifactDirectory: string;
  outboxDirectory: string;
  webOrigin: string;
  demoMode: boolean;
  /** Operator ceiling. A tenant opt-in can never raise this capability. */
  externalActionsEnabled: boolean;
  bootstrapSecret: string;
  /** True when the launch secret was generated for this workspace rather than
   * supplied through NIMANTO_BOOTSTRAP_SECRET. Governs whether the startup
   * banner may print the one-click link (a fresh local secret) or must not
   * echo a secret the operator already holds. Optional so buildServer callers
   * that never print a banner need not set it. */
  bootstrapSecretGenerated?: boolean;
  assuranceModel?: string;
  urlAllowlist: string[];
  urlTermsReviewedAt?: string;
  governmentDatasetTrust?: GovernmentDatasetTrust;
  providerJobsFetcher?: ProviderJobsFetcher;
  providerJobVerifier?: ProviderJobVerifier;
  allowlistedJobPageFetcher?: AllowlistedJobPageFetcher;
  localModel?: LocalModelAdapter;
  removePath?: (target: string, options: { recursive?: boolean; force?: boolean }) => Promise<void>;
  port: number;
  host: string;
}

function booleanEnvironment(name: string, raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  const normalized = raw.trim().toLocaleLowerCase("en-US");
  if (normalized === "on") return true;
  if (normalized === "off") return false;
  throw new Error(`${name} must be either on or off`);
}

function portEnvironment(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const normalized = raw.trim();
  if (!/^\d{1,5}$/u.test(normalized)) throw new Error(`${name} must be an integer port`);
  const value = Number(normalized);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) {
    throw new Error(`${name} must be between 1 and 65535`);
  }
  return value;
}

function reviewedDate(raw: string | undefined): string | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  const value = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new Error("NIMANTO_URL_TERMS_REVIEWED_AT must be an ISO calendar date");
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error("NIMANTO_URL_TERMS_REVIEWED_AT must be an ISO calendar date");
  }
  return value;
}

function webOriginEnvironment(raw: string | undefined): string {
  const value = raw?.trim() || "http://127.0.0.1:4300";
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("NIMANTO_WEB_ORIGIN must be a valid HTTP or HTTPS origin");
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("NIMANTO_WEB_ORIGIN must be a credential-free HTTP or HTTPS origin");
  }
  return parsed.origin;
}

function localBootstrapSecret(root: string, environment: NodeJS.ProcessEnv): string {
  const supplied = environment.NIMANTO_BOOTSTRAP_SECRET?.trim();
  if (supplied) {
    if (supplied.length < 32)
      throw new Error("NIMANTO_BOOTSTRAP_SECRET must be at least 32 characters");
    return supplied;
  }
  mkdirSync(root, { recursive: true, mode: 0o700 });
  chmodSync(root, 0o700);
  const secretPath = path.join(root, "launch-secret");
  try {
    const current = readFileSync(secretPath, "utf8").trim();
    if (current.length < 32) throw new Error("Stored launch secret is invalid");
    chmodSync(secretPath, 0o600);
    return current;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const created = randomBytes(32).toString("base64url");
  try {
    writeFileSync(secretPath, `${created}\n`, { encoding: "utf8", flag: "wx", mode: 0o600 });
    return created;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const current = readFileSync(secretPath, "utf8").trim();
    chmodSync(secretPath, 0o600);
    return current;
  }
}

export function loadOptions(environment: NodeJS.ProcessEnv = process.env): NimantoApiOptions {
  const root = path.resolve(
    environment.NIMANTO_DATA_DIR ?? path.join(import.meta.dirname, "../../..", ".nimanto-data"),
  );
  const host = environment.NIMANTO_API_HOST?.trim() || "127.0.0.1";
  const demoMode = booleanEnvironment("NIMANTO_DEMO_MODE", environment.NIMANTO_DEMO_MODE, true);
  const externalActionsEnabled = booleanEnvironment(
    "NIMANTO_EXTERNAL_ACTIONS_ENABLED",
    environment.NIMANTO_EXTERNAL_ACTIONS_ENABLED,
    false,
  );
  const webOrigin = webOriginEnvironment(environment.NIMANTO_WEB_ORIGIN);
  const urlTermsReviewedAt = reviewedDate(environment.NIMANTO_URL_TERMS_REVIEWED_AT);
  const urlAllowlist = (environment.NIMANTO_URL_ALLOWLIST ?? "")
    .split(",")
    .map((host) => host.trim().toLocaleLowerCase("en-US"))
    .filter(Boolean);
  if (urlAllowlist.length > 0 && !urlTermsReviewedAt) {
    throw new Error("NIMANTO_URL_TERMS_REVIEWED_AT is required for an enabled URL allowlist");
  }
  if (demoMode && host !== "127.0.0.1" && host !== "::1" && host !== "localhost") {
    throw new Error("Local beta authentication can only bind to a loopback host");
  }
  return {
    dataDirectory: path.join(root, "database"),
    artifactDirectory: path.join(root, "artifacts"),
    outboxDirectory: path.join(root, "outbox"),
    webOrigin,
    demoMode,
    externalActionsEnabled,
    bootstrapSecret: localBootstrapSecret(root, environment),
    bootstrapSecretGenerated: !environment.NIMANTO_BOOTSTRAP_SECRET?.trim(),
    ...(environment.NIMANTO_ASSURANCE_MODEL?.trim()
      ? { assuranceModel: environment.NIMANTO_ASSURANCE_MODEL.trim() }
      : {}),
    urlAllowlist,
    ...(urlTermsReviewedAt ? { urlTermsReviewedAt } : {}),
    port: portEnvironment("NIMANTO_API_PORT", environment.NIMANTO_API_PORT, 4310),
    host,
  };
}
