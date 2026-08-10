import { readFile } from "node:fs/promises";

const paths = process.argv.slice(2);
if (paths.length === 0) throw new Error("Pass at least one SBOM path.");

const releaseManifest = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);
const releaseVersion = releaseManifest.version;
const releaseWorkspaces = [
  "api",
  "web",
  "worker",
  "database",
  "documents",
  "domain",
  "parsers",
  "providers",
];

const requiredPurls = [
  "pkg:npm/next@16.3.0",
  "pkg:npm/react-dom@19.2.8",
  "pkg:npm/serve@14.2.6",
  "pkg:npm/%40fastify/cookie@11.1.2",
];

for (const path of paths) {
  const document = JSON.parse(await readFile(path, "utf8"));
  const serialized = JSON.stringify(document);
  if (serialized.includes(".claude/worktrees/")) {
    throw new Error(`${path} contains dependencies from a nested Claude worktree`);
  }
  if (/\/(?:Users|home\/runner)\//u.test(serialized)) {
    throw new Error(`${path} contains a machine-local absolute path`);
  }
  for (const purl of requiredPurls) {
    if (!serialized.includes(purl))
      throw new Error(`${path} is missing required component ${purl}`);
  }
  if (!serialized.includes(`pkg:npm/nimanto@${releaseVersion}`)) {
    throw new Error(`${path} does not identify the root release as ${releaseVersion}`);
  }
  for (const workspace of releaseWorkspaces) {
    const workspacePurl = new RegExp(`pkg:npm/(?:%40|@)nimanto/${workspace}@([^"?#/]+)`, "gu");
    const versions = [...serialized.matchAll(workspacePurl)].map((match) => match[1]);
    if (versions.length === 0) {
      throw new Error(`${path} does not identify @nimanto/${workspace} as ${releaseVersion}`);
    }
    const mismatched = [...new Set(versions.filter((version) => version !== releaseVersion))];
    if (mismatched.length > 0) {
      throw new Error(
        `${path} identifies @nimanto/${workspace} with mismatched version(s): ${mismatched.join(
          ", ",
        )}`,
      );
    }
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
