import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { bootstrapSecret } from "../../playwright.config.js";

const TEST_API_ORIGIN = `http://127.0.0.1:${process.env.NIMANTO_PLAYWRIGHT_API_PORT ?? "4310"}`;

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

async function approveExactPacket(scope: Page | Locator) {
  await scope.getByRole("button", { name: "Approve", exact: true }).first().click();
  await scope.getByRole("button", { name: "Approve this packet" }).first().click();
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

// WebKit can complete selectOption just before React replaces the controlled
// form subtree. Cross two paint boundaries so the next locator resolves the
// committed input instead of typing into the detached predecessor.
async function settleControlledForm(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
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
  for (const viewport of [
    { width: 320, height: 900 },
    { width: 375, height: 812 },
    { width: 414, height: 900 },
    { width: 640, height: 900 },
    { width: 768, height: 900 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `public-site overflow at ${viewport.width}px`).toBeLessThanOrEqual(0);
    const escapedHeaderLinks = await page.locator(".site-header nav a").evaluateAll((links) =>
      links
        .map((link) => {
          const rect = link.getBoundingClientRect();
          return { label: link.textContent?.trim(), left: rect.left, right: rect.right };
        })
        .filter(({ left, right }) => left < 0 || right > window.innerWidth),
    );
    expect(escapedHeaderLinks, `public navigation geometry at ${viewport.width}px`).toEqual([]);
    if (viewport.width === 375) {
      await page.evaluate(() => scrollTo(0, 0));
      const emblem = page.locator(".hero-emblem");
      const primaryAction = page.getByRole("link", { name: /Open the workbench/ });
      await expect(emblem).toBeInViewport();
      await expect(primaryAction).toBeInViewport();
      const openingOrder = await page.locator(".hero").evaluate((hero) => {
        const mark = hero.querySelector(".hero-emblem")?.getBoundingClientRect();
        const action = hero.querySelector(".hero-actions .primary")?.getBoundingClientRect();
        return {
          markBeforeAction: Boolean(mark && action && mark.top < action.top),
          markInsideViewport: Boolean(mark && mark.top >= 0 && mark.bottom <= innerHeight),
          actionInsideViewport: Boolean(action && action.top >= 0 && action.bottom <= innerHeight),
        };
      });
      expect(openingOrder).toEqual({
        markBeforeAction: true,
        markInsideViewport: true,
        actionInsideViewport: true,
      });
      await page.locator("footer").scrollIntoViewIfNeeded();
      await expect(page.getByRole("navigation", { name: "Footer" })).toBeInViewport();
    }
  }

  await expect(page.getByRole("link", { name: "Run it" })).toHaveAttribute("href", "#run");
  await expect(page.getByRole("link", { name: /Open the workbench/ })).toHaveAttribute(
    "href",
    "./workspace/",
  );
  await expect(
    page.getByRole("link", { name: "Releases & checksums", exact: true }),
  ).toHaveAttribute("href", "https://github.com/udhawan97/Nimanto/releases/latest");
  await expect(page.getByRole("link", { name: "Help", exact: true })).toHaveAttribute(
    "href",
    "#help",
  );
  await expect(page.getByLabel("Ways to run Nimanto").locator("article")).toHaveCount(3);
  await expect(page.getByRole("navigation", { name: "Help and continuation" })).toContainText(
    "Run and troubleshoot",
  );
  await expect(page.getByRole("link", { name: "Run and troubleshoot" })).toHaveAttribute(
    "href",
    "https://github.com/udhawan97/Nimanto/blob/main/docs/operations/local-beta.md",
  );
  await expect(page.getByRole("link", { name: "Report a security issue" })).toHaveAttribute(
    "href",
    "https://github.com/udhawan97/Nimanto/blob/main/SECURITY.md",
  );
  await expect(page.getByRole("link", { name: "Inspect or report a bug" })).toHaveAttribute(
    "href",
    "https://github.com/udhawan97/Nimanto/issues",
  );
  await expect(page.getByRole("link", { name: "Open the v0.8.0 source release" })).toHaveAttribute(
    "href",
    "https://github.com/udhawan97/Nimanto/releases/tag/v0.8.0",
  );
  await expect(page.getByRole("link", { name: "Read the v0.8.0 notes" })).toHaveAttribute(
    "href",
    "https://github.com/udhawan97/Nimanto/blob/v0.8.0/docs/releases/v0.8.0.md",
  );
  await expect(page.getByRole("link", { name: "Check hashes and inventories" })).toHaveAttribute(
    "href",
    "https://github.com/udhawan97/Nimanto/blob/v0.8.0/README.md#verify-a-source-release",
  );
  const releaseLinkTops = await page
    .locator(".release-proof .text-link")
    .evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().top)));
  expect(new Set(releaseLinkTops).size, "release verification links occupy separate rows").toBe(
    releaseLinkTops.length,
  );
  await expect(page.getByRole("link", { name: "v0.8.0 notes" }).first()).toHaveAttribute(
    "href",
    "https://github.com/udhawan97/Nimanto/blob/v0.8.0/docs/releases/v0.8.0.md",
  );
  await expect(page.getByAltText(/Synthetic Nimanto Applications workbench/)).toHaveAttribute(
    "src",
    /assets\/nimanto-workbench\.png$/,
  );
  // Assert after hydration and the full page journey so a delayed effect cannot
  // make a false-zero loopback registration pass.
  expect(
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length),
  ).toBe(0);
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
          return (await page.request.get(`${TEST_API_ORIGIN}/health`)).ok();
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
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => scrollTo(0, 0));
  const firstDecisionOrder = await page.locator(".focus-strip").evaluate((focusStrip) => {
    const summaries = [".metric-row", ".funnel-strip", ".workspace-columns"].map((selector) =>
      document.querySelector(selector),
    );
    const action = focusStrip.querySelector("button");
    const actionRect = action?.getBoundingClientRect();
    return {
      dom: summaries.every(
        (summary) =>
          summary !== null &&
          Boolean(focusStrip.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING),
      ),
      visual: summaries.every(
        (summary) =>
          summary !== null &&
          focusStrip.getBoundingClientRect().top < summary.getBoundingClientRect().top,
      ),
      actionInFirstViewport:
        actionRect !== undefined && actionRect.top >= 0 && actionRect.bottom <= window.innerHeight,
    };
  });
  expect(firstDecisionOrder).toEqual({
    dom: true,
    visual: true,
    actionInFirstViewport: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Run starter matches" }).click();
  await expect(page.locator(".metric").filter({ hasText: "Explained matches" })).toContainText("2");

  await page.getByRole("button", { name: "Evidence vault" }).click();
  const originalAuthorization = await page.getByLabel("Candidate-approved statement").inputValue();
  await page.getByLabel("Evidence type").selectOption("project");
  await page.getByLabel("Exact claim").fill("Candidate-controlled draft survives navigation");
  await page
    .getByLabel("Candidate-approved statement")
    .fill("Candidate-approved wording survives navigation too.");
  await page.getByRole("button", { name: "Role discovery" }).click();
  await page.getByRole("button", { name: "Evidence vault" }).click();
  await expect(page.getByLabel("Evidence type")).toHaveValue("project");
  await expect(page.getByLabel("Exact claim")).toHaveValue(
    "Candidate-controlled draft survives navigation",
  );
  await expect(page.getByLabel("Candidate-approved statement")).toHaveValue(
    "Candidate-approved wording survives navigation too.",
  );
  await page.getByLabel("Evidence type").selectOption("skill");
  await page.getByLabel("Exact claim").fill("");
  await page.getByLabel("Candidate-approved statement").fill(originalAuthorization);
  await page.locator('input[type="file"]').setInputFiles({
    name: "linkedin-export.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(
      "UEsDBBQAAAAIAEqdBV2JuW/mFAAAABIAAAAjAAAAQmFzaWNfTGlua2VkSW5EYXRhRXhwb3J0L1NraWxscy5jc3bzS8xN5VIKqSxIDU4uyiwoUeICAFBLAwQUAAAACABKnQVdezphTR4AAAAcAAAAJQAAAEJhc2ljX0xpbmtlZEluRGF0YUV4cG9ydC9NZXNzYWdlcy5jc3ZzK8rP1QnJ13HOzytJzSvhctRx0gkoyixLLEnlAgBQSwECFAAUAAAACABKnQVdiblv5hQAAAASAAAAIwAAAAAAAAAAAAAAAAAAAAAAQmFzaWNfTGlua2VkSW5EYXRhRXhwb3J0L1NraWxscy5jc3ZQSwECFAAUAAAACABKnQVdezphTR4AAAAcAAAAJQAAAAAAAAAAAAAAAABVAAAAQmFzaWNfTGlua2VkSW5EYXRhRXhwb3J0L01lc3NhZ2VzLmNzdlBLBQYAAAAAAgACAKQAAAC2AAAAAAA=",
      "base64",
    ),
  });
  const importPreview = page.locator(".import-preview");
  await expect(page.getByRole("heading", { name: "Review linkedin-export.zip" })).toBeVisible();
  await expect(importPreview).toBeFocused();
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
  await expect(page.locator('input[type="file"]')).toBeFocused();
  await expect(
    page.locator(".evidence-list").getByText("TypeScript", { exact: true }),
  ).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: "cancelled-import.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("This preview must not commit."),
  });
  await expect(importPreview).toBeFocused();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator('input[type="file"]')).toBeFocused();

  const longClaim = `claim-${"evidence".repeat(44)}`;
  await page.getByLabel("Exact claim").fill(longClaim);
  await page.getByRole("button", { name: "Add pending claim" }).click();
  await page.setViewportSize({ width: 320, height: 900 });
  await expectSurfaceContained(
    page,
    page.locator(".evidence-item", { hasText: longClaim }),
    "long evidence claim at 320px",
  );
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.getByRole("button", { name: "Role discovery" }).click();
  await expect(page.getByRole("heading", { name: "Platform Engineer" })).toBeVisible();
  await expect(page.getByText("Northwind Systems").first()).toBeVisible();

  // Role context may guide the candidate, but it may never overwrite or
  // impersonate their unsaved evidence wording.
  await page.getByRole("button", { name: "Evidence vault" }).click();
  const candidateDraft = "Candidate wording stays mine while I inspect a role requirement.";
  await page.getByLabel("Exact claim").fill(candidateDraft);
  await page.getByRole("button", { name: "Role discovery" }).click();
  await page.getByText("View match anatomy").first().click();
  const unmetRequirement = page.getByRole("button", { name: /^Add evidence for / }).first();
  const unmetRequirementLabel = (await unmetRequirement.getAttribute("aria-label"))!.replace(
    "Add evidence for ",
    "",
  );
  await unmetRequirement.click();
  await expect(page.getByLabel("Exact claim")).toHaveValue(candidateDraft);
  await expect(page.getByText("Role requirement to address", { exact: true })).toBeVisible();
  await expect(page.getByText(unmetRequirementLabel, { exact: true })).toBeVisible();
  await expect(page.getByText(/Role wording has not been added to your claim/)).toBeVisible();
  await page.getByRole("button", { name: "Dismiss role requirement" }).click();
  await expect(page.getByText("Role requirement to address", { exact: true })).toHaveCount(0);
  await page.getByLabel("Exact claim").fill("");
  await page.getByRole("button", { name: "Role discovery" }).click();

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

  /* Declining returns the candidate to the control they pressed with the draft
   * untouched; only the second, named press throws the work away. */
  await page.getByRole("button", { name: "Discard draft" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Discard draft" })).toBeFocused();
  await expect(page.getByLabel("Role title")).toHaveValue("Synthetic Reliability Engineer");
  await page.getByRole("button", { name: "Discard draft" }).click();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByLabel("Role title")).toHaveValue("Synthetic Reliability Engineer");
  await expect(page.getByRole("button", { name: "Discard draft" })).toBeFocused();
  await page.getByRole("button", { name: "Discard draft" }).click();
  await page.getByRole("button", { name: "Discard it" }).click();
  await expect(page.getByRole("button", { name: "Add role" })).toBeFocused();
  await page.getByRole("button", { name: "Add role" }).click();
  await page.getByLabel("Role title").fill("Reload clears this draft");
  await page.reload();
  await expect(page.getByRole("button", { name: "Add role" })).toBeVisible();
  await expect(page.locator("#manual-role-draft")).toHaveCount(0);

  await page.getByRole("button", { name: "Add role" }).click();
  await page.getByLabel("Role title").fill("Saved Synthetic Role");
  await page.getByLabel("Company").fill("Synthetic Works");
  await page
    .getByLabel("Posting URL")
    .fill("https://job-boards.greenhouse.io/nimanto-synthetic/jobs/17001?utm_source=test#apply");
  await page.getByLabel("Description").fill("A role saved exactly once.");
  await page.getByLabel("Requirements, one per line").fill("TypeScript");
  await page.getByLabel("Posted annual minimum (USD)").fill("200000");
  await page.getByLabel("Posted annual maximum (USD)").fill("100000");
  await page.getByRole("button", { name: "Save role" }).click();
  await expect(page.getByLabel("Role title")).toHaveValue("Saved Synthetic Role");
  await expect(page.getByLabel("Description")).toHaveValue("A role saved exactly once.");
  await expect(
    page.getByText("The posted annual maximum must be greater than or equal to the minimum."),
  ).toBeVisible();
  await expect(page.getByLabel("Posted annual minimum (USD)")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Posted annual maximum (USD)")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Posted annual maximum (USD)")).toBeFocused();
  expect(consoleProblems).toEqual([]);
  await page.getByLabel("Posted annual maximum (USD)").fill("220000");
  await expect(
    page.getByText("The posted annual maximum must be greater than or equal to the minimum."),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Save role" }).click();
  await expect(page.getByRole("button", { name: "Add role" })).toBeFocused();
  await expect(page.getByRole("heading", { name: "Saved Synthetic Role" })).toHaveCount(1);
  const savedRole = page.locator(".job-row").filter({ hasText: "Saved Synthetic Role" });
  await expect(savedRole.getByRole("link", { name: "Open employer posting" })).toHaveAttribute(
    "href",
    "https://job-boards.greenhouse.io/nimanto-synthetic/jobs/17001",
  );
  await expect(savedRole.getByRole("button", { name: "Recheck employer ATS" })).toBeVisible();
  await expect(savedRole.getByRole("button", { name: "Recheck employer ATS" })).toHaveAttribute(
    "title",
    /Candidate-requested Detail get · no redirects or applications/u,
  );

  await page.getByRole("button", { name: "Schedule source" }).click();
  await page.getByLabel("Scheduled provider").selectOption("greenhouse");
  await page.getByLabel("Scheduled board identifier").fill("northwind-careers");
  await page.getByLabel("Refresh cadence").selectOption("360");
  await page.getByRole("button", { name: "Start schedule" }).click();
  const schedule = page.locator(".schedule-row").filter({ hasText: "northwind-careers" });
  await expect(schedule).toContainText("Every 6 hours");
  await expect(schedule).toContainText("Queued");
  await page.setViewportSize({ width: 320, height: 900 });
  await schedule.getByRole("button", { name: "Pause schedule" }).click();
  await expect(schedule).toContainText("Paused");
  const pauseNotice = page.getByRole("status").filter({ hasText: "northwind-careers is paused." });
  await expect(pauseNotice).toBeInViewport();
  await schedule.getByRole("button", { name: "Resume schedule" }).click();
  await expect(schedule).toContainText("Queued");
  const cancelSchedule = schedule.getByRole("button", { name: "Cancel schedule" });
  await cancelSchedule.click();
  await expect(schedule.getByText(/This cannot be undone/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(cancelSchedule).toBeFocused();
  await expect(schedule).toContainText("Queued");

  for (const width of [320, 375, 414, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);
  }

  await page.setViewportSize({ width: 375, height: 812 });
  // WebKit can report a computed 44 CSS-pixel box a few millionths below 44
  // after device-scale conversion. Keep a sub-thousandth-pixel tolerance so
  // this still fails for any meaningful touch-target regression.
  const minimumTouchTarget = 44 - 0.001;
  const openNavigation = page.getByRole("button", { name: "Open navigation" });
  const openNavigationBox = await openNavigation.boundingBox();
  expect(openNavigationBox?.width).toBeGreaterThanOrEqual(minimumTouchTarget);
  expect(openNavigationBox?.height).toBeGreaterThanOrEqual(minimumTouchTarget);
  await openNavigation.click();
  const navigationDialog = page.getByRole("dialog", { name: "Workspace navigation" });
  await expect(navigationDialog).toBeVisible();
  await expect(page.locator("#main")).toHaveAttribute("inert", "");
  await expect(page.locator(".nav-scrim")).toHaveAttribute("tabindex", "-1");
  const closeNavigation = page.getByRole("button", { name: "Close navigation" }).first();
  const closeNavigationBox = await closeNavigation.boundingBox();
  expect(closeNavigationBox?.width).toBeGreaterThanOrEqual(minimumTouchTarget);
  expect(closeNavigationBox?.height).toBeGreaterThanOrEqual(minimumTouchTarget);
  const brandLink = navigationDialog.locator('a[href="../"]');
  await expect(closeNavigation).toBeVisible();
  await expect(closeNavigation).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(brandLink).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(closeNavigation).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Overview" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(closeNavigation).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Overview" })).toBeFocused();
  const signOut = navigationDialog.getByRole("button", { name: "Sign out" });
  await signOut.focus();
  await page.keyboard.press("Tab");
  await expect(brandLink).toBeFocused();
  await brandLink.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(signOut).toBeFocused();
  await closeNavigation.focus();
  await closeNavigation.click();
  await expect(page.getByRole("navigation", { name: "Workbench" })).toBeHidden();
  await expect(openNavigation).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Refresh" })).toBeFocused();

  await openNavigation.click();
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(page.getByRole("navigation", { name: "Workbench" })).toBeVisible();
  await expect(page.locator("#main")).not.toHaveAttribute("inert", "");
  await page.setViewportSize({ width: 320, height: 900 });
  await expect(page.getByRole("navigation", { name: "Workbench" })).toBeHidden();

  await openNavigation.click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("heading", { name: "Your evidence stays with you." })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem("nimanto_bootstrap")))
    .toBeNull();
  expect(consoleProblems).toEqual([]);
});

