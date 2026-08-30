import type { NimantoStore } from "@nimanto/database";
import {
  canonicalHash,
  buildEmployerCandidates,
  employerRegistryChecksum,
  evaluateEmployerResolution,
  GOVERNMENT_DATASET_SOURCE_TYPES,
  GOVERNMENT_EVIDENCE_LANGUAGE_CONTRACT,
  governmentEvidenceLanguageContractChecksum,
  governmentEvidenceLanguageReviewChecksum,
  governmentDatasetProvenanceChecksum,
  renderGovernmentEvidenceLimitations,
  resolveEmployer,
  type GovernmentDatasetProvenance,
  type GovernmentDatasetSourceType,
  type GovernmentEvidenceLanguageReview,
  type H1bSignalLabel,
} from "@nimanto/domain";
import type { GovernmentDatasetTrust, TrustedEmployerResolutionEvaluation } from "./config.js";

const LABELS: H1bSignalLabel[] = [
  "current_role_transfer_support",
  "current_company_policy_support",
  "recent_positive_history",
  "possible",
  "uncertain",
  "no_sponsorship_of_any_kind",
  "no_new_cap_petitions",
  "no_permanent_sponsorship",
  "unspecified_negative",
];

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("INVALID_DATASET_ROW");
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.normalize("NFC").trim()) {
    throw new Error(`INVALID_${field.toUpperCase()}`);
  }
  return value.normalize("NFC").trim();
}

function exactText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value === value.normalize("NFC").trim();
}

function validSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

