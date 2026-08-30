import { randomBytes } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
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

export interface NimantoApiOptions {
  dataDirectory: string;
  artifactDirectory: string;
  outboxDirectory: string;
  webOrigin: string;
  demoMode: boolean;
  bootstrapSecret: string;
  assuranceModel?: string;
  urlAllowlist: string[];
  urlTermsReviewedAt?: string;
  trustedEmployerResolutionEvaluation?: {
    datasetChecksum: string;
    registryChecksum: string;
    reviewedAt: string;
    reviewer: string;
    fixtures: Array<{ sourceName: string; expectedId: string | null }>;
  };
  providerJobsFetcher?: ProviderJobsFetcher;
  providerJobVerifier?: ProviderJobVerifier;
  allowlistedJobPageFetcher?: AllowlistedJobPageFetcher;
  localModel?: LocalModelAdapter;
  removePath?: (target: string, options: { recursive?: boolean; force?: boolean }) => Promise<void>;
  port: number;
  host: string;
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
  const host = environment.NIMANTO_API_HOST ?? "127.0.0.1";
  const demoMode = environment.NIMANTO_DEMO_MODE !== "off";
  const urlAllowlist = (environment.NIMANTO_URL_ALLOWLIST ?? "")
    .split(",")
    .map((host) => host.trim().toLocaleLowerCase("en-US"))
    .filter(Boolean);
  if (
    urlAllowlist.length > 0 &&
    !/^\d{4}-\d{2}-\d{2}$/u.test(environment.NIMANTO_URL_TERMS_REVIEWED_AT ?? "")
  ) {
    throw new Error("NIMANTO_URL_TERMS_REVIEWED_AT is required for an enabled URL allowlist");
  }
  if (demoMode && host !== "127.0.0.1" && host !== "::1" && host !== "localhost") {
    throw new Error("Local beta authentication can only bind to a loopback host");
  }
  return {
    dataDirectory: path.join(root, "database"),
    artifactDirectory: path.join(root, "artifacts"),
    outboxDirectory: path.join(root, "outbox"),
    webOrigin: environment.NIMANTO_WEB_ORIGIN ?? "http://127.0.0.1:4300",
    demoMode,
    bootstrapSecret: localBootstrapSecret(root, environment),
    ...(environment.NIMANTO_ASSURANCE_MODEL?.trim()
      ? { assuranceModel: environment.NIMANTO_ASSURANCE_MODEL.trim() }
      : {}),
    urlAllowlist,
    ...(environment.NIMANTO_URL_TERMS_REVIEWED_AT
      ? { urlTermsReviewedAt: environment.NIMANTO_URL_TERMS_REVIEWED_AT }
      : {}),
    port: Number.parseInt(environment.NIMANTO_API_PORT ?? "4310", 10),
    host,
  };
}
