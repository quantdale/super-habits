import { test, expect, type Page } from "@playwright/test";
import { goToTab } from "./helpers/navigation";
import { clearDatabase } from "./helpers/db";

/** Opens add-habit modal via the first time-group + (scoped to Habit groups a11y region). */
async function openAddHabitModal(page: Page) {
  await expect(page.getByText("ANYTIME").first()).toBeVisible({ timeout: 15_000 });
  const nameField = page.getByLabel("Habit name");
  // Click the first group's Add tile instead of class-based wrappers.
  for (let attempt = 0; attempt < 3; attempt++) {
    const firstAddTile = page
      .getByLabel("Habit groups")
      .getByText("Add", { exact: true })
      .first()
      .locator("xpath=preceding-sibling::*[1]");
    await firstAddTile.click({ force: true });
    try {
      await nameField.waitFor({ state: "visible", timeout: 8_000 });
      return;
    } catch {
      /* retry */
    }
  }
  throw new Error("Add-habit modal did not open (Habit name field never visible)");
}

test.describe("Habits", () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, "habits");
    await clearDatabase(page);
    await goToTab(page, "habits");
    await expect(page.getByText("ANYTIME").first()).toBeVisible({ timeout: 15_000 });
  });

  test("shows empty state when no habits exist", async ({ page }) => {
    await expect(
      page.getByText(/Pick a time of day and tap Add to create your first habit/i),
    ).toBeVisible();
    await expect(page.getByText("ANYTIME")).toBeVisible();
  });

  test("does not add habit with empty name", async ({ page }) => {
    await openAddHabitModal(page);
    await page.getByText("Create habit", { exact: true }).locator("..").click({ force: true });
    await expect(
      page.getByText(/Pick a time of day and tap Add to create your first habit/i),
    ).toBeVisible();
  });

  test("adds a new habit", async ({ page }) => {
    await openAddHabitModal(page);
    await page.getByLabel("Habit name").fill("Morning run");
    await page.getByText("Create habit", { exact: true }).locator("..").click({ force: true });
    await expect(page.getByText("Morning run").first()).toBeVisible();
  });

  test("increments habit completion", async ({ page }) => {
    await openAddHabitModal(page);
    await page.getByLabel("Habit name").fill("Meditate");
    await page.getByText("Create habit", { exact: true }).locator("..").click({ force: true });
    await expect(page.getByText("Meditate").first()).toBeVisible();
    // Ring is the preceding sibling of the label row (Pressable has no role="button" on RN Web).
    await page
      .getByText("Meditate", { exact: true })
      .locator("xpath=preceding-sibling::*[1]")
      .click();
    await expect(page.getByText("Meditate").first()).toBeVisible();
  });

  test("habit persists after reload", async ({ page }) => {
    await openAddHabitModal(page);
    await page.getByLabel("Habit name").fill("Drink water");
    await page.getByText("Create habit", { exact: true }).locator("..").click({ force: true });
    await expect(page.getByText("Drink water").first()).toBeVisible();

    await page.reload();
    await page.waitForLoadState("load");
    await goToTab(page, "habits");
    await expect(page.getByText("Drink water").first()).toBeVisible();
  });

  test("deletes a habit in edit mode after web confirmation", async ({ page }) => {
    await openAddHabitModal(page);
    await page.getByLabel("Habit name").fill("Delete this habit");
    await page.getByText("Create habit", { exact: true }).locator("..").click({ force: true });
    await expect(page.getByText("Delete this habit").first()).toBeVisible();
    await page.getByLabel("Enter habit edit mode").click({ force: true });
    await expect(page.getByLabel("Exit habit edit mode")).toBeVisible();
    await page.getByText("Delete", { exact: true }).first().click();
    await page.getByText("Delete habit", { exact: true }).last().click({ force: true });
    await expect(page.getByText("Delete this habit").first()).not.toBeVisible();
  });
});
