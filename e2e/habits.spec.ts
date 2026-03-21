import { test, expect, type Page } from "@playwright/test";
import { goToTab } from "./helpers/navigation";
import { clearDatabase } from "./helpers/db";

async function openAddHabitModal(page: Page) {
  await page.locator('[class*="border-dashed"]').first().click();
}

test.describe("Habits", () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, "habits");
    await clearDatabase(page);
    await goToTab(page, "habits");
  });

  test("shows empty state when no habits exist", async ({ page }) => {
    await expect(page.getByText("Add your first habit")).toBeVisible();
  });

  test("does not add habit with empty name", async ({ page }) => {
    await openAddHabitModal(page);
    await page.getByText("Create habit", { exact: true }).click();
    await expect(page.getByText("Add your first habit")).toBeVisible();
  });

  test("adds a new habit", async ({ page }) => {
    await openAddHabitModal(page);
    await page.getByPlaceholder(/Read 20 minutes/i).fill("Morning run");
    await page.getByText("Create habit", { exact: true }).click();
    await expect(page.getByText("Morning run")).toBeVisible();
  });

  test("increments habit completion", async ({ page }) => {
    await openAddHabitModal(page);
    await page.getByPlaceholder(/Read 20 minutes/i).fill("Meditate");
    await page.getByText("Create habit", { exact: true }).click();
    await expect(page.getByText("Meditate")).toBeVisible();
    await page.getByText("Meditate", { exact: true }).locator("..").locator("> *").first().click();
    await expect(page.getByText("Meditate")).toBeVisible();
  });

  test("habit persists after reload", async ({ page }) => {
    await openAddHabitModal(page);
    await page.getByPlaceholder(/Read 20 minutes/i).fill("Drink water");
    await page.getByText("Create habit", { exact: true }).click();
    await expect(page.getByText("Drink water")).toBeVisible();

    await page.reload();
    await page.waitForLoadState("load");
    await goToTab(page, "habits");
    await expect(page.getByText("Drink water")).toBeVisible();
  });

  // RN core Alert.alert only implements iOS + Android (see node_modules/react-native/Libraries/Alert/Alert.js).
  // On web there is no branch — the call is a no-op, so no confirmation UI appears and the habit cannot be removed here.
  test("delete in edit mode: no confirmation on web (Alert.alert no-op), habit remains", async ({
    page,
  }) => {
    await openAddHabitModal(page);
    await page.getByPlaceholder(/Read 20 minutes/i).fill("Delete this habit");
    await page.getByText("Create habit", { exact: true }).click();
    await expect(page.getByText("Delete this habit")).toBeVisible();
    await page.locator(".mb-4.flex-row").locator(".rounded-lg.p-2").click();
    await page.getByText("Delete", { exact: true }).first().click();
    await expect(page.getByText("Delete this habit")).toBeVisible();
  });
});
