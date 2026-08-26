import { describe, expect, it } from "vitest";
import { buildApplicationCsv } from "../lib/application-csv-export.js";

describe("focused application CSV export", () => {
  it("exports a deterministic tracker summary without private text", () => {
    const result = buildApplicationCsv(
      [
        {
          id: "application-1",
          jobId: "job-1",
          status: "submitted_externally",
          createdAt: "2026-08-20T12:00:00.000Z",
          updatedAt: "2026-08-24T12:00:00.000Z",
          submittedAt: "2026-08-24T12:00:00.000Z",
          followUpOn: "2026-08-30",
          job: { title: "Platform, Engineer", company: "Northwind" },
          outcomes: [{ note: "Sensitive recruiter wording" }],
          notes: [{ text: "Sensitive private note" }],
        },
      ],
      [{ id: "job-1", source: "greenhouse" }],
      new Date("2026-08-25T12:34:56.000Z"),
    );

    expect(result).toMatchObject({
      rowCount: 1,
      filename: "nimanto-applications-2026-08-25.csv",
    });
    expect(result.content).toContain('"Platform, Engineer"');
    expect(result.content).toContain('"greenhouse"');
    expect(result.content).toContain('"1","1"\r\n');
    expect(result.content).not.toContain("Sensitive recruiter wording");
    expect(result.content).not.toContain("Sensitive private note");
  });

  it("neutralizes spreadsheet formulas while preserving Unicode and RFC 4180 quoting", () => {
    const result = buildApplicationCsv(
      [
        {
          id: "application-2",
          jobId: "job-2",
          status: "tracked",
          job: { title: '=HYPERLINK("https://bad.test")', company: "+Café 東京" },
        },
      ],
      [{ id: "job-2", source: "manual" }],
      new Date("2026-08-25T12:34:56.000Z"),
    );

    expect(result.content.startsWith('\uFEFF"application_id"')).toBe(true);
    expect(result.content).toContain('"\'=HYPERLINK(""https://bad.test"")"');
    expect(result.content).toContain('"\'+Café 東京"');
  });

  it("preserves the candidate's explicit working-view order", () => {
    const result = buildApplicationCsv(
      [
        { id: "application-z", status: "tracked", job: { title: "Zeta", company: "A" } },
        { id: "application-a", status: "tracked", job: { title: "Alpha", company: "B" } },
      ],
      [],
      new Date("2026-08-25T12:34:56.000Z"),
    );

    expect(result.content.indexOf("application-z")).toBeLessThan(
      result.content.indexOf("application-a"),
    );
  });
});
