import { describe, expect, it } from "vitest";
import { APPLICATION_STATUSES, applicationTransitions } from "@nimanto/domain";
import {
  BOARD_COLUMNS,
  APPLICATION_MATCH_BUCKETS,
  FOLLOW_UP_DAYS,
  applicationCohortCounts,
  boardColumns,
  canMove,
  confirmationPrompt,
  daysSinceLastRecord,
  failureMessage,
  filterEvidence,
  filterApplications,
  followUpNote,
  funnelStages,
  lastRecordedAt,
  legalTargets,
  needsConfirmation,
  nextSteps,
  countedNoun,
  packetInventoryNotice,
  explanationFreshness,
  profileInputChanged,
  unscoredConfirmedClaims,
  profileVersionDiff,
  recordReviewQueue,
  recordedOutcomeTimeline,
  sortApplications,
  type ApplicationStatus,
} from "../lib/derive.js";
import { sectionFromHash, sectionHash } from "../lib/navigation-transitions.js";

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

describe("completion copy", () => {
  it("uses singular and plural nouns literally", () => {
    expect(countedNoun(0, "application")).toBe("0 applications");
    expect(countedNoun(1, "application")).toBe("1 application");
    expect(countedNoun(2, "application")).toBe("2 applications");
  });

  it("describes returned packet files and distinct file types", () => {
    expect(packetInventoryNotice({ artifacts: [] })).toBe(
      "Packet generated: 0 files across 0 file types.",
    );
    expect(
      packetInventoryNotice({
        artifacts: [{ filename: "packet.json", format: "canonical", sha256: "a" }],
      }),
    ).toBe("Packet generated: 1 file across 1 file type.");
    expect(
      packetInventoryNotice({
        artifacts: [
          { filename: "packet.json", format: "canonical", sha256: "a" },
          { filename: "resume.txt", format: "resume", sha256: "b" },
          { filename: "cover-letter.txt", format: "cover", sha256: "c" },
          { filename: "resume.docx", format: "resume", sha256: "d" },
          { filename: "cover-letter.docx", format: "cover", sha256: "e" },
          { filename: "packet.pdf", format: "combined", sha256: "f" },
        ],
      }),
    ).toBe("Packet generated: 6 files across 4 file types.");
  });
});

describe("profile input comparison", () => {
  const profile = { authorizationWording: "Caf\u00e9 eligible", claimIds: ["b", "a"] };

  it("treats NFC, surrounding whitespace, and claim order as equivalent", () => {
    expect(profileInputChanged(profile, "  Cafe\u0301 eligible  ", ["a", "b"])).toBe(false);
  });

  it("detects wording and confirmed-claim changes", () => {
    expect(profileInputChanged(profile, "Different wording", ["a", "b"])).toBe(true);
    expect(profileInputChanged(profile, "Caf\u00e9 eligible", ["a", "c"])).toBe(true);
  });
});

describe("unscored confirmed claims", () => {
  const profile = { authorizationWording: "Caf\u00e9 eligible", claimIds: ["b", "a"] };

  it("counts nothing when the saved version already covers every confirmed claim", () => {
    expect(unscoredConfirmedClaims(profile, ["a", "b"])).toBe(0);
  });

  /* `profileInputChanged` is also true for a wording edit or a claim removal.
   * Copy that names a count of unscored claims would be wrong in both cases,
   * so this counts added claims only. */
  it("ignores a claim removal, which changes the version without adding scoreable evidence", () => {
    expect(unscoredConfirmedClaims(profile, ["a"])).toBe(0);
  });

  it("counts only claims missing from the saved version", () => {
    expect(unscoredConfirmedClaims(profile, ["a", "b", "c"])).toBe(1);
    expect(unscoredConfirmedClaims(profile, ["a", "b", "c", "d"])).toBe(2);
  });

  it("counts every confirmed claim when no version has been saved yet", () => {
    expect(unscoredConfirmedClaims(null, ["a", "b"])).toBe(2);
  });
});

