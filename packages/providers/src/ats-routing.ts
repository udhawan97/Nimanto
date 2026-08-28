import { sourceRegistryEntry, type JobSourceId } from "./source-registry.js";

export type AtsRoutingProvider = Extract<
  JobSourceId,
  "greenhouse" | "lever" | "ashby" | "smartrecruiters"
>;

export type AtsRoutingDecision = Readonly<{
  state: "ready" | "gated" | "unrecognized";
  provider: AtsRoutingProvider | null;
  boardId: string | null;
  sourceJobId: string | null;
  targetUrl: string | null;
  routeKind: "provider_source" | "recognized_url" | null;
  verificationMethod: "detail_get" | "complete_list" | null;
  verificationState: "ready" | "gated" | "unavailable";
  reason:
    | "provider_source_deep_link"
    | "recognized_candidate_link"
    | "origin_source_rights_required"
    | "destination_source_rights_required"
    | "source_link_invalid"
    | "ats_pattern_not_recognized";
  ruleVersion: "ats_routing_v1";
}>;

type AtsRoutingInput = Readonly<{
  source: string;
  sourceJobId: string;
  url: string;
  sourceMeta?: Readonly<Record<string, unknown>>;
}>;

type RecognizedTarget = Readonly<{
  provider: AtsRoutingProvider;
  boardId: string;
  sourceJobId: string;
  targetUrl: string;
}>;

const ATS_PROVIDERS = new Set<AtsRoutingProvider>([
  "greenhouse",
  "lever",
  "ashby",
  "smartrecruiters",
]);
const CANDIDATE_OWNED_SOURCES = new Set(["manual", "allowlisted_url"]);
const IDENTIFIER = /^[A-Za-z0-9_-]{1,120}$/u;
const GREENHOUSE_JOB_ID = /^\d{1,24}$/u;
const MAX_LINK_LENGTH = 2_048;

function decision(value: Omit<AtsRoutingDecision, "ruleVersion">): AtsRoutingDecision {
  return { ...value, ruleVersion: "ats_routing_v1" };
}

function safeHttpsUrl(value: string): URL | null {
  if (!value || value.length > MAX_LINK_LENGTH) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.port || url.username || url.password) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function pathSegments(url: URL): string[] | null {
  try {
    const segments = url.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
    return segments.every((segment) => IDENTIFIER.test(segment)) ? segments : null;
  } catch {
    return null;
  }
}

