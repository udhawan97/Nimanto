import { describe, expect, it, vi } from "vitest";
import { createWorkbenchMutations } from "../lib/workbench-mutations.js";

function harness(refresh: "ready" | "signed_out" | "unreachable" | "failed" = "ready") {
  const events: string[] = [];
  const mutations = createWorkbenchMutations({
    setBusy: (busy) => events.push(`busy:${busy}`),
    captureFocus: () => events.push("focus:capture"),
    restoreFocus: () => events.push("focus:restore"),
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
      "focus:capture",
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

  /* A success with no deliberate successor used to leave focus on <body>: the
   * activated control is disabled for the duration of `busy`, and disabling the
   * focused element is what moves focus to the document. The error branch always
   * had somewhere to land; the success branch had nowhere. */
  it("returns focus to the caller when a success declares no successor", async () => {
    const { mutations, events } = harness();
    await mutations.run({ request: async () => "ok", success: "Done." });
    expect(events).toEqual([
      "focus:capture",
      "busy:true",
      "notice:clear",
      "notice-focus:false",
      "refresh",
      "notice:ok:Done.",
      "busy:false",
      "schedule",
      "focus:restore",
    ]);
  });

  it("can report a committed blocked check as an error notice after reconciliation", async () => {
    const { mutations, events } = harness();
    await mutations.run({
      request: async () => ({ result: "blocked" as const }),
      success: "The check was recorded but blocked.",
      noticeKind: (value) => (value.result === "blocked" ? "error" : "ok"),
    });
    expect(events).toContain("refresh");
    expect(events).toContain("notice:error:The check was recorded but blocked.");
  });

  it("leaves focus to the declared successor rather than restoring it", async () => {
    const { mutations, events } = harness();
    await mutations.run({
      request: async () => "ok",
      success: "Done.",
      focus: () => events.push("focus:successor"),
    });
    expect(events).toContain("focus:successor");
    expect(events).not.toContain("focus:restore");
  });

  it("leaves focus to the error region rather than restoring it", async () => {
    const { mutations, events } = harness();
    await mutations.run({
      request: async () => Promise.reject(new Error("boom")),
      success: "Done.",
    });
    expect(events).toContain("notice-focus:true");
    expect(events).not.toContain("focus:restore");
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

  it("reconciles a rejected stale-tab write before announcing the identity change", async () => {
    const { mutations, events } = harness();
    const identityError = Object.assign(new Error("generic"), { code: "IDENTITY_CHANGED" });
    expect(
      await mutations.run({
        request: async () => Promise.reject(identityError),
        success: "Never shown.",
      }),
    ).toEqual({ kind: "failed" });
    expect(events).toEqual([
      "focus:capture",
      "busy:true",
      "notice:clear",
      "notice-focus:false",
      "reachable:true",
      "identity:signed-out",
      "refresh",
      "notice-focus:true",
      "notice:error:Safe failure.",
      "busy:false",
    ]);
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
