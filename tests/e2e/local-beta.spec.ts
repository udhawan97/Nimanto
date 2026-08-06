import { expect, test } from "@playwright/test";
import { bootstrapSecret } from "../../playwright.config.js";

test("a candidate starts a private workspace and receives deterministic role explanations", async ({
  page,
}) => {
  const consoleProblems: string[] = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) consoleProblems.push(message.text());
  });
  page.on("pageerror", (error) => consoleProblems.push(error.message));

  await expect
    .poll(
      async () => {
        try {
          return (await page.request.get("http://127.0.0.1:4310/health")).ok();
        } catch {
          return false;
        }
      },
      {
        message: "local API health before opening the workbench",
        timeout: 20_000,
      },
    )
    .toBe(true);
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  await page.getByLabel("Your name").fill("Asha Rao");
  await page.getByLabel("Your email").fill("asha@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();
  await expect(page.getByRole("heading", { name: "Good to see you, Asha." })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("nimanto_bootstrap")))
    .toBeNull();
  await page.getByRole("button", { name: "Run starter matches" }).click();
  await expect(page.locator(".metric").filter({ hasText: "Explained matches" })).toContainText("2");

  await page.getByRole("button", { name: "Evidence vault" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "linkedin-export.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(
      "UEsDBBQAAAAIAEqdBV2JuW/mFAAAABIAAAAjAAAAQmFzaWNfTGlua2VkSW5EYXRhRXhwb3J0L1NraWxscy5jc3bzS8xN5VIKqSxIDU4uyiwoUeICAFBLAwQUAAAACABKnQVdezphTR4AAAAcAAAAJQAAAEJhc2ljX0xpbmtlZEluRGF0YUV4cG9ydC9NZXNzYWdlcy5jc3ZzK8rP1QnJ13HOzytJzSvhctRx0gkoyixLLEnlAgBQSwECFAAUAAAACABKnQVdiblv5hQAAAASAAAAIwAAAAAAAAAAAAAAAAAAAAAAQmFzaWNfTGlua2VkSW5EYXRhRXhwb3J0L1NraWxscy5jc3ZQSwECFAAUAAAACABKnQVdezphTR4AAAAcAAAAJQAAAAAAAAAAAAAAAABVAAAAQmFzaWNfTGlua2VkSW5EYXRhRXhwb3J0L01lc3NhZ2VzLmNzdlBLBQYAAAAAAgACAKQAAAC2AAAAAAA=",
      "base64",
    ),
  });
  await expect(page.getByRole("heading", { name: "Review linkedin-export.zip" })).toBeVisible();
  await expect(page.getByText("Basic_LinkedInDataExport/Skills.csv")).toBeVisible();
  await expect(
    page.getByText("Basic_LinkedInDataExport/Messages.csv", { exact: true }),
  ).toBeVisible();
  // The preview lists the claims it would create — a count alone asked the
  // candidate to accept material they could not read. The invariant is
  // narrower than "the word is absent from the page": nothing reaches the
  // vault until they confirm.
  await expect(
    page.locator(".import-claims").getByText("TypeScript", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".evidence-list").getByText("TypeScript", { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(
    page.locator(".evidence-list").getByText("TypeScript", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Role discovery" }).click();
  await expect(page.getByRole("heading", { name: "Platform Engineer" })).toBeVisible();
  await expect(page.getByText("Northwind Systems").first()).toBeVisible();

  await page.getByRole("button", { name: "Schedule source" }).click();
  await page.getByLabel("Scheduled provider").selectOption("greenhouse");
  await page.getByLabel("Scheduled board identifier").fill("northwind-careers");
  await page.getByLabel("Refresh cadence").selectOption("360");
  await page.getByRole("button", { name: "Start schedule" }).click();
  const schedule = page.locator(".schedule-row").filter({ hasText: "northwind-careers" });
  await expect(schedule).toContainText("Every 6 hours");
  await expect(schedule).toContainText("Queued");
  await schedule.getByRole("button", { name: "Pause schedule" }).click();
  await expect(schedule).toContainText("Paused");
  await schedule.getByRole("button", { name: "Resume schedule" }).click();
  await expect(schedule).toContainText("Queued");

  for (const width of [320, 375, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);
  }

  await page.setViewportSize({ width: 320, height: 900 });
  const openNavigation = page.getByRole("button", { name: "Open navigation" });
  await openNavigation.click();
  const closeNavigation = page.getByRole("button", { name: "Close navigation" }).first();
  await expect(closeNavigation).toBeVisible();
  await expect(closeNavigation).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Overview" })).toBeFocused();
  await closeNavigation.focus();
  await closeNavigation.click();
  await expect(page.getByRole("navigation", { name: "Workbench" })).toBeHidden();
  await expect(openNavigation).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Refresh" })).toBeFocused();

  await openNavigation.click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Your evidence stays with you." })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("nimanto_bootstrap")))
    .toBeNull();
  expect(consoleProblems).toEqual([]);
});

test("an email-bound invitation creates a separate empty candidate workspace", async ({ page }) => {
  const invitation = await page.request.post("http://127.0.0.1:4310/v1/auth/invitations", {
    headers: { "x-nimanto-bootstrap-secret": bootstrapSecret },
    data: { email: "invitee@example.test" },
  });
  expect(invitation.ok()).toBe(true);
  const { token } = (await invitation.json()) as { token: string };

  await page.goto(`/workspace/#invite=${token}`);
  await expect(page.getByText("Private invitation")).toBeVisible();
  await page.getByLabel("Your name").fill("Invited Candidate");
  await page.getByLabel("Your email").fill("invitee@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();

  await expect(page.getByRole("heading", { name: "Good to see you, Invited." })).toBeVisible();
  await expect(page.getByText("invitee@example.test")).toBeVisible();
  await expect(page.locator(".metric").filter({ hasText: "Confirmed evidence" })).toContainText(
    "0",
  );
  await expect.poll(() => page.evaluate(() => location.hash)).toBe("");
});

test("one guarded control owns every status change, and the two views are exclusive", async ({
  page,
}) => {
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  await page.getByLabel("Your name").fill("Guard Check");
  await page.getByLabel("Your email").fill("guard@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();
  await page.getByRole("button", { name: "Run starter matches" }).click();
  await page.getByRole("button", { name: "Role discovery" }).click();
  await page.getByRole("button", { name: "Track", exact: true }).first().click();
  await page.getByRole("button", { name: "Applications" }).click();

  // Board view used to render the row list underneath it, because `hidden` lost
  // to a shared `display: grid` rule — which is what kept the unguarded status
  // control permanently on screen.
  await expect(page.locator(".board")).toBeVisible();
  await expect(page.locator(".application-table")).toBeHidden();
  await page.getByRole("button", { name: "Table view" }).click();
  await expect(page.locator(".board")).toHaveCount(0);
  await expect(page.locator(".application-table")).toBeVisible();

  // A control may only offer moves the domain allows. Listing all five taught
  // the candidate about illegal transitions by way of a rejected request.
  const status = page.locator(".application-table .table-row select").first();
  await expect(status).toHaveValue("tracked");
  expect(await status.locator("option").evaluateAll((nodes) => nodes.map((n) => n.value))).toEqual([
    "tracked",
    "prepared",
    "withdrawn",
  ]);

  // Every route to a consequential status asks first, from either surface.
  const prompts: string[] = [];
  page.on("dialog", (dialog) => {
    prompts.push(dialog.message());
    void dialog.accept();
  });
  await status.selectOption("prepared");
  await expect(status).toHaveValue("prepared");
  expect(prompts, "moving to a preparatory stage should not interrogate the candidate").toEqual([]);

  await status.selectOption("approved_for_export");
  await expect(status).toHaveValue("approved_for_export");
  await status.selectOption("submitted_externally");
  await expect(status).toHaveValue("submitted_externally");
  expect(prompts).toHaveLength(2);
  expect(prompts[0]).toContain("approved for export");
  expect(prompts[1]).toContain("Nimanto does not submit anything for you");

  /* Declining has to leave the record alone — and leave the control showing the
   * status the record still has. The select's snap-back is React restoring a
   * controlled value with no re-render behind it, which is exactly the kind of
   * thing that holds until someone changes the component and no test notices. */
  page.removeAllListeners("dialog");
  page.on("dialog", (dialog) => void dialog.dismiss());
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "PUT" && request.url().includes("/status")) writes.push(request.url());
  });
  await status.selectOption("withdrawn");
  await expect(status).toHaveValue("submitted_externally");
  await page.waitForTimeout(250);
  expect(writes, "a declined confirmation must not write").toEqual([]);
});

test("deletion hands back a receipt that outlives the session, and does not outlive the next one", async ({
  page,
}) => {
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  await page.getByLabel("Your name").fill("Erase Me");
  await page.getByLabel("Your email").fill("erase@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();
  await page.getByRole("button", { name: "Data controls" }).click();

  await page
    .getByRole("textbox", { name: /DELETE MY NIMANTO DATA/ })
    .fill("DELETE MY NIMANTO DATA");
  await page.getByRole("button", { name: "Delete all data" }).click();

  /* Deletion clears the session, so the panel that requested it unmounts. The
   * receipt has to survive that or the seven-day token — the only way to check
   * or resume the deletion — is gone before it can be read. */
  const receipt = page.locator(".receipt");
  await expect(receipt).toBeVisible();
  await expect(receipt.getByRole("heading")).toContainText("deleted");
  await expect(receipt.getByRole("button", { name: /Copy/ })).toBeVisible();
  await expect(receipt).toContainText("/v1/deletion/resume");
  const token = await receipt.locator("code").first().textContent();
  expect(token?.trim().length).toBeGreaterThan(16);

  /* The success notice must not contradict the receipt beside it: the server
   * decides whether file cleanup finished, so this copy stays outcome-neutral.
   * Asserted positively — a `not.toContainText` would also pass while the
   * notice simply had not rendered yet. */
  await expect(page.locator(".notice.ok")).toContainText("Deletion recorded");

  /* A new workspace retires the old receipt. Signing out does not reload the
   * page, so a stale one would re-announce a dead token over a live workspace.
   * Deliberately without navigating: a reload would clear the receipt anyway
   * and prove nothing. Deletion also cleared the launch key, so it is entered
   * again here rather than arriving in the URL. */
  await page.getByLabel("Private launch key").fill(bootstrapSecret);
  await page.getByLabel("Your name").fill("Someone Else");
  await page.getByLabel("Your email").fill("someone@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();
  // Section-agnostic on purpose: the hash still reads #data from before the
  // deletion, and restoring that section is the routing fix working.
  await expect(page.locator(".workspace-shell")).toBeVisible();
  await expect(page.getByText("someone@example.test")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Your evidence stays with you." })).toBeVisible();
  await expect(page.locator(".receipt")).toHaveCount(0);
});

test("the match band is never covered, and the section survives back and reload", async ({
  page,
}) => {
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  await page.getByLabel("Your name").fill("Layout Check");
  await page.getByLabel("Your email").fill("layout@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();
  await page.getByRole("button", { name: "Run starter matches" }).click();
  await page.getByRole("button", { name: "Role discovery" }).click();
  await page.locator(".match-detail summary").first().click();

  /* Document overflow stayed at 0 through all of this, which is why the sweep
   * above never caught it: the band chip was overlapped by the button beside
   * it between roughly 560 and 1100px. Collision, not overflow, is the test. */
  for (const width of [320, 375, 560, 768, 900, 1024, 1100, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const overlap = await page.evaluate(() => {
      const card = document.querySelector(".job-row");
      if (!card) return "no card";
      const band = card.querySelector(".state");
      const buttons = [...card.querySelectorAll("button")];
      if (!band || buttons.length === 0) return "no band";
      const a = band.getBoundingClientRect();
      return buttons
        .filter((button) => {
          const b = button.getBoundingClientRect();
          return !(
            a.right <= b.left ||
            b.right <= a.left ||
            a.bottom <= b.top ||
            b.bottom <= a.top
          );
        })
        .map((button) => button.textContent?.trim());
    });
    expect(overlap, `match band overlapped at ${width}px`).toEqual([]);
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  /* The section lived only in React state: Back left the workbench entirely and
   * a reload always dropped the candidate back on Overview. The test arrived
   * here via Role discovery, so Back belongs there — inside the app. */
  await expect(page).toHaveURL(/#jobs$/);
  await page.getByRole("button", { name: "Applications" }).click();
  await expect(page).toHaveURL(/#applications$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Track the real process." })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/#jobs$/);
  await expect(page.getByRole("heading", { name: /Compare roles to evidence/ })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Track the real process." })).toBeVisible();

  // A deep link opens on its section rather than on Overview.
  await page.goto("/workspace/#packets");
  await expect(page.getByRole("heading", { name: /Generate once/ })).toBeVisible();
});
