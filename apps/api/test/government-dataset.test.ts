import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NimantoStore } from "@nimanto/database";
import {
  buildEmployerCandidates,
  canonicalHash,
  employerRegistryChecksum,
  governmentEvidenceLanguageContractChecksum,
  governmentEvidenceLanguageReviewChecksum,
  governmentDatasetProvenanceChecksum,
  type GovernmentDatasetProvenance,
  type GovernmentEvidenceLanguageReview,
} from "@nimanto/domain";
import { GovernmentDatasetIngestion } from "../src/government-dataset.js";

const stores: NimantoStore[] = [];

afterEach(async () => {
  await Promise.all(stores.splice(0).map((store) => store.close()));
});

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

function languageReview(
  sourceType: GovernmentEvidenceLanguageReview["sourceType"] = "dol_oflc_bulk",
): GovernmentEvidenceLanguageReview {
  return {
    version: "government_evidence_language_review_v1",
    sourceType,
    transformationVersion: "government_ingest_v1",
    languageContractVersion: "government_evidence_language_v1",
    languageContractChecksum: governmentEvidenceLanguageContractChecksum(),
    reviewer: "Synthetic immigration-language reviewer",
    qualification: "Synthetic test fixture; no production qualification is claimed.",
    reviewedAt: "2026-08-29T00:00:00.000Z",
  };
}

