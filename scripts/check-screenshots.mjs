import { spawn } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertScreenshotBytesMatch,
  assertScreenshotVisuallyMatches,
  verifyScreenshotEvidence,
  writeScreenshotEvidence,
} from "./screenshot-evidence.mjs";

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scratch = await mkdtemp(path.join(tmpdir(), "nimanto-screenshot-check-"));
const secret = "nimanto-synthetic-screenshot-check-secret";
const evidenceManifest = "docs/assets/nimanto-screenshots.json";
const sitePort = Number(process.env.NIMANTO_SCREENSHOT_SITE_PORT ?? 4300);
const apiPort = Number(process.env.NIMANTO_SCREENSHOT_API_PORT ?? 4310);
const siteOrigin = `http://127.0.0.1:${sitePort}`;
const apiOrigin = `http://127.0.0.1:${apiPort}`;
let service;
let serviceLog = "";
const update = process.argv.includes("--update");

function appendLog(chunk) {
  serviceLog = `${serviceLog}${chunk.toString("utf8")}`.slice(-20_000);
}

async function run(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: repository,
    env: { ...process.env, ...options.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString("utf8");
  });
  const code = await new Promise((resolve) => child.on("exit", resolve));
  if (code !== 0) throw new Error(`${command} ${args.join(" ")} failed (${code}):\n${output}`);
  return output;
}

async function portIsBusy(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const finish = (busy) => {
      socket.destroy();
      resolve(busy);
    };
    socket.setTimeout(500, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

async function waitForApi() {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (service?.exitCode !== null) {
      throw new Error(`Disposable screenshot service exited before startup:\n${serviceLog}`);
    }
    try {
      const response = await fetch(`${apiOrigin}/health`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) return;
    } catch {
      // The bounded retry owns startup latency; the final error includes service logs.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for the disposable screenshot API:\n${serviceLog}`);
}

try {
  const occupiedPorts = [];
  for (const port of [sitePort, apiPort]) {
    if (await portIsBusy(port)) occupiedPorts.push(port);
  }
  if (occupiedPorts.length > 0) {
    throw new Error(
      `Screenshot check requires unused loopback ports; already listening: ${occupiedPorts.join(", ")}`,
    );
  }
  service = spawn("pnpm", ["start"], {
    cwd: repository,
    env: {
      ...process.env,
      NIMANTO_BOOTSTRAP_SECRET: secret,
      NIMANTO_DATA_DIR: path.join(scratch, "data"),
      NIMANTO_API_PORT: String(apiPort),
      NIMANTO_WEB_ORIGIN: siteOrigin,
      NIMANTO_WEB_PORT: String(sitePort),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  service.stdout.on("data", appendLog);
  service.stderr.on("data", appendLog);
  await waitForApi();

  const assets = path.join(scratch, "assets");
  const publicAssets = path.join(scratch, "public-assets");
  await run(process.execPath, ["scripts/render-screenshots.mjs"], {
    env: {
      NIMANTO_SCREENSHOT_BOOTSTRAP_SECRET: secret,
      NIMANTO_SCREENSHOT_ASSETS_DIR: assets,
      NIMANTO_SCREENSHOT_PUBLIC_ASSETS_DIR: publicAssets,
      NIMANTO_SITE_ORIGIN: siteOrigin,
      NIMANTO_API_ORIGIN: apiOrigin,
    },
  });

  const landing = await readFile(path.join(assets, "nimanto-landing.png"));
  const workbench = await readFile(path.join(assets, "nimanto-workbench.png"));
  const publicWorkbench = await readFile(path.join(publicAssets, "nimanto-workbench.png"));
  const committedLanding = await readFile(path.join(repository, "docs/assets/nimanto-landing.png"));
  const committedWorkbench = await readFile(
    path.join(repository, "docs/assets/nimanto-workbench.png"),
  );
  const committedPublicWorkbench = await readFile(
    path.join(repository, "apps/web/public/assets/nimanto-workbench.png"),
  );
  const pngSignature = "89504e470d0a1a0a";
  if (landing.subarray(0, 8).toString("hex") !== pngSignature || landing.length < 100_000) {
    throw new Error("Disposable landing capture is not a complete PNG");
  }
  if (workbench.subarray(0, 8).toString("hex") !== pngSignature || workbench.length < 100_000) {
    throw new Error("Disposable workbench capture is not a complete PNG");
  }
  if (!workbench.equals(publicWorkbench)) {
    throw new Error("Fresh documentation and public workbench captures differ");
  }
  if (update) {
    await copyFile(
      path.join(assets, "nimanto-landing.png"),
      path.join(repository, "docs/assets/nimanto-landing.png"),
    );
    await copyFile(
      path.join(assets, "nimanto-workbench.png"),
      path.join(repository, "docs/assets/nimanto-workbench.png"),
    );
    await copyFile(
      path.join(publicAssets, "nimanto-workbench.png"),
      path.join(repository, "apps/web/public/assets/nimanto-workbench.png"),
    );
    await writeScreenshotEvidence(repository, evidenceManifest);
    console.log("Updated committed screenshots and their source evidence manifest.");
  } else {
    await verifyScreenshotEvidence(repository, evidenceManifest);
    assertScreenshotBytesMatch(
      committedWorkbench,
      committedPublicWorkbench,
      "Committed documentation and public workbench screenshots",
    );
    const landingComparison = await assertScreenshotVisuallyMatches(
      landing,
      committedLanding,
      "Fresh landing screenshot",
    );
    const workbenchComparison = await assertScreenshotVisuallyMatches(
      workbench,
      committedWorkbench,
      "Fresh workbench screenshot",
    );
    console.log(
      "Verified exact screenshot source/asset evidence and bounded cross-host visual captures " +
        `(landing mean delta ${landingComparison.meanAbsoluteError.toFixed(3)}, ` +
        `workbench ${workbenchComparison.meanAbsoluteError.toFixed(3)}).`,
    );
  }
} finally {
  if (service && service.exitCode === null) {
    service.kill("SIGTERM");
    await Promise.race([
      new Promise((resolve) => service.once("exit", resolve)),
      new Promise((resolve) => setTimeout(resolve, 5_000)),
    ]);
  }
  await rm(scratch, { recursive: true, force: true });
}
