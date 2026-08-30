import { describe, expect, it, vi } from "vitest";
import type { NimantoStore } from "@nimanto/database";
import { buildEmployerCandidates, canonicalHash, employerRegistryChecksum } from "@nimanto/domain";
import { GovernmentDatasetIngestion } from "../src/government-dataset.js";

describe("GovernmentDatasetIngestion employer registry binding", () => {
  it("links a reviewed alias only while the trusted evaluation matches the exact registry", async () => {
    const aliases = Array.from({ length: 300 }, (_, index) => ({
      canonicalCompany: "Northwind Systems",
      alias: `Northwind Legal Entity ${index}`,
    }));
    const candidates = buildEmployerCandidates(["Northwind Systems"], aliases);
    const fixtures = aliases.map((entry) => ({
      sourceName: entry.alias,
      expectedId: "northwind systems",
    }));
    const importH1bDatasetEdition = vi.fn(async (_tenantId: string, input: any) => ({
      created: true,
      edition: {
        id: "edition-1",
        sourceType: input.sourceType,
        sourceEdition: input.sourceEdition,
        checksum: input.checksum,
        transformationVersion: input.transformationVersion,
        evaluation: input.evaluation,
        evaluationProvenance: input.evaluationProvenance,
        createdAt: "2026-08-29T00:00:00.000Z",
      },
      signals: input.signals.map((signal: Record<string, unknown>, index: number) => ({
        id: `signal-${index}`,
        ...signal,
      })),
    }));
    const aliasRows = aliases.map((entry, index) => ({
      id: `alias-${index}`,
      employerEntityId: "entity-1",
      normalizedName: "northwind systems",
      normalizedAlias: `northwind legal entity ${index}`,
      sourceLocator: `fixture:alias:${index}`,
      observedAt: "2026-08-28T00:00:00.000Z",
      evidenceHash: "a".repeat(64),
      reviewedAt: "2026-08-28T00:00:00.000Z",
      ...entry,
    }));
    const store = {
      listJobs: vi.fn(async () => [{ company: "Northwind Systems" }]),
      listEmployerAliases: vi.fn(async () => aliasRows),
      importH1bDatasetEdition,
    } as unknown as NimantoStore;
    const ingestion = new GovernmentDatasetIngestion(store, {
      datasetChecksum: canonicalHash(fixtures),
      registryChecksum: employerRegistryChecksum(candidates),
      reviewedAt: "2026-08-28T00:00:00.000Z",
      reviewer: "Synthetic qualified fixture reviewer",
      fixtures,
    });
    const rows = [
      {
        company: "Northwind Legal Entity 42",
        label: "recent_positive_history",
        sourcePeriod: "FY2026 Q2",
        observedAt: "2026-07-15T00:00:00.000Z",
      },
    ];
    const trusted = await ingestion.import("tenant-1", {
      sourceType: "dol_oflc_bulk",
      sourceEdition: "synthetic-fy2026q2",
      checksum: canonicalHash(rows),
      rows,
    });
    expect(trusted).toMatchObject({
      employerRegistryChecksum: employerRegistryChecksum(candidates),
      resolutionEvaluation: { enabled: true, registryMatches: true },
      signals: [
        {
          company: "Northwind Systems",
          sourceCompany: "Northwind Legal Entity 42",
          label: "recent_positive_history",
          confidence: "high",
        },
      ],
    });

    aliasRows.push({
      ...aliasRows[0]!,
      id: "alias-unreviewed-by-evaluation",
      alias: "Northwind Newly Added",
      normalizedAlias: "northwind newly added",
      sourceLocator: "fixture:alias:new",
    });
    const changedRows = [{ ...rows[0], company: "Northwind Newly Added" }];
    const changed = await ingestion.import("tenant-1", {
      sourceType: "dol_oflc_bulk",
      sourceEdition: "synthetic-fy2026q3",
      checksum: canonicalHash(changedRows),
      rows: changedRows,
    });
    expect(changed).toMatchObject({
      resolutionEvaluation: { enabled: false, registryMatches: false },
      signals: [
        {
          company: "Northwind Newly Added",
          sourceCompany: "Northwind Newly Added",
          label: "possible",
          confidence: "low",
        },
      ],
    });
  });
});
