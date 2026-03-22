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
  });

  test("shows empty session history on first load", async ({ page }) => {
    await expect(page.getByText("Recent sessions")).toBeVisible();
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
});
