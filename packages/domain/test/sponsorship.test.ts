import { describe, expect, it } from "vitest";
import {
  buildEmployerCandidates,
  employerRegistryChecksum,
  evaluateEmployerResolution,
  freshH1bLabel,
  governmentDatasetProvenanceChecksum,
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

  it("builds a deterministic reviewed-alias registry without merging collisions", () => {
    const candidates = buildEmployerCandidates(
      ["Northwind Systems, Inc.", "Contoso LLC", "Northwind Systems"],
      [
        { canonicalCompany: "Contoso", alias: "Shared DBA" },
        { canonicalCompany: "Northwind Systems", alias: "Northwind Global" },
        { canonicalCompany: "Northwind Systems", alias: "Shared DBA" },
      ],
    );
    expect(candidates).toEqual([
      { id: "contoso", name: "Contoso LLC", aliases: ["Shared DBA"] },
      {
        id: "northwind systems",
        name: "Northwind Systems",
        aliases: ["Northwind Global", "Shared DBA"],
      },
    ]);
    expect(resolveEmployer("Northwind Global", candidates)).toEqual({
      state: "resolved",
      id: "northwind systems",
    });
    expect(resolveEmployer("Shared DBA", candidates)).toEqual({ state: "ambiguous" });
    expect(employerRegistryChecksum(candidates)).toMatch(/^[a-f0-9]{64}$/u);
    expect(
      employerRegistryChecksum(
        buildEmployerCandidates(
          ["Contoso LLC", "Northwind Systems", "Northwind Systems, Inc."],
          [
            { canonicalCompany: "Northwind Systems", alias: "Shared DBA" },
            { canonicalCompany: "Northwind Systems", alias: "Northwind Global" },
            { canonicalCompany: "Contoso", alias: "Shared DBA" },
          ],
        ),
      ),
    ).toBe(employerRegistryChecksum(candidates));
  });

  it("binds every reviewed government provenance field into one checksum", () => {
    const provenance = {
      version: "government_dataset_provenance_v1" as const,
      sourceType: "dol_oflc_bulk" as const,
      sourceEdition: "synthetic-fy2026q2",
      sourcePageUrl: "https://dol.example.test/performance",
      archiveUrl: "https://dol.example.test/archive.zip",
      archiveSha256: "a".repeat(64),
      layoutUrl: "https://dol.example.test/layout.xlsx",
      layoutSha256: "b".repeat(64),
      layoutVersion: "synthetic-layout-v1",
      retrievedAt: "2026-08-28T00:00:00.000Z",
      dataAsOf: "2026-06-30",
      rowSetChecksum: "c".repeat(64),
      transformationVersion: "government_ingest_v1",
      reuseNotice: "Synthetic fixture only.",
      reviewer: "Synthetic provenance reviewer",
      reviewedAt: "2026-08-28T00:00:00.000Z",
    };
    const checksum = governmentDatasetProvenanceChecksum(provenance);
    expect(checksum).toMatch(/^[a-f0-9]{64}$/u);
    expect(
      governmentDatasetProvenanceChecksum({
        ...provenance,
        layoutSha256: "d".repeat(64),
      }),
    ).not.toBe(checksum);
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
