import { describe, expect, it } from "vitest";
import { describeApplicationDurations } from "../src/career-operations.js";

describe("candidate-owned descriptive application insights", () => {
  it("reports medians with sample sizes and leaves missing observations empty", () => {
    const durations = describeApplicationDurations([
      {
        id: "one",
        status: "submitted_externally",
        createdAt: "2026-08-01T00:00:00.000Z",
        statusEvents: [
          {
            id: "one-tracked",
            applicationId: "one",
            fromStatus: null,
            toStatus: "tracked",
            source: "candidate",
            occurredAt: "2026-08-01T00:00:00.000Z",
          },
          {
            id: "one-prepared",
            applicationId: "one",
            fromStatus: "tracked",
            toStatus: "prepared",
            source: "candidate",
            occurredAt: "2026-08-03T00:00:00.000Z",
          },
          {
            id: "one-submitted",
            applicationId: "one",
            fromStatus: "approved_for_export",
            toStatus: "submitted_externally",
            source: "candidate",
            occurredAt: "2026-08-05T00:00:00.000Z",
          },
        ],
        outcomes: [{ type: "reply", occurredAt: "2026-08-08T00:00:00.000Z" }],
      },
      {
        id: "two",
        status: "prepared",
        createdAt: "2026-08-10T00:00:00.000Z",
        statusEvents: [
          {
            id: "two-tracked",
            applicationId: "two",
            fromStatus: null,
            toStatus: "tracked",
            source: "candidate",
            occurredAt: "2026-08-10T00:00:00.000Z",
          },
          {
            id: "two-prepared",
            applicationId: "two",
            fromStatus: "tracked",
            toStatus: "prepared",
            source: "candidate",
            occurredAt: "2026-08-16T00:00:00.000Z",
          },
        ],
      },
    ]);

    expect(durations[0]).toMatchObject({ medianDays: 4, sampleSize: 2 });
    expect(durations[1]).toMatchObject({ medianDays: null, sampleSize: 0 });
    expect(durations[3]).toMatchObject({ medianDays: 3, sampleSize: 1 });
  });

  it("does not count outcomes recorded before external submission", () => {
    expect(
      describeApplicationDurations([
        {
          id: "application",
          status: "submitted_externally",
          createdAt: "2026-08-01T00:00:00.000Z",
          statusEvents: [
            {
              id: "submitted",
              applicationId: "application",
              fromStatus: "approved_for_export",
              toStatus: "submitted_externally",
              source: "candidate",
              occurredAt: "2026-08-05T00:00:00.000Z",
            },
          ],
          outcomes: [{ type: "interview", occurredAt: "2026-08-04T00:00:00.000Z" }],
        },
      ])[3],
    ).toMatchObject({ medianDays: null, sampleSize: 0 });
  });

  it("never treats a migration snapshot as reconstructed stage history", () => {
    expect(
      describeApplicationDurations([
        {
          id: "legacy-application",
          status: "prepared",
          createdAt: "2026-07-01T00:00:00.000Z",
          statusEvents: [
            {
              id: "migration-snapshot",
              applicationId: "legacy-application",
              fromStatus: null,
              toStatus: "tracked",
              source: "migration",
              occurredAt: "2026-07-01T00:00:00.000Z",
            },
            {
              id: "candidate-prepared",
              applicationId: "legacy-application",
              fromStatus: "tracked",
              toStatus: "prepared",
              source: "candidate",
              occurredAt: "2026-08-01T00:00:00.000Z",
            },
          ],
        },
      ])[0],
    ).toMatchObject({ medianDays: null, sampleSize: 0 });
  });
});
