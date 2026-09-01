import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { verifyChecksumManifest } from "./verify-sbom-checksums.mjs";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = await mkdtemp(path.join(tmpdir(), "nimanto-release-assets-"));
after(() => rm(fixture, { recursive: true, force: true }));

test("the committed v0.9.0 inventories and checksums pass the release preflight", () => {
  const result = spawnSync("pnpm", ["release:check"], { cwd: repository, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("the published v0.9.0 provenance bytes remain identical to the tag", async () => {
  const expected = new Map([
    ["nimanto-v0.9.0.cdx.json", "ee7e0e5bf9ef0e4d9a023ebe38682aa9f551ceffe72b107d52622facc9555cab"],
    [
      "nimanto-v0.9.0.spdx.json",
      "0c893d67ad585755cb4abbfebe010c266355ecd8b99dab975cb35ce82210daab",
    ],
    [
      "nimanto-v0.9.0-SHA256SUMS.txt",
      "7d66d617b35542d06235ed71c43a654f0b0e19de5ff7a8ed4c295a44338e8bf9",
    ],
  ]);
  for (const [name, digest] of expected) {
    const bytes = await readFile(path.join(repository, "docs/releases", name));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), digest, name);
  }
});

test("fresh SBOM commands build before collecting occurrence evidence", async () => {
  const manifest = JSON.parse(await readFile(path.join(repository, "package.json"), "utf8"));
  assert.match(manifest.scripts["sbom:check"], /^pnpm build && /u);
  assert.match(manifest.scripts["sbom:current"], /^pnpm build && /u);
  assert.equal(manifest.scripts["sbom:release"], "pnpm sbom:current");
});

test("the SBOM validator rejects missing and mismatched workspace identities", async () => {
  const source = path.join(repository, "docs/releases/nimanto-v0.9.0.cdx.json");
  const original = await readFile(source, "utf8");
  const target = path.join(fixture, "mutated.cdx.json");

  await writeFile(
    target,
    original
      .replaceAll("pkg:npm/%40nimanto/api@0.9.0", "pkg:npm/%40nimanto/api@0.0.0")
      .replaceAll("pkg:npm/@nimanto/api@0.9.0", "pkg:npm/@nimanto/api@0.0.0"),
  );
  let result = spawnSync(
    process.execPath,
    ["scripts/validate-sbom.mjs", "--version", "0.9.0", target],
    {
      cwd: repository,
      encoding: "utf8",
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /mismatched version|does not identify/u);

  await writeFile(
    target,
    original
      .replaceAll("pkg:npm/%40nimanto/api@0.9.0", "pkg:npm/removed-api@0.9.0")
      .replaceAll("pkg:npm/@nimanto/api@0.9.0", "pkg:npm/removed-api@0.9.0"),
  );
  result = spawnSync(
    process.execPath,
    ["scripts/validate-sbom.mjs", "--version", "0.9.0", target],
    {
      cwd: repository,
      encoding: "utf8",
    },
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not identify @nimanto\/api/u);
});

test("the checksum verifier rejects stale bytes and an incomplete manifest", async () => {
  const first = path.join(fixture, "first.json");
  const second = path.join(fixture, "second.json");
  const manifest = path.join(fixture, "SHA256SUMS.txt");
  await writeFile(first, "first\n");
  await writeFile(second, "second\n");
  await writeFile(
    manifest,
    "92a230b5e6690315d15852cbe99b25f3e7fdd74f3d294ad3812b6889b00f2b82  first.json\n",
  );
  const failures = await verifyChecksumManifest(manifest, [first, second]);
  assert.ok(failures.some((failure) => failure.includes("expected exactly")));
  assert.ok(failures.some((failure) => failure.includes("checksum mismatch")));
});
