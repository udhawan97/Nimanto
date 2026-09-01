import { describe, expect, it } from "vitest";
import {
  careerLedgerInsightCounts,
  changedApplicationsForView,
  projectApplicationView,
} from "../lib/career-ledger.js";

describe("Career Ledger insight counts", () => {
  it("keeps cancelled work in history without counting it as planned or active", () => {
    expect(
      careerLedgerInsightCounts({
        activities: [{ state: "planned" }, { state: "completed" }, { state: "cancelled" }],
        interviews: [{ state: "scheduled" }, { state: "completed" }, { state: "cancelled" }],
      }),
    ).toEqual({
      plannedActivities: 1,
      completedActivities: 1,
      nonCancelledInterviews: 2,
      completedInterviews: 1,
    });
  });
});

describe("saved application review views", () => {
  const applications = [
    {
      id: "changed",
      jobId: "manual-job",
      status: "tracked" as const,
      updatedAt: "2026-08-30T12:00:00.000Z",
      job: { title: "Platform Engineer", company: "Northwind" },
    },
    {
      id: "unchanged",
      jobId: "manual-old",
      status: "tracked" as const,
      updatedAt: "2026-08-20T12:00:00.000Z",
      job: { title: "Data Engineer", company: "Contoso" },
    },
    {
      id: "filtered",
      jobId: "provider-job",
      status: "prepared" as const,
      updatedAt: "2026-08-30T12:00:00.000Z",
      job: { title: "Platform Engineer", company: "Northwind Labs" },
    },
  ];
  const jobs = [
    { id: "manual-job", source: "manual", updatedAt: "2026-08-30T12:00:00.000Z" },
    { id: "manual-old", source: "manual", updatedAt: "2026-08-20T12:00:00.000Z" },
    { id: "provider-job", source: "greenhouse", updatedAt: "2026-08-30T12:00:00.000Z" },
  ];

  it("counts only matching records newer than the explicit watermark", () => {
    expect(
      changedApplicationsForView({
        applications,
        jobs,
        filters: { status: "tracked", source: "manual", query: "engineer" },
        lastReviewedAt: "2026-08-25T00:00:00.000Z",
      }),
    ).toEqual(["changed"]);
  });

  it("treats a never-reviewed view as an inbox without writing a watermark", () => {
    expect(
      changedApplicationsForView({
        applications,
        jobs,
        filters: { status: "tracked", source: "manual" },
        lastReviewedAt: null,
      }),
    ).toEqual(["changed", "unchanged"]);
  });

  it("preserves the existing 336-hour fallback in a saved Review due view", () => {
    expect(
      changedApplicationsForView({
        applications: [
          {
            ...applications[0]!,
            createdAt: "2026-08-01T00:00:00.000Z",
            updatedAt: "2026-08-30T12:00:00.000Z",
          },
          {
            ...applications[1]!,
            createdAt: "2026-08-29T00:00:00.000Z",
            updatedAt: "2026-08-30T12:00:00.000Z",
          },
        ],
        jobs,
        filters: { reviewOnly: true, status: "tracked", source: "manual" },
        lastReviewedAt: "2026-08-25T00:00:00.000Z",
        now: new Date("2026-08-30T12:00:00.000Z"),
      }),
    ).toEqual(["changed"]);
  });

  it("uses the same literal membership and order for the live and saved projections", () => {
    const withPrivateText = [
      {
        ...applications[0]!,
        notes: [
          {
            text: "Follow up about the platform migration",
            recordedAt: "2026-08-29T12:00:00.000Z",
          },
        ],
      },
      applications[1]!,
    ];
    const view = {
      reviewOnly: false,
      query: "migration",
      status: "tracked" as const,
      source: "manual",
      followUp: "all" as const,
      sort: "role" as const,
    };

    expect(
      projectApplicationView({ applications: withPrivateText, jobs, view }).applications.map(
        (application) => application.id,
      ),
    ).toEqual(["changed"]);
    expect(
      changedApplicationsForView({
        applications: withPrivateText,
        jobs,
        filters: view,
        lastReviewedAt: "2026-08-25T00:00:00.000Z",
      }),
    ).toEqual(["changed"]);
  });

  it("counts note-only and application-owned child changes after an old parent timestamp", () => {
    const oldParent = "2026-08-20T12:00:00.000Z";
    const noteOnly = {
      ...applications[0]!,
      id: "note-only",
      updatedAt: oldParent,
      notes: [{ text: "Candidate note", recordedAt: "2026-08-29T12:00:00.000Z" }],
    };
    const childOnly = {
      ...applications[1]!,
      id: "child-only",
      updatedAt: oldParent,
    };
    expect(
      changedApplicationsForView({
        applications: [noteOnly, childOnly],
        jobs: jobs.map((job) => ({ ...job, updatedAt: oldParent })),
        filters: { status: "tracked", source: "manual" },
        lastReviewedAt: "2026-08-25T00:00:00.000Z",
        careerOperations: {
          activities: [
            {
              applicationId: "child-only",
              occurredAt: null,
              createdAt: oldParent,
              updatedAt: "2026-08-30T12:00:00.000Z",
            },
          ],
          contacts: [],
          interviews: [
            {
              applicationId: "child-only",
              createdAt: oldParent,
              updatedAt: "2026-08-29T12:00:00.000Z",
            },
          ],
          offers: [],
        },
      }),
    ).toEqual(["note-only", "child-only"]);
  });
});
