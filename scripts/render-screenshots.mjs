/* Regenerate the README screenshots against the running local beta.
 *
 * The README embeds these, so after any restyle they otherwise become confident
 * pictures of a version that no longer exists. Run locally:
 *
 *   pnpm exec playwright install chromium
 *   pnpm build && pnpm dev            # api + worker + web, another terminal
 *   node scripts/render-screenshots.mjs
 *
 * CI installs WebKit only, so this is deliberately manual rather than wired into
 * the build. Pass --site-only to shoot the public page without a running API.
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(root, "docs/assets");
const site = process.env.NIMANTO_SITE_ORIGIN ?? "http://127.0.0.1:4321";
const siteOnly = process.argv.includes("--site-only");

await mkdir(assets, { recursive: true });
const browser = await chromium.launch();

async function shoot(name, url, { width = 1440, height = 900, settle = 4000, full = false } = {}) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
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
  await page.close();
  console.log(`${name}.png${problems.length ? `  [console: ${problems.join(" | ")}]` : ""}`);
}

await shoot("nimanto-landing", `${site}/`, { settle: 6000 });

if (!siteOnly) {
  await shoot("nimanto-workbench", `${site}/workspace/`, { settle: 2500 });
}

await browser.close();
