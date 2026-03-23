import { test, expect } from "@playwright/test";
import { goToTab } from "./helpers/navigation";
import { clearDatabase } from "./helpers/db";
import { fillCaloriesMacros } from "./helpers/forms";

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
    await page.getByText("Add entry", { exact: true }).scrollIntoViewIfNeeded();
    await page.getByText("Add entry", { exact: true }).click();
    await expect(page.locator("body")).toContainText("Food name is required");
  });

  test("adds a calorie entry and updates daily total", async ({ page }) => {
    await fillCaloriesMacros(page, "Chicken breast", "30", "0", "3", "0");
    await page.getByText("Breakfast", { exact: true }).click();
    await page.getByText("Add entry", { exact: true }).click();
    await expect(page.getByText("Chicken breast", { exact: false })).toBeVisible();
    await expect(page.getByText("147 kcal", { exact: false })).toBeVisible();
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
    await page.getByText("Add entry", { exact: true }).click();
    await expect(page.getByText("Oats", { exact: false })).toBeVisible();
    await expect(page.getByText("235 kcal", { exact: false })).toBeVisible();

    await page.reload();
    await page.waitForLoadState("load");
    await goToTab(page, "calories");
    await expect(page.getByText("Oats", { exact: false })).toBeVisible();
    await expect(page.getByText("235 kcal", { exact: false })).toBeVisible();
  });
});
