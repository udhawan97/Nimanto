import { describe, expect, it } from "vitest";
import { APPLICATION_STATUSES, applicationTransitions } from "../src/applications.js";

describe("application transition policy", () => {
  it("exposes only legal candidate options and their confirmation requirement", () => {
    expect(applicationTransitions.candidate("tracked").options).toEqual([
      { to: "prepared", confirmation: "none" },
      { to: "withdrawn", confirmation: "required" },
    ]);
    expect(applicationTransitions.candidate("prepared").options).toEqual([
      { to: "tracked", confirmation: "none" },
      { to: "approved_for_export", confirmation: "required" },
      { to: "withdrawn", confirmation: "required" },
    ]);
  });

  it("distinguishes unchanged, allowed, confirmation-required, and illegal moves", () => {
    const tracked = applicationTransitions.candidate("tracked");
    expect(tracked.decide("tracked")).toEqual({ kind: "unchanged", status: "tracked" });
    expect(tracked.decide("prepared")).toEqual({
      kind: "allowed",
      transition: { to: "prepared" },
    });
    expect(tracked.decide("withdrawn")).toEqual({
      kind: "confirmation_required",
      to: "withdrawn",
    });
    expect(tracked.decide("withdrawn", { confirmed: true })).toEqual({
      kind: "allowed",
      transition: { to: "withdrawn" },
    });
    expect(tracked.decide("submitted_externally", { confirmed: true })).toEqual({
      kind: "illegal",
      code: "INVALID_APPLICATION_TRANSITION",
    });
  });

  it("keeps packet consequences separate from candidate legality", () => {
    expect(applicationTransitions.packet("tracked", "packet_generated")).toEqual({
      kind: "system_consequence",
      to: "prepared",
    });
    expect(applicationTransitions.packet("prepared", "packet_approved")).toEqual({
      kind: "system_consequence",
      to: "approved_for_export",
    });
    expect(applicationTransitions.candidate("withdrawn").decide("prepared")).toEqual({
      kind: "illegal",
      code: "INVALID_APPLICATION_TRANSITION",
    });
    expect(() => applicationTransitions.packet("tracked", "unknown" as never)).toThrow(
      "INVALID_PACKET_APPLICATION_EFFECT",
    );
  });

  it("preserves candidate-recorded submissions and withdrawals from packet effects", () => {
    for (const status of ["submitted_externally", "withdrawn"] as const) {
      expect(applicationTransitions.packet(status, "packet_generated")).toEqual({
        kind: "candidate_status_preserved",
        status,
      });
      expect(applicationTransitions.packet(status, "packet_approved")).toEqual({
        kind: "candidate_status_preserved",
        status,
      });
    }
  });

  it("rejects unknown statuses without throwing from ordinary policy decisions", () => {
    expect(applicationTransitions.isStatus("hired")).toBe(false);
    expect(applicationTransitions.isStatus("tracked")).toBe(true);
    expect(applicationTransitions.candidate("nonsense" as never).options).toEqual([]);
    expect(applicationTransitions.candidate("nonsense" as never).decide("tracked")).toEqual({
      kind: "illegal",
      code: "INVALID_APPLICATION_TRANSITION",
    });
  });

  it("never strands a known status", () => {
    for (const status of APPLICATION_STATUSES) {
      expect(applicationTransitions.candidate(status).options.length).toBeGreaterThan(0);
    }
  });
});
