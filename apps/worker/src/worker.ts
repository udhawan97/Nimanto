export interface WorkerCycleResult {
  processed: number;
  failed: number;
  imported: number;
  matched: number;
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
  bootstrapSecret?: string;
  fetcher?: typeof fetch;
}): Promise<WorkerCycleResult> {
  const apiOrigin = loopbackApiOrigin(input.apiOrigin);
  const fetcher = input.fetcher ?? fetch;
  const health = await fetcher(`${apiOrigin}/health`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!health.ok) throw new Error(`API_HEALTH_${health.status}`);
  if (!input.bootstrapSecret) throw new Error("WORKER_BOOTSTRAP_SECRET_MISSING");
  const cycle = await fetcher(`${apiOrigin}/v1/worker/cycle`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "x-nimanto-bootstrap-secret": input.bootstrapSecret,
    },
    signal: AbortSignal.timeout(15 * 60_000),
  });
  if (!cycle.ok) throw new Error(`WORKER_CYCLE_${cycle.status}`);
  const result = (await cycle.json()) as Partial<WorkerCycleResult>;
  const values = [result.processed, result.failed, result.imported, result.matched];
  if (
    values.some((value) => !Number.isInteger(value) || (value ?? -1) < 0) ||
    (result.processed ?? 4) > 3 ||
    (result.failed ?? 1) > (result.processed ?? 0)
  ) {
    throw new Error("WORKER_INVALID_CYCLE_RESULT");
  }
  return result as WorkerCycleResult;
}
