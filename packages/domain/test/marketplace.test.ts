import { describe, expect, it } from "vitest";
import {
  classifyRoleFamily,
  isValidatedRoleFamily,
  normalizeWorkplaceMode,
  validateStructuredArea,
  workModeConflict,
} from "../src/marketplace.js";

describe("marketplace normalization", () => {
  it.each([
    ["Remote", "remote"],
    ["on-site", "onsite"],
    ["in office", "onsite"],
    ["hybrid", "hybrid"],
    ["flexible", "unknown"],
  ])("normalizes %s as %s", (input, expected) => {
    expect(normalizeWorkplaceMode(input)).toBe(expected);
  });

  it("retains conflicting high-confidence workplace observations", () => {
    const common = {
      method: "source_structured" as const,
      sourceText: "value",
      sourceFieldOrLocator: "workplaceType",
      observedAt: "2026-08-26T00:00:00.000Z",
      normalizerVersion: "workplace_normalizer_v1" as const,
      confidence: "high" as const,
      eligibleRemoteAreas: [],
      physicalLocations: [],
    };
    expect(
      workModeConflict([
        { ...common, mode: "remote" },
        { ...common, mode: "onsite" },
      ]),
    ).toBe("conflicting");
  });

  it("requires ambiguous geography to remain unknown", () => {
    expect(
      validateStructuredArea({
        displayLabel: "Georgia",
        countryCode: "US",
        subdivisionCode: "US-GA",
        metroId: null,
        timeZone: "America/New_York",
        resolution: "unknown",
      }),
    ).toEqual({
      displayLabel: "Georgia",
      countryCode: null,
      subdivisionCode: null,
      metroId: null,
      timeZone: null,
      resolution: "unknown",
    });
  });

  it("validates canonical geography and role-family gates", () => {
    expect(
      validateStructuredArea({
        displayLabel: "Illinois",
        countryCode: "US",
        subdivisionCode: "US-IL",
        metroId: null,
        timeZone: "America/Chicago",
        resolution: "confirmed",
      }),
    ).toMatchObject({ subdivisionCode: "US-IL", timeZone: "America/Chicago" });
    expect(classifyRoleFamily("Machine Learning Engineer")).toBe("ai_ml");
    expect(isValidatedRoleFamily(classifyRoleFamily("Product Manager"))).toBe(false);
  });
});
