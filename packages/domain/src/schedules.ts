export type ScheduledJobState =
  "queued" | "running" | "retry_wait" | "paused" | "dead_letter" | "cancelled";

export type ScheduledJobEvent =
  "claim" | "succeed" | "fail" | "exhaust" | "pause" | "resume" | "cancel";

const transitions: Partial<
  Record<ScheduledJobState, Partial<Record<ScheduledJobEvent, ScheduledJobState>>>
> = {
  queued: { claim: "running", pause: "paused", cancel: "cancelled" },
  running: { succeed: "queued", fail: "retry_wait", exhaust: "dead_letter", cancel: "cancelled" },
  retry_wait: { claim: "running", pause: "paused", cancel: "cancelled" },
  paused: { resume: "queued", cancel: "cancelled" },
  dead_letter: { resume: "queued", cancel: "cancelled" },
};

export function transitionScheduledJob(
  state: ScheduledJobState,
  event: ScheduledJobEvent,
): ScheduledJobState {
  const next = transitions[state]?.[event];
  if (next) return next;
  if (event === "succeed") {
    throw new Error("Scheduled work must be running before it can succeed.");
  }
  throw new Error(`Cannot ${event} scheduled work while it is ${state}.`);
}

export function scheduledRetryDelayMinutes(attempt: number): number {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("Invalid scheduled-work attempt.");
  return Math.min(15, 2 ** (attempt - 1));
}

export function scheduledFailureEvent(attempts: number, maxAttempts: number): "fail" | "exhaust" {
  if (
    !Number.isInteger(attempts) ||
    !Number.isInteger(maxAttempts) ||
    attempts < 1 ||
    maxAttempts < 1
  ) {
    throw new Error("Invalid scheduled-work retry limit.");
  }
  return attempts >= maxAttempts ? "exhaust" : "fail";
}
