/* Regenerate the README screenshots against the running local beta.
 *
 * The README embeds these, so after any restyle they otherwise become confident
 * pictures of a version that no longer exists. Run locally:
 *
 *   pnpm exec playwright install webkit
 *   pnpm build
 *   NIMANTO_BOOTSTRAP_SECRET=... NIMANTO_DATA_DIR=/tmp/nimanto-screenshots pnpm start
 *   NIMANTO_SCREENSHOT_BOOTSTRAP_SECRET=... node scripts/render-screenshots.mjs
 *
 * Pass --site-only to shoot the public page without a running API.
 */

// cspell:ignore requestfailed

import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.resolve(
  process.env.NIMANTO_SCREENSHOT_ASSETS_DIR ?? path.join(root, "docs/assets"),
);
const publicAssets = path.resolve(
  process.env.NIMANTO_SCREENSHOT_PUBLIC_ASSETS_DIR ?? path.join(root, "apps/web/public/assets"),
);
const site = process.env.NIMANTO_SITE_ORIGIN ?? "http://127.0.0.1:4300";
const api = process.env.NIMANTO_API_ORIGIN ?? "http://127.0.0.1:4310";
const screenshotSecret = process.env.NIMANTO_SCREENSHOT_BOOTSTRAP_SECRET ?? "";
const siteOnly = process.argv.includes("--site-only");
const workbenchOnly = process.argv.includes("--workbench-only");

await mkdir(assets, { recursive: true });
await mkdir(publicAssets, { recursive: true });
const browser = await webkit.launch();

async function shoot(
  name,
  url,
  { width = 1440, height = 900, settle = 4000, full = false, workbench = false } = {},
) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  if (workbench) {
    if (!screenshotSecret) throw new Error("NIMANTO_SCREENSHOT_BOOTSTRAP_SECRET is required");
    const login = await context.request.post(`${api}/v1/auth/demo`, {
      headers: { "x-nimanto-bootstrap-secret": screenshotSecret },
      data: {},
    });
    if (!login.ok()) throw new Error(`Synthetic screenshot login failed: ${login.status()}`);
    const loginBody = await login.json();
    if (loginBody.identity?.email !== "priya@example.test") {
      throw new Error("Screenshot capture refused a workspace not owned by the synthetic demo");
    }
    const dashboard = await context.request.get(`${api}/v1/dashboard`);
    if (!dashboard.ok()) throw new Error(`Screenshot dashboard failed: ${dashboard.status()}`);
    const dashboardBody = await dashboard.json();
    for (const job of dashboardBody.jobs ?? []) {
      const match = await context.request.post(`${api}/v1/jobs/${job.id}/match`);
      if (!match.ok()) throw new Error(`Screenshot match failed: ${match.status()}`);
    }
    const version = await context.request.post(`${api}/v1/profile/versions`, {
      data: { authorizationWording: "I require employer support for an H-1B transfer." },
    });
    if (!version.ok()) throw new Error(`Screenshot profile version failed: ${version.status()}`);
    const firstJob = dashboardBody.jobs?.[0];
    if (firstJob) {
      const comparisonRun = await context.request.post(`${api}/v1/jobs/${firstJob.id}/match`);
      if (!comparisonRun.ok()) {
        throw new Error(`Screenshot comparison match failed: ${comparisonRun.status()}`);
      }
      const application = await context.request.post(`${api}/v1/applications`, {
        data: { jobId: firstJob.id },
      });
      if (!application.ok()) {
        throw new Error(`Screenshot application failed: ${application.status()}`);
      }
      const applicationBody = await application.json();
      const outcome = await context.request.post(
        `${api}/v1/applications/${applicationBody.id}/outcomes`,
        { data: { type: "reply", note: "Candidate-recorded follow-up" } },
      );
      if (!outcome.ok()) throw new Error(`Screenshot outcome failed: ${outcome.status()}`);
    }
  }
  const page = await context.newPage();
  if (!workbench) {
    // The public screenshot documents the deterministic no-WebGL fallback.
    // The live emblem is separately exercised by browser tests, but its GPU
    // rasterization is not stable enough for a committed cross-run artifact.
    await page.addInitScript(() => {
      const nativeGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function getDeterministicContext(
        contextId,
        ...args
      ) {
        if (contextId === "webgl" || contextId === "webgl2") return null;
        return Reflect.apply(nativeGetContext, this, [contextId, ...args]);
      };
    });
  }
  const problems = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("requestfailed", (request) =>
    problems.push(`request failed: ${request.method()} ${request.url()}`),
  );
  page.on("response", (response) => {
    if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`);
  });
  const response = await page.goto(url, { waitUntil: "networkidle" });
  if (!response?.ok()) throw new Error(`Screenshot page failed: ${response?.status() ?? "none"}`);
  if (workbench) {
    await page.getByRole("button", { name: "Applications" }).click();
    await page.getByRole("heading", { name: "Track the real process." }).waitFor();
    await page.locator(".board-card").first().waitFor();
    await page.getByRole("button", { name: "Record outcome" }).first().waitFor();
  }
  await page.evaluate(() => document.fonts.ready);
  // The emblem assembles over ~5s; shoot it at rest, not mid-assembly.
  await page.waitForTimeout(settle);
  const output = path.join(assets, `${name}.png`);
  await page.screenshot({ path: output, fullPage: full });
  if (workbench) await copyFile(output, path.join(publicAssets, `${name}.png`));
  await context.close();
  if (problems.length) throw new Error(`${name}.png: ${problems.join(" | ")}`);
  console.log(`${name}.png`);
}

if (!workbenchOnly) await shoot("nimanto-landing", `${site}/`, { settle: 6000 });

if (!siteOnly) {
  await shoot("nimanto-workbench", `${site}/workspace/`, { settle: 2500, workbench: true });
}

await browser.close();
