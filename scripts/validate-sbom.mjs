import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

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

const requiredPackages = [
  ["../apps/web/package.json", "next"],
  ["../apps/web/package.json", "react-dom"],
  ["../apps/web/package.json", "serve"],
  ["../apps/api/package.json", "@fastify/cookie"],
];

const requiredPurls = await Promise.all(
  requiredPackages.map(async ([workspaceManifest, packageName]) => {
    const workspaceRequire = createRequire(new URL(workspaceManifest, import.meta.url));
    const installedManifestPath = workspaceRequire.resolve(`${packageName}/package.json`);
    const installedManifest = JSON.parse(await readFile(installedManifestPath, "utf8"));
    const purlName = packageName.startsWith("@") ? `%40${packageName.slice(1)}` : packageName;
    return `pkg:npm/${purlName}@${installedManifest.version}`;
  }),
);

function containsAbsoluteFilesystemPath(value) {
  if (typeof value === "string") {
    return value.startsWith("/") || /^[A-Za-z]:[\\/]/u.test(value);
  }
  if (Array.isArray(value)) return value.some(containsAbsoluteFilesystemPath);
  return (
    value !== null &&
    typeof value === "object" &&
    Object.values(value).some(containsAbsoluteFilesystemPath)
  );
}

for (const path of paths) {
  const document = JSON.parse(await readFile(path, "utf8"));
  const serialized = JSON.stringify(document);
  if (serialized.includes(".claude/worktrees/")) {
    throw new Error(`${path} contains dependencies from a nested Claude worktree`);
  }
  if (containsAbsoluteFilesystemPath(document)) {
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
    const spdxDocument = document["@graph"]?.find((entry) => entry.type === "SpdxDocument");
    if (spdxDocument?.name !== "Nimanto") {
      throw new Error(`${path} does not use the stable Nimanto SPDX document name`);
    }
    const packages = document["@graph"]?.filter((entry) => entry.type === "software_Package");
    if (!Array.isArray(packages) || packages.length < 200) {
      throw new Error(`${path} has an incomplete SPDX package inventory`);
    }
    continue;
  }

  throw new Error(`${path} has an unsupported SBOM schema`);
}

console.log(`Validated ${paths.length} complete repository dependency inventory file(s).`);
