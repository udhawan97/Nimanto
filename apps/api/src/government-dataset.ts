import type { NimantoStore } from "@nimanto/database";
import {
  canonicalHash,
  buildEmployerCandidates,
  employerRegistryChecksum,
  evaluateEmployerResolution,
  resolveEmployer,
  type H1bSignalLabel,
} from "@nimanto/domain";
import type { NimantoApiOptions } from "./config.js";

type TrustedEvaluation = NimantoApiOptions["trustedEmployerResolutionEvaluation"];
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

export class GovernmentDatasetIngestion {
  constructor(
    private readonly store: NimantoStore,
    private readonly trustedEvaluation: TrustedEvaluation,
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
  }

  async import(tenantId: string, value: unknown) {
    const body = record(value);
    const sourceType = text(body.sourceType, "source_type");
    if (!(["dol_oflc_bulk", "uscis_h1b_employer_data"] as string[]).includes(sourceType)) {
      throw new Error("INVALID_SOURCE_TYPE");
    }
    if (body.resolutionEvaluation !== undefined) {
      throw new Error("UNTRUSTED_RESOLUTION_EVALUATION");
    }
    const sourceEdition = text(body.sourceEdition, "source_edition");
    const transformationVersion =
      body.transformationVersion === undefined
        ? "government_ingest_v1"
        : text(body.transformationVersion, "transformation_version");
    if (!Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > 500) {
      throw new Error("INVALID_DATASET_ROWS");
    }
    const rows = body.rows.map(record);
    const checksum = canonicalHash(rows);
    if (text(body.checksum, "checksum") !== checksum) throw new Error("DATASET_CHECKSUM_MISMATCH");

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
    const signals = rows.map((row, index) => {
      const company = text(row.company, "company");
      const requestedLabel = text(row.label, "label") as H1bSignalLabel;
      if (!LABELS.includes(requestedLabel)) throw new Error("INVALID_LABEL");
      const sourcePeriod = text(row.sourcePeriod, "source_period");
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
        sourceLocator: `${sourceEdition}:row:${index + 1}`,
        sourcePeriod,
        observedAt,
        confidence: (resolution.state === "resolved" && evaluation.enabled ? "high" : "low") as
          "high" | "low",
        limitations: `Historical ${sourceType} evidence from ${sourceEdition}, checksum ${checksum}, transformation ${transformationVersion}; source employer ${JSON.stringify(company)}; employer resolution ${resolution.state}; registry checksum ${registryChecksum}, trusted registry match=${registryMatches}; evaluation n=${evaluation.sampleSize}, precision=${evaluation.precision.toFixed(3)}, recall=${evaluation.recall.toFixed(3)}, abstention=${evaluation.abstentionRate.toFixed(3)}, enabled=${evaluation.enabled}. Not legal advice or a current transfer guarantee.`,
      };
    });
    const result = await this.store.importH1bDatasetEdition(tenantId, {
      sourceType,
      sourceEdition,
      checksum,
      transformationVersion,
      evaluation: evaluation as unknown as Record<string, unknown>,
      evaluationProvenance,
      signals,
    });
    return {
      imported: result.signals.length,
      created: result.created,
      checksum,
      transformationVersion: result.edition.transformationVersion,
      employerRegistryChecksum: registryChecksum,
      datasetEdition: result.edition,
      resolutionEvaluation: result.edition.evaluation,
      resolutionEvaluationProvenance: result.edition.evaluationProvenance,
      signals: result.signals,
    };
  }
}
