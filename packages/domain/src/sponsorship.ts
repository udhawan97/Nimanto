import type { H1bSignalLabel } from "./types.js";
import { canonicalHash } from "./receipts.js";

const COMPANY_SUFFIXES = /\b(?:incorporated|inc|llc|ltd|limited|corp|corporation|company|co)\b/giu;

export function normalizeEmployerName(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/&/gu, " and ")
    .replace(COMPANY_SUFFIXES, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

export function resolveEmployer(
  sourceName: string,
  candidates: Array<{ id: string; name: string; aliases?: string[] }>,
): { state: "resolved"; id: string } | { state: "ambiguous" | "unmatched" } {
  const source = normalizeEmployerName(sourceName);
  const matches = candidates.filter((candidate) =>
    [candidate.name, ...(candidate.aliases ?? [])]
      .map(normalizeEmployerName)
      .some((name) => name === source),
  );
  if (matches.length === 1) return { state: "resolved", id: matches[0]!.id };
  return { state: matches.length > 1 ? "ambiguous" : "unmatched" };
}

export interface EmployerAliasInput {
  canonicalCompany: string;
  alias: string;
}

export interface EmployerCandidate {
  id: string;
  name: string;
  aliases: string[];
}

export const GOVERNMENT_DATASET_SOURCE_TYPES = [
  "dol_oflc_bulk",
  "uscis_h1b_employer_data",
] as const;

export type GovernmentDatasetSourceType = (typeof GOVERNMENT_DATASET_SOURCE_TYPES)[number];

export interface GovernmentDatasetProvenance {
  version: "government_dataset_provenance_v1";
  sourceType: GovernmentDatasetSourceType;
  sourceEdition: string;
  sourcePageUrl: string;
  archiveUrl: string;
  archiveSha256: string;
  layoutUrl: string;
  layoutSha256: string;
  layoutVersion: string;
  retrievedAt: string;
  dataAsOf: string;
  rowSetChecksum: string;
  transformationVersion: string;
  reuseNotice: string;
  reviewer: string;
  reviewedAt: string;
}

export function governmentDatasetProvenanceChecksum(
  provenance: GovernmentDatasetProvenance,
): string {
  return canonicalHash(provenance);
}

/** Build one deterministic candidate per normalized employer name. Reviewed
 * aliases can add exact names, but they never merge distinct canonical
 * employers; a shared alias therefore remains ambiguous in resolveEmployer. */
export function buildEmployerCandidates(
  companies: string[],
  reviewedAliases: EmployerAliasInput[] = [],
): EmployerCandidate[] {
  const groups = new Map<string, { names: Set<string>; aliases: Set<string> }>();
  for (const company of companies) {
    const normalized = normalizeEmployerName(company);
    if (!normalized) continue;
    const group = groups.get(normalized) ?? {
      names: new Set<string>(),
      aliases: new Set<string>(),
    };
    group.names.add(company.normalize("NFC").trim());
    groups.set(normalized, group);
  }
  for (const reviewed of reviewedAliases) {
    const canonical = normalizeEmployerName(reviewed.canonicalCompany);
    const alias = reviewed.alias.normalize("NFC").trim();
    const aliasNormalized = normalizeEmployerName(alias);
    const group = groups.get(canonical);
    if (!group || !aliasNormalized || aliasNormalized === canonical) continue;
    group.aliases.add(alias);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en-US"))
    .map(([id, group]) => ({
      id,
      name: [...group.names].sort((left, right) => left.localeCompare(right, "en-US"))[0]!,
      aliases: [...group.aliases].sort((left, right) => left.localeCompare(right, "en-US")),
    }));
}

export function employerRegistryChecksum(candidates: EmployerCandidate[]): string {
  return canonicalHash(
    candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      aliases: [...candidate.aliases],
    })),
  );
}

export interface EmployerResolutionEvaluation {
  version: "employer_resolution_eval_v1";
  sampleSize: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  abstentions: number;
  predictedPositives: number;
  uniqueFixtureCount: number;
  precision: number;
  recall: number;
  abstentionRate: number;
  precision95: { lower: number; upper: number };
  enabled: boolean;
}

function wilson(successes: number, total: number): { lower: number; upper: number } {
  if (total === 0) return { lower: 0, upper: 0 };
  const z = 1.959963984540054;
  const value = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = value + (z * z) / (2 * total);
  const margin = z * Math.sqrt((value * (1 - value)) / total + (z * z) / (4 * total * total));
  return {
    lower: Math.max(0, (center - margin) / denominator),
    upper: Math.min(1, (center + margin) / denominator),
  };
}

export function evaluateEmployerResolution(
  fixtures: Array<{ sourceName: string; expectedId: string | null }>,
  candidates: Array<{ id: string; name: string; aliases?: string[] }>,
): EmployerResolutionEvaluation {
  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let abstentions = 0;
  for (const fixture of fixtures) {
    const result = resolveEmployer(fixture.sourceName, candidates);
    if (result.state !== "resolved") {
      abstentions += 1;
      if (fixture.expectedId !== null) falseNegatives += 1;
      continue;
    }
    if (result.id === fixture.expectedId) truePositives += 1;
    else {
      falsePositives += 1;
      if (fixture.expectedId !== null) falseNegatives += 1;
    }
  }
  const predicted = truePositives + falsePositives;
  const expected = truePositives + falseNegatives;
  const precision = predicted === 0 ? 0 : truePositives / predicted;
  const recall = expected === 0 ? 0 : truePositives / expected;
  const sampleSize = fixtures.length;
  const uniqueFixtureCount = new Set(
    fixtures.map(
      (fixture) =>
        `${normalizeEmployerName(fixture.sourceName)}\u0000${fixture.expectedId ?? "null"}`,
    ),
  ).size;
  const precision95 = wilson(truePositives, predicted);
  return {
    version: "employer_resolution_eval_v1",
    sampleSize,
    truePositives,
    falsePositives,
    falseNegatives,
    abstentions,
    predictedPositives: predicted,
    uniqueFixtureCount,
    precision,
    recall,
    abstentionRate: sampleSize === 0 ? 0 : abstentions / sampleSize,
    precision95,
    enabled:
      sampleSize >= 300 &&
      uniqueFixtureCount >= 300 &&
      predicted >= 300 &&
      precision >= 0.98 &&
      precision95.lower >= 0.95,
  };
}

export function freshH1bLabel(
  input: { label: H1bSignalLabel; observedAt: string },
  asOf = new Date(),
): { label: H1bSignalLabel; freshness: "current" | "stale"; originalLabel: H1bSignalLabel } {
  const observed = new Date(input.observedAt);
  const ageDays = (asOf.getTime() - observed.getTime()) / 86_400_000;
  const maximumAge = input.label.startsWith("current_")
    ? 90
    : input.label === "recent_positive_history"
      ? 730
      : Infinity;
  const stale = !Number.isFinite(observed.getTime()) || ageDays > maximumAge;
  return {
    label: stale ? "uncertain" : input.label,
    freshness: stale ? "stale" : "current",
    originalLabel: input.label,
  };
}
