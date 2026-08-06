import { readFile } from "node:fs/promises";

const paths = process.argv.slice(2);
if (paths.length === 0) throw new Error("Pass at least one SBOM path.");

const requiredPurls = [
  "pkg:npm/next@16.3.0",
  "pkg:npm/react-dom@19.2.8",
  "pkg:npm/serve@14.2.6",
  "pkg:npm/%40fastify/cookie@11.1.2",
];

for (const path of paths) {
  const document = JSON.parse(await readFile(path, "utf8"));
  const serialized = JSON.stringify(document);
  if (/\/(?:Users|home\/runner)\//u.test(serialized)) {
    throw new Error(`${path} contains a machine-local absolute path`);
  }
  for (const purl of requiredPurls) {
    if (!serialized.includes(purl))
      throw new Error(`${path} is missing required component ${purl}`);
  }

  if (document.bomFormat === "CycloneDX") {
    if (document.specVersion !== "1.6") throw new Error(`${path} is not CycloneDX 1.6`);
    if (!Array.isArray(document.components) || document.components.length < 200) {
      throw new Error(`${path} has an incomplete CycloneDX component inventory`);
    }
    continue;
  }

  if (document["@context"] === "https://spdx.org/rdf/3.0.1/spdx-context.jsonld") {
    const packages = document["@graph"]?.filter((entry) => entry.type === "software_Package");
    if (!Array.isArray(packages) || packages.length < 200) {
      throw new Error(`${path} has an incomplete SPDX package inventory`);
    }
    continue;
  }

  throw new Error(`${path} has an unsupported SBOM schema`);
}

console.log(`Validated ${paths.length} complete repository dependency inventory file(s).`);