describe("GovernmentDatasetIngestion employer registry binding", () => {
  it("links a reviewed alias only while the trusted evaluation matches the exact registry", async () => {
    const aliases = Array.from({ length: 300 }, (_, index) => ({
      canonicalCompany: "Northwind Systems",
      alias: `Northwind Legal Entity ${index}`,
    }));
    const candidates = buildEmployerCandidates(["Northwind Systems"], aliases);
    const fixtures: Array<{ sourceName: string; expectedId: string | null }> = aliases.map(
      (entry) => ({
        sourceName: entry.alias,
        expectedId: "northwind systems",
      }),
    );
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
        languageReview: input.languageReview,
        languageReviewChecksum: input.languageReviewChecksum,
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
    const evaluationTrust = {
      datasetChecksum: canonicalHash(fixtures),
      registryChecksum: employerRegistryChecksum(candidates),
      reviewedAt: "2026-08-28T00:00:00.000Z",
      reviewer: "Synthetic qualified fixture reviewer",
      fixtures,
    };
    const trustedLanguageReviews = [languageReview()];
    const ingestion = new GovernmentDatasetIngestion(store, {
      employerResolutionEvaluation: evaluationTrust,
      provenance: trustedProvenance,
      languageReviews: trustedLanguageReviews,
    });
    evaluationTrust.registryChecksum = "f".repeat(64);
    fixtures.push({ sourceName: "Caller-mutated fixture", expectedId: null });
    trustedProvenance.splice(0, trustedProvenance.length);
    trustedLanguageReviews.splice(0, trustedLanguageReviews.length);
    await expect(
      new GovernmentDatasetIngestion(store).import("tenant-1", {
        sourceType: "dol_oflc_bulk",
        sourceEdition: "synthetic-fy2026q2",
        checksum: canonicalHash(rows),
        provenanceChecksum: governmentDatasetProvenanceChecksum(
          provenance("synthetic-fy2026q2", rows),
        ),
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
      provenanceChecksum: governmentDatasetProvenanceChecksum(
        provenance("synthetic-fy2026q2", rows),
      ),
      rows,
    });
    expect(trusted).toMatchObject({
      employerRegistryChecksum: employerRegistryChecksum(candidates),
      provenanceChecksum: governmentDatasetProvenanceChecksum(
        provenance("synthetic-fy2026q2", rows),
      ),
      provenance: { layoutVersion: "synthetic-fy2026q2-layout-v1" },
      resolutionEvaluation: { enabled: true, registryMatches: true, sampleSize: 300 },
      signals: [
        {
          company: "Northwind Systems",
          sourceCompany: "Northwind Legal Entity 42",
          sourceLocator: "synthetic-fy2026q2:H-1B:row:43",
          label: "recent_positive_history",
          confidence: "high",
        },
      ],
      languageReviewChecksum: governmentEvidenceLanguageReviewChecksum(languageReview()),
      languageReview: {
        reviewer: "Synthetic immigration-language reviewer",
        qualification: "Synthetic test fixture; no production qualification is claimed.",
      },
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
      provenanceChecksum: governmentDatasetProvenanceChecksum(
        provenance("synthetic-fy2026q3", changedRows),
      ),
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

  it("rejects malformed and duplicate trust configuration at startup", () => {
    const store = {} as NimantoStore;
    const rows = [{ sourceLocator: "fixture:row:1" }];
    const trusted = provenance("synthetic-fy2026q2", rows);
    expect(
      () =>
        new GovernmentDatasetIngestion(store, {
          provenance: [{ ...trusted, archiveUrl: "http://dol.example.test/archive.zip" }],
        }),
    ).toThrow("INVALID_TRUSTED_DATASET_PROVENANCE");
    expect(() => new GovernmentDatasetIngestion(store, { provenance: [trusted, trusted] })).toThrow(
      "DUPLICATE_TRUSTED_DATASET_PROVENANCE",
    );
    expect(
      () =>
        new GovernmentDatasetIngestion(store, {
          employerResolutionEvaluation: {
            datasetChecksum: "f".repeat(64),
            registryChecksum: "e".repeat(64),
            reviewedAt: "2026-08-28T00:00:00.000Z",
            reviewer: "Synthetic qualified fixture reviewer",
            fixtures: [{ sourceName: "Northwind Systems", expectedId: "northwind systems" }],
          },
        }),
    ).toThrow("INVALID_TRUSTED_EMPLOYER_EVALUATION");
  });

  it("requires a server-trusted qualified review of the exact language contract", async () => {
    const rows = [
      {
        company: "Northwind Systems",
        label: "recent_positive_history",
        sourceLocator: "synthetic-fy2026q2:H-1B:row:1",
        sourcePeriod: "FY2026 Q2",
        observedAt: "2026-07-15T00:00:00.000Z",
      },
    ];
    const trustedProvenance = provenance("synthetic-fy2026q2", rows);
    const store = {
      listJobs: vi.fn(async () => [{ company: "Northwind Systems" }]),
      listEmployerAliases: vi.fn(async () => []),
      importH1bDatasetEdition: vi.fn(),
    } as unknown as NimantoStore;
    const ingestion = new GovernmentDatasetIngestion(store, {
      provenance: [trustedProvenance],
    });
    const payload = {
      sourceType: "dol_oflc_bulk",
      sourceEdition: "synthetic-fy2026q2",
      checksum: canonicalHash(rows),
      provenanceChecksum: governmentDatasetProvenanceChecksum(trustedProvenance),
      rows,
    };
    await expect(ingestion.import("tenant-1", payload)).rejects.toThrow(
      "GOVERNMENT_EVIDENCE_LANGUAGE_NOT_REVIEWED",
    );
    expect(
      () =>
        new GovernmentDatasetIngestion(store, {
          provenance: [trustedProvenance],
          languageReviews: [
            {
              ...languageReview(),
              languageContractChecksum: "f".repeat(64),
            },
          ],
        }),
    ).toThrow("INVALID_TRUSTED_GOVERNMENT_LANGUAGE_REVIEW");
    expect(
      () =>
        new GovernmentDatasetIngestion(store, {
          provenance: [trustedProvenance],
          languageReviews: [languageReview(), languageReview()],
        }),
    ).toThrow("DUPLICATE_TRUSTED_GOVERNMENT_LANGUAGE_REVIEW");

    const trusted = new GovernmentDatasetIngestion(store, {
      provenance: [trustedProvenance],
      languageReviews: [languageReview()],
    });
    await expect(
      trusted.import("tenant-1", { ...payload, languageReview: languageReview() }),
    ).rejects.toThrow("UNTRUSTED_GOVERNMENT_LANGUAGE_REVIEW");
    expect(store.importH1bDatasetEdition).not.toHaveBeenCalled();
  });

  it("rejects the complete untrusted or malformed packet before reading or writing storage", async () => {
    const rows = [
      {
        company: "Northwind Systems",
        label: "recent_positive_history",
        sourceLocator: "synthetic-fy2026q2:H-1B:row:1",
        sourcePeriod: "FY2026 Q2",
        observedAt: "2026-07-15T00:00:00.000Z",
      },
    ];
    const trustedProvenance = provenance("synthetic-fy2026q2", rows);
    const listJobs = vi.fn(async () => []);
    const listEmployerAliases = vi.fn(async () => []);
    const importH1bDatasetEdition = vi.fn();
    const store = {
      listJobs,
      listEmployerAliases,
      importH1bDatasetEdition,
    } as unknown as NimantoStore;
    const ingestion = new GovernmentDatasetIngestion(store, {
      provenance: [trustedProvenance],
      languageReviews: [languageReview()],
    });
    const payload = {
      sourceType: "dol_oflc_bulk",
      sourceEdition: "synthetic-fy2026q2",
      checksum: canonicalHash(rows),
      provenanceChecksum: governmentDatasetProvenanceChecksum(trustedProvenance),
      rows,
    };
    const invalidRows = [{ ...rows[0], label: "employer_promised_sponsorship" }];
    const attempts = [
      [{ ...payload, provenance: trustedProvenance }, "UNTRUSTED_DATASET_PROVENANCE"],
      [{ ...payload, checksum: "f".repeat(64) }, "DATASET_CHECKSUM_MISMATCH"],
      [{ ...payload, rows: invalidRows, checksum: canonicalHash(invalidRows) }, "INVALID_LABEL"],
      [{ ...payload, sourceEdition: "not-approved" }, "GOVERNMENT_DATASET_NOT_APPROVED"],
      [
        { ...payload, provenanceChecksum: "f".repeat(64) },
        "GOVERNMENT_DATASET_PROVENANCE_MISMATCH",
      ],
    ] as const;

    for (const [attempt, code] of attempts) {
      await expect(ingestion.import("tenant-1", attempt)).rejects.toThrow(code);
    }
    expect(listJobs).not.toHaveBeenCalled();
    expect(listEmployerAliases).not.toHaveBeenCalled();
    expect(importH1bDatasetEdition).not.toHaveBeenCalled();

    const missingLanguageReview = new GovernmentDatasetIngestion(store, {
      provenance: [trustedProvenance],
    });
    await expect(missingLanguageReview.import("tenant-1", payload)).rejects.toThrow(
      "GOVERNMENT_EVIDENCE_LANGUAGE_NOT_REVIEWED",
    );
    expect(listJobs).not.toHaveBeenCalled();
    expect(listEmployerAliases).not.toHaveBeenCalled();
    expect(importH1bDatasetEdition).not.toHaveBeenCalled();
  });

  it("owns tenant-isolated idempotency and edition conflicts through its real persistence seam", async () => {
    const store = await NimantoStore.open(`memory://government-dataset-${randomUUID()}`);
    stores.push(store);
    const alpha = await store.createLocalTenant("dataset-alpha@example.test", "Dataset Alpha");
    const beta = await store.createLocalTenant("dataset-beta@example.test", "Dataset Beta");
    const rows = [
      {
        company: "Northwind Systems",
        label: "recent_positive_history",
        sourceLocator: "synthetic-fy2026q2:H-1B:row:1",
        sourcePeriod: "FY2026 Q2",
        observedAt: "2026-07-15T00:00:00.000Z",
      },
    ];
    const trustedProvenance = provenance("synthetic-fy2026q2", rows);
    const ingestion = new GovernmentDatasetIngestion(store, {
      provenance: [trustedProvenance],
      languageReviews: [languageReview()],
    });
    const payload = {
      sourceType: "dol_oflc_bulk",
      sourceEdition: "synthetic-fy2026q2",
      checksum: canonicalHash(rows),
      provenanceChecksum: governmentDatasetProvenanceChecksum(trustedProvenance),
      rows,
    };

    const created = await ingestion.import(alpha.tenantId, payload);
    const repeated = await ingestion.import(alpha.tenantId, payload);
    expect(created).toMatchObject({ created: true, imported: 1 });
    expect(repeated).toMatchObject({ created: false, imported: 1 });
    expect(repeated.datasetEdition.id).toBe(created.datasetEdition.id);

    const conflictingRows = [
      {
        ...rows[0],
        company: "Northwind Legal Entity",
        sourceLocator: "synthetic-fy2026q2:H-1B:row:2",
      },
    ];
    const conflictingProvenance = provenance("synthetic-fy2026q2", conflictingRows);
    const conflictingIngestion = new GovernmentDatasetIngestion(store, {
      provenance: [conflictingProvenance],
      languageReviews: [languageReview()],
    });
    await expect(
      conflictingIngestion.import(alpha.tenantId, {
        ...payload,
        checksum: canonicalHash(conflictingRows),
        provenanceChecksum: governmentDatasetProvenanceChecksum(conflictingProvenance),
        rows: conflictingRows,
      }),
    ).rejects.toThrow("DATASET_EDITION_CONFLICT");

    const betaCreated = await ingestion.import(beta.tenantId, payload);
    expect(betaCreated).toMatchObject({ created: true, imported: 1 });
    expect(betaCreated.datasetEdition.id).not.toBe(created.datasetEdition.id);
    expect(await store.listDatasetEditions(alpha.tenantId)).toHaveLength(1);
    expect(await store.listH1bSignals(alpha.tenantId)).toHaveLength(1);
    expect(await store.listDatasetEditions(beta.tenantId)).toHaveLength(1);
    expect(await store.listH1bSignals(beta.tenantId)).toHaveLength(1);
  });
});
