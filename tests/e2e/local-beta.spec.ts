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
  await expect(page.getByText("TypeScript", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.getByText("TypeScript", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Role discovery" }).click();
  await expect(page.getByRole("heading", { name: "Platform Engineer" })).toBeVisible();
  await expect(page.getByText("Northwind Systems").first()).toBeVisible();

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
