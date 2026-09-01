import { describe, expect, it } from "vitest";
import { deriveExternalActionRuntimeView } from "../lib/external-action-runtime.js";

describe("external action runtime projection", () => {
  it("never presents execution as on when the operator ceiling is off", () => {
    expect(
      deriveExternalActionRuntimeView({
        operatorEnabled: false,
        tenantReady: true,
        externalActionsEnabled: true,
      }),
    ).toMatchObject({
      effectiveEnabled: false,
      nextTenantReady: false,
      statusLabel: "Execution runtime is off",
      toggleLabel: "Turn workspace opt-in off",
      explanation: expect.stringContaining("operator ceiling is off"),
    });
  });

  it("distinguishes tenant opt-in from effective execution", () => {
    expect(
      deriveExternalActionRuntimeView({
        operatorEnabled: true,
        tenantReady: false,
        externalActionsEnabled: false,
      }),
    ).toMatchObject({
      effectiveEnabled: false,
      nextTenantReady: true,
      toggleLabel: "Turn workspace opt-in on",
      explanation: expect.stringContaining("workspace's opt-in is off"),
    });
    expect(
      deriveExternalActionRuntimeView({
        operatorEnabled: true,
        tenantReady: true,
        externalActionsEnabled: true,
      }),
    ).toMatchObject({
      effectiveEnabled: true,
      nextTenantReady: false,
      statusLabel: "Execution runtime is on",
      toggleLabel: "Turn workspace opt-in off",
    });
  });

  it("explains a service-reported effective gate that remains off", () => {
    expect(
      deriveExternalActionRuntimeView({
        operatorEnabled: true,
        tenantReady: true,
        externalActionsEnabled: false,
      }),
    ).toMatchObject({
      effectiveEnabled: false,
      explanation: expect.stringContaining("service still reports execution unavailable"),
    });
  });
});
