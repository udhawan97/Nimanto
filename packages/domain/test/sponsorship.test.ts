import { describe, expect, it } from "vitest";
import {
  evaluateEmployerResolution,
  freshH1bLabel,
  normalizeEmployerName,
  resolveEmployer,
} from "../src/index.js";

describe("transfer-intelligence foundations", () => {
  it("normalizes reviewed employer suffixes but abstains on ambiguous aliases", () => {
    expect(normalizeEmployerName("Northwind Systems, Inc.")).toBe("northwind systems");
    expect(
      resolveEmployer("Northwind Systems Inc", [
        { id: "northwind", name: "Northwind Systems LLC" },
        { id: "contoso", name: "Contoso" },
      ]),
    ).toEqual({ state: "resolved", id: "northwind" });
    expect(
      resolveEmployer("Shared DBA", [
        { id: "one", name: "One", aliases: ["Shared DBA"] },
        { id: "two", name: "Two", aliases: ["Shared DBA"] },
      ]),
    ).toEqual({ state: "ambiguous" });
  });

  it("deterministically downgrades stale positive evidence to uncertain", () => {
    expect(
      freshH1bLabel(
        { label: "current_company_policy_support", observedAt: "2026-01-01T00:00:00.000Z" },
        new Date("2026-08-05T00:00:00.000Z"),
      ),
    ).toEqual({
      label: "uncertain",
      freshness: "stale",
      originalLabel: "current_company_policy_support",
    });
  });

  it("reports measured resolution precision, recall, abstention, and a confidence interval", () => {
    const candidates = [
      { id: "northwind", name: "Northwind Systems LLC" },
      { id: "contoso", name: "Contoso Inc" },
    ];
    const report = evaluateEmployerResolution(
      Array.from({ length: 100 }, (_, index) => ({
        sourceName: index % 2 === 0 ? "Northwind Systems, Inc." : "Contoso Corporation",
        expectedId: index % 2 === 0 ? "northwind" : "contoso",
      })),
      candidates,
    );
    expect(report).toMatchObject({
      sampleSize: 100,
      truePositives: 100,
      falsePositives: 0,
      precision: 1,
      recall: 1,
      abstentionRate: 0,
      predictedPositives: 100,
      uniqueFixtureCount: 2,
      enabled: false,
    });
    expect(report.precision95.lower).toBeGreaterThan(0.96);

    const representativeCandidates = Array.from({ length: 300 }, (_, index) => ({
      id: `employer-${index}`,
      name: `Employer ${index}`,
    }));
    const enabled = evaluateEmployerResolution(
      representativeCandidates.map((candidate) => ({
        sourceName: candidate.name,
        expectedId: candidate.id,
      })),
      representativeCandidates,
    );
    expect(enabled).toMatchObject({
      sampleSize: 300,
      predictedPositives: 300,
      uniqueFixtureCount: 300,
      precision: 1,
      enabled: true,
    });
    expect(enabled.precision95.lower).toBeGreaterThan(0.95);
  });
});