function validDateTime(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || value !== value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function validTrustedProvenance(value: unknown): value is GovernmentDatasetProvenance {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const provenance = value as Partial<GovernmentDatasetProvenance>;
  const exactTextFields = [
    provenance.sourceEdition,
    provenance.layoutVersion,
    provenance.transformationVersion,
    provenance.reuseNotice,
    provenance.reviewer,
  ].every(exactText);
  return (
    provenance.version === "government_dataset_provenance_v1" &&
    (GOVERNMENT_DATASET_SOURCE_TYPES as readonly unknown[]).includes(provenance.sourceType) &&
    exactTextFields &&
    validHttpsUrl(provenance.sourcePageUrl) &&
    validHttpsUrl(provenance.archiveUrl) &&
    validHttpsUrl(provenance.layoutUrl) &&
    validSha256(provenance.archiveSha256) &&
    validSha256(provenance.layoutSha256) &&
    validSha256(provenance.rowSetChecksum) &&
    validDateTime(provenance.retrievedAt) &&
    validDate(provenance.dataAsOf) &&
    validDateTime(provenance.reviewedAt)
  );
}

function validTrustedLanguageReview(value: unknown): value is GovernmentEvidenceLanguageReview {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const review = value as Partial<GovernmentEvidenceLanguageReview>;
  return (
    review.version === "government_evidence_language_review_v1" &&
    (GOVERNMENT_DATASET_SOURCE_TYPES as readonly unknown[]).includes(review.sourceType) &&
    review.languageContractVersion === GOVERNMENT_EVIDENCE_LANGUAGE_CONTRACT.version &&
    review.languageContractChecksum === governmentEvidenceLanguageContractChecksum() &&
    validSha256(review.languageContractChecksum) &&
    exactText(review.transformationVersion) &&
    exactText(review.reviewer) &&
    exactText(review.qualification) &&
    validDateTime(review.reviewedAt)
  );
}

type GovernmentDatasetRow = {
  company: string;
  label: H1bSignalLabel;
  sourceLocator: string;
  sourcePeriod: string;
  observedAt: string;
};

type GovernmentDatasetAdmission = {
  provenance: GovernmentDatasetProvenance;
  provenanceChecksum: string;
  transformationVersion: string;
  languageReview: GovernmentEvidenceLanguageReview;
  languageReviewChecksum: string;
};

function governmentDatasetRow(value: Record<string, unknown>): GovernmentDatasetRow {
  const company = text(value.company, "company");
  const label = text(value.label, "label") as H1bSignalLabel;
  if (!LABELS.includes(label)) throw new Error("INVALID_LABEL");
  const sourceLocator = text(value.sourceLocator, "source_locator");
  const sourcePeriod = text(value.sourcePeriod, "source_period");
  const observedAt = text(value.observedAt, "observed_at");
  if (!Number.isFinite(new Date(observedAt).getTime())) throw new Error("INVALID_OBSERVED_AT");
  return { company, label, sourceLocator, sourcePeriod, observedAt };
}

class TrustedGovernmentDatasetCatalog {
  readonly #evaluation: Readonly<TrustedEmployerResolutionEvaluation> | undefined;
  readonly #provenance = new Map<string, GovernmentDatasetProvenance>();
  readonly #languageReviews = new Map<string, GovernmentEvidenceLanguageReview>();

  constructor(trust: GovernmentDatasetTrust = {}) {
    const evaluation = trust.employerResolutionEvaluation;
    if (
      evaluation &&
      (typeof evaluation.reviewer !== "string" ||
        !evaluation.reviewer.trim() ||
        typeof evaluation.reviewedAt !== "string" ||
        !Number.isFinite(new Date(evaluation.reviewedAt).getTime()) ||
        !validSha256(evaluation.registryChecksum) ||
        canonicalHash(evaluation.fixtures) !== evaluation.datasetChecksum)
    ) {
      throw new Error("INVALID_TRUSTED_EMPLOYER_EVALUATION");
    }
    if (evaluation) {
      const fixtures = Object.freeze(
        evaluation.fixtures.map((fixture) => Object.freeze({ ...fixture })),
      );
      this.#evaluation = Object.freeze({ ...evaluation, fixtures });
    }

    for (const provenance of trust.provenance ?? []) {
      if (!validTrustedProvenance(provenance)) {
        throw new Error("INVALID_TRUSTED_DATASET_PROVENANCE");
      }
      const snapshot = Object.freeze({ ...provenance });
      const key = `${snapshot.sourceType}\u0000${snapshot.sourceEdition}`;
      if (this.#provenance.has(key)) {
        throw new Error("DUPLICATE_TRUSTED_DATASET_PROVENANCE");
      }
      this.#provenance.set(key, snapshot);
    }

    for (const review of trust.languageReviews ?? []) {
      if (!validTrustedLanguageReview(review)) {
        throw new Error("INVALID_TRUSTED_GOVERNMENT_LANGUAGE_REVIEW");
      }
      const snapshot = Object.freeze({ ...review });
      const key = `${snapshot.sourceType}\u0000${snapshot.transformationVersion}`;
      if (this.#languageReviews.has(key)) {
        throw new Error("DUPLICATE_TRUSTED_GOVERNMENT_LANGUAGE_REVIEW");
      }
      this.#languageReviews.set(key, snapshot);
    }
  }

  admit(input: {
    sourceType: GovernmentDatasetSourceType;
    sourceEdition: string;
    transformationVersion: string;
    provenanceChecksum: string;
    rowSetChecksum: string;
  }): GovernmentDatasetAdmission {
    const provenance = this.#provenance.get(`${input.sourceType}\u0000${input.sourceEdition}`);
    if (!provenance) throw new Error("GOVERNMENT_DATASET_NOT_APPROVED");
    const provenanceChecksum = governmentDatasetProvenanceChecksum(provenance);
    if (
      input.provenanceChecksum !== provenanceChecksum ||
      input.transformationVersion !== provenance.transformationVersion ||
      input.rowSetChecksum !== provenance.rowSetChecksum
    ) {
      throw new Error("GOVERNMENT_DATASET_PROVENANCE_MISMATCH");
    }
    const languageReview = this.#languageReviews.get(
      `${input.sourceType}\u0000${input.transformationVersion}`,
    );
    if (!languageReview) throw new Error("GOVERNMENT_EVIDENCE_LANGUAGE_NOT_REVIEWED");
    return {
      provenance,
      provenanceChecksum,
      transformationVersion: input.transformationVersion,
      languageReview,
      languageReviewChecksum: governmentEvidenceLanguageReviewChecksum(languageReview),
    };
  }

  evaluateEmployerResolution(companies: ReturnType<typeof buildEmployerCandidates>) {
    const registryChecksum = employerRegistryChecksum(companies);
    const measured = evaluateEmployerResolution([...(this.#evaluation?.fixtures ?? [])], companies);
    const registryMatches = this.#evaluation?.registryChecksum === registryChecksum;
    return {
      registryChecksum,
      evaluation: {
        ...measured,
        enabled: measured.enabled && registryMatches,
        registryChecksum,
        trustedRegistryChecksum: this.#evaluation?.registryChecksum ?? null,
        registryMatches,
      },
      evaluationProvenance: this.#evaluation
        ? {
            datasetChecksum: this.#evaluation.datasetChecksum,
            registryChecksum: this.#evaluation.registryChecksum,
            reviewedAt: this.#evaluation.reviewedAt,
            reviewer: this.#evaluation.reviewer,
          }
        : null,
    };
  }
}

export class GovernmentDatasetIngestion {
  readonly #catalog: TrustedGovernmentDatasetCatalog;

  constructor(
    private readonly store: NimantoStore,
    trust: GovernmentDatasetTrust = {},
  ) {
    this.#catalog = new TrustedGovernmentDatasetCatalog(trust);
  }

  async import(tenantId: string, value: unknown) {
    const body = record(value);
    const sourceType = text(body.sourceType, "source_type") as GovernmentDatasetSourceType;
    if (!(GOVERNMENT_DATASET_SOURCE_TYPES as readonly string[]).includes(sourceType)) {
      throw new Error("INVALID_SOURCE_TYPE");
    }
    if (body.resolutionEvaluation !== undefined) {
      throw new Error("UNTRUSTED_RESOLUTION_EVALUATION");
    }
    if (body.provenance !== undefined) {
      throw new Error("UNTRUSTED_DATASET_PROVENANCE");
    }
    if (body.languageReview !== undefined || body.languageReviewChecksum !== undefined) {
      throw new Error("UNTRUSTED_GOVERNMENT_LANGUAGE_REVIEW");
    }
    const sourceEdition = text(body.sourceEdition, "source_edition");
    const transformationVersion =
      body.transformationVersion === undefined
        ? "government_ingest_v1"
        : text(body.transformationVersion, "transformation_version");
    if (!Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > 500) {
      throw new Error("INVALID_DATASET_ROWS");
    }
    const rawRows = body.rows.map(record);
    const checksum = canonicalHash(rawRows);
    if (text(body.checksum, "checksum") !== checksum) throw new Error("DATASET_CHECKSUM_MISMATCH");
    const rows = rawRows.map(governmentDatasetRow);
    const admission = this.#catalog.admit({
      sourceType,
      sourceEdition,
      transformationVersion,
      provenanceChecksum: text(body.provenanceChecksum, "provenance_checksum"),
      rowSetChecksum: checksum,
    });

    const [jobs, reviewedAliases] = await Promise.all([
      this.store.listJobs(tenantId),
      this.store.listEmployerAliases(tenantId),
    ]);
    const companies = buildEmployerCandidates(
      jobs.map((job) => job.company),
      reviewedAliases.map((review) => ({
        canonicalCompany: review.canonicalCompany,
        alias: review.alias,
      })),
    );
    const { evaluation, evaluationProvenance, registryChecksum } =
      this.#catalog.evaluateEmployerResolution(companies);
    const signals = rows.map((row) => {
      const company = row.company;
      const requestedLabel = row.label;
      const resolution = resolveEmployer(company, companies);
      const resolvedCompany =
        resolution.state === "resolved"
          ? companies.find((candidate) => candidate.id === resolution.id)?.name
          : undefined;
      const historicallyPositive = [
        "current_role_transfer_support",
        "current_company_policy_support",
        "recent_positive_history",
      ].includes(requestedLabel);
      const negative =
        requestedLabel.startsWith("no_") || requestedLabel === "unspecified_negative";
      const label: H1bSignalLabel = negative
        ? "uncertain"
        : historicallyPositive
          ? resolution.state === "resolved" && evaluation.enabled
            ? "recent_positive_history"
            : "possible"
          : requestedLabel;
      return {
        company: evaluation.enabled && resolvedCompany ? resolvedCompany : company,
        sourceCompany: company,
        label,
        sourceType,
        sourceLocator: row.sourceLocator,
        sourcePeriod: row.sourcePeriod,
        observedAt: row.observedAt,
        confidence: (resolution.state === "resolved" && evaluation.enabled ? "high" : "low") as
          "high" | "low",
        limitations: renderGovernmentEvidenceLimitations({
          sourceType,
          sourceEdition,
          sourceCompany: company,
          sourcePeriod: row.sourcePeriod,
          dataAsOf: admission.provenance.dataAsOf,
          layoutVersion: admission.provenance.layoutVersion,
          provenanceChecksum: admission.provenanceChecksum,
          rowSetChecksum: checksum,
          transformationVersion,
          resolutionState: resolution.state,
          registryChecksum,
          registryMatches: evaluation.registryMatches,
          sampleSize: evaluation.sampleSize,
          precision: evaluation.precision,
          recall: evaluation.recall,
          abstentionRate: evaluation.abstentionRate,
          evaluationEnabled: evaluation.enabled,
        }),
      };
    });
    const result = await this.store.importH1bDatasetEdition(tenantId, {
      sourceType,
      sourceEdition,
      checksum,
      transformationVersion,
      provenance: admission.provenance,
      provenanceChecksum: admission.provenanceChecksum,
      languageReview: admission.languageReview,
      languageReviewChecksum: admission.languageReviewChecksum,
      evaluation: evaluation as unknown as Record<string, unknown>,
      evaluationProvenance,
      signals,
    });
    return {
      imported: result.signals.length,
      created: result.created,
      checksum,
      transformationVersion: result.edition.transformationVersion,
      provenanceChecksum: admission.provenanceChecksum,
      provenance: result.edition.provenance,
      languageReviewChecksum: admission.languageReviewChecksum,
      languageReview: result.edition.languageReview,
      employerRegistryChecksum: registryChecksum,
      datasetEdition: result.edition,
      resolutionEvaluation: result.edition.evaluation,
      resolutionEvaluationProvenance: result.edition.evaluationProvenance,
      signals: result.signals,
    };
  }
}
