import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { bootstrapSecret } from "../../playwright.config.js";

const apiOrigin = `http://127.0.0.1:${process.env.NIMANTO_PLAYWRIGHT_API_PORT ?? "4310"}`;

async function startSyntheticWorkspace(page: Page) {
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  await page.getByLabel("Your name").fill("Dev Review Fixture");
  await page.getByLabel("Your email").fill(`dev-review-${randomUUID()}@example.test`);
  await page.getByRole("button", { name: "Start private workspace" }).click();
  await page.getByRole("button", { name: "Run starter matches" }).click();
}

test("Packet Composer retains keyboard focus through selection, edge moves, and generation", async ({
  page,
}) => {
  await startSyntheticWorkspace(page);
  await page.getByRole("button", { name: "Role discovery" }).click();
  await page.getByRole("button", { name: "Track", exact: true }).first().click();
  await page.getByRole("button", { name: "Review packets" }).click();
  const composer = page.locator(".packet-composer").first();
  await composer.locator("summary").click();
  const first = (await composer
    .locator(".packet-evidence-pool button strong")
    .first()
    .textContent())!;
  const availableFirst = composer
    .locator(".packet-evidence-pool button")
    .filter({ hasText: first });
  await availableFirst.focus();
  await page.keyboard.press("Enter");
  const selectedFirst = composer
    .locator(".packet-evidence-toggle.selected")
    .filter({ hasText: first });
  await expect(selectedFirst).toBeFocused();
  await expect(selectedFirst).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Enter");
  await expect(availableFirst).toBeFocused();
  await expect(availableFirst).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Enter");
  const next = composer.locator(".packet-evidence-pool button").first();
  const second = (await next.locator("strong").textContent())!;
  await next.focus();
  await page.keyboard.press("Enter");
  const selectedSecond = composer
    .locator(".packet-evidence-toggle.selected")
    .filter({ hasText: second });
  await expect(selectedSecond).toBeFocused();
  const up = composer.getByRole("button", { name: `Move ${second} up`, exact: true });
  await up.focus();
  await page.keyboard.press("Enter");
  await expect(up).toBeDisabled();
  await expect(selectedSecond).toBeFocused();
  const down = composer.getByRole("button", { name: `Move ${second} down`, exact: true });
  await down.focus();
  await page.keyboard.press("Enter");
  await expect(down).toBeDisabled();
  await expect(selectedSecond).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(up).toBeFocused();

  const availableCount = await composer.locator(".packet-evidence-pool button").count();
  for (let index = 0; index <= availableCount; index += 1) {
    await page.keyboard.press("Tab");
  }
  const generate = composer.getByRole("button", { name: "Generate selected packet" });
  await expect(generate).toBeFocused();

  await page.evaluate(() => {
    let lostFocus = false;
    const sample = () => {
      if (document.activeElement === document.body) lostFocus = true;
    };
    const onFocusOut = () => queueMicrotask(sample);
    const observer = new MutationObserver(sample);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true });
    document.addEventListener("focusout", onFocusOut);
    let frame = 0;
    const sampleFrame = () => {
      sample();
      frame = requestAnimationFrame(sampleFrame);
    };
    frame = requestAnimationFrame(sampleFrame);
    Reflect.set(window, "stopPacketFocusWatch", () => {
      sample();
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("focusout", onFocusOut);
      return lostFocus;
    });
  });

  let releaseResponse = () => {};
  const responseBarrier = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  let generationStatus: number | null = null;
  await page.route("**/v1/packets", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const response = await route.fetch();
    generationStatus = response.status();
    await responseBarrier;
    await route.fulfill({ response });
  });
  try {
    await page.keyboard.press("Enter");
    await expect.poll(() => generationStatus, { timeout: 15_000 }).not.toBeNull();
    expect(generationStatus).toBe(200);
    await expect(generate).toBeDisabled();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    expect(
      await page.evaluate(() => document.activeElement === document.body),
      "focus must remain on a visible target while the real generation response is pending",
    ).toBe(false);
    expect(
      await page.evaluate(() => {
        const active = document.activeElement;
        return active instanceof HTMLElement && active.getClientRects().length > 0;
      }),
    ).toBe(true);
  } finally {
    releaseResponse();
  }
  await expect(page.locator(".packet-row .artifact-links a")).toHaveCount(6);
  await expect(page.getByRole("button", { name: "Assure", exact: true })).toBeEnabled();
  await expect(composer.locator("summary")).toBeFocused();
  expect(
    await page.evaluate(() => Reflect.get(window, "stopPacketFocusWatch")()),
    "keyboard generation must never leave focus on BODY during pending or completed rendering",
  ).toBe(false);
});