test("an email-bound invitation creates a separate empty candidate workspace", async ({ page }) => {
  const invitation = await page.request.post(`${TEST_API_ORIGIN}/v1/auth/invitations`, {
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
  await page.getByRole("button", { name: "Run starter matches" }).click();
  await page.getByRole("button", { name: "Evidence vault" }).click();
  await page.getByLabel("Evidence type").selectOption("project");
  await page.getByLabel("Exact claim").fill("Must not cross identity boundary");
  await page.getByLabel("Candidate-approved statement").fill("Identity-bound candidate wording");
  await page.getByRole("button", { name: "Role discovery" }).click();
  await page.locator(".role-filter-disclosure summary").click();
  await page.getByLabel("Search roles").fill("Northwind");
  await page.getByLabel("Tracking").selectOption("untracked");
  await page.getByRole("button", { name: "Track", exact: true }).first().click();
  await page.getByRole("button", { name: "Add role" }).click();
  const manualRoleDraft = page.locator("#manual-role-draft");
  const roleTitle = manualRoleDraft.locator('[name="title"]');
  await roleTitle.fill("Must not cross identity boundary");
  await expect(roleTitle).toHaveValue("Must not cross identity boundary");
  const roleCompany = manualRoleDraft.locator('[name="company"]');
  await roleCompany.fill("Synthetic Works");
  await expect(roleCompany).toHaveValue("Synthetic Works");
  const roleDescription = manualRoleDraft.locator('[name="description"]');
  await roleDescription.fill("Transient candidate draft");
  await expect(roleDescription).toHaveValue("Transient candidate draft");
  const roleRequirements = manualRoleDraft.locator('[name="requirements"]');
  await roleRequirements.fill("TypeScript");
  await expect(roleRequirements).toHaveValue("TypeScript");

  await page.getByRole("button", { name: "Applications" }).click();
  await page.getByRole("button", { name: "Table view" }).click();
  await page.getByRole("button", { name: "Record outcome" }).first().click();
  await page.getByLabel("Candidate-reported outcome").selectOption("interview");
  await page.getByLabel("Optional note").fill("Identity-bound outcome draft");
  await page.getByRole("button", { name: "Set follow-up" }).first().click();
  await page.getByLabel("Candidate follow-up date").fill("2099-12-31");
  await page.getByLabel("Created from").fill("2020-01-01");
  const status = page.locator(".application-table .table-row > label select").first();
  await status.selectOption("prepared");
  await status.selectOption("approved_for_export");
  await page.getByRole("button", { name: "Mark approved for export" }).click();
  await page.getByRole("button", { name: "Review packets" }).click();
  await page.getByRole("button", { name: "Generate", exact: true }).first().click();
  await page.getByRole("button", { name: "Assure", exact: true }).first().click();
  await approveExactPacket(page);
  await page.getByRole("button", { name: "Approved actions" }).click();
  await page.getByRole("button", { name: "Prepare action" }).click();
  await page.getByLabel("Recipient").fill("identity-bound@example.test");
  await page.getByRole("button", { name: "Role discovery" }).click();

  const revoked = await page.request.delete(`${TEST_API_ORIGIN}/v1/session`);
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
  await page.locator(".role-filter-disclosure summary").click();
  await expect(page.getByRole("button", { name: "Add role" })).toBeVisible();
  await expect(page.locator("#manual-role-draft")).toHaveCount(0);
  await expect(page.getByLabel("Search roles")).toHaveValue("");
  await expect(page.getByLabel("Tracking")).toHaveValue("all");
  await page.getByRole("button", { name: "Evidence vault" }).click();
  await expect(page.getByLabel("Evidence type")).toHaveValue("skill");
  await expect(page.getByLabel("Exact claim")).toHaveValue("");
  await page.getByRole("button", { name: "Applications" }).click();
  await expect(page.getByRole("button", { name: "Table view" })).toBeVisible();
  await expect(page.getByLabel("Created from")).not.toHaveValue("2020-01-01");
  await expect(page.locator(".outcome-form")).toHaveCount(0);
  await expect(page.locator(".reminder-form")).toHaveCount(0);
  await page.getByRole("button", { name: "Approved actions" }).click();
  await expect(page.locator(".action-form")).toHaveCount(0);
});

test("a shared-cookie identity rotation clears every lifted draft before replacement", async ({
  page,
  context,
}) => {
  await expect
    .poll(
      async () => {
        try {
          return (await page.request.get(`${TEST_API_ORIGIN}/health`)).ok();
        } catch {
          return false;
        }
      },
      { message: "local API health before the identity-rotation journey", timeout: 20_000 },
    )
    .toBe(true);
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  await page.getByLabel("Your name").fill("Original Candidate");
  await page.getByLabel("Your email").fill("original-candidate@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();
  await page.getByRole("button", { name: "Run starter matches" }).click();

  await page.getByRole("button", { name: "Evidence vault" }).click();
  await page.getByLabel("Evidence type").selectOption("project");
  await page.getByLabel("Exact claim").fill("Original candidate evidence wording");
  await page.getByLabel("Candidate-approved statement").fill("Original authorization wording");
  await page.getByRole("button", { name: "Role discovery" }).click();
  await page.locator(".role-filter-disclosure summary").click();
  await page.getByLabel("Search roles").fill("Northwind");
  await page.getByLabel("Tracking").selectOption("untracked");
  await page.getByRole("button", { name: "Track", exact: true }).first().click();
  await page.getByRole("button", { name: "Add role" }).click();
  await page.getByLabel("Role title").fill("Original candidate role draft");
  await page.getByLabel("Company").fill("Original Candidate LLC");

  await page.getByRole("button", { name: "Applications" }).click();
  await page.getByRole("button", { name: "Table view" }).click();
  await page.getByRole("button", { name: "Record outcome" }).first().click();
  await page.getByLabel("Candidate-reported outcome").selectOption("interview");
  await page.getByLabel("Optional note").fill("Original candidate outcome note");
  await page.getByLabel("Created from").fill("2020-01-01");
  await page.getByRole("button", { name: "Review packets" }).click();
  await page.getByRole("button", { name: "Generate", exact: true }).first().click();
  await page.getByRole("button", { name: "Assure", exact: true }).first().click();
  await approveExactPacket(page);
  await page.getByRole("button", { name: "Approved actions" }).click();
  await page.getByRole("button", { name: "Prepare action" }).click();
  await page.getByLabel("Recipient").fill("original-recipient@example.test");
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Original candidate private action draft");
  await page.getByRole("button", { name: "Evidence vault" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "identity-bound-preview.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Private preview that must remount at an identity boundary."),
  });
  await expect(
    page.getByRole("heading", { name: "Review identity-bound-preview.txt" }),
  ).toBeVisible();

  // Browser tabs share the authenticated cookie. Rotate it from a sibling tab
  // without letting the original page observe an unauthenticated state first.
  const sibling = await context.newPage();
  const signedOut = await sibling.request.delete(`${TEST_API_ORIGIN}/v1/session`);
  expect(signedOut.ok()).toBe(true);
  const replacement = await sibling.request.post(`${TEST_API_ORIGIN}/v1/auth/local`, {
    headers: { "x-nimanto-bootstrap-secret": bootstrapSecret },
    data: {
      displayName: "Replacement Candidate",
      email: "replacement-candidate@example.test",
    },
  });
  expect(replacement.ok()).toBe(true);
  await sibling.close();

  // Submit from the stale tab instead of refreshing first. The server rejects
  // the old session generation before writing, then the client reconciles and
  // remounts the still-active Evidence section.
  await page.getByRole("button", { name: "Add pending claim" }).click();
  await expect(page.getByText("replacement-candidate@example.test")).toBeVisible();
  await expect(page.getByText(/authenticated workspace changed in another tab/i)).toBeVisible();
  await expect(page.locator(".import-preview")).toHaveCount(0);
  await expect(page.getByLabel("Evidence type")).toHaveValue("skill");
  await expect(page.getByLabel("Exact claim")).toHaveValue("");
  await expect(page.getByLabel("Candidate-approved statement")).not.toHaveValue(
    "Original authorization wording",
  );
  await page.getByRole("button", { name: "Role discovery" }).click();
  await page.locator(".role-filter-disclosure summary").click();
  await expect(page.locator("#manual-role-draft")).toHaveCount(0);
  await expect(page.getByLabel("Search roles")).toHaveValue("");
  await expect(page.getByLabel("Tracking")).toHaveValue("all");
  await page.getByRole("button", { name: "Applications" }).click();
  await expect(page.getByRole("button", { name: "Table view" })).toBeVisible();
  await expect(page.getByLabel("Created from")).not.toHaveValue("2020-01-01");
  await expect(page.locator(".outcome-form")).toHaveCount(0);
  await page.getByRole("button", { name: "Approved actions" }).click();
  await expect(page.locator(".action-form")).toHaveCount(0);
});

test("a delayed evidence save cannot overwrite newer controlled edits", async ({ page }) => {
  await expect
    .poll(
      async () => {
        try {
          return (await page.request.get(`${TEST_API_ORIGIN}/health`)).ok();
        } catch {
          return false;
        }
      },
      { message: "local API health before delayed evidence save", timeout: 20_000 },
    )
    .toBe(true);
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  await page.getByLabel("Your name").fill("Delayed Evidence");
  await page.getByLabel("Your email").fill("delayed-evidence@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();
  await page.getByRole("button", { name: "Evidence vault" }).click();
  await page.getByLabel("Evidence type").selectOption("project");
  await page.getByLabel("Exact claim").fill("Submitted claim snapshot");
  await page.getByLabel("Candidate-approved statement").fill("Submitted authorization snapshot");

  let releaseResponse!: () => void;
  let reportResponseReady!: () => void;
  const responseMayFinish = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  const responseReady = new Promise<void>((resolve) => {
    reportResponseReady = resolve;
  });
  await page.route("**/v1/evidence", async (route) => {
    const response = await route.fetch();
    reportResponseReady();
    await responseMayFinish;
    await route.fulfill({ response });
  });

  await page.getByRole("button", { name: "Add pending claim" }).click();
  await responseReady;
  await page.getByLabel("Evidence type").selectOption("accomplishment");
  await page.getByLabel("Exact claim").fill("Newer in-flight candidate wording");
  await page
    .getByLabel("Candidate-approved statement")
    .fill("Newer in-flight authorization wording");
  releaseResponse();

  await expect(page.getByText("Claim added to the review queue.")).toBeVisible();
  await expect(page.getByLabel("Evidence type")).toHaveValue("accomplishment");
  await expect(page.getByLabel("Exact claim")).toHaveValue("Newer in-flight candidate wording");
  await expect(page.getByLabel("Candidate-approved statement")).toHaveValue(
    "Newer in-flight authorization wording",
  );
  await page.unroute("**/v1/evidence");
});

test("delayed role, outcome, and action submissions retain newer candidate edits", async ({
  page,
}) => {
  await expect
    .poll(
      async () => {
        try {
          return (await page.request.get(`${TEST_API_ORIGIN}/health`)).ok();
        } catch {
          return false;
        }
      },
      { message: "local API health before delayed controlled submissions", timeout: 20_000 },
    )
    .toBe(true);
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  await page.getByLabel("Your name").fill("Delayed Controls");
  await page.getByLabel("Your email").fill("delayed-controls@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();
  await page.getByRole("button", { name: "Run starter matches" }).click();
  await page.getByRole("button", { name: "Role discovery" }).click();
  await page.getByRole("button", { name: "Add role" }).click();
  await page.getByLabel("Role title").fill("Submitted role snapshot");
  await page.getByLabel("Company").fill("Submitted Company");
  await page.getByLabel("Description").fill("Submitted role description");
  await page.getByLabel("Requirements, one per line").fill("TypeScript");
  let releaseRole!: () => void;
  let reportRoleReady!: () => void;
  const roleMayFinish = new Promise<void>((resolve) => {
    releaseRole = resolve;
  });
  const roleReady = new Promise<void>((resolve) => {
    reportRoleReady = resolve;
  });
  await page.route("**/v1/jobs", async (route) => {
    const response = await route.fetch();
    reportRoleReady();
    await roleMayFinish;
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "Save role" }).click();
  await roleReady;
  await page.getByLabel("Role title").fill("Newer candidate role draft");
  await page.getByLabel("Company").fill("Newer Candidate Company");
  await page.getByLabel("Description").fill("Newer candidate description");
  releaseRole();
  await expect(page.getByText("Role added.")).toBeVisible();
  await expect(page.getByLabel("Role title")).toHaveValue("Newer candidate role draft");
  await expect(page.getByLabel("Company")).toHaveValue("Newer Candidate Company");
  await expect(page.getByLabel("Description")).toHaveValue("Newer candidate description");
  await page.unroute("**/v1/jobs");
  await page.getByRole("button", { name: "Track", exact: true }).first().click();

  await page.getByRole("button", { name: "Applications" }).click();
  await page.getByRole("button", { name: "Record outcome" }).first().click();
  await page.getByLabel("Candidate-reported outcome").selectOption("reply");
  await page.getByLabel("Optional note").fill("Submitted outcome snapshot");
  let releaseOutcome!: () => void;
  let reportOutcomeReady!: () => void;
  const outcomeMayFinish = new Promise<void>((resolve) => {
    releaseOutcome = resolve;
  });
  const outcomeReady = new Promise<void>((resolve) => {
    reportOutcomeReady = resolve;
  });
  await page.route("**/v1/applications/*/outcomes", async (route) => {
    const response = await route.fetch();
    reportOutcomeReady();
    await outcomeMayFinish;
    await route.fulfill({ response });
  });
  await page.locator(".outcome-form").getByRole("button", { name: "Record outcome" }).click();
  await outcomeReady;
  await page.getByLabel("Candidate-reported outcome").selectOption("interview");
  await page.getByLabel("Optional note").fill("Newer candidate outcome draft");
  releaseOutcome();
  await expect(page.getByText("Candidate-reported outcome recorded.")).toBeVisible();
  await expect(page.getByLabel("Candidate-reported outcome")).toHaveValue("interview");
  await expect(page.getByLabel("Optional note")).toHaveValue("Newer candidate outcome draft");
  await page.unroute("**/v1/applications/*/outcomes");

  await page.getByRole("button", { name: "Review packets" }).click();
  await page.getByRole("button", { name: "Generate", exact: true }).first().click();
  await page.getByRole("button", { name: "Assure", exact: true }).first().click();
  await approveExactPacket(page);
  await page.getByRole("button", { name: "Approved actions" }).click();
  await page.getByRole("button", { name: "Prepare action" }).click();
  await page.getByLabel("Provider").selectOption("test_outbox");
  await settleControlledForm(page);
  await page.getByLabel("Recipient").fill("submitted@example.test");
  await page.getByLabel("Subject").fill("Submitted action snapshot");
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Submitted candidate message");
  let releaseAction!: () => void;
  let reportActionReady!: () => void;
  const actionMayFinish = new Promise<void>((resolve) => {
    releaseAction = resolve;
  });
  const actionReady = new Promise<void>((resolve) => {
    reportActionReady = resolve;
  });
  await page.route("**/v1/actions", async (route) => {
    const response = await route.fetch();
    reportActionReady();
    await actionMayFinish;
    await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "Create approval request" }).click();
  await actionReady;
  await page.getByLabel("Recipient").fill("newer@example.test");
  await page.getByLabel("Subject").fill("Newer candidate action draft");
  await page.getByRole("textbox", { name: "Message", exact: true }).fill("Newer candidate message");
  releaseAction();
  await expect(page.getByText("Action created and waiting for approval.")).toBeVisible();
  await expect(page.getByLabel("Recipient")).toHaveValue("newer@example.test");
  await expect(page.getByLabel("Subject")).toHaveValue("Newer candidate action draft");
  await expect(page.getByRole("textbox", { name: "Message", exact: true })).toHaveValue(
    "Newer candidate message",
  );
  await page.unroute("**/v1/actions");
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
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "PUT" && request.url().includes("/status")) writes.push(request.url());
  });

  // Only the active work surface is mounted. This prevents a hidden second
  // editor from duplicating label and aria-controls IDs.
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => scrollTo(0, 0));
  await expect(page.locator(".board")).toBeVisible();
  await expect(page.locator(".application-table")).toHaveCount(0);
  const workSurfaceOrder = await page.evaluate(() => {
    const board = document.querySelector(".board");
    const secondary = document.querySelector(".application-filter-disclosure");
    const firstCard = document.querySelector(".board-card");
    return board && secondary && firstCard
      ? {
          dom: Boolean(board.compareDocumentPosition(secondary) & Node.DOCUMENT_POSITION_FOLLOWING),
          visual: board.getBoundingClientRect().top < secondary.getBoundingClientRect().top,
          boardInFirstViewport: board.getBoundingClientRect().top < innerHeight,
          firstCardInFirstViewport: firstCard.getBoundingClientRect().top < innerHeight,
        }
      : null;
  });
  expect(workSurfaceOrder).toEqual({
    dom: true,
    visual: true,
    boardInFirstViewport: true,
    firstCardInFirstViewport: true,
  });

  const boardOutcome = page.getByRole("button", { name: "Record outcome" }).first();
  await expect(boardOutcome).not.toHaveAttribute("aria-controls", /.+/);
  const withdraw = page.locator(".board button", { hasText: /^Withdrawn$/ }).first();
  await withdraw.click();
  await expect(page.locator(".board .confirm-strip")).toContainText("withdrawn");
  await page.keyboard.press("Escape");
  await expect(page.locator(".board .confirm-strip")).toHaveCount(0);
  await expect(withdraw).toBeFocused();
  await page.waitForTimeout(250);
  expect(writes, "an escaped board confirmation must not write").toEqual([]);
  await boardOutcome.click();
  const boardOutcomeEditorId = await boardOutcome.getAttribute("aria-controls");
  expect(boardOutcomeEditorId).toBeTruthy();
  await expect(page.locator(`#${boardOutcomeEditorId}`)).toHaveCount(1);
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
  await boardOutcomeForm.getByRole("button", { name: "Discard draft" }).click();
  await page.keyboard.press("Escape");
  await expect(boardOutcomeForm.getByRole("button", { name: "Discard draft" })).toBeFocused();
  await boardOutcomeForm.getByRole("button", { name: "Discard draft" }).click();
  await boardOutcomeForm.getByRole("button", { name: "Discard it" }).click();
  await expect(boardOutcome).toBeFocused();
  await page.setViewportSize({ width: 1280, height: 900 });
  await boardOutcome.click();
  await boardOutcomeForm.getByLabel("Candidate-reported outcome").selectOption("interview");
  await boardOutcomeForm.getByLabel("Optional note").fill("Board draft survives navigation");
  await page.getByLabel("Created from").fill("2020-01-01");
  await page.getByRole("button", { name: "Overview" }).click();
  await page.getByRole("button", { name: "Applications" }).click();
  await expect(
    page.locator(".board .outcome-form").getByLabel("Candidate-reported outcome"),
  ).toHaveValue("interview");
  await expect(page.locator(".board .outcome-form").getByLabel("Optional note")).toHaveValue(
    "Board draft survives navigation",
  );
  await expect(page.getByLabel("Created from")).toHaveValue("2020-01-01");
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

  /* Every route to a consequential status asks first, from either surface.
   * The prompt is the product's own wording in the product's own chrome now, so
   * this block clicks real controls rather than answering a browser dialog. */
  const strip = page.locator(".application-table .confirm-strip");
  await status.selectOption("prepared");
  await expect(status).toHaveValue("prepared");
  await expect(strip, "a preparatory stage should not interrogate the candidate").toHaveCount(0);

  await status.selectOption("approved_for_export");
  await expect(strip).toContainText("approved for export");
  await strip.getByRole("button", { name: "Mark approved for export" }).click();
  await expect(status).toHaveValue("approved_for_export");

  await status.selectOption("submitted_externally");
  await expect(strip).toContainText("Nimanto does not submit anything for you");
  await strip.getByRole("button", { name: "Mark submitted" }).click();
  await expect(status).toHaveValue("submitted_externally");

  /* Declining has to leave the record alone — and leave the control showing the
   * status the record still has. The select's snap-back is React restoring a
   * controlled value with no re-render behind it, which is exactly the kind of
   * thing that holds until someone changes the component and no test notices. */
  const writesBeforeDecline = writes.length;
  await status.selectOption("withdrawn");
  await expect(strip).toContainText("withdrawn");
  await page.keyboard.press("Escape");
  await expect(strip).toHaveCount(0);
  await expect(status).toHaveValue("submitted_externally");
  await expect(status).toBeFocused();
  await page.waitForTimeout(250);
  expect(writes, "a declined confirmation must not write").toHaveLength(writesBeforeDecline);

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
  await expect(page.getByText(/Source registry · 3 enabled/)).toBeVisible();
  await page.getByRole("button", { name: "Discovery profile" }).click();
  await page.getByRole("button", { name: "Approve discovery profile" }).click();
  await expect(page.getByText("Discovery profile approved and saved.")).toBeVisible();
  const roleResultsHeading = page.getByRole("heading", { name: "Current roles" });
  const roleFilters = page.locator(".role-filter-disclosure");
  const roleFilterSummary = roleFilters.locator("summary");
  await expect(roleResultsHeading).toBeVisible();
  await expect(roleFilters).not.toHaveAttribute("open", "");
  for (const [width, maximumTop] of [
    [320, 1_800],
    [1280, 1_100],
  ] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    const hierarchy = await page.evaluate(() => {
      const heading = [...document.querySelectorAll("h2")].find(
        (candidate) => candidate.textContent?.trim() === "Current roles",
      );
      const filters = document.querySelector(".role-filter-disclosure");
      const firstRole = document.querySelector(".job-row");
      if (!heading || !filters || !firstRole) return null;
      return {
        headingTop: heading.getBoundingClientRect().top + window.scrollY,
        filtersTop: filters.getBoundingClientRect().top + window.scrollY,
        firstRoleTop: firstRole.getBoundingClientRect().top + window.scrollY,
      };
    });
    expect(hierarchy, `role hierarchy exists at ${width}px`).not.toBeNull();
    expect(hierarchy!.headingTop).toBeLessThan(hierarchy!.filtersTop);
    expect(hierarchy!.filtersTop).toBeLessThan(hierarchy!.firstRoleTop);
    expect(hierarchy!.firstRoleTop, `first role is reachable early at ${width}px`).toBeLessThan(
      maximumTop,
    );
  }
  await roleFilterSummary.focus();
  await page.keyboard.press("Enter");
  await expect(roleFilters).toHaveAttribute("open", "");
  await expect(roleFilterSummary).toBeFocused();
  await page.getByLabel("Remote / workplace").selectOption("hybrid");
  await expect(page.locator(".job-row")).toHaveCount(1);
  await expect(page.locator(".posting-verification")).toContainText("not source-verified");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(roleFilterSummary).toBeFocused();
  await expect(roleFilters).not.toHaveAttribute("open", "");
  await roleFilterSummary.click();
  await expect(page.getByText("Filters stay in this tab until reload or sign-out.")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search roles" }).fill("Northwind");
  await page.getByLabel("Tracking").selectOption("untracked");
  await expect(page.locator(".job-row")).toHaveCount(1);
  await expect(page.getByText("1 of 2", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Overview" }).click();
  await page.getByRole("button", { name: "Role discovery" }).click();
  await expect(page.getByRole("searchbox", { name: "Search roles" })).toHaveValue("Northwind");
  await expect(page.getByLabel("Tracking")).toHaveValue("untracked");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".role-filter-disclosure summary")).toBeFocused();
  await expect(page.locator(".job-row")).toHaveCount(2);

  const role = page.locator(".job-row").first();
  await role.getByText("View match anatomy").click();
  await expect(role.locator(".dimension-grid article")).toHaveCount(4);
  await expect(
    role.getByText(/Coverage below 0\.60, including roles without known requirements/),
  ).toBeVisible();
  await expect(role.getByText(/At least 0\.60 is required for a scored band/)).toBeVisible();
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
  await expect(
    timeline.getByText(/Gaps infer nothing; notes change no status or metric/),
  ).toBeVisible();

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

test("the full discovery contract is candidate-approved, replayed, and explained", async ({
  page,
}) => {
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  await page.getByLabel("Your name").fill("Discovery Review");
  await page.getByLabel("Your email").fill("discovery-review@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();
  await page.getByRole("button", { name: "Run starter matches" }).click();
  await page.getByRole("button", { name: "Role discovery" }).click();

  await page.setViewportSize({ width: 320, height: 900 });
  await expect(page.locator(".discovery-profile")).toHaveCount(0);
  const firstTimeRoleTop = await page
    .locator(".job-row")
    .first()
    .evaluate((role) => role.getBoundingClientRect().top + window.scrollY);
  expect(firstTimeRoleTop, "first-time role is reachable before profile setup").toBeLessThan(1_800);
  await page.getByRole("button", { name: "Discovery profile" }).click();

  await page.getByLabel("Seniority terms, one per line").fill("Engineer");
  await page.getByLabel("Industry terms, one per line").fill("platform");
  await page.getByLabel("Required skill terms, one per line").fill("TypeScript");
  await page.getByLabel("Preferred skill terms, one per line").fill("PostgreSQL");
  await page.getByLabel("Include conflicting evidence").check();
  await page.getByRole("button", { name: "Add physical area" }).click();
  await page.getByLabel("Physical area 1 label").fill("Chicago, IL");
  await page.getByLabel("Physical area 1 country code").fill("US");
  await page.getByLabel("Physical area 1 subdivision code").fill("US-IL");
  await page.getByLabel("Physical area 1 metro ID").fill("chi");
  await page.getByLabel("Physical area 1 timezone").fill("America/Chicago");
  await page.getByLabel("Physical area 1 confirmation").selectOption("confirmed");
  await page.getByRole("button", { name: "Add physical area" }).click();
  await page.getByLabel("Physical area 2 label").fill("Madison, WI");
  await page.getByLabel("Physical area 2 country code").fill("US");
  await page.getByLabel("Physical area 2 subdivision code").fill("US-WI");
  await page.getByLabel("Physical area 2 confirmation").selectOption("confirmed");
  await page.getByRole("button", { name: "Add remote area" }).click();
  await page.getByLabel("Remote area 1 label").fill("United States");
  await page.getByLabel("Remote area 1 country code").fill("US");
  await page.getByLabel("Remote area 1 confirmation").selectOption("confirmed");
  await page.getByLabel("Commute radius in miles").fill("25");
  await page.getByLabel("Willingness to move").selectOption("no");
  await page.getByLabel("Minimum posted compensation").fill("150000");
  await page.getByLabel("Compensation currency").fill("USD");
  await page.getByLabel("Reconfirm authorization statement by").fill("2026-12-31");
  await page.getByRole("button", { name: "Approve discovery profile" }).click();

  await expect(page.getByText("Discovery profile approved and saved.")).toBeVisible();
  const discoveryContract = page.locator(".discovery-contract-disclosure");
  await expect(discoveryContract.locator("summary")).toContainText("Active discovery contract");
  await discoveryContract.locator("summary").click();
  await expect(page.getByRole("heading", { name: "Active discovery contract" })).toBeVisible();
  await expect(page.getByLabel("Exact discovery profile hash")).toHaveText(/^[a-f0-9]{64}$/);
  await expect(page.locator(".discovery-provenance")).toContainText("scoring_rules_v1");
  await expect(page.locator(".discovery-provenance")).toContainText("discovery_profile_v1");
  await expect(page.locator(".job-row")).toHaveCount(1);
  const role = page.locator(".job-row").first();
  await role.getByText("Why this role is shown").click();
  await expect(role.getByText("Seniority · matched")).toBeVisible();
  await expect(role.getByText("Required skill · matched")).toBeVisible();
  await expect(role.getByText("Commute radius · unresolved")).toBeVisible();
  await expect(role.locator(".discovery-rationale code")).toHaveText(/^[a-f0-9]{64}$/);

  await page.locator(".role-filter-disclosure summary").click();
  await page.getByLabel("Discovery contract view").selectOption("excluded");
  await expect(page.locator(".job-row")).toHaveCount(1);
  const excluded = page.locator(".job-row").first();
  await excluded.getByText("Why this role is outside recommendations").click();
  await expect(excluded.locator(".discovery-rationale")).toContainText("Excluded");
  await page.getByLabel("Discovery contract view").selectOption("recommended");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.reload();
  await page.getByRole("button", { name: "Role discovery" }).click();
  await expect(page.locator(".discovery-contract-disclosure summary")).toContainText(
    "Active discovery contract",
  );

  await page.getByRole("button", { name: "Discovery profile" }).click();
  await expect(page.getByLabel("Seniority terms, one per line")).toHaveValue("Engineer");
  await expect(page.getByLabel("Industry terms, one per line")).toHaveValue("platform");
  await expect(page.getByLabel("Required skill terms, one per line")).toHaveValue("TypeScript");
  await expect(page.getByLabel("Preferred skill terms, one per line")).toHaveValue("PostgreSQL");
  await expect(page.getByLabel("Include conflicting evidence")).toBeChecked();
  await expect(page.getByLabel("Physical area 1 label")).toHaveValue("Chicago, IL");
  await expect(page.getByLabel("Physical area 1 subdivision code")).toHaveValue("US-IL");
  await expect(page.getByLabel("Physical area 1 metro ID")).toHaveValue("chi");
  await expect(page.getByLabel("Physical area 1 timezone")).toHaveValue("America/Chicago");
  await expect(page.getByLabel("Physical area 1 confirmation")).toHaveValue("confirmed");
  await expect(page.getByLabel("Physical area 2 label")).toHaveValue("Madison, WI");
  await expect(page.getByLabel("Physical area 2 subdivision code")).toHaveValue("US-WI");
  await expect(page.getByLabel("Remote area 1 label")).toHaveValue("United States");
  await expect(page.getByLabel("Remote area 1 country code")).toHaveValue("US");
  await expect(page.getByLabel("Commute radius in miles")).toHaveValue("25");
  await expect(page.getByLabel("Willingness to move")).toHaveValue("no");
  await expect(page.getByLabel("Minimum posted compensation")).toHaveValue("150000");
  await expect(page.getByLabel("Compensation currency")).toHaveValue("USD");
  await expect(page.getByLabel("Reconfirm authorization statement by")).toHaveValue("2026-12-31");

  await page.getByLabel("Physical area 1 label").fill("Chicago metro");
  await expect(page.getByLabel("Physical area 1 confirmation")).toHaveValue("unknown");
  await page.getByRole("button", { name: "Approve discovery profile" }).click();
  await expect(
    page.getByText("Confirm each edited structured area before saving", { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel("Physical area 1 subdivision code")).toHaveValue("US-IL");
  await expect(page.getByLabel("Physical area 1 metro ID")).toHaveValue("chi");
  await expect(page.getByLabel("Physical area 1 timezone")).toHaveValue("America/Chicago");
  await page.getByLabel("Physical area 1 confirmation").selectOption("confirmed");
  await page.getByRole("button", { name: "Approve discovery profile" }).click();
  await expect(page.getByText("Discovery profile approved and saved.")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Role discovery" }).click();
  await page.getByRole("button", { name: "Discovery profile" }).click();
  await expect(page.getByLabel("Physical area 1 label")).toHaveValue("Chicago metro");
  await expect(page.getByLabel("Physical area 1 subdivision code")).toHaveValue("US-IL");
  await expect(page.getByLabel("Physical area 1 metro ID")).toHaveValue("chi");
  await expect(page.getByLabel("Physical area 1 timezone")).toHaveValue("America/Chicago");
  await expect(page.getByLabel("Physical area 1 confirmation")).toHaveValue("confirmed");
});

test("retained history, record review, cohorts, and sensitive export stay bounded and explicit", async ({
  page,
}) => {
  await expect
    .poll(
      async () => {
        try {
          return (await page.request.get(`${TEST_API_ORIGIN}/health`)).ok();
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
  await expect(page.locator(".metric").filter({ hasText: "Explained matches" })).toContainText("2");

  await page.getByRole("button", { name: "Evidence vault" }).click();
  const authorizationWording = page.getByLabel("Candidate-approved statement");
  await authorizationWording.fill("I require employer support for an H-1B transfer.");
  await expect(authorizationWording).toHaveValue(
    "I require employer support for an H-1B transfer.",
  );
  await expect(page.getByRole("button", { name: "Save profile version" })).toBeVisible();
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
  await expect(
    page.getByText(
      /No candidate-set date is due, and no unscheduled application has reached the 336-hour activity fallback/,
    ),
  ).toBeVisible();
  const cohort = page.locator(".cohort-panel");
  await expect(cohort.getByRole("heading", { name: /explicit creation window/ })).toBeVisible();
  await expect(cohort.getByText("Counts only.")).toBeVisible();
  await expect(cohort.locator(".metric").first()).toContainText("1");
  await expectSurfaceContained(page, cohort, "application cohort at 320px");

  await page.getByRole("button", { name: "Table view" }).click();
  await page.getByRole("button", { name: /Review due/ }).click();
  await page.getByLabel("Created from").fill("2026-01-01");
  await page.getByLabel("Created through").fill("2026-12-31");
  await page.getByLabel("Current role source").selectOption({ index: 1 });
  await page.getByLabel("Current match classification").selectOption("strong_evidence");
  const retainedSource = await page.getByLabel("Current role source").inputValue();

  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Overview" }).click();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Applications" }).click();
  await expect(page.getByRole("button", { name: "Board view" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show all" })).toBeVisible();
  await expect(page.getByLabel("Created from")).toHaveValue("2026-01-01");
  await expect(page.getByLabel("Created through")).toHaveValue("2026-12-31");
  await expect(page.getByLabel("Current role source")).toHaveValue(retainedSource);
  await expect(page.getByLabel("Current match classification")).toHaveValue("strong_evidence");

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

test("outcome drafts remain with each application until recorded or discarded", async ({
  page,
}) => {
  await expect
    .poll(
      async () => {
        try {
          return (await page.request.get(`${TEST_API_ORIGIN}/health`)).ok();
        } catch {
          return false;
        }
      },
      { message: "local API health before the outcome-draft journey", timeout: 20_000 },
    )
    .toBe(true);
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  await page.getByLabel("Your name").fill("Outcome Draft Check");
  await page.getByLabel("Your email").fill("outcome-drafts@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();
  await page.getByRole("button", { name: "Run starter matches" }).click();
  await page.getByRole("button", { name: "Role discovery" }).click();
  const roles = page.locator(".job-row");
  const firstRoleTitle = (await roles
    .nth(0)
    .getByRole("heading", { level: 2 })
    .textContent())!.trim();
  const secondRoleTitle = (await roles
    .nth(1)
    .getByRole("heading", { level: 2 })
    .textContent())!.trim();
  await roles.nth(0).getByRole("button", { name: "Track", exact: true }).click();
  await expect(roles.nth(0).getByRole("button", { name: "Tracked", exact: true })).toBeVisible();
  await roles.nth(1).getByRole("button", { name: "Track", exact: true }).click();
  await expect(roles.nth(1).getByRole("button", { name: "Tracked", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Applications" }).click();
  const cards = page.locator(".board-card");
  await expect(cards).toHaveCount(2);
  const first = cards.filter({ hasText: firstRoleTitle });
  const second = cards.filter({ hasText: secondRoleTitle });
  await first.getByRole("button", { name: "Record outcome" }).click();
  await first.getByLabel("Optional note").fill("First application keeps this exact note.");
  await second.getByRole("button", { name: "Record outcome" }).click();
  await second.getByLabel("Candidate-reported outcome").selectOption("interview");
  await second.getByLabel("Optional note").fill("Second application has different work.");

  await first.getByRole("button", { name: "Record outcome" }).click();
  await expect(first.getByLabel("Candidate-reported outcome")).toHaveValue("reply");
  await expect(first.getByLabel("Optional note")).toHaveValue(
    "First application keeps this exact note.",
  );
  await second.getByRole("button", { name: "Record outcome" }).click();
  await expect(second.getByLabel("Candidate-reported outcome")).toHaveValue("interview");
  await expect(second.getByLabel("Optional note")).toHaveValue(
    "Second application has different work.",
  );
});

test("candidate follow-up dates retain drafts, become due, and clear without inference", async ({
  page,
}) => {
  await expect
    .poll(
      async () => {
        try {
          return (await page.request.get(`${TEST_API_ORIGIN}/health`)).ok();
        } catch {
          return false;
        }
      },
      { message: "local API health before the follow-up reminder journey", timeout: 20_000 },
    )
    .toBe(true);
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  await page.getByLabel("Your name").fill("Follow-up Check");
  await page.getByLabel("Your email").fill("follow-up@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();
  await page.getByRole("button", { name: "Run starter matches" }).click();
  await page.getByRole("button", { name: "Role discovery" }).click();
  const role = page.locator(".job-row").first();
  const roleTitle = (await role.getByRole("heading", { level: 2 }).textContent())!.trim();
  await role.getByRole("button", { name: "Track", exact: true }).click();
  await expect(role.getByRole("button", { name: "Tracked", exact: true })).toBeVisible();

  const followUpWrites: Array<string | null> = [];
  page.on("request", (request) => {
    if (request.method() !== "PUT" || !request.url().endsWith("/follow-up")) return;
    followUpWrites.push((request.postDataJSON() as { followUpOn: string | null }).followUpOn);
  });

  await page.getByRole("button", { name: "Applications" }).click();
  const card = page.locator(".board-card").filter({ hasText: roleTitle });
  await card.getByRole("button", { name: "Set follow-up" }).click();
  const date = card.getByLabel("Candidate follow-up date");
  await expect(date).toBeFocused();
  await expect(date).toHaveValue("");
  await expect(card.getByText("Choose a date · required", { exact: true })).toBeVisible();
  await expect(date).not.toHaveAttribute("aria-invalid", "true");
  await expect(card.getByRole("button", { name: "Save reminder" })).toBeDisabled();
  await date.blur();
  await expect(card.getByText("Required · no date selected", { exact: true })).toBeVisible();
  await expect(date).toHaveAttribute("aria-invalid", "true");
  await date.fill("2099-12-31");
  await expect(card.getByText("Ready to save", { exact: true })).toBeVisible();
  await expect(date).not.toHaveAttribute("aria-invalid", "true");
  await expect(card.getByRole("button", { name: "Save reminder" })).toBeEnabled();
  await date.fill("");
  await expect(card.getByText("Required · no date selected", { exact: true })).toBeVisible();
  await expect(date).toHaveAttribute("aria-invalid", "true");
  await date.fill("2099-12-31");
  for (const width of [320, 375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expectSurfaceContained(page, card, `follow-up editor at ${width}px`);
  }
  await page.getByRole("button", { name: "Overview" }).click();
  await page.getByRole("button", { name: "Applications" }).click();
  await expect(card.getByLabel("Candidate follow-up date")).toHaveValue("2099-12-31");
  expect(followUpWrites, "an unsaved reminder draft must not write").toEqual([]);

  const discardReminder = card.getByRole("button", { name: "Discard draft" });
  await discardReminder.click();
  await expect(card.getByText("Discard this follow-up date draft?")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(discardReminder).toBeFocused();
  await expect(card.getByLabel("Candidate follow-up date")).toHaveValue("2099-12-31");
  expect(followUpWrites, "cancelling reminder discard must not write").toEqual([]);

  await card.getByLabel("Candidate follow-up date").fill("2000-01-01");
  await card.getByRole("button", { name: "Save reminder" }).click();
  await expect(page.getByText("Follow-up reminder saved.")).toBeVisible();
  await expect(card.getByRole("button", { name: "Change follow-up" })).toBeFocused();
  await expect(card.locator(".follow-up")).toContainText("Follow-up reminder due");
  await expect(page.getByRole("button", { name: "Review due · 1" })).toBeVisible();
  await page.getByRole("button", { name: "Table view" }).click();
  const row = page.locator(".table-row").filter({ hasText: roleTitle });
  await expect(row.locator(".follow-up")).toContainText("Follow-up reminder due");
  await page.getByRole("button", { name: "Board view" }).click();
  const reviewQueue = page.locator(".record-review-strip");
  await expect(reviewQueue.getByText("Candidate-set reminder due 2000-01-01")).toBeVisible();
  await expect(reviewQueue).toContainText("Neither infers an employer outcome or contacts anyone.");
  await expect(page.getByText(/employer (?:replied|responded|rejected)/i)).toHaveCount(0);
  expect(followUpWrites).toEqual(["2000-01-01"]);

  await card.getByRole("button", { name: "Change follow-up" }).click();
  await card.getByLabel("Candidate follow-up date").fill("1999-12-31");
  await card.locator("button", { hasText: /^Withdrawn$/ }).click();
  await card.getByRole("button", { name: "Mark withdrawn" }).click();
  await expect(card.locator(".follow-up")).toContainText("Follow-up reminder inactive");
  await expect(page.getByRole("button", { name: "Review due · 0" })).toBeVisible();
  await expect(card.getByRole("button", { name: "Review follow-up" })).toBeVisible();
  await expect(card.getByLabel("Candidate follow-up date")).toBeDisabled();
  await expect(card.getByLabel("Candidate follow-up date")).toHaveValue("2000-01-01");
  expect(followUpWrites, "withdrawing must discard an unsaved date change").toEqual(["2000-01-01"]);
  await expect(card.locator(".reminder-form")).toContainText(
    "retained but inactive while this application is withdrawn",
  );
  await card.getByRole("button", { name: "Close" }).click();
  await card.locator("button", { hasText: /^Tracked$/ }).click();
  await expect(card.locator(".follow-up")).toContainText("Follow-up reminder due");

  await card.getByRole("button", { name: "Change follow-up" }).click();
  await expect(card.getByLabel("Candidate follow-up date")).toHaveValue("2000-01-01");
  await card.getByLabel("Candidate follow-up date").fill("2099-12-30");
  await card.getByRole("button", { name: "Save reminder" }).click();
  await expect(page.getByText("Follow-up reminder saved.")).toBeVisible();
  await expect(card.locator(".follow-up")).toContainText("Follow-up reminder ·");
  await expect(card.locator(".follow-up")).not.toContainText("reminder due");
  await expect(page.getByRole("button", { name: "Review due · 0" })).toBeVisible();
  expect(followUpWrites).toEqual(["2000-01-01", "2099-12-30"]);

  await card.locator("button", { hasText: /^Withdrawn$/ }).click();
  await card.getByRole("button", { name: "Mark withdrawn" }).click();
  await expect(card.locator(".follow-up")).toContainText("Follow-up reminder inactive");
  await card.getByRole("button", { name: "Review follow-up" }).click();
  await card.getByRole("button", { name: "Clear reminder" }).click();
  await card.getByRole("button", { name: "Clear it" }).click();
  await expect(page.getByText("Follow-up reminder cleared.")).toBeVisible();
  await expect(card).toBeFocused();
  await expect(card.locator(".follow-up")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Review due · 0" })).toBeVisible();
  await expect(card.getByRole("button", { name: /follow-up/i })).toHaveCount(0);
  expect(followUpWrites).toEqual(["2000-01-01", "2099-12-30", null]);
  await card.locator("button", { hasText: /^Tracked$/ }).click();
  await expect(card.getByRole("button", { name: "Set follow-up" })).toBeVisible();
});

test("candidate decision tools archive, filter, annotate, and export without inference", async ({
  page,
}) => {
  await expect
    .poll(
      async () => {
        try {
          return (await page.request.get(`${TEST_API_ORIGIN}/health`)).ok();
        } catch {
          return false;
        }
      },
      { message: "local API health before the decision-tools journey", timeout: 20_000 },
    )
    .toBe(true);
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  await page.getByLabel("Your name").fill("Decision Tools Check");
  await page.getByLabel("Your email").fill("decision-tools@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();
  await page.getByRole("button", { name: "Run starter matches" }).click();
  await page.getByRole("button", { name: "Evidence vault" }).click();
  await page.getByRole("searchbox", { name: "Search evidence" }).fill("test-first");
  await expect(page.getByText("1 of 4")).toBeVisible();
  await expect(page.locator(".evidence-item")).toContainText("typed service migration");
  await page.getByRole("button", { name: "Overview" }).click();
  await page.getByRole("button", { name: "Evidence vault" }).click();
  await expect(page.getByRole("searchbox", { name: "Search evidence" })).toHaveValue("test-first");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByRole("button", { name: "Role discovery" }).click();
  await expect(page.getByRole("button", { name: "Import reviewed URL" })).toHaveCount(0);
  await expect(page.getByText(/Reviewed URL intake is off/)).toBeVisible();

  await page.setViewportSize({ width: 375, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator(".job-row").nth(0).getByRole("button", { name: "Compare" }).click();
  await expect(page.getByText(/Choose one more role below/)).toBeVisible();
  await page.locator(".job-row").nth(1).getByRole("button", { name: "Compare" }).click();
  const comparison = page.getByRole("region", { name: "Role comparison table" });
  const comparisonHeading = page.getByRole("heading", { name: "Read two roles on the same lines" });
  await expect(comparisonHeading).toBeFocused();
  expect(
    await comparisonHeading.evaluate((heading) => {
      const rect = heading.getBoundingClientRect();
      return rect.top >= 0 && rect.bottom <= innerHeight;
    }),
  ).toBe(true);
  await expect(comparison).toContainText("Explicit blockers");
  await expect(comparison).toContainText("Northwind Systems");
  await expect(comparison).toContainText("Contoso Labs");
  await expect(comparison).toHaveAttribute("data-overflowing", "true");
  const comparisonDescription = await comparison.getAttribute("aria-describedby");
  expect(comparisonDescription).toBeTruthy();
  await expect(page.locator(`#${comparisonDescription}`)).toContainText("right edge");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: "Overview" }).click();
  await page.getByRole("button", { name: "Role discovery" }).click();
  await expect(page.getByRole("region", { name: "Role comparison table" })).toBeVisible();
  await page.getByRole("button", { name: "Clear comparison" }).click();

  const originalRole = page.locator(".job-row").first();
  const roleTitle = (await originalRole.getByRole("heading", { level: 2 }).textContent())!.trim();
  await originalRole.getByRole("button", { name: "Archive" }).click();
  await expect(page.locator(".job-row").filter({ hasText: roleTitle })).toHaveCount(0);
  await page.locator(".role-filter-disclosure summary").click();
  await page.getByLabel("Candidate view").selectOption("archived");
  const archivedRole = page.locator(".job-row").filter({ hasText: roleTitle });
  await expect(archivedRole).toBeVisible();
  await archivedRole.getByRole("button", { name: "Restore" }).click();
  await expect(archivedRole).toHaveCount(0);
  await page.getByLabel("Candidate view").selectOption("active");
  const restoredRole = page.locator(".job-row").filter({ hasText: roleTitle });
  await restoredRole.getByRole("button", { name: "Track", exact: true }).click();
  await expect(restoredRole.getByRole("button", { name: "Tracked", exact: true })).toBeVisible();
  await page
    .locator(".job-row")
    .filter({ hasNotText: roleTitle })
    .getByRole("button", { name: "Track", exact: true })
    .click();

  await page.getByRole("button", { name: "Applications" }).click();
  await page.locator(".application-filter-disclosure summary").click();
  const card = page.locator(".board-card").filter({ hasText: roleTitle });
  await expect(card).toBeVisible();
  await page.getByLabel("Search applications").fill("no such application");
  await expect(page.getByText("No applications match this view", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: "Add private note" }).click();
  await card.getByLabel("Private application note").fill("Verify the on-call expectation.");
  await card.getByRole("button", { name: "Add note", exact: true }).click();
  await expect(page.getByText("Private note added to the literal timeline.")).toBeVisible();
  await expect(card.locator(".recorded-timeline")).toContainText("Verify the on-call expectation.");
  await page.getByLabel("Search applications").fill("on-call expectation");
  await expect(page.locator(".board-card")).toHaveCount(1);
  const csvDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export shown (.csv)" }).click();
  const csvDownload = await csvDownloadPromise;
  const csvPath = await csvDownload.path();
  expect(csvPath).not.toBeNull();
  const csv = await readFile(csvPath!, "utf8");
  expect(csv).toContain('"application_id"');
  expect(csv).toContain(roleTitle);
  expect(csv).not.toContain("Verify the on-call expectation.");
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.getByLabel("Sort").selectOption("role");
  const sortedRoles = await page.locator(".board-card > strong").allTextContents();
  expect(sortedRoles).toEqual([...sortedRoles].sort((left, right) => left.localeCompare(right)));

  await card.getByRole("button", { name: "Set follow-up" }).click();
  await card.getByLabel("Candidate follow-up date").fill("2099-12-31");
  await card.getByRole("button", { name: "Save reminder" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export reminders (.ics)" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).not.toBeNull();
  const calendar = await readFile(path!, "utf8");
  expect(calendar).toContain("BEGIN:VCALENDAR\r\n");
  expect(calendar).toContain("DTSTART;VALUE=DATE:20991231\r\n");
  expect(calendar).toContain(`Review ${roleTitle}`);

  await page.getByRole("button", { name: "Review packets" }).click();
  const localAssist = page.locator(".local-draft-disclosure");
  await expect(localAssist).toContainText("Optional local assist");
  await expect(page.getByRole("heading", { name: "Draft from selected evidence" })).toHaveCount(0);
  await localAssist.locator("summary").click();
  await expect(page.getByRole("heading", { name: "Draft from selected evidence" })).toBeVisible();
  await expect(page.getByText(/copy-only/)).toBeVisible();
});

test("enabled reviewed URL intake submits only the explicit posting fields", async ({ page }) => {
  test.skip(
    !process.env.NIMANTO_URL_ALLOWLIST,
    "requires the reviewed URL capability in the disposable Playwright service",
  );
  let submitted: Record<string, unknown> | null = null;
  await page.route("**/v1/jobs/url-import", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.continue();
      return;
    }
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": new URL(page.url()).origin,
        "access-control-allow-credentials": "true",
      },
      body: JSON.stringify({ id: "reviewed-url-role", source: "allowlisted_url" }),
    });
  });
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  await page.getByLabel("Your name").fill("Reviewed URL Check");
  await page.getByLabel("Your email").fill("reviewed-url@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();
  await page.getByRole("button", { name: "Role discovery" }).click();
  await page.getByRole("button", { name: "Import reviewed URL" }).click();
  await page.getByLabel("Allowlisted HTTPS URL").fill("https://jobs.example.test/opening/42");
  await page.getByLabel("Role title").fill("Accessibility Engineer");
  await page.getByLabel("Company").fill("Example Labs");
  await page.getByLabel("Location").fill("Remote");
  await page.getByLabel("Work mode").selectOption("remote");
  await page.getByLabel("Requirements, one per line").fill("TypeScript\nWCAG");
  await expect(page.getByText(/jobs\.example\.test/)).toBeVisible();
  await page.getByRole("button", { name: "Import posting" }).click();
  await expect(page.getByText("Reviewed URL saved as a current role.")).toBeVisible();
  expect(submitted).toEqual({
    url: "https://jobs.example.test/opening/42",
    title: "Accessibility Engineer",
    company: "Example Labs",
    location: "Remote",
    workMode: "remote",
    requirements: ["TypeScript", "WCAG"],
  });
});

test("available local model drafts and copies only the selected evidence", async ({ page }) => {
  await installClipboardRecorder(page);
  let submitted: Record<string, unknown> | null = null;
  let statusProbes = 0;
  await page.route("**/v1/models/status", async (route) => {
    statusProbes += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": new URL(page.url()).origin,
        "access-control-allow-credentials": "true",
      },
      body: JSON.stringify({ available: true, models: ["qwen3:local", "llama3:local"] }),
    });
  });
  await page.route("**/v1/models/draft-summary", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.continue();
      return;
    }
    submitted = route.request().postDataJSON() as Record<string, unknown>;
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": new URL(page.url()).origin,
        "access-control-allow-credentials": "true",
      },
      body: JSON.stringify({
        text: "Candidate-reviewed local draft.",
        model: "qwen3:local",
        label: "unverified_local_draft",
      }),
    });
  });
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  await page.getByLabel("Your name").fill("Local Draft Check");
  await page.getByLabel("Your email").fill("local-draft@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();
  await page.getByRole("button", { name: "Run starter matches" }).click();
  await page.getByRole("button", { name: "Role discovery" }).click();
  await page.getByRole("button", { name: "Track", exact: true }).first().click();
  await page.getByRole("button", { name: "Review packets" }).click();
  const localAssist = page.locator(".local-draft-disclosure");
  await expect(localAssist).toContainText(/only confirmed claims you select/i);
  expect(statusProbes, "collapsed local assist must not probe Ollama").toBe(0);
  await localAssist.locator("summary").click();
  await expect.poll(() => statusProbes).toBe(1);
  await expect(
    page.getByText(/selected role title and company, plus only the confirmed claims/i),
  ).toBeVisible();
  await page.getByLabel("Application").selectOption({ index: 1 });
  await expect(page.getByLabel("Local model")).toHaveValue("qwen3:local");
  const evidence = page.locator(".evidence-selector input").first();
  await evidence.check();
  await page.getByRole("button", { name: "Create unverified draft" }).click();
  await expect(page.getByLabel("Application")).toBeDisabled();
  await expect(page.getByLabel("Local model")).toBeDisabled();
  await expect(evidence).toBeDisabled();
  await expect(page.getByLabel("Unverified local draft")).toHaveValue(
    "Candidate-reviewed local draft.",
  );
  expect(submitted).toMatchObject({ model: "qwen3:local", evidenceIds: [expect.any(String)] });
  await page.locator(".local-draft-result").getByRole("button", { name: "Copy" }).click();
  await expect(
    page.locator(".local-draft-result").getByRole("button", { name: "Copied" }),
  ).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("nimanto-test-copied"))).toBe(
    "Candidate-reviewed local draft.",
  );
  await page.getByLabel("Local model").selectOption("llama3:local");
  await expect(page.getByLabel("Unverified local draft")).toHaveCount(0);
});

test("long action references keep their Copy control clear at 320px", async ({ page }) => {
  await installClipboardRecorder(page);
  await expect
    .poll(
      async () => {
        try {
          return (await page.request.get(`${TEST_API_ORIGIN}/health`)).ok();
        } catch {
          return false;
        }
      },
      { message: "local API health before the action-reference journey", timeout: 20_000 },
    )
    .toBe(true);
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
  await approveExactPacket(packet);
  await expect(packet.getByText("Approved", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Approved actions" }).click();
  const prepareAction = page.getByRole("button", { name: "Prepare action" });
  await expect(prepareAction).not.toHaveAttribute("aria-controls", /.+/);
  await prepareAction.click();
  const originalPacketId = await page.getByLabel("Approved packet").inputValue();

  // Keep the original packet in action history before starting the draft under
  // test. Historical labels must not make a retired packet eligible again.
  await page.getByLabel("Provider").selectOption("test_outbox");
  await settleControlledForm(page);
  await page.getByLabel("Recipient").fill("historical@example.test");
  await page.getByLabel("Subject").fill("Historical action");
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("An earlier action keeps this packet in history.");
  await page.getByRole("button", { name: "Create approval request" }).click();
  await expect(page.locator(".action-row").filter({ hasText: "Historical action" })).toBeVisible();
  await prepareAction.click();
  await expect(page.getByLabel("Approved packet")).toHaveValue(originalPacketId);
  await page.getByLabel("Provider").selectOption("test_outbox");
  await settleControlledForm(page);
  await page.getByLabel("Recipient").fill("recipient@example.test");
  await page.getByLabel("Subject").fill("Candidate-reviewed subject");
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Candidate-reviewed exact local draft.");
  await page.getByRole("button", { name: "Overview" }).click();
  await page.getByRole("button", { name: "Approved actions" }).click();
  await expect(page.getByRole("button", { name: "Resume action draft" })).toBeVisible();
  await expect(page.getByLabel("Provider")).toHaveValue("test_outbox");
  await expect(page.getByLabel("Recipient")).toHaveValue("recipient@example.test");
  await expect(page.getByLabel("Subject")).toHaveValue("Candidate-reviewed subject");
  await expect(page.getByRole("textbox", { name: "Message", exact: true })).toHaveValue(
    "Candidate-reviewed exact local draft.",
  );
  await expect(page.getByLabel("Approved packet")).toHaveValue(originalPacketId);

  // A new packet retires the one the candidate originally reviewed. Preserve
  // message work, but make the stale packet selection visibly invalid until a
  // current approved packet is chosen explicitly.
  await page.getByRole("button", { name: "Review packets" }).click();
  const replacementPacket = page.locator(".packet-row").first();
  await replacementPacket.getByRole("button", { name: "Generate new" }).click();
  await replacementPacket.getByRole("button", { name: "Assure", exact: true }).click();
  await approveExactPacket(replacementPacket);
  await page.getByRole("button", { name: "Approved actions" }).click();
  await expect(page.getByLabel("Approved packet")).toHaveValue("");
  await expect(page.getByLabel("Approved packet")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText(/newer packet replaced the one previously reviewed/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Create approval request" })).toBeDisabled();
  await expect(page.getByLabel("Recipient")).toHaveValue("recipient@example.test");
  await expect(page.getByRole("textbox", { name: "Message", exact: true })).toHaveValue(
    "Candidate-reviewed exact local draft.",
  );
  await page.getByLabel("Approved packet").selectOption({ index: 1 });
  expect(await page.getByLabel("Approved packet").inputValue()).not.toBe(originalPacketId);
  await expect(page.getByRole("button", { name: "Create approval request" })).toBeEnabled();
  await page.getByRole("button", { name: "Create approval request" }).click();
  const action = page.locator(".action-row").filter({ hasText: "Candidate-reviewed subject" });
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
  // The workspace can render from an overlapping authentication refresh before
  // the start action's own refresh has settled. Wait for its completion notice
  // so that rerender cannot replace this controlled destructive input mid-entry.
  await expect(page.locator(".notice.ok")).toContainText("Your private beta workspace is ready.");
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

/* When a mutation fails, focus moves to the message announcing it. Only a real
 * browser can assert this: jsdom has no layout, so `focus()` still succeeds
 * there on a target that cannot actually take focus — which is precisely how a
 * `display: contents` wrapper silently disabled this path once, with the whole
 * unit suite green. */
test("a failed mutation moves focus to the error it announced", async ({ page }) => {
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  /* Entry depends on what earlier tests left behind on the shared local API, so
   * take whichever door this run is actually shown rather than assuming one. */
  const nameField = page.getByLabel("Your name");
  const evidenceNav = page.getByRole("button", { name: "Evidence vault" });
  await expect(nameField.or(evidenceNav).first()).toBeVisible();
  if (await nameField.isVisible()) {
    await nameField.fill("Focus Probe");
    await page.getByLabel("Your email").fill("focus-probe@example.test");
    await page.getByRole("button", { name: "Start private workspace" }).click();
    await expect(page.locator(".notice.ok")).toBeVisible();
  }

  await evidenceNav.click();
  await page.getByLabel("Exact claim").fill("A claim whose save will fail");
  await page.route("**/v1/evidence", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ code: "INTERNAL_ERROR", message: "forced for this test" }),
    }),
  );
  await page.getByRole("button", { name: "Add pending claim" }).click();

  const error = page.locator(".notice.error");
  await expect(error).toBeVisible();
  await expect(error).toBeFocused();
});

/* The launch key arrives in a URL fragment that the workbench scrubs on sign-in.
 * Sign-out, deletion, a bookmark and the URL printed in the operations guide all
 * reach this screen without it, so the screen has to say what is missing. */
test("the entry screen names the launch-key prerequisite when it has none", async ({ page }) => {
  await page.goto("/workspace/");
  const start = page.getByRole("button", { name: "Start private workspace" });
  const demo = page.getByRole("button", { name: "Use clearly labeled synthetic demo" });
  await expect(start).toBeDisabled();
  await expect(demo).toBeDisabled();

  const describedBy = await start.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  await expect(demo).toHaveAttribute("aria-describedby", String(describedBy));
  const requirement = page.locator(`#${describedBy}`);
  await expect(requirement).toBeVisible();
  await expect(requirement).toContainText(".nimanto-data/launch-secret");
});

test("the pipeline exposes the stages it cannot fit, and a moved card comes with it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  await page.getByLabel("Your name").fill("Board Check");
  await page.getByLabel("Your email").fill("board@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();
  await page.getByRole("button", { name: "Run starter matches" }).click();
  await page.getByRole("button", { name: "Role discovery" }).click();
  await page.getByRole("button", { name: "Track", exact: true }).first().click();
  await page.getByRole("button", { name: "Applications" }).click();

  const board = page.locator(".board");
  await expect(board).toHaveAttribute("tabindex", "0");
  await expect(board).toHaveAttribute("role", "region");
  // Overflowing is fine; being unable to tell is not.
  await expect(board).toHaveAttribute("data-overflowing", "true");

  await page
    .locator(".board button", { hasText: /^Prepared$/ })
    .first()
    .click();
  await expect(page.getByText("Application status updated.")).toBeVisible();
  const cardVisible = await page
    .locator(".board article")
    .first()
    .evaluate((card) => {
      const rect = card.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= document.documentElement.clientWidth + 1;
    });
  expect(cardVisible).toBe(true);
});

test("a pending claim decision is labelled, distinguishable, and asks before it is final", async ({
  page,
}) => {
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  await page.getByLabel("Your name").fill("Claim Check");
  await page.getByLabel("Your email").fill("claim@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();
  await page.getByRole("button", { name: "Evidence vault" }).click();
  await page.getByLabel("Exact claim").fill("Shipped an accessible React design system");
  await page.getByRole("button", { name: "Add pending claim" }).click();
  await expect(page.getByText("Claim added to the review queue.")).toBeVisible();

  const row = page.locator(".evidence-item", { hasText: "accessible React design system" }).first();
  const reject = row.getByRole("button", { name: /^Reject/ });
  await expect(row.getByRole("button", { name: /^Confirm/ })).toContainText("Confirm");
  await expect(reject).toContainText("Reject");

  // First press arms, it does not decide.
  await reject.click();
  await expect(row.getByText("Rejecting is final.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(row.getByText("Rejecting is final.")).toHaveCount(0);
  await expect(reject).toBeFocused();
  await expect(row).toContainText("Pending");

  await reject.click();
  await row.getByRole("button", { name: "Keep it pending" }).click();
  await expect(row).toContainText("Pending");

  await reject.click();
  await row.getByRole("button", { name: "Reject claim" }).click();
  await expect(page.getByText("Claim rejected.")).toBeVisible();
  await expect(row).toContainText("Rejected — this decision is final.");
});

test("gated and empty-state controls say what they are waiting for", async ({ page }) => {
  await page.goto(`/workspace/#bootstrap=${bootstrapSecret}`);
  await page.getByLabel("Your name").fill("Gate Check");
  await page.getByLabel("Your email").fill("gate@example.test");
  await page.getByRole("button", { name: "Start private workspace" }).click();

  await page.getByRole("button", { name: "Applications" }).click();
  // The header action and the empty state have to agree; "another" was a claim
  // about a record that held nothing.
  await expect(page.getByRole("button", { name: "Track another role" })).toHaveCount(0);
  await expect(
    page.locator(".page-intro").getByRole("button", { name: "Track a role" }),
  ).toHaveCount(1);

  // The starter action lives on Overview, not on the empty Applications screen.
  await page.getByRole("button", { name: "Overview" }).click();
  await page.getByRole("button", { name: "Run starter matches" }).click();
  await page.getByRole("button", { name: "Role discovery" }).click();
  await page.getByRole("button", { name: "Track", exact: true }).first().click();
  await page.getByRole("button", { name: "Applications" }).click();
  await page
    .locator(".board button", { hasText: /^Prepared$/ })
    .first()
    .click();
  await page
    .locator(".board button", { hasText: /^Approved for export$/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Mark approved for export" }).click();

  await page.getByRole("button", { name: "Review packets" }).click();
  await page.getByRole("button", { name: "Generate", exact: true }).first().click();
  const packet = page.locator(".packet-row").first();
  const approve = packet.getByRole("button", { name: "Approve", exact: true });
  const assure = packet.getByRole("button", { name: "Assure", exact: true });
  await expect(approve).toBeDisabled();
  await expect(packet.locator(".packet-actions .button.primary")).toHaveText("Assure");
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(packet.locator(".packet-actions .button.primary")).toHaveText("Assure");
  const gate = await approve.getAttribute("aria-describedby");
  expect(gate).toBeTruthy();
  await expect(page.locator(`#${gate}`)).toContainText("assurance");
  await assure.click();
  await expect(approve).toBeEnabled();
  await expect(packet.locator(".packet-actions .button.primary")).toHaveText("Approve");
  const approvalWrites: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && /\/v1\/packets\/[^/]+\/approve$/.test(request.url())) {
      approvalWrites.push(request.url());
    }
  });
  await approve.click();
  const approvalConfirmation = packet.locator(".confirm-strip");
  await expect(approvalConfirmation).toHaveAccessibleName(
    /^Approve packet [a-f0-9]{8} for export\?$/,
  );
  await expect(approvalConfirmation).toContainText(/Assurance passed · 6 generated artifacts/i);
  const promptPosition = await approvalConfirmation.evaluate((confirmation) => {
    const header = document.querySelector(".workspace-header")?.getBoundingClientRect();
    const question = confirmation.querySelector(".confirm-question")?.getBoundingClientRect();
    return header && question
      ? { headerBottom: header.bottom, questionTop: question.top, questionBottom: question.bottom }
      : null;
  });
  expect(promptPosition).not.toBeNull();
  expect(
    promptPosition!.questionTop,
    "approval prompt clears the sticky header",
  ).toBeGreaterThanOrEqual(promptPosition!.headerBottom);
  expect(promptPosition!.questionBottom, "approval prompt begins inside the viewport").toBeLessThan(
    900,
  );
  expect(
    await approvalConfirmation.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    ),
    "the exact binding must not widen the 320px page",
  ).toBe(true);
  expect(approvalWrites, "arming packet approval must not write").toEqual([]);
  const exactBinding = approvalConfirmation.getByText("Inspect exact packet binding", {
    exact: true,
  });
  await exactBinding.click();
  await expect(approvalConfirmation.getByLabel("Exact frozen packet ID")).toHaveText(
    /^[a-f0-9-]{36}$/,
  );
  await expect(approvalConfirmation.getByLabel("Full packet SHA-256")).toHaveText(/^[a-f0-9]{64}$/);
  const artifactHashes = approvalConfirmation.getByLabel(/^Full SHA-256 for /);
  await expect(artifactHashes).toHaveCount(6);
  for (const hash of await artifactHashes.all()) await expect(hash).toHaveText(/^[a-f0-9]{64}$/);
  expect(approvalWrites, "inspecting packet binding must not write").toEqual([]);
  await page.keyboard.press("Escape");
  await expect(approvalConfirmation).toHaveCount(0);
  await expect(approve).toBeFocused();
  expect(approvalWrites, "cancelling packet approval must not write").toEqual([]);
  await approve.click();
  await packet.getByRole("button", { name: "Approve this packet" }).click();
  await expect(page.getByText("Packet approved for export.")).toBeVisible();
  await expect(page.getByText("Approved", { exact: true })).toBeVisible();
  expect(approvalWrites).toHaveLength(1);
  await expect(packet.locator(".packet-actions .button.primary")).toHaveCount(0);
  await expect(approve).not.toHaveAttribute("aria-describedby");
  await expect(page.locator(`#${gate}`)).toHaveCount(0);
});
