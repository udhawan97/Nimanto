import { createHash } from "node:crypto";
import {
  normalizeWorkplaceMode,
  type RoleFamily,
  type StructuredArea,
  type WorkplaceEvidence,
  type WorkplaceMode,
} from "@nimanto/domain";
import { assertSourceExecutionEnabled } from "./source-registry.js";
import { NIMANTO_PROVIDER_VERSION } from "./version.js";

export type JobProvider = "greenhouse" | "lever" | "ashby" | "smartrecruiters";

export interface ProviderJob {
  source: JobProvider;
  sourceJobId: string;
  title: string;
  company: string;
  description: string;
  location: string;
  workMode: WorkplaceMode;
  workplaceEvidence: WorkplaceEvidence[];
  roleFamily?: RoleFamily;
  url: string;
  requirements: string[];
  observedAt: string;
  sourcePostedAt?: string | undefined;
  sourceUpdatedAt?: string | undefined;
  validThrough?: string | undefined;
  contentHash: string;
  rawPayload: Record<string, unknown>;
  sourceMeta: Record<string, unknown>;
}

export interface JobProviderRequest {
  provider: JobProvider;
  board: string;
}

export interface ProviderFetchRun {
  source: JobProvider;
  boardId: string;
  startedAt: string;
  completedAt: string;
  complete: boolean;
  pagesRead: number;
  sourceItemCount: number;
  responseFingerprint: string;
  retryAfterObserved: boolean;
  sourcePolicyVersion: string;
}

export interface ProviderFetchResult {
  jobs: ProviderJob[];
  run: ProviderFetchRun;
}

type Fetcher = typeof fetch;
const MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024;
const MAX_PROVIDER_JOBS = 500;

function assertBoard(value: string): string {
  const board = value.trim();
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(board)) throw new Error("INVALID_BOARD_IDENTIFIER");
  return board;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.normalize("NFC").trim() : "";
}

function outboundUrl(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : "";
  } catch {
    return "";
  }
}

