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
  await expect(page.getByText("Add with command", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByText("Add with command", { exact: true }).locator("..").click({ force: true });
  await expect(page.getByLabel("Command")).toBeVisible();
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
