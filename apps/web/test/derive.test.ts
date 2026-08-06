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
  failureMessage,
  followUpNote,
  funnelStages,
  lastRecordedAt,
  legalTargets,
  needsConfirmation,
  nextSteps,
  sectionFromHash,
  sectionHash,
  type ApplicationStatus,
} from "../lib/derive.js";

const NOW = new Date("2026-08-05T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const empty = {
  evidence: [],
  jobs: [],
  matches: [],
  packets: [],
  externalActions: [],
  applications: [],
};

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
      applications: [{ id: "app-1", jobId: "job-2", status: "tracked" }],
      packets: [{ status: "draft", applicationId: "app-1" }],
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

  // The rail existed to answer "now what?". Before this, it went green and said
  // "Nothing is waiting on you" at exactly the two points where the candidate
  // has an obvious next move and no prompt for it.
  it("asks the candidate to track a role once it is explained", () => {
    const steps = nextSteps({
      ...empty,
      jobs: [{ id: "job-1" }],
      matches: [{ job: { id: "job-1" }, result: { blockers: [] } }],
    });
    expect(steps.map((step) => step.id)).toEqual(["track-roles"]);
    expect(steps[0]?.title).toBe("Track 1 explained role");
    expect(steps[0]?.section).toBe("jobs");
  });

  it("asks for a packet once an application is tracked and has none", () => {
    const steps = nextSteps({
      ...empty,
      jobs: [{ id: "job-1" }],
      matches: [{ job: { id: "job-1" }, result: { blockers: [] } }],
      applications: [{ id: "app-1", jobId: "job-1", status: "tracked" }],
    });
    expect(steps.map((step) => step.id)).toEqual(["prepare-packets"]);
    expect(steps[0]?.section).toBe("packets");
  });

  it("stops asking once the role is tracked and the packet exists", () => {
    expect(
      nextSteps({
        ...empty,
        jobs: [{ id: "job-1" }],
        matches: [{ job: { id: "job-1" }, result: { blockers: [] } }],
        applications: [{ id: "app-1", jobId: "job-1", status: "prepared" }],
        packets: [{ status: "approved", applicationId: "app-1" }],
      }),
    ).toEqual([]);
  });

  it("does not chase an application the candidate already withdrew", () => {
    expect(
      nextSteps({
        ...empty,
        jobs: [{ id: "job-1" }],
        matches: [{ job: { id: "job-1" }, result: { blockers: [] } }],
        applications: [{ id: "app-1", jobId: "job-1", status: "withdrawn" }],
      }),
    ).toEqual([]);
  });

  it("counts only roles that have no explanation yet", () => {
    const steps = nextSteps({
      ...empty,
      jobs: [{ id: "a" }, { id: "b" }],
      matches: [{ job: { id: "a" }, result: { blockers: [] } }],
    });
    // "b" still needs explaining; "a" is explained and now needs tracking. Both
    // are real next steps, so assert the one this test is about rather than the
    // total.
    expect(steps.find((step) => step.id === "run-matches")?.title).toContain("1 role");
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
    for (const forbidden of [
      /stale/i,
      /cold/i,
      /ignored/i,
      /rejected/i,
      /likely/i,
      /no response/i,
    ]) {
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

describe("legal targets", () => {
  // Every status control must offer the same set the board offers. A control
  // that lists all five lets the candidate pick a move the domain forbids, and
  // learn about it from a rejected request.
  it("offers only moves the domain allows, plus the status already held", () => {
    expect(legalTargets("tracked")).toEqual(["tracked", "prepared", "withdrawn"]);
    expect(legalTargets("approved_for_export")).toEqual([
      "prepared",
      "approved_for_export",
      "submitted_externally",
      "withdrawn",
    ]);
  });

  // legalTargets is defined in terms of canMove, so asserting the two agree
  // proves nothing. What is worth pinning is that the offer set is exactly the
  // domain's own answer — the table in apps/web is a copy, and this is the
  // check that catches it drifting.
  it("offers exactly what the domain allows, for every status", () => {
    for (const from of APPLICATION_STATUSES) {
      const offered = legalTargets(from as ApplicationStatus).filter((to) => to !== from);
      const allowed = APPLICATION_STATUSES.filter(
        (to) => to !== from && isApplicationTransitionLegal(from, to),
      );
      expect([from, offered.toSorted()]).toEqual([from, allowed.toSorted()]);
    }
  });
});

describe("failure messages", () => {
  it("says nothing when the connection banner already owns the failure", () => {
    // The banner names which half is down and how to restart it. Repeating the
    // browser's own "Failed to fetch" underneath it is noise, not information.
    expect(failureMessage({ transport: true, message: "Failed to fetch" })).toBeNull();
  });

  it("turns a rejected transition into the order of stages", () => {
    const text = failureMessage({ code: "INVALID_APPLICATION_TRANSITION", message: "generic" })!;
    expect(text).toContain("Prepared");
    expect(text).not.toBe("generic");
  });

  it("keeps the server wording when the code is not one it can improve on", () => {
    expect(failureMessage({ code: "SOMETHING_NEW", message: "Server said this." })).toBe(
      "Server said this.",
    );
  });

  it("never surfaces a raw browser exception as user copy", () => {
    for (const raw of ["Failed to fetch", "NetworkError when attempting to fetch resource."]) {
      expect(failureMessage({ transport: true, message: raw })).toBeNull();
    }
  });
});

describe("section routing", () => {
  it("round-trips a section through the hash", () => {
    expect(sectionFromHash(sectionHash("packets"))).toBe("packets");
  });

  it("ignores a hash that is not a known section", () => {
    expect(sectionFromHash("#nonsense")).toBeNull();
    expect(sectionFromHash("")).toBeNull();
  });

  // The hash is already load-bearing for the credential handshake. A section
  // router that answered these would strand a secret in the back stack.
  it("refuses to read a section out of a credential hash", () => {
    expect(sectionFromHash("#bootstrap=secret-value")).toBeNull();
    expect(sectionFromHash("#invite=token-value")).toBeNull();
  });

  it("emits only the section name, never a record identifier", () => {
    expect(sectionHash("applications")).toBe("#applications");
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
