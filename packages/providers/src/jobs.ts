import { createHash } from "node:crypto";

export interface ProviderJob {
  source: "greenhouse" | "lever" | "ashby";
  sourceJobId: string;
  title: string;
  company: string;
  description: string;
  location: string;
  workMode: string;
  url: string;
  requirements: string[];
  contentHash: string;
  sourceMeta: Record<string, unknown>;
}

export interface JobProviderRequest {
  provider: ProviderJob["source"];
  board: string;
}

type Fetcher = typeof fetch;
const MAX_PROVIDER_RESPONSE_BYTES = 1024 * 1024;

function assertBoard(value: string): string {
  const board = value.trim();
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(board)) throw new Error("INVALID_BOARD_IDENTIFIER");
  return board;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
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

async function getJson(url: string, fetcher: Fetcher): Promise<unknown> {
  const response = await fetcher(url, {
    headers: { accept: "application/json", "user-agent": "Nimanto/0.1" },
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

export async function fetchProviderJobs(
  request: JobProviderRequest,
  fetcher: Fetcher = fetch,
): Promise<ProviderJob[]> {
  const board = assertBoard(request.board);
  if (request.provider === "greenhouse") {
    const payload = (await getJson(
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`,
      fetcher,
    )) as { jobs?: unknown[] };
    return (payload.jobs ?? []).map((raw) => {
      const job = raw as Record<string, unknown>;
      const location = (job.location as { name?: unknown } | undefined)?.name;
      return {
        source: "greenhouse",
        sourceJobId: String(job.id ?? ""),
        title: text(job.title),
        company: board,
        description: stripMarkup(text(job.content)),
        location: text(location),
        workMode: "unspecified",
        url: outboundUrl(job.absolute_url),
        requirements: [],
        contentHash: digest(job),
        sourceMeta: { board },
      };
    });
  }
  if (request.provider === "lever") {
    const payload = (await getJson(
      `https://api.lever.co/v0/postings/${encodeURIComponent(board)}?mode=json`,
      fetcher,
    )) as unknown[];
    return payload.map((raw) => {
      const job = raw as Record<string, unknown>;
      const categories = (job.categories ?? {}) as Record<string, unknown>;
      return {
        source: "lever",
        sourceJobId: text(job.id),
        title: text(job.text),
        company: board,
        description: stripMarkup(`${text(job.descriptionPlain)} ${text(job.additionalPlain)}`),
        location: text(categories.location),
        workMode: text(job.workplaceType) || "unspecified",
        url: outboundUrl(job.hostedUrl),
        requirements: [],
        contentHash: digest(job),
        sourceMeta: { board },
      };
    });
  }
  const payload = (await getJson(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}`,
    fetcher,
  )) as { jobs?: unknown[] };
  return (payload.jobs ?? []).map((raw) => {
    const job = raw as Record<string, unknown>;
    return {
      source: "ashby",
      sourceJobId: text(job.id) || text(job.jobUrl),
      title: text(job.title),
      company: board,
      description: stripMarkup(text(job.descriptionPlain) || text(job.descriptionHtml)),
      location: text(job.location),
      workMode: job.isRemote === true ? "remote" : "unspecified",
      url: outboundUrl(job.jobUrl) || outboundUrl(job.applyUrl),
      requirements: [],
      contentHash: digest(job),
      sourceMeta: { board },
    };
  });
}
