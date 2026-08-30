import { describe, expect, it, vi } from "vitest";
import type { NimantoStore } from "@nimanto/database";
import {
  buildEmployerCandidates,
  canonicalHash,
  employerRegistryChecksum,
  governmentDatasetProvenanceChecksum,
  type GovernmentDatasetProvenance,
} from "@nimanto/domain";
import { GovernmentDatasetIngestion } from "../src/government-dataset.js";

function provenance(
  sourceEdition: string,
  rows: Array<Record<string, unknown>>,
): GovernmentDatasetProvenance {
  return {
    version: "government_dataset_provenance_v1",
    sourceType: "dol_oflc_bulk",
    sourceEdition,
    sourcePageUrl: "https://dol.example.test/performance",
    archiveUrl: `https://dol.example.test/archive/${sourceEdition}.zip`,
    archiveSha256: "a".repeat(64),
    layoutUrl: `https://dol.example.test/layout/${sourceEdition}.xlsx`,
    layoutSha256: "b".repeat(64),
    layoutVersion: `${sourceEdition}-layout-v1`,
    retrievedAt: "2026-08-28T00:00:00.000Z",
    dataAsOf: "2026-06-30",
    rowSetChecksum: canonicalHash(rows),
    transformationVersion: "government_ingest_v1",
    reuseNotice: "Synthetic government provenance fixture; not an approved production edition.",
    reviewer: "Synthetic source provenance reviewer",
    reviewedAt: "2026-08-28T00:00:00.000Z",
  };
}

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
    const rows = [
      {
        company: "Northwind Legal Entity 42",
        label: "recent_positive_history",
        sourceLocator: "synthetic-fy2026q2:H-1B:row:43",
        sourcePeriod: "FY2026 Q2",
        observedAt: "2026-07-15T00:00:00.000Z",
      },
    ];
    const changedRows = [
      {
        ...rows[0],
        company: "Northwind Newly Added",
        sourceLocator: "synthetic-fy2026q3:H-1B:row:8",
        sourcePeriod: "FY2026 Q3",
      },
    ];
    const trustedProvenance = [
      provenance("synthetic-fy2026q2", rows),
      provenance("synthetic-fy2026q3", changedRows),
    ];
    const importH1bDatasetEdition = vi.fn(async (_tenantId: string, input: any) => ({
      created: true,
      edition: {
        id: "edition-1",
        sourceType: input.sourceType,
        sourceEdition: input.sourceEdition,
        checksum: input.checksum,
        transformationVersion: input.transformationVersion,
        provenance: input.provenance,
        provenanceChecksum: input.provenanceChecksum,
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
    const ingestion = new GovernmentDatasetIngestion(
      store,
      {
        datasetChecksum: canonicalHash(fixtures),
        registryChecksum: employerRegistryChecksum(candidates),
        reviewedAt: "2026-08-28T00:00:00.000Z",
        reviewer: "Synthetic qualified fixture reviewer",
        fixtures,
      },
      trustedProvenance,
    );
    await expect(
      new GovernmentDatasetIngestion(store, undefined).import("tenant-1", {
        sourceType: "dol_oflc_bulk",
        sourceEdition: "synthetic-fy2026q2",
        checksum: canonicalHash(rows),
        provenanceChecksum: governmentDatasetProvenanceChecksum(trustedProvenance[0]!),
        rows,
      }),
    ).rejects.toThrow("GOVERNMENT_DATASET_NOT_APPROVED");
    await expect(
      ingestion.import("tenant-1", {
        sourceType: "dol_oflc_bulk",
        sourceEdition: "synthetic-fy2026q2",
        checksum: canonicalHash(rows),
        provenanceChecksum: "f".repeat(64),
        rows,
      }),
    ).rejects.toThrow("GOVERNMENT_DATASET_PROVENANCE_MISMATCH");
    const trusted = await ingestion.import("tenant-1", {
      sourceType: "dol_oflc_bulk",
      sourceEdition: "synthetic-fy2026q2",
      checksum: canonicalHash(rows),
      provenanceChecksum: governmentDatasetProvenanceChecksum(trustedProvenance[0]!),
      rows,
    });
    expect(trusted).toMatchObject({
      employerRegistryChecksum: employerRegistryChecksum(candidates),
      provenanceChecksum: governmentDatasetProvenanceChecksum(trustedProvenance[0]!),
      provenance: { layoutVersion: "synthetic-fy2026q2-layout-v1" },
      resolutionEvaluation: { enabled: true, registryMatches: true },
      signals: [
        {
          company: "Northwind Systems",
          sourceCompany: "Northwind Legal Entity 42",
          sourceLocator: "synthetic-fy2026q2:H-1B:row:43",
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
    const changed = await ingestion.import("tenant-1", {
      sourceType: "dol_oflc_bulk",
      sourceEdition: "synthetic-fy2026q3",
      checksum: canonicalHash(changedRows),
      provenanceChecksum: governmentDatasetProvenanceChecksum(trustedProvenance[1]!),
      rows: changedRows,
    });
    expect(changed).toMatchObject({
      resolutionEvaluation: { enabled: false, registryMatches: false },
      signals: [
        {
          company: "Northwind Newly Added",
          sourceCompany: "Northwind Newly Added",
          sourceLocator: "synthetic-fy2026q3:H-1B:row:8",
          label: "possible",
          confidence: "low",
        },
      ],
    });
  });

  it("rejects malformed and duplicate trusted provenance at startup", () => {
    const store = {} as NimantoStore;
    const rows = [{ sourceLocator: "fixture:row:1" }];
    const trusted = provenance("synthetic-fy2026q2", rows);
    expect(
      () =>
        new GovernmentDatasetIngestion(store, undefined, [
          { ...trusted, archiveUrl: "http://dol.example.test/archive.zip" },
        ]),
    ).toThrow("INVALID_TRUSTED_DATASET_PROVENANCE");
    expect(() => new GovernmentDatasetIngestion(store, undefined, [trusted, trusted])).toThrow(
      "DUPLICATE_TRUSTED_DATASET_PROVENANCE",
    );
  });
});
