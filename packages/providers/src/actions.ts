import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ExternalActionProvider } from "@nimanto/domain";

export interface ActionPayload {
  actionId: string;
  provider: ExternalActionProvider;
  to: string;
  subject: string;
  body: string;
}

export interface ActionResult {
  provider: ExternalActionProvider;
  status: "prepared" | "sent";
  providerReference: string;
}

export function validateActionPayload(payload: ActionPayload): void {
  if (
    payload.to.length > 254 ||
    /[\r\n\0]/u.test(payload.to) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(payload.to)
  ) {
    throw new Error("INVALID_EMAIL_TARGET");
  }
  if (
    payload.subject.length < 1 ||
    payload.subject.length > 200 ||
    /[\r\n\0]/u.test(payload.subject)
  ) {
    throw new Error("INVALID_EMAIL_SUBJECT");
  }
  if (payload.body.length < 1 || payload.body.length > 20_000 || /\0/u.test(payload.body)) {
    throw new Error("INVALID_EMAIL_BODY");
  }
}

export function buildDeepLink(payload: ActionPayload): string {
  validateActionPayload(payload);
  const params = new URLSearchParams({ subject: payload.subject, body: payload.body });
  return `mailto:${encodeURIComponent(payload.to)}?${params.toString()}`;
}

export async function executeProviderAction(
  payload: ActionPayload,
  options: {
    outboxDirectory: string;
  },
): Promise<ActionResult> {
  validateActionPayload(payload);
  if (payload.provider === "deep_link") {
    return {
      provider: payload.provider,
      status: "prepared",
      providerReference: buildDeepLink(payload),
    };
  }
  if (payload.provider === "test_outbox") {
    await mkdir(options.outboxDirectory, { recursive: true, mode: 0o700 });
    await chmod(options.outboxDirectory, 0o700);
    const target = path.join(options.outboxDirectory, `${payload.actionId}.json`);
    await writeFile(
      target,
      `${JSON.stringify({ ...payload, createdAt: new Date().toISOString() }, null, 2)}\n`,
      {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      },
    );
    return { provider: payload.provider, status: "sent", providerReference: target };
  }

  throw new Error("PROVIDER_NOT_AVAILABLE_IN_V0_1_0");
}
