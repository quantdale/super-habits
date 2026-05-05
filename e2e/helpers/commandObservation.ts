import { expect, type Page } from "@playwright/test";

function infoRowByLabel(page: Page, label: string) {
  return page
    .getByText(label, { exact: true })
    .locator("xpath=ancestor::*[contains(@class,'justify-between')][1]")
    .first();
}

export async function clickLabeledAction(page: Page, label: string) {
  await page.getByText(label, { exact: true }).locator("..").click({ force: true });
}

export async function openCommandScreen(page: Page) {
  await page.goto("/(tabs)/overview", { waitUntil: "domcontentloaded" });
  const launcher = page.getByRole("button", { name: "Open command center" });
  await expect(launcher).toBeVisible({
    timeout: 15_000,
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const launcherCount = await launcher.count();
    for (let index = 0; index < launcherCount; index += 1) {
      const candidate = launcher.nth(index);
      if (await candidate.isVisible().catch(() => false)) {
        try {
          await candidate.click({ force: true });
          break;
        } catch {
          continue;
        }
      }
    }
    try {
      await expect(page.locator("#command-input")).toBeVisible({ timeout: 5_000 });
      return;
    } catch {
      await page.waitForTimeout(250);
    }
  }

  await expect(page.locator("#command-input")).toBeVisible({ timeout: 15_000 });
}

export async function openSettingsScreen(page: Page) {
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Settings", { exact: true })).toBeVisible();
}

export async function parseCommand(page: Page, rawText: string) {
  await page.locator("#command-input").fill(rawText);
  await clickLabeledAction(page, "Parse command");
  await page.waitForFunction(
    () => {
      const bodyText = document.body?.innerText ?? "";
      return (
        bodyText.includes("Review before saving") ||
        bodyText.includes("Try rewording your command") ||
        bodyText.includes("Parse unavailable")
      );
    },
    { timeout: 15_000 },
  );
}

export async function fillById(page: Page, id: string, value: string) {
  await page.locator(`#${id}`).fill(value, { force: true });
}

export async function expectDraftOutcome(page: Page, status: "ready" | "needs_input") {
  await expect(page.getByText("Review before saving", { exact: true })).toBeVisible();
  await expect(page.getByText("Try rewording your command", { exact: true })).toHaveCount(0);
  await expect(infoRowByLabel(page, "Parser status")).toContainText(status);

  if (status === "ready") {
    await expect(page.getByText("Confirm and save", { exact: true })).toBeVisible();
    await expect(page.getByText("Needs input", { exact: true })).toHaveCount(0);
    return;
  }

  await expect(page.getByText("Needs input", { exact: true })).toBeVisible();
}

export async function expectUnsupportedOutcome(page: Page) {
  await expect(page.getByText("Try rewording your command", { exact: true })).toBeVisible();
  await expect(page.getByText("Review before saving", { exact: true })).toHaveCount(0);
}

export async function expectWarningVisible(page: Page) {
  await expect(page.getByText("Warnings", { exact: true })).toBeVisible();
}

export async function expectPreviewRowContains(page: Page, label: string, value: string | RegExp) {
  await expect(infoRowByLabel(page, label)).toContainText(value);
}

export async function expectInternalMetadataHidden(page: Page) {
  await expect(page.getByText("Internal parser metadata", { exact: true })).toHaveCount(0);
}

export async function expectInternalMetadataVisible(page: Page) {
  await expect(page.getByText("Internal parser metadata", { exact: true })).toBeVisible();
}

export async function expectInternalMetadataRowContains(
  page: Page,
  label: string,
  value: string | RegExp,
) {
  await expect(infoRowByLabel(page, label)).toContainText(value);
}
