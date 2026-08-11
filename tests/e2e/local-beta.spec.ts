import { expect, test, type Locator, type Page } from "@playwright/test";
import { bootstrapSecret } from "../../playwright.config.js";

async function installClipboardRecorder(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          sessionStorage.setItem("nimanto-test-copied", value);
        },
      },
    });
  });
}

async function expectCopyLineContained(copyLine: Locator) {
  await expect(copyLine).toBeVisible();
  const geometry = await copyLine.evaluate((line) => {
    const code = line.querySelector("code");
    const button = line.querySelector("button");
    if (!code || !button) return null;
    const lineRect = line.getBoundingClientRect();
    const codeRect = code.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    const style = getComputedStyle(code);
    return {
      lineRight: lineRect.right,
      codeRight: codeRect.right,
      buttonLeft: buttonRect.left,
      buttonRight: buttonRect.right,
      overflowX: style.overflowX,
      codeClientWidth: code.clientWidth,
      codeScrollWidth: code.scrollWidth,
    };
  });

  expect(geometry).not.toBeNull();
  expect(geometry!.codeRight).toBeLessThanOrEqual(geometry!.buttonLeft);
  expect(geometry!.buttonRight).toBeLessThanOrEqual(geometry!.lineRight);
  expect(geometry!.overflowX).toBe("auto");
  expect(geometry!.codeScrollWidth).toBeGreaterThan(geometry!.codeClientWidth);
  const scrollLeft = await copyLine.locator("code").evaluate((code) => {
    code.scrollLeft = code.scrollWidth;
    return code.scrollLeft;
  });
  expect(scrollLeft).toBeGreaterThan(0);
}

async function expectSurfaceContained(page: Page, surface: Locator, label: string) {
  await expect(surface).toBeVisible();
  const geometry = await surface.evaluate((root) => {
    const rootRect = root.getBoundingClientRect();
    const checked = [
      root,
      ...root.querySelectorAll("code, dd, li, p, small, strong, select, button"),
    ];
    const escaped = checked.flatMap((element) =>
      [...element.getClientRects()]
        .filter((rect) => rect.left < rootRect.left - 1 || rect.right > rootRect.right + 1)
        .map((rect) => ({
          tag: element.tagName,
          text: element.textContent?.slice(0, 80) ?? "",
          left: rect.left,
          right: rect.right,
          rootLeft: rootRect.left,
          rootRight: rootRect.right,
        })),
    );
    const overflowing = [...root.querySelectorAll("*")]
      .filter((element) => element.scrollWidth > element.clientWidth + 1)
      .map((element) => ({
        tag: element.tagName,
        className: element.className,
        text: element.textContent?.slice(0, 80) ?? "",
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }));
    return {
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      escaped,
      overflowing,
    };
  });
  expect(geometry.escaped, label + " child geometry").toEqual([]);
  expect(geometry.scrollWidth, label + " scroll width").toBeLessThanOrEqual(geometry.clientWidth);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
    label + " document overflow",
  ).toBeLessThanOrEqual(0);
}

