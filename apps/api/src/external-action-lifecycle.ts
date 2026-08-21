import { randomUUID } from "node:crypto";
import type { NimantoStore } from "@nimanto/database";
import {
  canonicalHash,
  createReceipt,
  transitionExternalAction,
  type ExternalActionProvider,
} from "@nimanto/domain";
import { executeProviderAction, validateActionPayload } from "@nimanto/providers";

export type ProviderActionExecutor = typeof executeProviderAction;

export class ExternalActionLifecycle {
  private enabled = false;

  constructor(
    private readonly store: NimantoStore,
    private readonly outboxDirectory: string,
    private readonly executeAction: ProviderActionExecutor = executeProviderAction,
  ) {}

  setRuntime(enabled: boolean): { externalActionsEnabled: boolean } {
    this.enabled = enabled;
    return { externalActionsEnabled: this.enabled };
  }

  runtime(): boolean {
    return this.enabled;
  }

  async recoverInterrupted(): Promise<number> {
    return this.store.markInterruptedActionsAmbiguous();
  }

  async request(input: {
    tenantId: string;
    packetId: string;
    provider: ExternalActionProvider;
    to: string;
    subject: string;
    body: string;
  }) {
    if (!["deep_link", "test_outbox"].includes(input.provider)) throw new Error("INVALID_PROVIDER");
    validateActionPayload({ actionId: "pending", ...input });
    return this.store.transaction(async (database) => {
      // Packet generation takes the same tenant lock. Latest-packet validation
      // and action insertion therefore form one decision even across tabs.
      await database.lockTenantActive(input.tenantId);
      const packet = await database.getPacket(input.tenantId, input.packetId);
      if (packet?.status !== "approved") throw new Error("APPROVED_PACKET_REQUIRED");
      const latest = await database.getLatestPacketForApplication(
        input.tenantId,
        packet.applicationId,
      );
      if (latest?.id !== packet.id) throw new Error("LATEST_APPROVED_PACKET_REQUIRED");
      return database.createExternalAction(input.tenantId, {
        packetId: input.packetId,
        provider: input.provider,
        target: { to: input.to },
        payload: { subject: input.subject, body: input.body },
        idempotencyKey: canonicalHash({
          packetId: input.packetId,
          provider: input.provider,
          to: input.to,
          subject: input.subject,
          body: input.body,
        }),
      });
    });
  }

  async approve(tenantId: string, id: string) {
    const current = await this.store.getExternalAction(tenantId, id);
    if (!current) throw new Error("ACTION_NOT_FOUND");
    try {
      transitionExternalAction(current.state, "approve");
    } catch {
      throw new Error("INVALID_TRANSITION");
    }
    return this.store.approveExternalActionExact(tenantId, id);
  }

  async cancel(tenantId: string, id: string) {
    const current = await this.store.getExternalAction(tenantId, id);
    if (!current) throw new Error("ACTION_NOT_FOUND");
    try {
      transitionExternalAction(current.state, "cancel");
    } catch {
      throw new Error("INVALID_TRANSITION");
    }
    const updated = await this.store.transitionExternalAction(
      tenantId,
      id,
      current.state,
      "cancelled",
    );
    if (!updated) throw new Error("INVALID_TRANSITION");
    return updated;
  }

  async execute(tenantId: string, id: string) {
    if (!this.enabled) throw new Error("EXTERNAL_ACTIONS_DISABLED");
    const executing = await this.store.transaction(async (database) => {
      await database.lockTenantActive(tenantId);
      const current = await database.getExternalAction(tenantId, id);
      if (!current) throw new Error("ACTION_NOT_FOUND");
      try {
        transitionExternalAction(current.state, "execute");
      } catch {
        throw new Error("INVALID_TRANSITION");
      }
      if (!current.packetId) throw new Error("APPROVED_PACKET_REQUIRED");
      const packet = await database.getPacket(tenantId, current.packetId);
      const exactIntentHash = canonicalHash({
        packetId: current.packetId,
        provider: current.provider,
        target: current.target,
        payload: current.payload,
      });
      if (
        packet?.status !== "approved" ||
        packet.artifactHash !== current.approvedPacketHash ||
        exactIntentHash !== current.approvedIntentHash ||
        exactIntentHash !== current.intentHash
      ) {
        throw new Error("ACTION_APPROVAL_STALE");
      }
      const updated = await database.transitionExternalAction(
        tenantId,
        id,
        "approved",
        "executing",
      );
      if (!updated) throw new Error("INVALID_TRANSITION");
      return updated;
    });

    const target = executing.target as { to?: unknown };
    const payload = executing.payload as { subject?: unknown; body?: unknown };
    const actionPayload = {
      actionId: id,
      provider: executing.provider,
      to: String(target.to ?? ""),
      subject: String(payload.subject ?? ""),
      body: String(payload.body ?? ""),
    };
    let providerSucceeded = false;
    try {
      const outcome = await this.store.transaction(async (database) => {
        await database.lockTenantActive(tenantId);
        let result: Awaited<ReturnType<ProviderActionExecutor>>;
        try {
          result = await this.executeAction(actionPayload, {
            outboxDirectory: this.outboxDirectory,
          });
          providerSucceeded = true;
        } catch (error) {
          const failed = await database.transitionExternalAction(
            tenantId,
            id,
            "executing",
            "failed",
            {
              errorCode:
                error instanceof Error && /^[A-Z0-9_]+$/u.test(error.message)
                  ? error.message
                  : "PROVIDER_ERROR",
            },
          );
          if (!failed) throw new Error("ACTION_OUTCOME_PERSIST_FAILED");
          return { succeeded: false as const, error };
        }
        const succeeded = await database.transitionExternalAction(
          tenantId,
          id,
          "executing",
          "succeeded",
          result as unknown as Record<string, unknown>,
        );
        if (!succeeded) throw new Error("ACTION_OUTCOME_PERSIST_FAILED");
        const receipt = createReceipt({
          id: randomUUID(),
          type: "external_action",
          occurredAt: new Date().toISOString(),
          input: executing,
          artifact: result,
        });
        await database.saveReceipt(tenantId, receipt, { actionId: id, result });
        return { succeeded: true as const, action: succeeded };
      });
      if (!outcome.succeeded) throw outcome.error;
      return outcome.action;
    } catch (error) {
      if (providerSucceeded) {
        try {
          await this.store.transitionExternalAction(tenantId, id, "executing", "ambiguous", {
            errorCode: "ACTION_OUTCOME_PERSIST_FAILED",
          });
        } catch {
          // The executing state itself remains an explicit do-not-retry marker
          // and is recovered as ambiguous on restart.
        }
        throw new Error("ACTION_OUTCOME_AMBIGUOUS");
      }
      throw error;
    }
  }
}