test("Application Dossier pages real retained publications across Profiles and Role content", async ({
  page,
}) => {
  test.setTimeout(75_000);
  await startSyntheticWorkspace(page);
  await expect(page.locator(".workspace-header")).toBeVisible();
  const roleInput = {
    title: "Retained history fixture",
    company: "Synthetic history company",
    description: "Build accessible TypeScript services.",
    requirements: ["TypeScript"],
    location: "Chicago",
    workMode: "hybrid",
    url: "https://example.test/history-fixture",
  };
  const createRole = await page.request.post(`${apiOrigin}/v1/jobs`, { data: roleInput });
  expect(createRole.ok()).toBe(true);
  const role = await createRole.json();
  const publish = async () => {
    const response = await page.request.post(`${apiOrigin}/v1/jobs/${role.id}/match`);
    expect(response.ok()).toBe(true);
    return response.json();
  };
  const first = await publish();
  const applicationResponse = await page.request.post(`${apiOrigin}/v1/applications`, {
    data: { jobId: role.id },
  });
  expect(applicationResponse.ok()).toBe(true);
  const application = await applicationResponse.json();
  for (let index = 1; index < 20; index += 1) await publish();
  const replaceRole = await page.request.put(`${apiOrigin}/v1/jobs/${role.id}`, {
    data: {
      ...roleInput,
      description: "Build accessible TypeScript services and PostgreSQL tools.",
    },
  });
  expect(replaceRole.ok()).toBe(true);
  const changedRoleRun = await publish();
  expect(changedRoleRun.jobContentHash).not.toBe(first.jobContentHash);
  const saveProfile = await page.request.post(`${apiOrigin}/v1/profile/versions`, {
    data: {
      authorizationWording: "Synthetic candidate-approved statement for another Profile Version.",
    },
  });
  expect(saveProfile.ok()).toBe(true);
  const newest = await publish();
  expect(newest.profileVersionId).not.toBe(application.profileVersionId);
  const dashboardResponse = await page.request.get(`${apiOrigin}/v1/dashboard`);
  const dashboard = await dashboardResponse.json();
  expect(
    dashboard.matches.filter((match: { jobId: string }) => match.jobId === role.id),
  ).toHaveLength(1);
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("button", { name: "Applications", exact: true }).click();
  await page.locator(`#dossier-trigger-board-${application.id}`).click();
  const dossier = page.locator("#application-dossier");
  await expect(dossier.getByText(/No current Match Publication/)).toBeVisible();
  const history = dossier.locator(".dossier-match-history");
  await expect(history.locator("summary")).toContainText(
    "20 retained immutable publications loaded",
  );
  await history.locator("summary").click();
  await expect(history).toContainText(newest.id);
  await expect(history).toContainText(changedRoleRun.jobContentHash);
  await expect(history).not.toContainText("earlier immutable");
  await history.getByRole("button", { name: "Load more retained publications" }).click();
  await expect(history.locator("li")).toHaveCount(22);
  await expect(history).toContainText(first.id);
  await expect(history).toContainText(first.jobContentHash);
  await expect(history).toContainText(application.profileVersionId);
  await expect(
    history.getByRole("button", { name: "Load more retained publications" }),
  ).toHaveCount(0);
  await expect(dossier.getByText(/No current Match Publication/)).toBeVisible();
});
