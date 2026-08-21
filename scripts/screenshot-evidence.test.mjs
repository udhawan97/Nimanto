import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import {
  assertScreenshotVisuallyMatches,
  verifyScreenshotEvidence,
  writeScreenshotEvidence,
} from "./screenshot-evidence.mjs";

test("screenshot evidence fails closed when a source input or asset drifts", async () => {
  const repository = await mkdtemp(path.join(tmpdir(), "nimanto-screenshot-evidence-"));
  try {
    await mkdir(path.join(repository, "src"));
    await mkdir(path.join(repository, "assets"));
    await writeFile(path.join(repository, "src/page.tsx"), "export const copy = 'current';\n");
    await writeFile(path.join(repository, "assets/capture.png"), "synthetic capture");
    await writeScreenshotEvidence(repository, "manifest.json", {
      sourcePaths: ["src"],
      assetPaths: ["assets/capture.png"],
    });
    await verifyScreenshotEvidence(repository, "manifest.json", {
      sourcePaths: ["src"],
      assetPaths: ["assets/capture.png"],
    });

    await writeFile(path.join(repository, "src/page.tsx"), "export const copy = 'stale';\n");
    await assert.rejects(
      verifyScreenshotEvidence(repository, "manifest.json", {
        sourcePaths: ["src"],
        assetPaths: ["assets/capture.png"],
      }),
      /stale for the current screenshot source inputs/,
    );

    await writeFile(path.join(repository, "src/page.tsx"), "export const copy = 'current';\n");
    await writeFile(path.join(repository, "assets/capture.png"), "different capture");
    await assert.rejects(
      verifyScreenshotEvidence(repository, "manifest.json", {
        sourcePaths: ["src"],
        assetPaths: ["assets/capture.png"],
      }),
      /bytes do not match their evidence manifest/,
    );
  } finally {
    await rm(repository, { recursive: true, force: true });
  }
});

test("visual comparison accepts encoding drift and rejects a materially different capture", async () => {
  const red = await sharp({
    create: { width: 200, height: 100, channels: 3, background: "#8f2d1d" },
  })
    .png({ compressionLevel: 0 })
    .toBuffer();
  const redRecompressed = await sharp(red).png({ compressionLevel: 9 }).toBuffer();
  const blue = await sharp({
    create: { width: 200, height: 100, channels: 3, background: "#172b4d" },
  })
    .png()
    .toBuffer();

  await assert.doesNotReject(assertScreenshotVisuallyMatches(redRecompressed, red, "same image"));
  await assert.rejects(
    assertScreenshotVisuallyMatches(blue, red, "different image"),
    /differs materially/,
  );
  assert.notDeepEqual(red, redRecompressed);
});