function canonicalTarget(url: URL, segments: readonly string[]): string {
  url.pathname = `/${segments.map((segment) => encodeURIComponent(segment)).join("/")}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}

/** Recognize only stable, exact ATS-host path shapes. No request or redirect is made. */
export function recognizeAtsTarget(value: string): RecognizedTarget | null {
  const url = safeHttpsUrl(value);
  if (!url) return null;
  const host = url.hostname.toLocaleLowerCase("en-US");
  const segments = pathSegments(url);
  if (!segments) return null;

  if (
    (host === "boards.greenhouse.io" || host === "job-boards.greenhouse.io") &&
    segments.length >= 3 &&
    segments[1] === "jobs" &&
    GREENHOUSE_JOB_ID.test(segments[2]!)
  ) {
    return {
      provider: "greenhouse",
      boardId: segments[0]!,
      sourceJobId: segments[2]!,
      targetUrl: canonicalTarget(url, segments.slice(0, 3)),
    };
  }

  if (host === "jobs.lever.co" && segments.length >= 2) {
    return {
      provider: "lever",
      boardId: segments[0]!,
      sourceJobId: segments[1]!,
      targetUrl: canonicalTarget(url, segments.slice(0, 2)),
    };
  }

  if (host === "jobs.ashbyhq.com" && segments.length >= 2) {
    return {
      provider: "ashby",
      boardId: segments[0]!,
      sourceJobId: segments[1]!,
      targetUrl: canonicalTarget(url, segments.slice(0, 2)),
    };
  }

  if (host === "jobs.smartrecruiters.com" && segments.length >= 2) {
    return {
      provider: "smartrecruiters",
      boardId: segments[0]!,
      sourceJobId: segments[1]!,
      targetUrl: canonicalTarget(url, segments.slice(0, 2)),
    };
  }

  return null;
}

function verificationMethod(
  provider: AtsRoutingProvider,
): AtsRoutingDecision["verificationMethod"] {
  return provider === "ashby" ? "complete_list" : "detail_get";
}

function verificationState(
  provider: AtsRoutingProvider,
  boardId: string | null,
  sourceJobId: string | null,
): AtsRoutingDecision["verificationState"] {
  if (!boardId || !sourceJobId) return "unavailable";
  return sourceRegistryEntry(provider)?.executionEnabled ? "ready" : "gated";
}

function metadataIdentifier(value: unknown): string | null {
  return typeof value === "string" && IDENTIFIER.test(value) ? value : null;
}

function gated(
  reason: Extract<
    AtsRoutingDecision["reason"],
    "origin_source_rights_required" | "destination_source_rights_required"
  >,
  recognized: RecognizedTarget | null,
): AtsRoutingDecision {
  return decision({
    state: "gated",
    provider: recognized?.provider ?? null,
    boardId: recognized?.boardId ?? null,
    sourceJobId: recognized?.sourceJobId ?? null,
    targetUrl: null,
    routeKind: recognized ? "recognized_url" : null,
    verificationMethod: recognized ? verificationMethod(recognized.provider) : null,
    verificationState: recognized
      ? verificationState(recognized.provider, recognized.boardId, recognized.sourceJobId)
      : "unavailable",
    reason,
  });
}

/**
 * Produce a display/routing decision without fetching the target. Provider-owned
 * links inherit the fixed-host adapter's source identity; candidate-entered
 * links must match an exact ATS host/path. Licensed discovery sources remain
 * closed until their registry entry grants deep-link rights.
 */
export function routeAtsLink(input: AtsRoutingInput): AtsRoutingDecision {
  const source = input.source as AtsRoutingProvider;
  const directProvider = ATS_PROVIDERS.has(source) ? source : null;
  const parsedUrl = safeHttpsUrl(input.url);

  if (directProvider) {
    const registry = sourceRegistryEntry(directProvider);
    if (!registry?.deepLinkAllowed) {
      return gated("destination_source_rights_required", recognizeAtsTarget(input.url));
    }
    if (!parsedUrl) {
      return decision({
        state: "unrecognized",
        provider: directProvider,
        boardId: null,
        sourceJobId: null,
        targetUrl: null,
        routeKind: null,
        verificationMethod: null,
        verificationState: "unavailable",
        reason: "source_link_invalid",
      });
    }
    const recognized = recognizeAtsTarget(input.url);
    const boardId = metadataIdentifier(input.sourceMeta?.board) ?? recognized?.boardId ?? null;
    const sourceJobId = metadataIdentifier(input.sourceJobId) ?? recognized?.sourceJobId ?? null;
    return decision({
      state: "ready",
      provider: directProvider,
      boardId,
      sourceJobId,
      targetUrl: parsedUrl.toString(),
      routeKind: "provider_source",
      verificationMethod: verificationMethod(directProvider),
      verificationState: verificationState(directProvider, boardId, sourceJobId),
      reason: "provider_source_deep_link",
    });
  }

  const recognized = recognizeAtsTarget(input.url);
  const originRegistryId =
    typeof input.sourceMeta?.sourceRegistryId === "string"
      ? input.sourceMeta.sourceRegistryId
      : input.source;
  if (!CANDIDATE_OWNED_SOURCES.has(input.source)) {
    const origin = sourceRegistryEntry(originRegistryId);
    if (!origin?.deepLinkAllowed) return gated("origin_source_rights_required", recognized);
  }
  if (!recognized) {
    return decision({
      state: "unrecognized",
      provider: null,
      boardId: null,
      sourceJobId: null,
      targetUrl: null,
      routeKind: null,
      verificationMethod: null,
      verificationState: "unavailable",
      reason: parsedUrl ? "ats_pattern_not_recognized" : "source_link_invalid",
    });
  }
  if (!sourceRegistryEntry(recognized.provider)?.deepLinkAllowed) {
    return gated("destination_source_rights_required", recognized);
  }
  return decision({
    state: "ready",
    provider: recognized.provider,
    boardId: recognized.boardId,
    sourceJobId: recognized.sourceJobId,
    targetUrl: recognized.targetUrl,
    routeKind: "recognized_url",
    verificationMethod: verificationMethod(recognized.provider),
    verificationState: verificationState(
      recognized.provider,
      recognized.boardId,
      recognized.sourceJobId,
    ),
    reason: "recognized_candidate_link",
  });
}
