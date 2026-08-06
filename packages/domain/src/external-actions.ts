import type { ExternalActionState } from "./types.js";

export type ExternalActionEvent =
  | "request_approval"
  | "approve"
  | "cancel"
  | "execute"
  | "mark_succeeded"
  | "mark_failed"
  | "mark_ambiguous";

const transitions: Partial<
  Record<ExternalActionState, Partial<Record<ExternalActionEvent, ExternalActionState>>>
> = {
  draft: { request_approval: "pending_approval", cancel: "cancelled" },
  pending_approval: { approve: "approved", cancel: "cancelled" },
  approved: { execute: "executing", cancel: "cancelled" },
  executing: {
    mark_succeeded: "succeeded",
    mark_failed: "failed",
    mark_ambiguous: "ambiguous",
  },
  failed: { request_approval: "pending_approval", cancel: "cancelled" },
};

export function transitionExternalAction(
  state: ExternalActionState,
  event: ExternalActionEvent,
): ExternalActionState {
  const next = transitions[state]?.[event];
  if (next) return next;
  if (event === "execute" && state !== "approved") {
    throw new Error("External action must be approved before execution.");
  }
  throw new Error(`Invalid external-action transition: ${state} -> ${event}.`);
}
