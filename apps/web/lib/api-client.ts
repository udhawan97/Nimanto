const API = process.env.NEXT_PUBLIC_NIMANTO_API_ORIGIN ?? "http://127.0.0.1:4310";

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

let expectedSessionId: string | null = null;

export function fenceApiWritesToSession(sessionId: string | null): void {
  expectedSessionId = sessionId;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("content-type", "application/json");
  if (
    expectedSessionId &&
    !["GET", "HEAD", "OPTIONS"].includes(method) &&
    !path.startsWith("/v1/auth/") &&
    path !== "/v1/deletion/resume"
  ) {
    headers.set("x-nimanto-expected-session-id", expectedSessionId);
  }
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
    };
    throw new ApiError(
      payload.error?.code ?? `HTTP_${response.status}`,
      payload.error?.message ?? "Nimanto could not complete that request.",
    );
  }
  return response.json() as Promise<T>;
}
