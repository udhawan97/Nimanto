import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const volatileRegistryProperties = new Set(["cdx:npm:lastModifiedTime", "cdx:npm:versionCount"]);

function registryPropertyName(value) {
  if (!value || typeof value !== "object") return "";
  if (typeof value.name === "string") return value.name;
  if (typeof value.extension_cdxPropName === "string") {
    return value.extension_cdxPropName.replace(/^properties\./u, "");
  }
  return "";
}

function stableRegistryMetadata(value) {
  if (Array.isArray(value)) {
    return value
      .filter((entry) => !volatileRegistryProperties.has(registryPropertyName(entry)))
      .map(stableRegistryMetadata);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, stableRegistryMetadata(entry)]),
    );
  }
  return value;
}

function stableOccurrenceMetadata(value) {
  if (Array.isArray(value)) return value.map(stableOccurrenceMetadata);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "occurrences")
        .map(([key, entry]) => [key, stableOccurrenceMetadata(entry)]),
    );
  }
  if (typeof value === "string" && value.startsWith("{") && value.includes('"occurrences"')) {
    try {
      return JSON.stringify(stableOccurrenceMetadata(JSON.parse(value)));
    } catch {
      return value;
    }
  }
  return value;
}

function sortedPurls(values) {
  return [
    ...new Set(values.filter((value) => typeof value === "string" && value.startsWith("pkg:"))),
  ].sort();
}

export function cyclonedxPurls(document) {
  return sortedPurls([
    document.metadata?.component?.purl,
    ...(document.components ?? []).map((component) => component.purl),
  ]);
}

export function spdxPurls(document) {
  return sortedPurls((document["@graph"] ?? []).map((node) => node.software_packageUrl));
}

export function comparePurlSets(label, expected, actual) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((purl) => !actualSet.has(purl));
  const unexpected = actual.filter((purl) => !expectedSet.has(purl));
  if (missing.length === 0 && unexpected.length === 0) return;
  const describe = (values) => values.slice(0, 8).join(", ") || "none";
  throw new Error(
    `${label} does not match the freshly generated dependency inventory; missing: ${describe(missing)}; unexpected: ${describe(unexpected)}`,
  );
}

export function stableCycloneDx(document) {
  const normalized = structuredClone(document);
  delete normalized.serialNumber;
  if (normalized.metadata) delete normalized.metadata.timestamp;
  for (const annotation of normalized.annotations ?? []) delete annotation.timestamp;
  return stableOccurrenceMetadata(stableRegistryMetadata(normalized));
}

export function stableSpdx(document) {
  const normalize = (value, key = "") => {
    if (Array.isArray(value)) return value.map((entry) => normalize(entry));
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([entryKey, entry]) => [entryKey, normalize(entry, entryKey)]),
      );
    }
    if (typeof value === "string") {
      if (key === "created" && /^\d{4}-\d{2}-\d{2}T/u.test(value)) return "CURRENT-CAPTURE";
      return value.replace(
        /urn:cdxgen:spdx:[0-9a-f]{8}-[0-9a-f-]{27}/giu,
        "urn:cdxgen:spdx:CURRENT-CAPTURE",
      );
    }
    return value;
  };
  return stableOccurrenceMetadata(stableRegistryMetadata(normalize(document)));
}

function compareDocuments(label, expected, actual) {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error(`${label} metadata does not match the freshly generated inventory`);
  }
}

export async function verifySbomFreshness(
  freshCycloneDxPath,
  freshSpdxPath,
  committedCycloneDxPath,
  committedSpdxPath,
) {
  const [freshCycloneDx, freshSpdx, committedCycloneDx, committedSpdx] = await Promise.all(
    [freshCycloneDxPath, freshSpdxPath, committedCycloneDxPath, committedSpdxPath].map(
      async (file) => JSON.parse(await readFile(file, "utf8")),
    ),
  );
  const freshPurls = cyclonedxPurls(freshCycloneDx);
  comparePurlSets("Committed CycloneDX inventory", freshPurls, cyclonedxPurls(committedCycloneDx));
  comparePurlSets("Committed SPDX inventory", freshPurls, spdxPurls(committedSpdx));
  compareDocuments(
    "Committed CycloneDX inventory",
    stableCycloneDx(freshCycloneDx),
    stableCycloneDx(committedCycloneDx),
  );
  compareDocuments("Committed SPDX inventory", stableSpdx(freshSpdx), stableSpdx(committedSpdx));
  console.log(
    `Verified ${freshPurls.length} current package identities and metadata in both committed release inventories.`,
  );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  const [freshCycloneDxPath, freshSpdxPath, committedCycloneDxPath, committedSpdxPath] =
    process.argv.slice(2);
  if (!freshCycloneDxPath || !freshSpdxPath || !committedCycloneDxPath || !committedSpdxPath) {
    throw new Error(
      "Usage: node scripts/verify-sbom-freshness.mjs <fresh-cdx> <fresh-spdx> <committed-cdx> <committed-spdx>",
    );
  }
  await verifySbomFreshness(
    freshCycloneDxPath,
    freshSpdxPath,
    committedCycloneDxPath,
    committedSpdxPath,
  );
}
