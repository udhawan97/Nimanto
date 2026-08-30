import { describe, expect, it } from "vitest";
import { changedApplicationsForView } from "../lib/career-ledger.js";

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
});
