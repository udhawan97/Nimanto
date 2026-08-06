import { describe, expect, it } from "vitest";
import {
  APPLICATION_STATUSES,
  applicationTransitionNeedsConfirmation,
  isApplicationTransitionLegal,
} from "@nimanto/domain";
import {
  BOARD_COLUMNS,
  FOLLOW_UP_DAYS,
  boardColumns,
  canMove,
  confirmationPrompt,
  daysSinceLastRecord,
  followUpNote,
  funnelStages,
  lastRecordedAt,
  needsConfirmation,
  nextSteps,
  type ApplicationStatus,
} from "../lib/derive.js";

const NOW = new Date("2026-08-05T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const empty = { evidence: [], jobs: [], matches: [], packets: [], externalActions: [] };

describe("next-step rail", () => {
  it("says nothing when there is nothing to do", () => {
    expect(nextSteps(empty)).toEqual([]);
  });

  it("puts pending evidence ahead of everything downstream of it", () => {
    // A single pending claim outranks ten packets: confirming evidence is what
    // unblocks matching, which unblocks packets.
    const steps = nextSteps({
      ...empty,
      evidence: [{ status: "pending" }],
      packets: Array.from({ length: 10 }, () => ({ status: "draft" })),
    });
    expect(steps[0]?.id).toBe("confirm-evidence");
    expect(steps[1]?.id).toBe("assure-packets");
  });

  it("orders the whole flow from earliest blockage to latest", () => {
    const steps = nextSteps({
      evidence: [{ status: "pending" }],
      jobs: [{ id: "job-1" }, { id: "job-2" }],
      matches: [{ job: { id: "job-2" }, result: { blockers: ["sponsorship"] } }],
      packets: [{ status: "draft" }],
      externalActions: [{ state: "pending_approval" }],
    });
    expect(steps.map((step) => step.id)).toEqual([
      "confirm-evidence",
      "run-matches",
      "review-blockers",
      "assure-packets",
      "approve-actions",
    ]);
  });

  it("counts only roles that have no explanation yet", () => {
    const steps = nextSteps({
      ...empty,
      jobs: [{ id: "a" }, { id: "b" }],
      matches: [{ job: { id: "a" }, result: { blockers: [] } }],
    });
    expect(steps).toHaveLength(1);
    expect(steps[0]?.title).toContain("1 role");
  });

  it("marks only the steps that are waiting on the candidate as live", () => {
    const steps = nextSteps({
      ...empty,
      evidence: [{ status: "pending" }],
      externalActions: [{ state: "pending_approval" }],
      jobs: [{ id: "a" }],
    });
    expect(steps.filter((step) => step.tone === "live").map((s) => s.id)).toEqual([
      "confirm-evidence",
      "approve-actions",
    ]);
  });

  it("ignores evidence that already has a decision", () => {
    expect(
      nextSteps({ ...empty, evidence: [{ status: "confirmed" }, { status: "rejected" }] }),
    ).toEqual([]);
  });

  it("singularises exactly one item", () => {
    const steps = nextSteps({ ...empty, evidence: [{ status: "pending" }] });
    expect(steps[0]?.title).toBe("Confirm 1 imported claim");
  });
});

describe("follow-up observation", () => {
  const app = (over: Partial<Parameters<typeof followUpNote>[0]> = {}) => ({
    id: "app-1",
    status: "submitted_externally" as ApplicationStatus,
    createdAt: daysAgo(40),
    outcomes: [],
    ...over,
  });

  it("uses the newest thing the candidate actually recorded", () => {
    expect(
      lastRecordedAt(app({ createdAt: daysAgo(40), outcomes: [{ occurredAt: daysAgo(3) }] })),
    ).toBe(daysAgo(3));
  });

  it("falls back to creation when no outcome exists", () => {
    expect(daysSinceLastRecord(app({ outcomes: [] }), NOW)).toBe(40);
  });

  it("stays silent below the threshold and speaks at it", () => {
    expect(followUpNote(app({ createdAt: daysAgo(FOLLOW_UP_DAYS - 1) }), NOW)).toBeNull();
    expect(followUpNote(app({ createdAt: daysAgo(FOLLOW_UP_DAYS) }), NOW)).not.toBeNull();
  });

  it("never infers an outcome from silence", () => {
    // The Applications page promises exactly this. The note must be an
    // observation about record-keeping, not a status.
    const note = followUpNote(app({ createdAt: daysAgo(60) }), NOW)!;
    expect(note).toMatch(/^Nothing recorded since /);
    for (const forbidden of [/stale/i, /cold/i, /ignored/i, /rejected/i, /likely/i, /no response/i]) {
      expect(note).not.toMatch(forbidden);
    }
  });

  it("says nothing about a withdrawn application", () => {
    expect(followUpNote(app({ status: "withdrawn", createdAt: daysAgo(90) }), NOW)).toBeNull();
  });

  it("survives a missing or unparseable timestamp", () => {
    expect(daysSinceLastRecord({ id: "x", status: "tracked" }, NOW)).toBeNull();
    expect(followUpNote({ id: "x", status: "tracked", createdAt: "not-a-date" }, NOW)).toBeNull();
  });
});

describe("pipeline board", () => {
  it("keeps a column for every status in the domain union", () => {
    expect(BOARD_COLUMNS.map((column) => column.id).sort()).toEqual(
      [...APPLICATION_STATUSES].sort(),
    );
  });

  it("groups applications into their column and drops none", () => {
    const applications = [
      { id: "1", status: "tracked" as ApplicationStatus },
      { id: "2", status: "tracked" as ApplicationStatus },
      { id: "3", status: "withdrawn" as ApplicationStatus },
    ];
    const columns = boardColumns(applications);
    expect(columns.flatMap((column) => column.items)).toHaveLength(applications.length);
    expect(columns.find((column) => column.id === "tracked")!.items).toHaveLength(2);
  });

  it("agrees with the server-side guard on every possible move", () => {
    // The board decides which drop targets to OFFER; the API decides what is
    // allowed. If these two ever disagree the UI starts proposing moves the
    // server will reject.
    for (const from of APPLICATION_STATUSES) {
      for (const to of APPLICATION_STATUSES) {
        expect([from, to, canMove(from as ApplicationStatus, to as ApplicationStatus)]).toEqual([
          from,
          to,
          isApplicationTransitionLegal(from, to),
        ]);
        expect([
          from,
          to,
          needsConfirmation(from as ApplicationStatus, to as ApplicationStatus),
        ]).toEqual([from, to, applicationTransitionNeedsConfirmation(from, to)]);
      }
    }
  });

  it("asks before recording an external submission, and says who did it", () => {
    const prompt = confirmationPrompt("submitted_externally", {
      id: "1",
      status: "approved_for_export",
      job: { title: "Platform Engineer", company: "Northwind" },
    });
    expect(prompt).toContain("Platform Engineer at Northwind");
    expect(prompt).toContain("Nimanto does not submit anything for you");
  });
});

describe("funnel", () => {
  it("reports counts and never a conversion rate", () => {
    const stages = funnelStages({
      sampleSize: 2,
      replies: 1,
      screens: 1,
      interviews: 0,
      offers: 0,
    });
    expect(stages.map((stage) => stage.count)).toEqual([2, 1, 1, 0, 0]);
    for (const stage of stages) {
      expect(Object.keys(stage)).toEqual(["id", "label", "count"]);
      expect(JSON.stringify(stage)).not.toMatch(/rate|percent|probability|%/i);
    }
  });
});
