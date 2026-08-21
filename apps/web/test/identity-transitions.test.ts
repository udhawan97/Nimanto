import { describe, expect, it, vi } from "vitest";
import { workspaceIdentityTransitions } from "../lib/identity-transitions.js";

describe("workspace identity transitions", () => {
  it("captures a bootstrap credential before scrubbing its location", () => {
    const order: string[] = [];
    const result = workspaceIdentityTransitions.consumeLocation({
      hash: "#bootstrap=private-value",
      rememberBootstrap: (value) => order.push(`remember:${value}`),
      scrub: () => order.push("scrub"),
    });
    expect(result).toEqual({ kind: "bootstrap", secret: "private-value" });
    expect(order).toEqual(["remember:private-value", "scrub"]);
  });

  it("gives invitations precedence and never forwards credential-shaped hashes", () => {
    const scrub = vi.fn();
    expect(
      workspaceIdentityTransitions.consumeLocation({
        hash: "#bootstrap=second&invite=first",
        rememberBootstrap: vi.fn(),
        scrub,
      }),
    ).toEqual({ kind: "invite", token: "first" });
    expect(scrub).toHaveBeenCalledOnce();

    expect(
      workspaceIdentityTransitions.consumeLocation({
        hash: "#employer=record-7",
        rememberBootstrap: vi.fn(),
        scrub,
      }),
    ).toEqual({ kind: "discarded" });
  });

  it("scrubs a bootstrap secret even if browser storage rejects it", () => {
    const scrub = vi.fn();
    expect(() =>
      workspaceIdentityTransitions.consumeLocation({
        hash: "#bootstrap=private-value",
        rememberBootstrap: () => {
          throw new Error("quota mentions private-value");
        },
        scrub,
      }),
    ).toThrow("CREDENTIAL_STORAGE_UNAVAILABLE");
    expect(scrub).toHaveBeenCalledOnce();
  });

  it("plans identity-bound cleanup without absorbing navigation behavior", () => {
    expect(workspaceIdentityTransitions.plan("authentication_required")).toEqual({
      clearDrafts: true,
      clearDashboard: true,
      requireAuthentication: true,
      closeMobileNavigation: true,
    });
    expect(workspaceIdentityTransitions.plan("session_lost")).toEqual({
      clearCredentials: true,
      clearDrafts: true,
      clearDashboard: true,
      requireAuthentication: true,
      closeMobileNavigation: true,
    });
    expect(workspaceIdentityTransitions.plan("workspace_opened")).toEqual({
      clearCredentials: true,
      clearDrafts: true,
      receipt: "retire_completed",
    });
    expect(workspaceIdentityTransitions.plan("identity_changed")).toEqual({
      clearDrafts: true,
      closeMobileNavigation: true,
    });
    expect(
      workspaceIdentityTransitions.plan({
        kind: "deletion_recorded",
        receipt: { token: "status-token", state: "cleanup_pending", message: "Pending" },
      }),
    ).toMatchObject({
      clearDrafts: true,
      receipt: { token: "status-token", state: "cleanup_pending" },
    });
  });
});