test("the public site reflows, links, and identifies itself in WebKit", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Nimanto", exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Build the evidence. Work the application. Keep the truth yours.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Candidate controlled", { exact: true })).toBeVisible();
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    /assets\/social-card\.png$/,
  );
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    /manifest\.webmanifest$/,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://udhawan97.github.io/Nimanto/",
  );
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    "content",
    "summary_large_image",
  );
  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await skipLink.focus();
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);

  // 640 CSS px is the effective reflow width of a 1280 px viewport at 200% zoom.
  for (const width of [320, 375, 414, 640, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `public-site overflow at ${width}px`).toBeLessThanOrEqual(0);
  }

  await expect(page.getByRole("link", { name: "Run it" })).toHaveAttribute("href", "#run");
  await expect(page.getByRole("link", { name: /Open the workbench/ })).toHaveAttribute(
    "href",
    "./workspace/",
  );
  await expect(page.getByRole("link", { name: "Source releases", exact: true })).toHaveAttribute(
    "href",
    "https://github.com/udhawan97/Nimanto/releases",
  );
  await expect(page.getByRole("link", { name: "v0.4.1 notes" }).first()).toHaveAttribute(
    "href",
    /docs\/releases\/v0\.4\.1\.md$/,
  );
  await expect(page.getByAltText(/Synthetic Nimanto Applications workbench/)).toHaveAttribute(
    "src",
    /assets\/nimanto-workbench\.png$/,
  );
});

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
  await page.setViewportSize({ width: 320, height: 900 });
  const entryLayout = await page.locator("form.start-panel").evaluate((panel) => {
    const panelRect = panel.getBoundingClientRect();
    const controls = [...panel.querySelectorAll("input, button")].map((control) => {
      const rect = control.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    });
    return {
      clientWidth: panel.clientWidth,
      scrollWidth: panel.scrollWidth,
      controlsInside: controls.every(
        ({ left, right }) =>
          left >= panelRect.left && right <= panelRect.right && right <= innerWidth,
      ),
    };
  });
  expect(entryLayout.scrollWidth).toBeLessThanOrEqual(entryLayout.clientWidth);
  expect(entryLayout.controlsInside).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });
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

  // A long manual role is transient, but section navigation is not allowed to
  // erase it. Every field is controlled by the parent workspace boundary.
  await page.getByRole("button", { name: "Add role" }).click();
  await page.getByLabel("Role title").fill("Synthetic Reliability Engineer");
  await page.getByLabel("Company").fill("Synthetic Works");
  await page.getByLabel("Location").fill("Chicago");
  await page.getByLabel("Work mode").selectOption("hybrid");
  await page.getByLabel("Posting URL").fill("https://example.test/jobs/reliability");
  await page.getByLabel("Description").fill("Build reliable synthetic systems.");
  await page.getByLabel("Requirements, one per line").fill("TypeScript\nPostgreSQL");
  await page.getByLabel("Posted annual minimum (USD)").fill("120000");
  await page.getByLabel("Posted annual maximum (USD)").fill("160000");
  await page.getByLabel("Stated benefits, one per line").fill("Health\nLearning budget");
  await page.getByLabel("Interview-process evidence").fill("Three candidate-recorded stages");
  await page.getByLabel("Interview source").fill("Synthetic candidate note");
  await page.getByRole("button", { name: "Evidence vault" }).click();
  await page.getByRole("button", { name: "Role discovery" }).click();
  await expect(page.getByLabel("Role title")).toHaveValue("Synthetic Reliability Engineer");
  await expect(page.getByLabel("Company")).toHaveValue("Synthetic Works");
  await expect(page.getByLabel("Location")).toHaveValue("Chicago");
  await expect(page.getByLabel("Work mode")).toHaveValue("hybrid");
  await expect(page.getByLabel("Posting URL")).toHaveValue("https://example.test/jobs/reliability");
  await expect(page.getByLabel("Description")).toHaveValue("Build reliable synthetic systems.");
  await expect(page.getByLabel("Requirements, one per line")).toHaveValue("TypeScript\nPostgreSQL");
  await expect(page.getByLabel("Posted annual minimum (USD)")).toHaveValue("120000");
  await expect(page.getByLabel("Posted annual maximum (USD)")).toHaveValue("160000");
  await expect(page.getByLabel("Stated benefits, one per line")).toHaveValue(
    "Health\nLearning budget",
  );
  await expect(page.getByLabel("Interview-process evidence")).toHaveValue(
    "Three candidate-recorded stages",
  );
  await expect(page.getByLabel("Interview source")).toHaveValue("Synthetic candidate note");

  page.once("dialog", (dialog) => void dialog.dismiss());
  await page.getByRole("button", { name: "Discard draft" }).click();
  await expect(page.getByLabel("Role title")).toHaveValue("Synthetic Reliability Engineer");
  await expect(page.getByRole("button", { name: "Discard draft" })).toBeFocused();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Discard draft" }).click();
  await expect(page.getByRole("button", { name: "Add role" })).toBeFocused();
  await page.getByRole("button", { name: "Add role" }).click();
  await page.getByLabel("Role title").fill("Reload clears this draft");
  await page.reload();
  await expect(page.getByRole("button", { name: "Add role" })).toBeVisible();
  await expect(page.locator("#manual-role-draft")).toHaveCount(0);

  await page.getByRole("button", { name: "Add role" }).click();
  await page.getByLabel("Role title").fill("Saved Synthetic Role");
  await page.getByLabel("Company").fill("Synthetic Works");
  await page.getByLabel("Description").fill("A role saved exactly once.");
  await page.getByLabel("Requirements, one per line").fill("TypeScript");
  await page.getByLabel("Posted annual minimum (USD)").fill("200000");
  await page.getByLabel("Posted annual maximum (USD)").fill("100000");
  await page.getByRole("button", { name: "Save role" }).click();
  await expect(page.getByLabel("Role title")).toHaveValue("Saved Synthetic Role");
  await expect(page.getByLabel("Description")).toHaveValue("A role saved exactly once.");
  const expectedFailureProblems = consoleProblems.splice(0);
  expect(expectedFailureProblems).toHaveLength(1);
  expect(expectedFailureProblems[0]).toContain("status of 400");
  await page.getByLabel("Posted annual maximum (USD)").fill("220000");
  await page.getByRole("button", { name: "Save role" }).click();
  await expect(page.getByRole("button", { name: "Add role" })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Saved Synthetic Role" })).toHaveCount(1);

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

  for (const width of [320, 375, 414, 768, 1280, 1440]) {
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

test("a revoked session clears identity-bound drafts before another workspace opens", async ({
  page,
}) => {
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  await page.getByLabel("Your name").fill("Expired Session");
  await page.getByLabel("Your email").fill("expired-session@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();
  await page.getByRole("button", { name: "Role discovery" }).click();
  await page.getByRole("button", { name: "Add role" }).click();
  await page.getByLabel("Role title").fill("Must not cross identity boundary");
  await page.getByLabel("Company").fill("Synthetic Works");
  await page.getByLabel("Description").fill("Transient candidate draft");
  await page.getByLabel("Requirements, one per line").fill("TypeScript");

  const revoked = await page.request.delete("http://127.0.0.1:4310/v1/session");
  expect(revoked.ok()).toBe(true);
  await page.getByRole("button", { name: "Save role" }).click();
  await expect(page.getByRole("heading", { name: "Your evidence stays with you." })).toBeVisible();
  await page.evaluate((secret) => {
    window.location.hash = `bootstrap=${secret}`;
  }, bootstrapSecret);
  await expect(
    page.getByRole("button", { name: "Use clearly labeled synthetic demo" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Use clearly labeled synthetic demo" }).click();
  await page.getByRole("button", { name: "Role discovery" }).click();
  await expect(page.getByRole("button", { name: "Add role" })).toBeVisible();
  await expect(page.locator("#manual-role-draft")).toHaveCount(0);
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
  await expect(page.getByRole("button", { name: "Tracked", exact: true }).first()).toBeDisabled();
  await page.getByRole("button", { name: "Applications" }).click();

  // Board view used to render the row list underneath it, because `hidden` lost
  // to a shared `display: grid` rule — which is what kept the unguarded status
  // control permanently on screen.
  await expect(page.locator(".board")).toBeVisible();
  await expect(page.locator(".application-table")).toBeHidden();
  const workSurfaceOrder = await page.evaluate(() => {
    const board = document.querySelector(".board");
    const funnel = document.querySelector(".funnel-strip");
    return board && funnel
      ? {
          dom: Boolean(board.compareDocumentPosition(funnel) & Node.DOCUMENT_POSITION_FOLLOWING),
          visual: board.getBoundingClientRect().top < funnel.getBoundingClientRect().top,
        }
      : null;
  });
  expect(workSurfaceOrder).toEqual({ dom: true, visual: true });

  const boardOutcome = page.getByRole("button", { name: "Record outcome" }).first();
  await boardOutcome.click();
  const boardOutcomeForm = page.locator(".board .outcome-form");
  await page.setViewportSize({ width: 320, height: 900 });
  const boardEditorGeometry = await boardOutcomeForm.evaluate((form) => {
    const rect = form.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      viewport: document.documentElement.clientWidth,
      contained: form.scrollWidth <= form.clientWidth,
    };
  });
  expect(boardEditorGeometry.left).toBeGreaterThanOrEqual(0);
  expect(boardEditorGeometry.right).toBeLessThanOrEqual(boardEditorGeometry.viewport);
  expect(boardEditorGeometry.contained).toBe(true);
  await boardOutcomeForm.getByRole("button", { name: "Cancel" }).click();
  await expect(boardOutcome).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 900 });
  await boardOutcome.click();
  await boardOutcomeForm.getByLabel("Candidate-reported outcome").selectOption("reply");
  await boardOutcomeForm.getByLabel("Optional note").fill("Board follow-up");
  const outcomeType = boardOutcomeForm.getByLabel("Candidate-reported outcome");
  await outcomeType.evaluate((select) => {
    const option = document.createElement("option");
    option.value = "synthetic-invalid";
    option.textContent = "Synthetic invalid outcome";
    select.append(option);
  });
  await outcomeType.selectOption("synthetic-invalid");
  await boardOutcomeForm.getByRole("button", { name: "Record outcome" }).click();
  await expect(outcomeType).toHaveValue("synthetic-invalid");
  await expect(boardOutcomeForm.getByLabel("Optional note")).toHaveValue("Board follow-up");
  await outcomeType.selectOption("reply");
  await boardOutcomeForm.getByRole("button", { name: "Record outcome" }).click();
  await expect(boardOutcome).toBeFocused();

  await page.getByRole("button", { name: "Table view" }).click();
  await expect(page.locator(".board")).toHaveCount(0);
  await expect(page.locator(".application-table")).toBeVisible();

  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const metadata = await page
      .locator(".application-table .application-identity")
      .first()
      .evaluate((container) => {
        const title = container.querySelector("strong")?.getBoundingClientRect();
        const company = container.querySelector("small")?.getBoundingClientRect();
        return title && company
          ? {
              display: getComputedStyle(container).display,
              titleBottom: title.bottom,
              companyTop: company.top,
            }
          : null;
      });
    expect(metadata, `application metadata exists at ${width}px`).not.toBeNull();
    expect(metadata!.display, `application metadata layout at ${width}px`).toBe("grid");
    expect(metadata!.companyTop, `application metadata separation at ${width}px`).toBeGreaterThan(
      metadata!.titleBottom,
    );
  }

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

  await page.getByRole("button", { name: "Record outcome", exact: true }).first().click();
  const outcomeForm = page.locator(".application-table .outcome-form");
  await outcomeForm.getByLabel("Candidate-reported outcome").selectOption("interview");
  await outcomeForm.getByLabel("Optional note").fill("Table follow-up");
  const tableOutcomeTrigger = page
    .getByRole("button", { name: "Record outcome", exact: true })
    .first();
  await outcomeForm.getByRole("button", { name: "Record outcome" }).click();
  await expect(tableOutcomeTrigger).toBeFocused();
  const outcomeChips = page.locator(".application-table .outcome-chips").first();
  await expect(outcomeChips.locator(":scope > span", { hasText: "Reply" })).toBeVisible();
  await expect(outcomeChips.locator(":scope > span", { hasText: "Interview" })).toBeVisible();
  const outcomeLayout = await outcomeChips.evaluate((chips) => {
    const style = getComputedStyle(chips);
    return { display: style.display, flexWrap: style.flexWrap };
  });
  expect(outcomeLayout).toEqual({ display: "flex", flexWrap: "wrap" });
});

test("evidence-rich review features stay literal, local, and inspectable", async ({ page }) => {
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  await page.getByLabel("Your name").fill("Review Check");
  await page.getByLabel("Your email").fill("review@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();
  await page.getByRole("button", { name: "Run starter matches" }).click();

  await page.getByRole("button", { name: "Role discovery" }).click();
  await expect(page.getByText("Filters stay in this open view")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search roles" }).fill("Northwind");
  await expect(page.locator(".job-row")).toHaveCount(1);
  await expect(page.getByText("1 of 2")).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".job-row")).toHaveCount(2);

  const role = page.locator(".job-row").first();
  await role.getByText("View match anatomy").click();
  await expect(role.locator(".dimension-grid article")).toHaveCount(4);
  await expect(role.getByText(/Roles without requirements remain not scored/)).toBeVisible();
  await expect(role.getByText(/explicit blockers remain separate/)).toBeVisible();
  await expect(role.getByText(/Evidence Strength is intentionally excluded/)).toBeVisible();
  const signal = page.locator(".signal-list article").first();
  await signal.getByText("Source and freshness").click();
  await expect(signal.getByText("Current role wording remains controlling.")).toBeVisible();

  await role.getByRole("button", { name: "Track", exact: true }).click();
  await page.getByRole("button", { name: "Applications" }).click();
  const timeline = page.locator(".board-card .recorded-timeline").first();
  await timeline.getByText("Recorded timeline").click();
  await expect(timeline.getByText("Application record created")).toBeVisible();
  await expect(timeline.getByText("Gaps infer nothing.")).toBeVisible();

  await page.getByRole("button", { name: "Review packets" }).click();
  await page.getByRole("button", { name: "Generate", exact: true }).first().click();
  await expect(page.getByText("Packet generated: 6 files across 4 file types.")).toBeVisible();
  await page.getByRole("button", { name: "Assure", exact: true }).first().click();
  const packet = page.locator(".packet-row").first();
  await packet.getByText("Inspect content, formats, and assurance").click();
  await expect(packet.getByText("Canonical content", { exact: true })).toBeVisible();
  await expect(packet.getByText("Document inspection", { exact: true })).toBeVisible();
  await expect(packet.getByText("Latest assurance", { exact: true })).toBeVisible();
  await expect(packet.getByText(/does not verify claim truth/)).toBeVisible();

  await page.getByRole("button", { name: "Local activity" }).click();
  await expect(page).toHaveURL(/#activity$/);
  await expect(page.locator(".receipt-row").first()).toContainText("Internal hash checked");
  await expect(page.getByText(/not a signature, an employer receipt/)).toBeVisible();

  await page.setViewportSize({ width: 320, height: 900 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("retained history, record review, cohorts, and sensitive export stay bounded and explicit", async ({
  page,
}) => {
  await expect
    .poll(
      async () => {
        try {
          return (await page.request.get("http://127.0.0.1:4310/health")).ok();
        } catch {
          return false;
        }
      },
      { message: "local API health before retained-history journey", timeout: 20_000 },
    )
    .toBe(true);
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  await page.getByLabel("Your name").fill("History Check");
  await page.getByLabel("Your email").fill("history@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();
  await page.getByRole("button", { name: "Run starter matches" }).click();

  await page.getByRole("button", { name: "Evidence vault" }).click();
  await page
    .getByLabel("Candidate-approved statement")
    .fill("I require employer support for an H-1B transfer.");
  await page.getByRole("button", { name: "Save profile version" }).click();
  await expect(page.getByRole("button", { name: "No changes to save" })).toBeDisabled();

  await page.getByRole("button", { name: "Role discovery" }).click();
  const role = page.locator(".job-row").first();
  const comparedRoleTitle = (await role.getByRole("heading", { level: 2 }).textContent())!.trim();
  const comparedRoleCompany = (await role.locator(".job-main p").textContent())!.split(" · ")[0]!;
  await role.getByRole("button", { name: "Explain fit" }).click();
  await role.getByRole("button", { name: "Track", exact: true }).click();
  // Tracking refreshes the dashboard asynchronously. Prove that the
  // application has landed before leaving this view; every history/cohort
  // assertion below depends on that refreshed snapshot.
  await expect(role.getByRole("button", { name: "Tracked", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Stored history" }).click();
  const profileHistory = page.locator(".history-panel").first();
  await expect(profileHistory.getByRole("heading", { name: "Profile version diff" })).toBeVisible();
  await expect(profileHistory.getByText("Version A exact wording")).toBeVisible();
  await expect(profileHistory.getByText("Version B exact wording")).toBeVisible();
  const profileA = profileHistory.getByLabel("Profile version A");
  const profileB = profileHistory.getByLabel("Profile version B");
  const profileOptions = await profileA
    .locator("option")
    .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
  await profileB.selectOption(profileOptions[0]!);
  await expect(profileHistory.getByText("Version B exact wording")).toBeVisible();
  await profileA.selectOption(profileOptions[0]!);
  await profileB.selectOption(profileOptions[1]!);
  await expect(profileHistory.getByText("Version A exact wording")).toBeVisible();
  const matchHistory = page.locator(".history-panel").nth(1);
  await expect(
    matchHistory.getByRole("heading", { name: "Same-role match comparison" }),
  ).toBeVisible();
  await matchHistory
    .getByLabel("Role with stored runs")
    .selectOption({ label: comparedRoleTitle + " · " + comparedRoleCompany });
  await expect(matchHistory.getByText("Stored run A")).toBeVisible();
  await expect(matchHistory.getByText("Stored run B")).toBeVisible();
  await expect(matchHistory.getByText("Rule version").first()).toBeVisible();
  await expect(matchHistory.getByText("Blockers").first()).toBeVisible();
  await expect(matchHistory.getByText(/not a content hash/)).toBeVisible();
  const runA = matchHistory.getByLabel("Stored match run A");
  const runB = matchHistory.getByLabel("Stored match run B");
  const runOptions = await runA
    .locator("option")
    .evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
  await runB.selectOption(runOptions[0]!);
  await expect(matchHistory.getByText("Stored run B")).toBeVisible();
  await runA.selectOption(runOptions[0]!);
  await runB.selectOption(runOptions[1]!);
  await page.setViewportSize({ width: 320, height: 900 });
  await expectSurfaceContained(page, page.locator(".history-grid"), "stored history at 320px");

  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Applications" }).click();
  await expect(page.getByRole("heading", { name: "Record-review queue" })).toBeVisible();
  await expect(page.getByText(/No application record has reached 336 elapsed hours/)).toBeVisible();
  const cohort = page.locator(".cohort-panel");
  await expect(cohort.getByRole("heading", { name: /explicit creation window/ })).toBeVisible();
  await expect(cohort.getByText("Counts only.")).toBeVisible();
  await expect(cohort.locator(".metric").first()).toContainText("1");
  await expectSurfaceContained(page, cohort, "application cohort at 320px");

  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Review packets" }).click();
  const packet = page.locator(".packet-row").first();
  await packet.getByRole("button", { name: "Generate", exact: true }).click();
  await packet.getByRole("button", { name: "Generate new" }).click();
  await packet.getByRole("button", { name: "Assure", exact: true }).click();
  await packet.getByRole("button", { name: "Assure", exact: true }).click();
  await packet.getByRole("button", { name: "History", exact: true }).click();
  const packetHistory = packet.locator(".packet-history");
  await expect(
    packetHistory.getByRole("heading", { name: "Packet history and comparison" }),
  ).toBeVisible();
  await expect(packetHistory.locator(".packet-version-list article")).toHaveCount(2);
  await packetHistory
    .locator(".packet-version-list article")
    .first()
    .getByRole("button", { name: "Assurance history" })
    .click();
  await expect(packetHistory.getByText("Run 2 · Passed")).toBeVisible();
  await expect(packetHistory.getByText(/no workspace-global sequence is exposed/)).toBeVisible();
  await expect(packetHistory.getByText(/Changed fields:/)).toBeVisible();
  await expect(packetHistory.getByText("Artifact manifest", { exact: true })).toBeVisible();
  await expectSurfaceContained(page, packetHistory, "packet history at 320px");

  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Data controls" }).click();
  await expect(page.getByText(/1 application, retained profile versions/)).toBeVisible();
  const exportButton = page.getByRole("button", { name: "Download JSON" });
  await expect(exportButton).toBeDisabled();
  await page.getByLabel(/I understand this JSON contains sensitive candidate records/).check();
  await expect(exportButton).toBeEnabled();
  await expect(page.getByText(/not a restore archive/)).toBeVisible();

  await expectSurfaceContained(page, page.locator(".data-grid"), "data controls at 320px");
});

test("long action references keep their Copy control clear at 320px", async ({ page }) => {
  await installClipboardRecorder(page);
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  await page.getByLabel("Your name").fill("Copy Check");
  await page.getByLabel("Your email").fill("copy@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();
  await page.getByRole("button", { name: "Run starter matches" }).click();
  await page.getByRole("button", { name: "Role discovery" }).click();
  await page.getByRole("button", { name: "Track", exact: true }).first().click();

  await page.getByRole("button", { name: "Review packets" }).click();
  await page.getByRole("button", { name: "Generate", exact: true }).first().click();
  await page.getByRole("button", { name: "Assure", exact: true }).first().click();
  const packet = page.locator(".packet-row").first();
  await packet.getByRole("button", { name: "Approve", exact: true }).click();
  await expect(packet.getByText("Approved", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Approved actions" }).click();
  await page.getByRole("button", { name: "Prepare action" }).click();
  await page.getByLabel("Provider").selectOption("test_outbox");
  await page.getByLabel("Recipient").fill("recipient@example.test");
  await page.getByRole("button", { name: "Create approval request" }).click();
  const action = page.locator(".action-row").first();
  await action.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByRole("button", { name: "Turn on" }).click();
  await action.getByRole("button", { name: "Execute", exact: true }).click();
  await expect(action.getByText("Succeeded", { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 320, height: 900 });
  const copyLine = action.locator(".copy-line");
  await expectCopyLineContained(copyLine);
  const fullReference = (await copyLine.locator("code").textContent())?.trim();
  expect(fullReference?.length).toBeGreaterThan(32);
  await copyLine.getByRole("button", { name: "Copy" }).click();
  await expect(copyLine.getByRole("button", { name: "Copied" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("nimanto-test-copied")))
    .toBe(fullReference);
});

test("deletion hands back a receipt that outlives the session, and does not outlive the next one", async ({
  page,
}) => {
  await installClipboardRecorder(page);
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  await page.getByLabel("Your name").fill("Erase Me");
  await page.getByLabel("Your email").fill("erase@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();
  await page.getByRole("button", { name: "Data controls" }).click();
  await page.setViewportSize({ width: 320, height: 900 });

  const deletionConfirmation = page.getByRole("textbox", {
    name: /DELETE MY NIMANTO DATA/,
  });
  await deletionConfirmation.pressSequentially("DELETE MY NIMANTO DATA");
  await expect(deletionConfirmation).toHaveValue("DELETE MY NIMANTO DATA");
  await page.getByRole("button", { name: "Delete all data" }).click();

  /* Deletion clears the session, so the panel that requested it unmounts. The
   * receipt has to survive that or the seven-day token — the only way to check
   * or resume the deletion — is gone before it can be read. */
  const receipt = page.locator(".receipt");
  await expect(receipt).toBeVisible();
  await expect(receipt.getByRole("heading")).toContainText("deleted");
  await expect(receipt.getByRole("button", { name: /Copy/ })).toBeVisible();
  await expect(receipt).toContainText("/v1/deletion/resume");
  const token = (await receipt.locator("code").first().textContent())?.trim();
  expect(token?.length).toBeGreaterThan(16);
  const copyLine = receipt.locator(".copy-line");
  await expectCopyLineContained(copyLine);
  await copyLine.getByRole("button", { name: "Copy" }).click();
  await expect(copyLine.getByRole("button", { name: "Copied" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("nimanto-test-copied")))
    .toBe(token);

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

  await page.setViewportSize({ width: 1280, height: 900 });
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

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.goBack();
  await expect(page).toHaveURL(/#jobs$/);
  const backHeading = page.getByRole("heading", { name: /Compare roles to evidence/ });
  await expect(backHeading).toBeVisible();
  await expect(page.locator(".workspace-content")).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const header = document.querySelector(".workspace-header")?.getBoundingClientRect();
        const heading = document.querySelector(".workspace-content h1")?.getBoundingClientRect();
        return Boolean(header && heading && heading.top >= header.bottom);
      }),
    )
    .toBe(true);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Track the real process." })).toBeVisible();
  await expect(page.locator(".workspace-content")).toBeFocused();

  // Section focus starts from a scrolled document and clears the actual sticky
  // header at every supported width. 640 CSS px represents 1280 at 200% zoom.
  for (const width of [320, 375, 414, 640, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    if (width <= 880) await page.getByRole("button", { name: "Open navigation" }).click();
    await page.getByRole("button", { name: "Stored history" }).click();
    // The correction is deliberately requestAnimationFrame-bound so it runs
    // after the newly selected section commits. Polling avoids measuring the
    // previous scroll position in that one-frame handoff.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const header = document.querySelector(".workspace-header")?.getBoundingClientRect();
            const heading = document
              .querySelector(".workspace-content h1")
              ?.getBoundingClientRect();
            return Boolean(header && heading && heading.top >= header.bottom);
          }),
        { message: `focused heading clears header at ${width}px` },
      )
      .toBe(true);
  }

  // A deep link opens on its section rather than on Overview.
  await page.goto("/workspace/#packets");
  await expect(page.getByRole("heading", { name: /Generate once/ })).toBeVisible();
});
