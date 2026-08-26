import { describe, expect, it } from "vitest";
import { buildFollowUpCalendar } from "../lib/calendar-export.js";

describe("candidate follow-up calendar export", () => {
  it("exports active candidate-set dates as deterministic all-day events", () => {
    const calendar = buildFollowUpCalendar(
      [
        {
          id: "application-1",
          status: "tracked",
          followUpOn: "2026-08-30",
          job: { title: "Platform, Engineer", company: "Northwind; Labs" },
        },
        {
          id: "application-2",
          status: "withdrawn",
          followUpOn: "2026-08-31",
          job: { title: "Inactive role", company: "Contoso" },
        },
      ],
      new Date("2026-08-25T12:34:56.000Z"),
    );
    expect(calendar).toMatchObject({
      eventCount: 1,
      filename: "nimanto-follow-ups-2026-08-25.ics",
    });
    expect(calendar.content).toContain("DTSTART;VALUE=DATE:20260830\r\n");
    expect(calendar.content).toContain("SUMMARY:Review Platform\\, Engineer at Northwind\\; Labs");
    expect(calendar.content).toContain("UID:application-1@nimanto.local");
    expect(calendar.content).not.toContain("application-2");
    expect(calendar.content.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("creates no event when no active reminder exists", () => {
    expect(
      buildFollowUpCalendar(
        [{ id: "application-1", status: "tracked", followUpOn: null }],
        new Date("2026-08-25T12:34:56.000Z"),
      ).eventCount,
    ).toBe(0);
  });

  it("folds long Unicode content lines at 75 UTF-8 octets without splitting characters", () => {
    const calendar = buildFollowUpCalendar(
      [
        {
          id: "application-unicode",
          status: "tracked",
          followUpOn: "2026-09-01",
          job: {
            title: "Principal Platform Engineer for Global Accessibility",
            company: "Café 東京 Engineering Cooperative",
          },
        },
      ],
      new Date("2026-08-25T12:34:56.000Z"),
    );
    const physicalLines = calendar.content.split("\r\n");
    expect(physicalLines.some((line) => line.startsWith(" "))).toBe(true);
    expect(physicalLines.every((line) => new TextEncoder().encode(line).byteLength <= 75)).toBe(
      true,
    );
    expect(calendar.content).not.toContain("�");
  });
});
