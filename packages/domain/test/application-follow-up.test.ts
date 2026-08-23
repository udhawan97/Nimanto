import { describe, expect, it } from "vitest";
import { applicationFollowUpPolicy, candidateLocalDate } from "../src/application-follow-up.js";

describe("Application follow-up policy", () => {
  it("accepts one literal calendar date or null and rejects ambiguous inputs", () => {
    expect(applicationFollowUpPolicy.parse("2026-08-22")).toBe("2026-08-22");
    expect(applicationFollowUpPolicy.parse(null)).toBeNull();
    for (const value of ["", "08/22/2026", "2026-02-30", "0000-01-01", "2026-08-22T00:00:00Z"]) {
      expect(() => applicationFollowUpPolicy.parse(value)).toThrow("INVALID_FOLLOW_UP_DATE");
    }
  });

  it("keeps withdrawn dates inactive and permits only clearing them", () => {
    expect(
      applicationFollowUpPolicy.observe(
        { status: "withdrawn", followUpOn: "2026-08-22" },
        "2026-08-30",
      ),
    ).toEqual({ kind: "inactive", date: "2026-08-22" });
    expect(applicationFollowUpPolicy.change("withdrawn", null)).toEqual({ kind: "allowed" });
    expect(() => applicationFollowUpPolicy.change("tracked", "2026-02-30")).toThrow(
      "INVALID_FOLLOW_UP_DATE",
    );
    expect(() => applicationFollowUpPolicy.change("withdrawn", "2026-09-01")).toThrow(
      "FOLLOW_UP_UNAVAILABLE",
    );
  });

  it("distinguishes scheduled and due dates without inferring an outcome", () => {
    expect(
      applicationFollowUpPolicy.observe(
        { status: "submitted_externally", followUpOn: "2026-08-23" },
        "2026-08-22",
      ),
    ).toEqual({ kind: "scheduled", date: "2026-08-23" });
    expect(
      applicationFollowUpPolicy.observe(
        { status: "submitted_externally", followUpOn: "2026-08-22" },
        "2026-08-22",
      ),
    ).toEqual({ kind: "due", date: "2026-08-22" });
    expect(
      applicationFollowUpPolicy.observe(
        { status: "submitted_externally", followUpOn: null },
        "2026-08-22",
      ),
    ).toEqual({ kind: "none" });
  });

  it("derives the candidate-local day from the local calendar boundary", () => {
    expect(candidateLocalDate(new Date(2026, 7, 22, 0, 1))).toBe("2026-08-22");
    expect(candidateLocalDate(new Date(2026, 7, 21, 23, 59))).toBe("2026-08-21");
  });
});
