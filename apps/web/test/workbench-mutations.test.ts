import { describe, expect, it, vi } from "vitest";
import { createWorkbenchMutations } from "../lib/workbench-mutations.js";

function harness(refresh: "ready" | "signed_out" | "unreachable" | "failed" = "ready") {
  const events: string[] = [];
  const mutations = createWorkbenchMutations({
    setBusy: (busy) => events.push(`busy:${busy}`),
    clearNotice: () => events.push("notice:clear"),
    setNoticeFocus: (focus) => events.push(`notice-focus:${focus}`),
    setReachable: (reachable) => events.push(`reachable:${reachable}`),
    enterSignedOutState: () => events.push("identity:signed-out"),
    refresh: async () => {
      events.push("refresh");
      return refresh;
    },
    describeFailure: () => "Safe failure.",
    publishNotice: (kind, text) => events.push(`notice:${kind}:${text}`),
    schedule: (work) => {
      events.push("schedule");
      work();
    },
  });
  return { mutations, events };
}

describe("Workbench mutation coordination", () => {
  it("commits, refreshes, publishes, and focuses in one stable order", async () => {
    const { mutations, events } = harness();
    const outcome = await mutations.run({
      request: async () => {
        events.push("request");
        return { id: "role-7" };
      },
      success: (value) => `Saved ${value.id}.`,
      commit: () => events.push("commit"),
      focus: () => events.push("focus"),
    });
    expect(outcome).toEqual({ kind: "committed", value: { id: "role-7" } });
    expect(events).toEqual([
      "busy:true",
      "notice:clear",
      "notice-focus:false",
      "request",
      "commit",
      "refresh",
      "notice:ok:Saved role-7.",
      "busy:false",
      "schedule",
      "focus",
    ]);
  });

  it("delegates authentication loss and transport failure without stale success", async () => {
    const signedOut = harness();
    const authError = Object.assign(new Error("generic"), {
      code: "AUTHENTICATION_REQUIRED",
    });
    expect(
      await signedOut.mutations.run({
        request: async () => Promise.reject(authError),
        success: "Never shown.",
      }),
    ).toEqual({ kind: "signed_out" });
    expect(signedOut.events).toContain("identity:signed-out");
    expect(signedOut.events.some((event) => event.includes("Never shown"))).toBe(false);

    const unreachable = harness();
    expect(
      await unreachable.mutations.run({
        request: async () => Promise.reject(new TypeError("Failed to fetch")),
        success: "Never shown.",
      }),
    ).toEqual({ kind: "unreachable" });
    expect(unreachable.events).toContain("reachable:false");
  });

  it("reports a committed identity-ending operation on the entry screen", async () => {
    const { mutations, events } = harness("signed_out");
    expect(
      await mutations.run({
        request: async () => ({ state: "completed" }),
        success: "Deletion recorded.",
        commit: () => events.push("receipt:kept"),
      }),
    ).toEqual({ kind: "committed", value: { state: "completed" } });
    expect(events).toContain("receipt:kept");
    expect(events).toContain("notice:ok:Deletion recorded.");
  });

  it("returns busy for overlap and lets a field own declared recovery", async () => {
    const { mutations, events } = harness();
    let release: (() => void) | undefined;
    const first = mutations.run({
      request: () => new Promise<void>((resolve) => (release = resolve)),
      success: "Done.",
    });
    expect(await mutations.run({ request: async () => undefined, success: "Second." })).toEqual({
      kind: "busy",
    });
    release?.();
    await first;

    const failed = await mutations.run({
      request: async () => Promise.reject(new Error("field")),
      success: "Never.",
      recover: () => {
        events.push("field:focus");
        return true;
      },
    });
    expect(failed).toEqual({ kind: "failed" });
    expect(events).toContain("notice-focus:false");
    expect(events).toContain("field:focus");
  });
});
