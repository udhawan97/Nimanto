import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  currentSchemaVersion,
  releaseAssetPaths,
  SCHEMA_VERSION_SOURCE,
  schemaVersionTextChecks,
  validateVersionSync,
  versionTextChecks,
  workspacePackages,
} from "./validate-version-sync.mjs";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = await mkdtemp(path.join(tmpdir(), "nimanto-version-sync-"));
const rootPackage = JSON.parse(await readFile(path.join(repository, "package.json"), "utf8"));
const checks = versionTextChecks(rootPackage.version);
const schemaVersion = await currentSchemaVersion(repository);
const schemaChecks = schemaVersionTextChecks(schemaVersion);
const fixtureFiles = new Set([
  "package.json",
  SCHEMA_VERSION_SOURCE,
  ...workspacePackages,
  ...checks.map((check) => check.file),
  ...schemaChecks.map((check) => check.file),
]);

for (const relativePath of fixtureFiles) {
  await mkdir(path.dirname(path.join(fixture, relativePath)), { recursive: true });
  await copyFile(path.join(repository, relativePath), path.join(fixture, relativePath));
}
for (const relativePath of releaseAssetPaths(rootPackage.version)) {
  await mkdir(path.dirname(path.join(fixture, relativePath)), { recursive: true });
  await writeFile(path.join(fixture, relativePath), "fixture\n");
}

after(() => rm(fixture, { recursive: true, force: true }));

test("the current release identities agree", async () => {
  assert.deepEqual((await validateVersionSync(fixture)).failures, []);
});

test("upgrade sequences must stay inside their declared upgrade sections", async () => {
  for (const [index, check] of checks.filter((candidate) => candidate.section).entries()) {
    const target = path.join(fixture, check.file);
    const original = await readFile(target, "utf8");
    assert.ok(original.includes(check.expected), `${check.file} contains the upgrade sequence`);
    await writeFile(
      target,
      `${check.expected}\n\n${original.replace(check.expected, `BROKEN_UPGRADE_SEQUENCE_${index}`)}`,
    );
    const result = await validateVersionSync(fixture);
    assert.ok(
      result.failures.some((failure) => failure.startsWith(`${check.file}:`)),
      `${check.file} rejects an upgrade sequence outside ${check.section}`,
    );
    await writeFile(target, original);
  }
});

test("every declared text seam fails closed when its current identity drifts", async () => {
  for (const [index, check] of checks.entries()) {
    const target = path.join(fixture, check.file);
    const original = await readFile(target, "utf8");
    assert.ok(original.includes(check.expected), `${check.file} contains the declared identity`);
    await writeFile(
      target,
      original.replaceAll(check.expected, `BROKEN_RELEASE_IDENTITY_${index}`),
    );
    const result = await validateVersionSync(fixture);
    assert.ok(
      result.failures.some((failure) => failure.startsWith(`${check.file}:`)),
      check.file,
    );
    await writeFile(target, original);
  }
});

test("every workspace manifest and release asset is required", async () => {
  for (const relativePath of workspacePackages) {
    const target = path.join(fixture, relativePath);
    const original = await readFile(target, "utf8");
    const manifest = JSON.parse(original);
    await writeFile(target, `${JSON.stringify({ ...manifest, version: "0.0.0" }, null, 2)}\n`);
    assert.ok(
      (await validateVersionSync(fixture)).failures.some((failure) =>
        failure.startsWith(`${relativePath}:`),
      ),
      relativePath,
    );
    await writeFile(target, original);
  }

  for (const relativePath of releaseAssetPaths(rootPackage.version)) {
    const target = path.join(fixture, relativePath);
    await rm(target);
    assert.ok(
      (await validateVersionSync(fixture)).failures.some((failure) =>
        failure.startsWith(`${relativePath}:`),
      ),
      relativePath,
    );
    await writeFile(target, "fixture\n");
  }
});

test("the documented schema version follows the migrations module", async () => {
  const source = path.join(fixture, SCHEMA_VERSION_SOURCE);
  const sourceOriginal = await readFile(source, "utf8");

  // Bumping CURRENT_SCHEMA_VERSION without touching the operations guide fails.
  await writeFile(
    source,
    sourceOriginal.replace(/CURRENT_SCHEMA_VERSION = \d+/u, "CURRENT_SCHEMA_VERSION = 99"),
  );
  assert.ok(
    (await validateVersionSync(fixture)).failures.some((failure) =>
      failure.startsWith("docs/operations/local-beta.md:"),
    ),
    "a bumped schema version must fail until the operations guide follows",
  );

  // A migrations module with no declared version fails closed rather than passing.
  await writeFile(
    source,
    sourceOriginal.replace(/export const CURRENT_SCHEMA_VERSION = \d+;/u, ""),
  );
  assert.ok(
    (await validateVersionSync(fixture)).failures.some((failure) =>
      failure.startsWith(`${SCHEMA_VERSION_SOURCE}:`),
    ),
    "a missing CURRENT_SCHEMA_VERSION must be reported",
  );
  await writeFile(source, sourceOriginal);

  // Editing the documented number alone fails too.
  for (const check of schemaChecks) {
    const target = path.join(fixture, check.file);
    const original = await readFile(target, "utf8");
    assert.ok(original.includes(check.expected), `${check.file} contains ${check.expected}`);
    await writeFile(target, original.replaceAll(check.expected, "schema version 99"));
    assert.ok(
      (await validateVersionSync(fixture)).failures.some((failure) =>
        failure.startsWith(`${check.file}:`),
      ),
      check.file,
    );
    await writeFile(target, original);
  }
});
