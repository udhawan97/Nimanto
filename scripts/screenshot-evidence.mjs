import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const screenshotSourcePaths = [
  "apps/api/package.json",
  "apps/api/src",
  "apps/web/app",
  "apps/web/components",
  "apps/web/lib",
  "apps/web/package.json",
  "apps/web/public",
  "package.json",
  "packages",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "scripts/check-screenshots.mjs",
  "scripts/render-screenshots.mjs",
  "scripts/screenshot-evidence.mjs",
  "tokens.css",
];

export const screenshotAssetPaths = [
  "docs/assets/nimanto-landing.png",
  "docs/assets/nimanto-workbench.png",
  "apps/web/public/assets/nimanto-workbench.png",
];

const ignoredDirectoryNames = new Set([".next", "coverage", "dist", "node_modules"]);
const ignoredSourcePaths = new Set(["apps/web/public/assets/nimanto-workbench.png"]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function collectFiles(repository, relativePath, files) {
  const absolutePath = path.join(repository, relativePath);
  const details = await stat(absolutePath);
  if (details.isFile()) {
    if (!ignoredSourcePaths.has(relativePath)) files.push(relativePath);
    return;
  }
  if (!details.isDirectory()) {
    throw new Error(
      `Screenshot evidence input is not a regular file or directory: ${relativePath}`,
    );
  }
  const entries = await readdir(absolutePath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectoryNames.has(entry.name)) continue;
    await collectFiles(repository, path.posix.join(relativePath, entry.name), files);
  }
}

export async function screenshotSourceDigest(
  repository,
  { sourcePaths = screenshotSourcePaths } = {},
) {
  const files = [];
  for (const sourcePath of sourcePaths) await collectFiles(repository, sourcePath, files);
  files.sort();
  const digest = createHash("sha256");
  digest.update("nimanto-screenshot-sources-v1\0");
  for (const file of files) {
    digest.update(file);
    digest.update("\0");
    digest.update(await readFile(path.join(repository, file)));
    digest.update("\0");
  }
  return digest.digest("hex");
}

export async function buildScreenshotEvidence(
  repository,
  { sourcePaths = screenshotSourcePaths, assetPaths = screenshotAssetPaths } = {},
) {
  const assets = {};
  for (const assetPath of [...assetPaths].sort()) {
    assets[assetPath] = sha256(await readFile(path.join(repository, assetPath)));
  }
  return {
    schemaVersion: 1,
    sourceDigest: await screenshotSourceDigest(repository, { sourcePaths }),
    assets,
  };
}

export async function writeScreenshotEvidence(repository, manifestPath, options = {}) {
  const evidence = await buildScreenshotEvidence(repository, options);
  await writeFile(path.join(repository, manifestPath), `${JSON.stringify(evidence, null, 2)}\n`);
  return evidence;
}

export async function verifyScreenshotEvidence(repository, manifestPath, options = {}) {
  const expected = await buildScreenshotEvidence(repository, options);
  const committed = JSON.parse(await readFile(path.join(repository, manifestPath), "utf8"));
  if (committed.schemaVersion !== expected.schemaVersion) {
    throw new Error("Committed screenshot evidence uses an unsupported schema");
  }
  if (committed.sourceDigest !== expected.sourceDigest) {
    throw new Error("Committed screenshots are stale for the current screenshot source inputs");
  }
  if (JSON.stringify(committed.assets) !== JSON.stringify(expected.assets)) {
    throw new Error("Committed screenshot bytes do not match their evidence manifest");
  }
  return expected;
}

export function assertScreenshotBytesMatch(actual, expected, label) {
  if (!actual.equals(expected)) {
    throw new Error(`${label} must be byte-identical`);
  }
}

export async function compareScreenshotImages(actual, expected) {
  const [actualMetadata, expectedMetadata] = await Promise.all([
    sharp(actual).metadata(),
    sharp(expected).metadata(),
  ]);
  if (
    !actualMetadata.width ||
    !actualMetadata.height ||
    actualMetadata.width !== expectedMetadata.width ||
    actualMetadata.height !== expectedMetadata.height
  ) {
    return { dimensionsMatch: false, meanAbsoluteError: Infinity, changedPixelRatio: 1 };
  }
  const width = 180;
  const height = Math.max(1, Math.round((width * actualMetadata.height) / actualMetadata.width));
  const normalize = (image) =>
    sharp(image)
      .flatten({ background: "#000000" })
      .resize(width, height, { fit: "fill" })
      .removeAlpha()
      .raw()
      .toBuffer();
  const [actualPixels, expectedPixels] = await Promise.all([
    normalize(actual),
    normalize(expected),
  ]);
  let totalDelta = 0;
  let changedPixels = 0;
  const channels = 3;
  for (let offset = 0; offset < actualPixels.length; offset += channels) {
    let maximumDelta = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      const delta = Math.abs(actualPixels[offset + channel] - expectedPixels[offset + channel]);
      totalDelta += delta;
      maximumDelta = Math.max(maximumDelta, delta);
    }
    if (maximumDelta > 32) changedPixels += 1;
  }
  return {
    dimensionsMatch: true,
    meanAbsoluteError: totalDelta / actualPixels.length,
    changedPixelRatio: changedPixels / (actualPixels.length / channels),
  };
}

export async function assertScreenshotVisuallyMatches(actual, expected, label) {
  const comparison = await compareScreenshotImages(actual, expected);
  if (
    !comparison.dimensionsMatch ||
    comparison.meanAbsoluteError > 3.5 ||
    comparison.changedPixelRatio > 0.08
  ) {
    throw new Error(
      `${label} differs materially from the committed capture ` +
        `(mean delta ${comparison.meanAbsoluteError.toFixed(3)}, changed pixels ${(
          comparison.changedPixelRatio * 100
        ).toFixed(2)}%)`,
    );
  }
  return comparison;
}