function stripMarkup(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .normalize("NFC")
    .trim();
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function isoInstant(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  if (typeof value !== "string" || !value.trim()) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function isoCountryCode(value: string): string | null {
  const normalized = value.toUpperCase();
  return /^[A-Z]{2}$/u.test(normalized) ? normalized : null;
}

function area(
  displayLabel: string,
  input: Partial<Omit<StructuredArea, "displayLabel" | "resolution">> = {},
): StructuredArea {
  return {
    displayLabel,
    countryCode: input.countryCode ?? null,
    subdivisionCode: input.subdivisionCode ?? null,
    metroId: input.metroId ?? null,
    timeZone: input.timeZone ?? null,
    resolution:
      input.countryCode || input.subdivisionCode || input.metroId || input.timeZone
        ? "confirmed"
        : "unknown",
  };
}

function workplaceEvidence(input: {
  value: string;
  locator: string;
  observedAt: string;
  confidence: WorkplaceEvidence["confidence"];
  eligibleRemoteAreas?: StructuredArea[];
  physicalLocations?: StructuredArea[];
}): WorkplaceEvidence {
  return {
    mode: normalizeWorkplaceMode(input.value),
    method: input.confidence === "high" ? "source_structured" : "unknown",
    sourceText: input.value,
    sourceFieldOrLocator: input.locator,
    observedAt: input.observedAt,
    normalizerVersion: "workplace_normalizer_v1",
    confidence: input.confidence,
    eligibleRemoteAreas: input.eligibleRemoteAreas ?? [],
    physicalLocations: input.physicalLocations ?? [],
  };
}

async function getJson(url: string, fetcher: Fetcher): Promise<unknown> {
  const response = await fetcher(url, {
    headers: { accept: "application/json", "user-agent": `Nimanto/${NIMANTO_PROVIDER_VERSION}` },
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`);
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("json")) throw new Error("PROVIDER_INVALID_CONTENT_TYPE");
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_PROVIDER_RESPONSE_BYTES) {
    throw new Error("PROVIDER_RESPONSE_TOO_LARGE");
  }
  if (!response.body) throw new Error("PROVIDER_EMPTY_RESPONSE");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_PROVIDER_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("PROVIDER_RESPONSE_TOO_LARGE");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    throw new Error("PROVIDER_INVALID_JSON");
  }
}

function greenhouseJobs(payload: { jobs?: unknown[] }, board: string, observedAt: string) {
  return (payload.jobs ?? []).map((raw): ProviderJob => {
    const job = raw as Record<string, unknown>;
    const location = text((job.location as { name?: unknown } | undefined)?.name);
    const evidence = workplaceEvidence({
      value: "unknown",
      locator: "location.name",
      observedAt,
      confidence: "low",
      physicalLocations: location ? [area(location)] : [],
    });
    return {
      source: "greenhouse",
      sourceJobId: String(job.id ?? ""),
      title: text(job.title),
      company: board,
      description: stripMarkup(text(job.content)),
      location,
      workMode: evidence.mode,
      workplaceEvidence: [evidence],
      url: outboundUrl(job.absolute_url),
      requirements: [],
      observedAt,
      ...(isoInstant(job.first_published)
        ? { sourcePostedAt: isoInstant(job.first_published) }
        : {}),
      ...(isoInstant(job.updated_at) ? { sourceUpdatedAt: isoInstant(job.updated_at) } : {}),
      ...(isoInstant(job.application_deadline)
        ? { validThrough: isoInstant(job.application_deadline) }
        : {}),
      contentHash: digest(job),
      rawPayload: job,
      sourceMeta: { board, offices: job.offices ?? [], departments: job.departments ?? [] },
    };
  });
}

function leverJobs(payload: unknown[], board: string, observedAt: string) {
  return payload.map((raw): ProviderJob => {
    const job = raw as Record<string, unknown>;
    const categories = (job.categories ?? {}) as Record<string, unknown>;
    const allLocations = Array.isArray(categories.allLocations)
      ? categories.allLocations.map(text).filter(Boolean)
      : text(categories.location)
        ? [text(categories.location)]
        : [];
    const country = text(categories.country);
    const modeValue = text(job.workplaceType) || "unknown";
    const mode = normalizeWorkplaceMode(modeValue);
    const locations = allLocations.map((label) =>
      area(label, { countryCode: isoCountryCode(country) }),
    );
    const evidence = workplaceEvidence({
      value: modeValue,
      locator: "workplaceType",
      observedAt,
      confidence: text(job.workplaceType) ? "high" : "low",
      eligibleRemoteAreas: mode === "remote" ? locations : [],
      physicalLocations: mode === "remote" ? [] : locations,
    });
    return {
      source: "lever",
      sourceJobId: text(job.id),
      title: text(job.text),
      company: board,
      description: stripMarkup(`${text(job.descriptionPlain)} ${text(job.additionalPlain)}`),
      location: allLocations.join(" · "),
      workMode: evidence.mode,
      workplaceEvidence: [evidence],
      url: outboundUrl(job.hostedUrl),
      requirements: [],
      observedAt,
      ...(isoInstant(job.createdAt) ? { sourcePostedAt: isoInstant(job.createdAt) } : {}),
      contentHash: digest(job),
      rawPayload: job,
      sourceMeta: {
        board,
        country,
        team: categories.team ?? null,
        department: categories.department ?? null,
        level: categories.commitment ?? null,
        salaryRange: job.salaryRange ?? null,
      },
    };
  });
}

function ashbyJobs(payload: { jobs?: unknown[] }, board: string, observedAt: string) {
  return (payload.jobs ?? []).map((raw): ProviderJob => {
    const job = raw as Record<string, unknown>;
    const primary = text(job.location);
    const secondary = Array.isArray(job.secondaryLocations)
      ? job.secondaryLocations
          .map((value) => text((value as Record<string, unknown>).location ?? value))
          .filter(Boolean)
      : [];
    const locations = [primary, ...secondary].filter(Boolean);
    const modeValue = text(job.workplaceType) || (job.isRemote === true ? "remote" : "unknown");
    const mode = normalizeWorkplaceMode(modeValue);
    const areas = locations.map((label) => area(label));
    const evidence = workplaceEvidence({
      value: modeValue,
      locator: text(job.workplaceType) ? "workplaceType" : "isRemote",
      observedAt,
      confidence: text(job.workplaceType) || typeof job.isRemote === "boolean" ? "high" : "low",
      eligibleRemoteAreas: mode === "remote" ? areas : [],
      physicalLocations: mode === "remote" ? [] : areas,
    });
    return {
      source: "ashby",
      sourceJobId: text(job.id) || text(job.jobUrl),
      title: text(job.title),
      company: board,
      description: stripMarkup(text(job.descriptionPlain) || text(job.descriptionHtml)),
      location: locations.join(" · "),
      workMode: evidence.mode,
      workplaceEvidence: [evidence],
      url: outboundUrl(job.jobUrl) || outboundUrl(job.applyUrl),
      requirements: [],
      observedAt,
      ...(isoInstant(job.publishedAt) ? { sourcePostedAt: isoInstant(job.publishedAt) } : {}),
      contentHash: digest(job),
      rawPayload: job,
      sourceMeta: {
        board,
        department: job.department ?? null,
        team: job.team ?? null,
        employmentType: job.employmentType ?? null,
        compensation: job.compensation ?? null,
      },
    };
  });
}

async function smartRecruitersJobs(board: string, fetcher: Fetcher, observedAt: string) {
  const summaries: Record<string, unknown>[] = [];
  let offset = 0;
  let totalFound = Number.POSITIVE_INFINITY;
  let pagesRead = 0;
  while (summaries.length < Math.min(totalFound, MAX_PROVIDER_JOBS)) {
    const payload = (await getJson(
      `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(board)}/postings?limit=100&offset=${offset}`,
      fetcher,
    )) as { content?: unknown[]; totalFound?: number };
    const content = (payload.content ?? []).map((item) => item as Record<string, unknown>);
    totalFound = Number.isFinite(payload.totalFound)
      ? Number(payload.totalFound)
      : summaries.length + content.length;
    summaries.push(...content);
    pagesRead += 1;
    if (content.length === 0 || content.length < 100) break;
    offset += content.length;
  }
  const jobs: ProviderJob[] = [];
  for (const summary of summaries.slice(0, MAX_PROVIDER_JOBS)) {
    const id = text(summary.id);
    if (!id) continue;
    const job = (await getJson(
      `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(board)}/postings/${encodeURIComponent(id)}`,
      fetcher,
    )) as Record<string, unknown>;
    const locationValue = (job.location ?? summary.location ?? {}) as Record<string, unknown>;
    const countryCode = isoCountryCode(text(locationValue.country));
    const region = text(locationValue.region);
    const city = text(locationValue.city);
    const label = [city, region, countryCode].filter(Boolean).join(", ");
    const remoteValue = locationValue.remote;
    const remote = remoteValue === true;
    const modeValue = typeof remoteValue === "boolean" ? (remote ? "remote" : "onsite") : "unknown";
    const regionCode = region.toUpperCase();
    const structuredArea = label
      ? area(label, {
          countryCode,
          subdivisionCode:
            countryCode && /^[A-Z0-9]{1,3}$/u.test(regionCode)
              ? `${countryCode}-${regionCode}`
              : null,
        })
      : null;
    const evidence = workplaceEvidence({
      value: modeValue,
      locator: "location.remote",
      observedAt,
      confidence: typeof remoteValue === "boolean" ? "high" : "low",
      eligibleRemoteAreas: remote && structuredArea ? [structuredArea] : [],
      physicalLocations: !remote && structuredArea ? [structuredArea] : [],
    });
    const jobAd = (job.jobAd ?? {}) as Record<string, unknown>;
    const sections = (jobAd.sections ?? {}) as Record<string, unknown>;
    const sectionText = (value: unknown) =>
      stripMarkup(text((value as Record<string, unknown> | undefined)?.text));
    const qualifications = sectionText(sections.qualifications);
    const description = [
      sectionText(sections.jobDescription),
      qualifications,
      sectionText(sections.additionalInformation),
    ]
      .filter(Boolean)
      .join(" ");
    const company = (job.company ?? {}) as Record<string, unknown>;
    jobs.push({
      source: "smartrecruiters",
      sourceJobId: id,
      title: text(job.name) || text(summary.name),
      company: text(company.name) || board,
      description,
      location: label,
      workMode: evidence.mode,
      workplaceEvidence: [evidence],
      url:
        outboundUrl((job.ref as Record<string, unknown> | undefined)?.to) ||
        outboundUrl((summary.ref as Record<string, unknown> | undefined)?.to),
      requirements: qualifications
        .split(/[.\n]/u)
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 30),
      observedAt,
      ...(isoInstant(job.releasedDate ?? summary.releasedDate)
        ? { sourcePostedAt: isoInstant(job.releasedDate ?? summary.releasedDate) }
        : {}),
      contentHash: digest(job),
      rawPayload: job,
      sourceMeta: { board, department: job.department ?? null, function: job.function ?? null },
    });
  }
  return { jobs, pagesRead, complete: jobs.length >= totalFound };
}

export async function fetchProviderJobsResult(
  request: JobProviderRequest,
  fetcher: Fetcher = fetch,
  options: { enforceRegistry?: boolean } = {},
): Promise<ProviderFetchResult> {
  if (options.enforceRegistry !== false) assertSourceExecutionEnabled(request.provider);
  const board = assertBoard(request.board);
  const startedAt = new Date().toISOString();
  let jobs: ProviderJob[];
  let pagesRead = 1;
  let complete = true;
  if (request.provider === "greenhouse") {
    jobs = greenhouseJobs(
      (await getJson(
        `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`,
        fetcher,
      )) as { jobs?: unknown[] },
      board,
      startedAt,
    );
  } else if (request.provider === "lever") {
    jobs = leverJobs(
      (await getJson(
        `https://api.lever.co/v0/postings/${encodeURIComponent(board)}?mode=json`,
        fetcher,
      )) as unknown[],
      board,
      startedAt,
    );
  } else if (request.provider === "ashby") {
    jobs = ashbyJobs(
      (await getJson(
        `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}`,
        fetcher,
      )) as { jobs?: unknown[] },
      board,
      startedAt,
    );
  } else {
    const result = await smartRecruitersJobs(board, fetcher, startedAt);
    jobs = result.jobs;
    pagesRead = result.pagesRead;
    complete = result.complete;
  }
  const sourceItemCount = jobs.length;
  if (sourceItemCount > MAX_PROVIDER_JOBS) {
    jobs = jobs.slice(0, MAX_PROVIDER_JOBS);
    complete = false;
  }
  const completedAt = new Date().toISOString();
  return {
    jobs,
    run: {
      source: request.provider,
      boardId: board,
      startedAt,
      completedAt,
      complete,
      pagesRead,
      sourceItemCount,
      responseFingerprint: digest(jobs.map((job) => [job.sourceJobId, job.contentHash])),
      retryAfterObserved: false,
      sourcePolicyVersion: "source_registry_v1",
    },
  };
}

export async function fetchProviderJobs(
  request: JobProviderRequest,
  fetcher: Fetcher = fetch,
): Promise<ProviderJob[]> {
  return (await fetchProviderJobsResult(request, fetcher)).jobs;
}
