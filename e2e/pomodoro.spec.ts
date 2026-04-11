import { test, expect } from "@playwright/test";
import { goToTab } from "./helpers/navigation";
import { clearDatabase } from "./helpers/db";

test.describe("Pomodoro", () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, "pomodoro");
    await clearDatabase(page);
    await goToTab(page, "pomodoro");
  });

  test("shows idle state on first load", async ({ page }) => {
    await expect(page.getByText("25:00")).toBeVisible();
    await expect(page.getByText("Start focus", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Open timer settings")).toBeVisible();
  });

  test("shows empty session history on first load", async ({ page }) => {
    await expect(
      page.getByText("Complete a session to start your garden"),
    ).toBeVisible();
    await expect(page.locator("text=/ min$/")).toHaveCount(0);
  });

  test("starts timer and shows running state", async ({ page }) => {
    await page.getByText("Start focus", { exact: true }).click();
    await expect(page.getByText("Pause", { exact: true })).toBeEnabled({ timeout: 3_000 });
    const timer = page.locator(".text-5xl").getByText(/^\d{2}:\d{2}$/);
    await expect(timer).not.toHaveText("25:00", { timeout: 5_000 });
  });

  test("resets timer", async ({ page }) => {
    await page.getByText("Start focus", { exact: true }).click();
    await page.waitForTimeout(2_000);
    await page.getByText("Reset", { exact: true }).click();
    await expect(page.getByText("25:00")).toBeVisible();
    await expect(page.getByText("Start focus", { exact: true })).toBeVisible();
  });

  test("opens settings in a modal and cancel dismisses without saving", async ({ page }) => {
    await page.getByLabel("Open timer settings").click();
    await expect(page.getByText("Timer settings", { exact: true })).toBeVisible();
    await expect(page.getByText("Durations are saved on this device.")).toBeVisible();

    const focusInput = page.locator('input').nth(0);
    await focusInput.click();
    await focusInput.fill("30");
    await page.getByText("Cancel", { exact: true }).click();

    await expect(page.getByText("Timer settings", { exact: true })).toHaveCount(0);
    await expect(page.getByText("25:00")).toBeVisible();

    await page.getByLabel("Open timer settings").click();
    await expect(page.locator('input').nth(0)).toHaveValue("25");
  });

  test("saves timer settings and keeps them after reload", async ({ page }) => {
    await page.getByLabel("Open timer settings").click();

    const inputs = page.locator("input");
    await inputs.nth(0).click();
    await inputs.nth(0).fill("30");
    await inputs.nth(1).click();
    await inputs.nth(1).fill("7");
    await inputs.nth(2).click();
    await inputs.nth(2).fill("20");
    await inputs.nth(3).click();
    await inputs.nth(3).fill("5");
    await page.getByText("Save", { exact: true }).click();

    await expect(page.getByText("30:00")).toBeVisible();
    await page.reload();
    await goToTab(page, "pomodoro");
    await expect(page.getByText("30:00")).toBeVisible();

    await page.getByLabel("Open timer settings").click();
    await expect(page.locator("input").nth(0)).toHaveValue("30");
    await expect(page.locator("input").nth(1)).toHaveValue("7");
    await expect(page.locator("input").nth(2)).toHaveValue("20");
    await expect(page.locator("input").nth(3)).toHaveValue("5");
  });
});
