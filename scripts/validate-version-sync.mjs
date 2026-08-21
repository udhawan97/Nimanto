import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const workspacePackages = [
  "apps/api/package.json",
  "apps/web/package.json",
  "apps/worker/package.json",
  "packages/database/package.json",
  "packages/documents/package.json",
  "packages/domain/package.json",
  "packages/parsers/package.json",
  "packages/providers/package.json",
];

export function versionTextChecks(version) {
  const tag = `v${version}`;
  return [
    { file: "apps/api/src/version.ts", expected: `NIMANTO_VERSION = "${version}"` },
    { file: "apps/api/src/server.ts", expected: "version: NIMANTO_VERSION", occurrences: 3 },
    {
      file: "packages/providers/src/version.ts",
      expected: `NIMANTO_PROVIDER_VERSION = "${version}"`,
    },
    {
      file: "packages/providers/src/jobs.ts",
      expected: "`Nimanto/${NIMANTO_PROVIDER_VERSION}`",
    },
    {
      file: "packages/providers/src/url.ts",
      expected: "`Nimanto/${NIMANTO_PROVIDER_VERSION}`",
    },
    { file: "compose.yaml", expected: `image: nimanto:${version}` },
    { file: "apps/web/app/page.tsx", expected: `Source-distributed local beta · ${tag}` },
    {
      file: "apps/web/app/page.tsx",
      expected: `https://github.com/udhawan97/Nimanto/releases/tag/${tag}`,
    },
    {
      file: "apps/web/app/page.tsx",
      expected: `https://github.com/udhawan97/Nimanto/blob/${tag}/docs/releases/${tag}.md`,
      occurrences: 2,
    },
    {
      file: "apps/web/app/page.tsx",
      expected: `https://github.com/udhawan97/Nimanto/blob/${tag}/README.md#verify-a-source-release`,
    },
    { file: "README.md", expected: `Nimanto ${tag} is source-distributed` },
    { file: "README.md", expected: `docs/releases/${tag}.md` },
    {
      file: "README.md",
      expected: `https://github.com/udhawan97/Nimanto/releases/tag/${tag}`,
    },
    { file: "README.md", expected: `docs/releases/nimanto-${tag}.cdx.json` },
    { file: "README.md", expected: `docs/releases/nimanto-${tag}.spdx.json` },
    { file: "docs/operations/local-beta.md", expected: `## Upgrade to ${tag}` },
    {
      file: "docs/operations/local-beta.md",
      expected: `nimanto-${tag}-SHA256SUMS.txt`,
    },
    { file: "ACKNOWLEDGMENTS.md", expected: `inventories for ${tag}` },
    { file: "ACKNOWLEDGMENTS.md", expected: `nimanto-${tag}.cdx.json` },
    { file: "ACKNOWLEDGMENTS.md", expected: `nimanto-${tag}.spdx.json` },
    { file: "ACKNOWLEDGMENTS.md", expected: `nimanto-${tag}-SHA256SUMS.txt` },
    {
      file: "THIRD_PARTY_NOTICES.md",
      expected: `exact ${tag} machine-readable inventories`,
    },
    { file: "package.json", expected: `docs/releases/nimanto-${tag}.cdx.json` },
    { file: "package.json", expected: `docs/releases/nimanto-${tag}.spdx.json` },
    { file: "package.json", expected: `docs/releases/nimanto-${tag}-SHA256SUMS.txt` },
    { file: `docs/releases/${tag}.md`, expected: `# Nimanto ${tag} —` },
    {
      file: `docs/releases/${tag}.md`,
      expected: `releases/download/${tag}/nimanto-${tag}.cdx.json`,
    },
    {
      file: `docs/releases/${tag}.md`,
      expected: `releases/download/${tag}/nimanto-${tag}.spdx.json`,
    },
    {
      file: `docs/releases/${tag}.md`,
      expected: `releases/download/${tag}/nimanto-${tag}-SHA256SUMS.txt`,
    },
    {
      file: `docs/releases/${tag}-surface-ledger.md`,
      expected: `# ${tag} public-surface ledger`,
    },
  ];
}

export function releaseAssetPaths(version) {
  const tag = `v${version}`;
  return [
    `docs/releases/nimanto-${tag}.cdx.json`,
    `docs/releases/nimanto-${tag}.spdx.json`,
    `docs/releases/nimanto-${tag}-SHA256SUMS.txt`,
  ];
}

function countOccurrences(text, expected) {
  return text.split(expected).length - 1;
}

export async function validateVersionSync(root) {
  const rootPackage = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const version = rootPackage.version;
  const tag = `v${version}`;
  const failures = [];

  for (const relativePath of workspacePackages) {
    const manifest = JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
    if (manifest.version !== version) {
      failures.push(`${relativePath}: expected version ${version}, found ${manifest.version}`);
    }
  }

  for (const check of versionTextChecks(version)) {
    const text = await readFile(path.join(root, check.file), "utf8");
    const actual = countOccurrences(text, check.expected);
    const failed = check.occurrences === undefined ? actual === 0 : actual !== check.occurrences;
    if (failed) {
      const requirement =
        check.occurrences === undefined ? "at least 1" : String(check.occurrences);
      failures.push(
        `${check.file}: expected ${requirement} occurrence(s) of ${JSON.stringify(check.expected)}, found ${actual}`,
      );
    }
  }

  for (const relativePath of releaseAssetPaths(version)) {
    try {
      await readFile(path.join(root, relativePath));
    } catch {
      failures.push(`${relativePath}: required current-release asset is missing`);
    }
  }

  return { version, tag, failures };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const result = await validateVersionSync(root);
  if (result.failures.length) {
    console.error(`Version synchronization failed for ${result.tag}:`);
    for (const failure of result.failures) console.error(`- ${failure}`);
    process.exitCode = 1;
  } else {
    console.log(`Version synchronization passed for ${result.tag}.`);
  }
}
