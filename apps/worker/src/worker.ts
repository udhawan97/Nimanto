export interface WorkerSource {
  provider: "greenhouse" | "lever" | "ashby";
  board: string;
}

export function nextDelay(attempt: number): number {
  return Math.min(15 * 60_000, 5_000 * 2 ** Math.max(0, attempt));
}

export function loopbackApiOrigin(value: string): string {
  const url = new URL(value);
  const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
  const hasUnexpectedPath = url.pathname !== "/" && url.pathname !== "";
  if (
    url.protocol !== "http:" ||
    !loopbackHosts.has(url.hostname) ||
    Boolean(url.username || url.password || url.search || url.hash || hasUnexpectedPath)
  ) {
    throw new Error("INVALID_API_ORIGIN");
  }
  return url.origin;
}

export async function runCycle(input: {
  apiOrigin: string;
  source?: WorkerSource;
  bootstrapSecret?: string;
  fetcher?: typeof fetch;
}): Promise<{ status: "healthy" | "refreshed"; imported: number }> {
  const apiOrigin = loopbackApiOrigin(input.apiOrigin);
  const fetcher = input.fetcher ?? fetch;
  const health = await fetcher(`${apiOrigin}/health`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!health.ok) throw new Error(`API_HEALTH_${health.status}`);
  if (!input.source) return { status: "healthy", imported: 0 };
  if (!input.bootstrapSecret) throw new Error("WORKER_BOOTSTRAP_SECRET_MISSING");

  const login = await fetcher(`${apiOrigin}/v1/auth/demo`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-nimanto-bootstrap-secret": input.bootstrapSecret,
    },
    body: "{}",
    signal: AbortSignal.timeout(5_000),
  });
  if (!login.ok) throw new Error(`WORKER_LOGIN_${login.status}`);
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("WORKER_SESSION_MISSING");
  const refresh = await fetcher(`${apiOrigin}/v1/jobs/import`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(input.source),
    signal: AbortSignal.timeout(30_000),
  });
  if (!refresh.ok) throw new Error(`WORKER_REFRESH_${refresh.status}`);
  const result = (await refresh.json()) as { imported?: number };
  return { status: "refreshed", imported: result.imported ?? 0 };
}
