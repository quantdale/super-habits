import { test, expect } from "@playwright/test";
import { goToTab } from "./helpers/navigation";
import { clearDatabase } from "./helpers/db";
import { clickCaloriesAddEntry, fillCalorieMacrosOnly, fillCaloriesMacros } from "./helpers/forms";

test.describe("Calories", () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, "calories");
    await clearDatabase(page);
    await goToTab(page, "calories");
  });

  test("shows empty state on first load", async ({ page }) => {
    await expect(page.getByText("Today: 0 kcal")).toBeVisible();
  });

  test("does not add entry with empty food name", async ({ page }) => {
    await fillCalorieMacrosOnly(page, "10", "0", "0", "0");
    await clickCaloriesAddEntry(page);
    await expect(page.locator("body")).toContainText("Food name is required", {
      timeout: 10_000,
    });
  });

  test("adds a calorie entry and updates daily total", async ({ page }) => {
    await fillCaloriesMacros(page, "Chicken breast", "30", "0", "3", "0");
    await clickCaloriesAddEntry(page);
    await expect(page.locator("body")).toContainText("Chicken breast", { timeout: 15_000 });
    await expect(page.locator("body")).toContainText("147 kcal", { timeout: 15_000 });
    await expect(page.getByText("Today: 147 kcal")).toBeVisible();
  });

  test("selects different meal types", async ({ page }) => {
    const mealTypes = ["Breakfast", "Lunch", "Dinner", "Snack"];
    for (const meal of mealTypes) {
      await page.getByText(meal, { exact: true }).click();
      await expect(page.getByText(meal, { exact: true })).toBeVisible();
    }
  });

  test("entry persists after reload", async ({ page }) => {
    await fillCaloriesMacros(page, "Oats", "10", "40", "5", "5");
    await clickCaloriesAddEntry(page);
    await expect(page.getByText("Oats - 235 kcal", { exact: true })).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await page.waitForLoadState("load");
    await goToTab(page, "calories");
    await expect(page.getByText("Oats - 235 kcal", { exact: true })).toBeVisible({ timeout: 15_000 });
  });
});