describe("explanation freshness", () => {
  const profile = { id: "v2", authorizationWording: "Café eligible", claimIds: ["a", "b"] };

  it("is current when the explanation was scored against the saved version", () => {
    expect(explanationFreshness({ profileVersionId: "v2" }, profile, ["a", "b"])).toBe("current");
  });

  it("reports an earlier version when the explanation predates the saved one", () => {
    expect(explanationFreshness({ profileVersionId: "v1" }, profile, ["a", "b"])).toBe(
      "scored_against_earlier_version",
    );
  });

  /* The case the whole loop exists for: the claim is confirmed but no version
   * carries it, so re-explaining produces an identical result. A freshness check
   * that only compares version ids cannot see this — a fresh explanation is
   * always stamped with the current version. */
  it("reports unsaved evidence even when the explanation is on the current version", () => {
    expect(explanationFreshness({ profileVersionId: "v2" }, profile, ["a", "b", "c"])).toBe(
      "confirmed_evidence_unsaved",
    );
  });

  it("prefers the unsaved-evidence remedy when both are true", () => {
    expect(explanationFreshness({ profileVersionId: "v1" }, profile, ["a", "b", "c"])).toBe(
      "confirmed_evidence_unsaved",
    );
  });

  it("reports unsaved evidence when no version has ever been saved", () => {
    expect(explanationFreshness({ profileVersionId: null }, null, ["a"])).toBe(
      "confirmed_evidence_unsaved",
    );
  });

  it("says nothing when there is no evidence and no version", () => {
    expect(explanationFreshness({ profileVersionId: null }, null, [])).toBe("current");
  });
});

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

  it("removes archived roles from active discovery prompts", () => {
    const steps = nextSteps({
      ...empty,
      jobs: [{ id: "active" }, { id: "archived", candidateDisposition: { state: "archived" } }],
      matches: [
        { job: { id: "active" }, result: { blockers: [] } },
        { job: { id: "archived" }, result: { blockers: ["sponsorship"] } },
      ],
      applications: [{ id: "tracked", jobId: "active", status: "tracked" }],
      packets: [{ status: "approved", applicationId: "tracked" }],
    });
    expect(steps).toEqual([]);
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

  it("adds the derived record-review queue without inferring an employer outcome", () => {
    const steps = nextSteps(
      {
        ...empty,
        applications: [
          { id: "app-1", jobId: "job-1", status: "submitted_externally", createdAt: daysAgo(14) },
        ],
      },
      NOW,
    );
    expect(steps.find((step) => step.id === "review-records")).toMatchObject({
      title: "Review 1 application record",
      section: "applications",
    });
    expect(steps.find((step) => step.id === "review-records")?.detail).toContain(
      "No outcome is inferred",
    );
  });

  it("names candidate-set and mixed review bases without claiming 336 elapsed hours for both", () => {
    const scheduled = nextSteps(
      {
        ...empty,
        applications: [
          {
            id: "scheduled",
            jobId: "job-1",
            status: "tracked",
            createdAt: daysAgo(1),
            followUpOn: "2026-08-05",
          },
        ],
      },
      NOW,
    ).find((step) => step.id === "review-records")!;
    expect(scheduled.detail).toBe("1 candidate-set follow-up date is due. No outcome is inferred.");

    const mixed = nextSteps(
      {
        ...empty,
        applications: [
          {
            id: "scheduled",
            jobId: "job-1",
            status: "tracked",
            createdAt: daysAgo(1),
            followUpOn: "2026-08-05",
          },
          {
            id: "derived",
            jobId: "job-2",
            status: "tracked",
            createdAt: daysAgo(20),
          },
        ],
      },
      NOW,
    ).find((step) => step.id === "review-records")!;
    expect(mixed.detail).toBe(
      "1 candidate-set date and 1 activity fallback are due. No outcome is inferred.",
    );
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

  it("stays silent on an unscheduled withdrawal and labels a retained date inactive", () => {
    expect(followUpNote(app({ status: "withdrawn", createdAt: daysAgo(90) }), NOW)).toBeNull();
    expect(followUpNote(app({ status: "withdrawn", followUpOn: "2026-08-05" }), NOW)).toMatch(
      /^Follow-up reminder inactive · /,
    );
  });

  it("names a candidate-set reminder without implying employer activity", () => {
    expect(followUpNote(app({ followUpOn: "2026-08-09" }), NOW)).toMatch(/^Follow-up reminder · /);
    const due = followUpNote(app({ followUpOn: "2026-08-05" }), NOW)!;
    expect(due).toMatch(/^Follow-up reminder due · /);
    expect(due).not.toMatch(/response|employer|rejected/iu);
  });

  it("parses low ISO years without remapping them into the twentieth century", () => {
    const note = followUpNote(app({ followUpOn: "0001-01-01" }), NOW);
    expect(note).toMatch(/^Follow-up reminder due · /);
    expect(recordReviewQueue([app({ followUpOn: "0001-01-01" })], NOW)[0]).toMatchObject({
      basis: "candidate_reminder",
      dueOn: "0001-01-01",
    });
  });

  it("survives a missing or unparseable timestamp", () => {
    expect(daysSinceLastRecord({ id: "x", status: "tracked" }, NOW)).toBeNull();
    expect(followUpNote({ id: "x", status: "tracked", createdAt: "not-a-date" }, NOW)).toBeNull();
  });
});

describe("record-review queue", () => {
  it("includes only non-withdrawn records whose literal activity is at least 336 hours old", () => {
    const applications = [
      {
        id: "due",
        status: "submitted_externally" as const,
        createdAt: daysAgo(30),
        outcomes: [{ occurredAt: daysAgo(14) }],
      },
      {
        id: "recent",
        status: "tracked" as const,
        createdAt: daysAgo(13),
        outcomes: [],
      },
      {
        id: "withdrawn",
        status: "withdrawn" as const,
        createdAt: daysAgo(90),
        outcomes: [],
      },
    ];
    expect(recordReviewQueue(applications, NOW).map((item) => item.application.id)).toEqual([
      "due",
    ]);
    expect(recordReviewQueue(applications, NOW)[0]).toMatchObject({
      elapsedHours: 336,
      lastRecordedAt: daysAgo(14),
      dueAt: NOW.toISOString(),
    });
  });

  it("orders records by their exact due instant even when floored elapsed hours tie", () => {
    const hour = 3_600_000;
    const minute = 60_000;
    const queue = recordReviewQueue(
      [
        {
          id: "a-later-due",
          status: "tracked" as const,
          createdAt: new Date(NOW.getTime() - 336 * hour - 10 * minute).toISOString(),
        },
        {
          id: "z-earlier-due",
          status: "tracked" as const,
          createdAt: new Date(NOW.getTime() - 336 * hour - 50 * minute).toISOString(),
        },
      ],
      NOW,
    );
    expect(queue.map((item) => item.application.id)).toEqual(["z-earlier-due", "a-later-due"]);
    expect(queue.map((item) => item.elapsedHours)).toEqual([336, 336]);
  });

  it("lets an explicit candidate date replace the derived 336-hour due date", () => {
    const queue = recordReviewQueue(
      [
        {
          id: "scheduled-future",
          status: "submitted_externally" as const,
          createdAt: daysAgo(40),
          followUpOn: "2026-08-09",
        },
        {
          id: "scheduled-due",
          status: "submitted_externally" as const,
          createdAt: daysAgo(2),
          followUpOn: "2026-08-05",
        },
        {
          id: "derived-due",
          status: "tracked" as const,
          createdAt: daysAgo(20),
          followUpOn: null,
        },
      ],
      NOW,
    );

    expect(queue.map((item) => item.application.id)).toEqual(["derived-due", "scheduled-due"]);
    expect(queue.find((item) => item.application.id === "scheduled-due")).toMatchObject({
      basis: "candidate_reminder",
      dueOn: "2026-08-05",
    });
    expect(queue.find((item) => item.application.id === "derived-due")).toMatchObject({
      basis: "record_activity",
    });
  });
});

describe("profile-version diff", () => {
  it("compares exact claim identifiers and authorization wording without interpretation", () => {
    expect(
      profileVersionDiff(
        { claimIds: ["claim-a", "claim-b"], authorizationWording: "Exact wording A" },
        { claimIds: ["claim-b", "claim-c"], authorizationWording: "Exact wording B" },
      ),
    ).toEqual({
      addedClaimIds: ["claim-c"],
      removedClaimIds: ["claim-a"],
      authorizationWordingChanged: true,
      beforeAuthorizationWording: "Exact wording A",
      afterAuthorizationWording: "Exact wording B",
    });
  });
});

describe("application cohort counts", () => {
  const applications = [
    {
      id: "a",
      jobId: "job-a",
      status: "tracked" as const,
      createdAt: "2026-08-01T12:00:00.000Z",
      outcomes: [{ type: "reply", occurredAt: "2026-08-02T12:00:00.000Z" }],
    },
    {
      id: "b",
      jobId: "job-b",
      status: "tracked" as const,
      createdAt: "2026-08-03T12:00:00.000Z",
      outcomes: [],
    },
    {
      id: "c",
      jobId: "job-c",
      status: "tracked" as const,
      createdAt: "2026-07-20T12:00:00.000Z",
      outcomes: [],
    },
  ];
  const jobs = [
    { id: "job-a", source: "greenhouse" },
    { id: "job-b", source: "manual" },
    { id: "job-c", source: "greenhouse" },
  ];
  const matches = [{ jobId: "job-a", result: { band: "strong_evidence" } }];

  it("uses an explicit creation-time cohort and mutually exclusive match classifications", () => {
    const result = applicationCohortCounts({
      applications,
      jobs,
      matches,
      startAt: "2026-08-01T00:00:00.000Z",
      endAtExclusive: "2026-08-05T00:00:00.000Z",
      source: "all",
      matchBucket: "all",
    });
    expect(result.sampleSize).toBe(2);
    expect(result.byMatchBucket).toEqual({
      strong_evidence: 1,
      promising_evidence: 0,
      partial_evidence: 0,
      weak_evidence: 0,
      not_scored: 0,
      unmatched: 1,
      unknown: 0,
    });
    expect(Object.keys(result.byMatchBucket)).toEqual(APPLICATION_MATCH_BUCKETS);
    expect(result.outcomes).toMatchObject({ replies: 1, screens: 0, interviews: 0, offers: 0 });
  });

  it("filters by the current role source and current latest match snapshot", () => {
    expect(
      applicationCohortCounts({
        applications,
        jobs,
        matches,
        startAt: "2026-07-01T00:00:00.000Z",
        endAtExclusive: "2026-09-01T00:00:00.000Z",
        source: "greenhouse",
        matchBucket: "strong_evidence",
      }).applicationIds,
    ).toEqual(["a"]);
  });

  it("keeps an unrecognized stored band distinct from no stored match", () => {
    const result = applicationCohortCounts({
      applications,
      jobs,
      matches: [...matches, { jobId: "job-b", result: { band: "future_band" } }],
      startAt: "2026-08-01T00:00:00.000Z",
      endAtExclusive: "2026-08-05T00:00:00.000Z",
      source: "all",
      matchBucket: "all",
    });
    expect(result.byMatchBucket.unmatched).toBe(0);
    expect(result.byMatchBucket.unknown).toBe(1);
  });
});

describe("recorded outcome timeline", () => {
  it("orders only literal records and keeps the candidate's notes", () => {
    expect(
      recordedOutcomeTimeline({
        id: "app-1",
        status: "submitted_externally",
        createdAt: "2026-07-01T12:00:00.000Z",
        statusEvents: [
          {
            id: "status-tracked",
            fromStatus: null,
            toStatus: "tracked",
            source: "candidate",
            occurredAt: "2026-07-01T12:00:00.000Z",
          },
          {
            id: "status-submitted",
            fromStatus: "approved_for_export",
            toStatus: "submitted_externally",
            source: "candidate",
            occurredAt: "2026-07-06T12:00:00.000Z",
          },
        ],
        outcomes: [
          {
            id: "outcome-2",
            type: "interview",
            note: "Panel with the platform team",
            occurredAt: "2026-07-08T12:00:00.000Z",
          },
          {
            id: "outcome-1",
            type: "reply",
            note: "Recruiter asked for times",
            occurredAt: "2026-07-03T12:00:00.000Z",
          },
        ],
        notes: [
          {
            id: "note-1",
            text: "Need to verify the travel expectation",
            recordedAt: "2026-07-04T12:00:00.000Z",
          },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        type: "status · tracked",
        note: "Candidate-recorded application status",
      }),
      expect.objectContaining({ type: "reply", note: "Recruiter asked for times" }),
      expect.objectContaining({
        type: "private note",
        note: "Need to verify the travel expectation",
      }),
      expect.objectContaining({ type: "status · submitted_externally" }),
      expect.objectContaining({ type: "interview", note: "Panel with the platform team" }),
    ]);
  });

  it("does not manufacture a status when no record exists", () => {
    expect(recordedOutcomeTimeline({ id: "app-1", status: "tracked" })).toEqual([]);
  });
});

describe("ephemeral evidence filters", () => {
  const evidence = [
    {
      id: "skill",
      kind: "skill",
      value: "TypeScript platform work",
      status: "confirmed",
      sourceName: "resume.pdf",
      locator: "page 2",
    },
    {
      id: "project",
      kind: "project",
      value: "Designed a local-first workbench",
      status: "pending",
      sourceName: "portfolio.md",
      locator: "Nimanto",
    },
  ];

  it("searches literal claim and provenance fields without changing the records", () => {
    const before = structuredClone(evidence);
    expect(
      filterEvidence(evidence, {
        query: "PAGE 2",
        kind: "all",
        status: "all",
        source: "all",
      }),
    ).toEqual([evidence[0]]);
    expect(
      filterEvidence(evidence, {
        query: "local-first",
        kind: "project",
        status: "pending",
        source: "portfolio.md",
      }),
    ).toEqual([evidence[1]]);
    expect(evidence).toEqual(before);
  });
});

describe("ephemeral application filters", () => {
  const jobs = [
    { id: "job-a", source: "greenhouse" },
    { id: "job-b", source: "manual" },
  ];
  const applications = [
    {
      id: "a",
      jobId: "job-a",
      status: "tracked" as const,
      followUpOn: "2026-08-05",
      job: { title: "Platform Engineer", company: "Northwind" },
      outcomes: [{ type: "reply", note: "Recruiter asked about Chicago", occurredAt: daysAgo(1) }],
      notes: [{ text: "Review the travel policy", recordedAt: daysAgo(2) }],
    },
    {
      id: "b",
      jobId: "job-b",
      status: "withdrawn" as const,
      followUpOn: "2026-08-07",
      job: { title: "Data Engineer", company: "Contoso" },
    },
  ];

  it("combines search, source, status, and literal reminder state without mutation", () => {
    const before = structuredClone(applications);
    expect(
      filterApplications(
        applications,
        jobs,
        { query: "north", source: "greenhouse", status: "tracked", followUp: "due" },
        new Date("2026-08-05T12:00:00.000Z"),
      ),
    ).toEqual([applications[0]]);
    expect(
      filterApplications(
        applications,
        jobs,
        { query: "", source: "all", status: "all", followUp: "inactive" },
        new Date("2026-08-05T12:00:00.000Z"),
      ),
    ).toEqual([applications[1]]);
    expect(applications).toEqual(before);
  });

  it("searches literal private-note and outcome text without inferring a result", () => {
    expect(
      filterApplications(
        applications,
        jobs,
        { query: "travel policy", source: "all", status: "all", followUp: "all" },
        NOW,
      ),
    ).toEqual([applications[0]]);
    expect(
      filterApplications(
        applications,
        jobs,
        { query: "chicago", source: "all", status: "all", followUp: "all" },
        NOW,
      ),
    ).toEqual([applications[0]]);
  });

  it("sorts a copied view by explicit literal fields and preserves stored order by default", () => {
    const dated = [
      { ...applications[0]!, createdAt: "2026-08-01T00:00:00.000Z", followUpOn: null },
      { ...applications[1]!, createdAt: "2026-08-03T00:00:00.000Z", followUpOn: "2026-08-07" },
    ];
    expect(sortApplications(dated, "stored")).toEqual(dated);
    expect(sortApplications(dated, "newest").map((item) => item.id)).toEqual(["b", "a"]);
    expect(sortApplications(dated, "role").map((item) => item.id)).toEqual(["b", "a"]);
    expect(sortApplications(dated, "follow_up").map((item) => item.id)).toEqual(["b", "a"]);
    expect(dated[0]?.id).toBe("a");
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
          applicationTransitions.candidate(from).decide(to).kind !== "illegal",
        ]);
        expect([
          from,
          to,
          needsConfirmation(from as ApplicationStatus, to as ApplicationStatus),
        ]).toEqual([
          from,
          to,
          applicationTransitions.candidate(from).options.find((option) => option.to === to)
            ?.confirmation === "required",
        ]);
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
        (to) => to !== from && applicationTransitions.candidate(from).decide(to).kind !== "illegal",
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

  it("explains a missing server-side consequential confirmation", () => {
    expect(
      failureMessage({
        code: "APPLICATION_TRANSITION_CONFIRMATION_REQUIRED",
        message: "generic",
      }),
    ).toContain("Confirm");
  });

  it("turns an invalid compensation range into a field-level correction", () => {
    expect(failureMessage({ code: "INVALID_COMPENSATION", message: "generic" })).toBe(
      "The posted annual maximum must be greater than or equal to the minimum.",
    );
  });

  it("names every input that can stale an approved action, not only a newer packet", () => {
    expect(failureMessage({ code: "ACTION_APPROVAL_STALE", message: "generic" })).toBe(
      "This packet's Profile, Match, role, or evidence inputs changed since approval. Compose, assure, and approve a current packet.",
    );
  });

  it("requires a replacement action when the selected packet is no longer current", () => {
    expect(failureMessage({ code: "LATEST_APPROVED_PACKET_REQUIRED", message: "generic" })).toBe(
      "A newer packet replaced the one selected for this action. Refresh, review and approve the current packet, then create and approve a replacement action.",
    );
  });

  it("routes stale composed packets back through the exact Match gate", () => {
    expect(failureMessage({ code: "SUBMISSION_PACKET_INPUT_CHANGED", message: "generic" })).toBe(
      "The role or Match changed after this packet was composed. Publish, compose, assure, and approve the current inputs first.",
    );
  });

  it("routes a stale Profile evidence selection back through candidate review", () => {
    expect(failureMessage({ code: "PROFILE_EVIDENCE_CHANGED", message: "generic" })).toContain(
      "save a current Profile Version",
    );
  });

  it("explains why an older packet cannot support a new submission record", () => {
    expect(
      failureMessage({ code: "SUBMISSION_CURRENT_APPROVED_PACKET_REQUIRED", message: "generic" }),
    ).toContain("no longer the current approved packet");
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

  it("makes the local activity ledger a first-class deep-linkable section", () => {
    expect(sectionFromHash("#activity")).toBe("activity");
  });

  it("makes stored history a first-class deep-linkable section", () => {
    expect(sectionFromHash("#history")).toBe("history");
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

describe("packet currentness failures", () => {
  it("tells the candidate a newer packet exists rather than repeating the API code", () => {
    expect(failureMessage({ code: "PACKET_NOT_CURRENT", message: "PACKET_NOT_CURRENT" })).toBe(
      "A newer packet exists for this application. Review and approve the current packet.",
    );
  });
});
