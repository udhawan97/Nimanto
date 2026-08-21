import assert from "node:assert/strict";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  releaseAssetPaths,
  validateVersionSync,
  versionTextChecks,
  workspacePackages,
} from "./validate-version-sync.mjs";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixture = await mkdtemp(path.join(tmpdir(), "nimanto-version-sync-"));
const rootPackage = JSON.parse(await readFile(path.join(repository, "package.json"), "utf8"));
const checks = versionTextChecks(rootPackage.version);
const fixtureFiles = new Set([
  "package.json",
  ...workspacePackages,
  ...checks.map((check) => check.file),
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
