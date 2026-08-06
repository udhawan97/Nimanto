import { describe, expect, it } from "vitest";
import {
  scheduledFailureEvent,
  scheduledRetryDelayMinutes,
  transitionScheduledJob,
} from "../src/schedules.js";

describe("scheduled discovery state seam", () => {
  it("requires a lease claim before a discovery run can complete", () => {
    expect(transitionScheduledJob("queued", "claim")).toBe("running");
    expect(transitionScheduledJob("running", "succeed")).toBe("queued");
    expect(() => transitionScheduledJob("queued", "succeed")).toThrow(
      "Scheduled work must be running before it can succeed.",
    );
  });

  it("keeps candidate pause and cancellation terminal for workers", () => {
    expect(transitionScheduledJob("queued", "pause")).toBe("paused");
    expect(transitionScheduledJob("paused", "resume")).toBe("queued");
    expect(transitionScheduledJob("retry_wait", "cancel")).toBe("cancelled");
    expect(() => transitionScheduledJob("cancelled", "claim")).toThrow();
  });

  it("moves an exhausted retry to a visible dead letter", () => {
    expect(transitionScheduledJob("running", "fail")).toBe("retry_wait");
    expect(transitionScheduledJob("running", "exhaust")).toBe("dead_letter");
    expect(transitionScheduledJob("dead_letter", "resume")).toBe("queued");
  });

  it("bounds retries and dead-letters the fifth consecutive failure", () => {
    expect(scheduledRetryDelayMinutes(1)).toBe(1);
    expect(scheduledRetryDelayMinutes(2)).toBe(2);
    expect(scheduledRetryDelayMinutes(5)).toBe(15);
    expect(scheduledRetryDelayMinutes(50)).toBe(15);
    expect(scheduledFailureEvent(4, 5)).toBe("fail");
    expect(scheduledFailureEvent(5, 5)).toBe("exhaust");
  });
});
