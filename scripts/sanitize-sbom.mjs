import { readFile, writeFile } from "node:fs/promises";

const paths = process.argv.slice(2);
if (paths.length === 0) throw new Error("Pass at least one SBOM path.");

function hasMachineLocalPath(value) {
  return Object.values(value ?? {}).some(
    (entry) => typeof entry === "string" && /^\/(?:Users|home\/runner)\//u.test(entry),
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

for (const path of paths) {
  const document = JSON.parse(await readFile(path, "utf8"));
  await writeFile(path, `${JSON.stringify(sanitize(document), null, 2)}\n`, { mode: 0o600 });
}

console.log(`Removed machine-local package paths from ${paths.length} SBOM file(s).`);
