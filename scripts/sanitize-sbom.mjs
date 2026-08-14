import { readFile, writeFile } from "node:fs/promises";

const paths = process.argv.slice(2);
if (paths.length === 0) throw new Error("Pass at least one SBOM path.");

function hasMachineLocalPath(value) {
  return Object.values(value ?? {}).some(
    (entry) =>
      typeof entry === "string" && (entry.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(entry)),
  );
}

function sanitize(value) {
  if (Array.isArray(value)) {
    return value
      .filter(
        (entry) =>
          entry?.name !== "cdx:npm:package_json" &&
          !entry?.extension_cdxPropName?.endsWith("cdx:npm:package_json") &&
          !hasMachineLocalPath(entry),
      )
      .map(sanitize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sanitize(entry)]));
  }
  return value;
}

function normalizeDocumentIdentity(document) {
  if (document["@context"] !== "https://spdx.org/rdf/3.0.1/spdx-context.jsonld") {
    return document;
  }
  return {
    ...document,
    "@graph": document["@graph"]?.map((entry) =>
      entry.type === "SpdxDocument" ? { ...entry, name: "Nimanto" } : entry,
    ),
  };
}

for (const path of paths) {
  const document = JSON.parse(await readFile(path, "utf8"));
  const releaseDocument = normalizeDocumentIdentity(sanitize(document));
  await writeFile(path, `${JSON.stringify(releaseDocument, null, 2)}\n`, { mode: 0o600 });
}

console.log(`Normalized ${paths.length} release SBOM file(s).`);
