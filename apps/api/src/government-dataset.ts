import type { NimantoStore } from "@nimanto/database";
import {
  canonicalHash,
  buildEmployerCandidates,
  employerRegistryChecksum,
  evaluateEmployerResolution,
  GOVERNMENT_DATASET_SOURCE_TYPES,
  governmentDatasetProvenanceChecksum,
  resolveEmployer,
  type GovernmentDatasetProvenance,
  type H1bSignalLabel,
} from "@nimanto/domain";
import type { NimantoApiOptions } from "./config.js";

type TrustedEvaluation = NimantoApiOptions["trustedEmployerResolutionEvaluation"];
type TrustedProvenance = NonNullable<
  NimantoApiOptions["trustedGovernmentDatasetProvenance"]
>[number];
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

export class GovernmentDatasetIngestion {
  readonly #trustedProvenance = new Map<string, GovernmentDatasetProvenance>();

  constructor(
    private readonly store: NimantoStore,
    private readonly trustedEvaluation: TrustedEvaluation,
    trustedProvenance: TrustedProvenance[] = [],
  ) {
    if (
      trustedEvaluation &&
      (!trustedEvaluation.reviewer.trim() ||
        !Number.isFinite(new Date(trustedEvaluation.reviewedAt).getTime()) ||
        !/^[a-f0-9]{64}$/u.test(trustedEvaluation.registryChecksum) ||
        canonicalHash(trustedEvaluation.fixtures) !== trustedEvaluation.datasetChecksum)
    ) {
      throw new Error("INVALID_TRUSTED_EMPLOYER_EVALUATION");
    }
    for (const provenance of trustedProvenance) {
      if (!validTrustedProvenance(provenance)) {
        throw new Error("INVALID_TRUSTED_DATASET_PROVENANCE");
      }
      const snapshot = Object.freeze({ ...provenance });
      const key = `${snapshot.sourceType}\u0000${snapshot.sourceEdition}`;
      if (this.#trustedProvenance.has(key)) {
        throw new Error("DUPLICATE_TRUSTED_DATASET_PROVENANCE");
      }
      this.#trustedProvenance.set(key, snapshot);
    }
  }

  async import(tenantId: string, value: unknown) {
    const body = record(value);
    const sourceType = text(body.sourceType, "source_type");
    if (!(GOVERNMENT_DATASET_SOURCE_TYPES as readonly string[]).includes(sourceType)) {
      throw new Error("INVALID_SOURCE_TYPE");
    }
    if (body.resolutionEvaluation !== undefined) {
      throw new Error("UNTRUSTED_RESOLUTION_EVALUATION");
    }
    if (body.provenance !== undefined) {
      throw new Error("UNTRUSTED_DATASET_PROVENANCE");
    }
    const sourceEdition = text(body.sourceEdition, "source_edition");
    const provenance = this.#trustedProvenance.get(`${sourceType}\u0000${sourceEdition}`);
    if (!provenance) throw new Error("GOVERNMENT_DATASET_NOT_APPROVED");
    const provenanceChecksum = governmentDatasetProvenanceChecksum(provenance);
    if (text(body.provenanceChecksum, "provenance_checksum") !== provenanceChecksum) {
      throw new Error("GOVERNMENT_DATASET_PROVENANCE_MISMATCH");
    }
    const transformationVersion =
      body.transformationVersion === undefined
        ? "government_ingest_v1"
        : text(body.transformationVersion, "transformation_version");
    if (transformationVersion !== provenance.transformationVersion) {
      throw new Error("GOVERNMENT_DATASET_PROVENANCE_MISMATCH");
    }
    if (!Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > 500) {
      throw new Error("INVALID_DATASET_ROWS");
    }
    const rows = body.rows.map(record);
    const checksum = canonicalHash(rows);
    if (text(body.checksum, "checksum") !== checksum) throw new Error("DATASET_CHECKSUM_MISMATCH");
    if (checksum !== provenance.rowSetChecksum) {
      throw new Error("GOVERNMENT_DATASET_PROVENANCE_MISMATCH");
    }

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
    const registryChecksum = employerRegistryChecksum(companies);
    const measuredEvaluation = evaluateEmployerResolution(
      this.trustedEvaluation?.fixtures ?? [],
      companies,
    );
    const registryMatches = this.trustedEvaluation?.registryChecksum === registryChecksum;
    const evaluation = {
      ...measuredEvaluation,
      enabled: measuredEvaluation.enabled && registryMatches,
      registryChecksum,
      trustedRegistryChecksum: this.trustedEvaluation?.registryChecksum ?? null,
      registryMatches,
    };
    const evaluationProvenance = this.trustedEvaluation
      ? {
          datasetChecksum: this.trustedEvaluation.datasetChecksum,
          registryChecksum: this.trustedEvaluation.registryChecksum,
          reviewedAt: this.trustedEvaluation.reviewedAt,
          reviewer: this.trustedEvaluation.reviewer,
        }
      : null;
    const signals = rows.map((row) => {
      const company = text(row.company, "company");
      const requestedLabel = text(row.label, "label") as H1bSignalLabel;
      if (!LABELS.includes(requestedLabel)) throw new Error("INVALID_LABEL");
      const sourcePeriod = text(row.sourcePeriod, "source_period");
      const sourceLocator = text(row.sourceLocator, "source_locator");
      const observedAt = text(row.observedAt, "observed_at");
      if (!Number.isFinite(new Date(observedAt).getTime())) throw new Error("INVALID_OBSERVED_AT");
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
        sourceLocator,
        sourcePeriod,
        observedAt,
        confidence: (resolution.state === "resolved" && evaluation.enabled ? "high" : "low") as
          "high" | "low",
        limitations: `Historical ${sourceType} evidence from ${sourceEdition}, data as of ${provenance.dataAsOf}, layout ${provenance.layoutVersion}, provenance ${provenanceChecksum}, row set ${checksum}, transformation ${transformationVersion}; source employer ${JSON.stringify(company)}; employer resolution ${resolution.state}; registry checksum ${registryChecksum}, trusted registry match=${registryMatches}; evaluation n=${evaluation.sampleSize}, precision=${evaluation.precision.toFixed(3)}, recall=${evaluation.recall.toFixed(3)}, abstention=${evaluation.abstentionRate.toFixed(3)}, enabled=${evaluation.enabled}. Not legal advice or a current transfer guarantee.`,
      };
    });
    const result = await this.store.importH1bDatasetEdition(tenantId, {
      sourceType,
      sourceEdition,
      checksum,
      transformationVersion,
      provenance,
      provenanceChecksum,
      evaluation: evaluation as unknown as Record<string, unknown>,
      evaluationProvenance,
      signals,
    });
    return {
      imported: result.signals.length,
      created: result.created,
      checksum,
      transformationVersion: result.edition.transformationVersion,
      provenanceChecksum,
      provenance: result.edition.provenance,
      employerRegistryChecksum: registryChecksum,
      datasetEdition: result.edition,
      resolutionEvaluation: result.edition.evaluation,
      resolutionEvaluationProvenance: result.edition.evaluationProvenance,
      signals: result.signals,
    };
  }
}
