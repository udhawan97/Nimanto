import { describe, expect, it } from "vitest";
import {
  APPLICATION_STATUSES,
  applicationTransitionNeedsConfirmation,
  isApplicationTransitionLegal,
  transitionApplication,
} from "../src/applications.js";

describe("application status transitions", () => {
  it("allows the ordinary preparation path to move in both directions", () => {
    expect(transitionApplication("tracked", "prepared")).toEqual({
      status: "prepared",
      clearSubmittedAt: false,
    });
    expect(transitionApplication("prepared", "tracked")).toEqual({
      status: "tracked",
      clearSubmittedAt: false,
    });
  });

  it("refuses to skip preparation on the way to an external submission", () => {
    expect(() => transitionApplication("tracked", "submitted_externally")).toThrow(
      /tracked -> submitted_externally/,
    );
    expect(isApplicationTransitionLegal("tracked", "submitted_externally")).toBe(false);
  });

  it("clears the submission timestamp when an application leaves submitted_externally", () => {
    // The store stamps submitted_at on entry and previously never cleared it, so a
    // corrected mis-drop left a false submission record on the candidate's own file.
    expect(transitionApplication("submitted_externally", "approved_for_export")).toEqual({
      status: "approved_for_export",
      clearSubmittedAt: true,
    });
    expect(transitionApplication("submitted_externally", "withdrawn")).toEqual({
      status: "withdrawn",
      clearSubmittedAt: true,
    });
  });

  it("keeps the submission timestamp for every transition that is not an exit", () => {
    for (const status of APPLICATION_STATUSES) {
      for (const next of APPLICATION_STATUSES) {
        if (!isApplicationTransitionLegal(status, next)) continue;
        if (status === "submitted_externally" && next !== "submitted_externally") continue;
        expect(transitionApplication(status, next).clearSubmittedAt).toBe(false);
      }
    }
  });

  it("treats a no-op as legal and inert", () => {
    for (const status of APPLICATION_STATUSES) {
      expect(transitionApplication(status, status)).toEqual({
        status,
        clearSubmittedAt: false,
      });
      expect(applicationTransitionNeedsConfirmation(status, status)).toBe(false);
    }
  });

  it("requires confirmation for every status that records a consequential fact", () => {
    expect(applicationTransitionNeedsConfirmation("prepared", "approved_for_export")).toBe(true);
    expect(
      applicationTransitionNeedsConfirmation("approved_for_export", "submitted_externally"),
    ).toBe(true);
    expect(applicationTransitionNeedsConfirmation("tracked", "withdrawn")).toBe(true);
  });

  it("lets the candidate move freely between tracked and prepared", () => {
    expect(applicationTransitionNeedsConfirmation("tracked", "prepared")).toBe(false);
    expect(applicationTransitionNeedsConfirmation("prepared", "tracked")).toBe(false);
  });

  it("lets a withdrawn application be reopened", () => {
    expect(transitionApplication("withdrawn", "tracked")).toEqual({
      status: "tracked",
      clearSubmittedAt: false,
    });
  });

  it("rejects a status outside the union", () => {
    expect(() => transitionApplication("tracked", "hired" as never)).toThrow(/Unknown/);
    expect(isApplicationTransitionLegal("nonsense" as never, "tracked")).toBe(false);
  });

  it("never leaves a status stranded with no legal exit", () => {
    for (const status of APPLICATION_STATUSES) {
      const exits = APPLICATION_STATUSES.filter(
        (next) => next !== status && isApplicationTransitionLegal(status, next),
      );
      expect(exits.length).toBeGreaterThan(0);
    }
  });
});
