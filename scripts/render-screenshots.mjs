/* Regenerate the README screenshots against the running local beta.
 *
 * The README embeds these, so after any restyle they otherwise become confident
 * pictures of a version that no longer exists. Run locally:
 *
 *   pnpm exec playwright install webkit
 *   pnpm build
 *   NIMANTO_BOOTSTRAP_SECRET=... pnpm start # another terminal, disposable data root
 *   NIMANTO_SCREENSHOT_BOOTSTRAP_SECRET=... node scripts/render-screenshots.mjs
 *
 * Pass --site-only to shoot the public page without a running API.
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { webkit } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(root, "docs/assets");
const site = process.env.NIMANTO_SITE_ORIGIN ?? "http://127.0.0.1:4321";
const api = process.env.NIMANTO_API_ORIGIN ?? "http://127.0.0.1:4310";
const screenshotSecret = process.env.NIMANTO_SCREENSHOT_BOOTSTRAP_SECRET ?? "";
const siteOnly = process.argv.includes("--site-only");

await mkdir(assets, { recursive: true });
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
  });
  if (workbench) {
    if (!screenshotSecret) throw new Error("NIMANTO_SCREENSHOT_BOOTSTRAP_SECRET is required");
    const login = await context.request.post(`${api}/v1/auth/demo`, {
      headers: { "x-nimanto-bootstrap-secret": screenshotSecret },
      data: {},
    });
    if (!login.ok()) throw new Error(`Synthetic screenshot login failed: ${login.status()}`);
    const dashboard = await context.request.get(`${api}/v1/dashboard`);
    if (!dashboard.ok()) throw new Error(`Screenshot dashboard failed: ${dashboard.status()}`);
    for (const job of (await dashboard.json()).jobs ?? []) {
      const match = await context.request.post(`${api}/v1/jobs/${job.id}/match`);
      if (!match.ok()) throw new Error(`Screenshot match failed: ${match.status()}`);
    }
  }
  const page = await context.newPage();
  const problems = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(message.text());
  });
  page.on("pageerror", (error) => problems.push(error.message));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  // The emblem assembles over ~5s; shoot it at rest, not mid-assembly.
  await page.waitForTimeout(settle);
  await page.screenshot({ path: path.join(assets, `${name}.png`), fullPage: full });
  await context.close();
  console.log(`${name}.png${problems.length ? `  [console: ${problems.join(" | ")}]` : ""}`);
}

await shoot("nimanto-landing", `${site}/`, { settle: 6000 });

if (!siteOnly) {
  await shoot("nimanto-workbench", `${site}/workspace/`, { settle: 2500, workbench: true });
}

await browser.close();
