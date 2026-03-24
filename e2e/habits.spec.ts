import { test, expect, type Page } from "@playwright/test";
import { goToTab } from "./helpers/navigation";
import { clearDatabase } from "./helpers/db";

/** Opens add-habit modal via the per–time-group + control (label "Add" is plain text; the + is pressable). */
async function openAddHabitModal(page: Page) {
  await page.getByText("+", { exact: true }).first().locator("..").click({ force: true });
}

test.describe("Habits", () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, "habits");
    await clearDatabase(page);
    await goToTab(page, "habits");
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

  // RN core Alert.alert only implements iOS + Android (see node_modules/react-native/Libraries/Alert/Alert.js).
  // On web there is no branch — the call is a no-op, so no confirmation UI appears and the habit cannot be removed here.
  test("delete in edit mode: no confirmation on web (Alert.alert no-op), habit remains", async ({
    page,
  }) => {
    await openAddHabitModal(page);
    await page.getByLabel("Habit name").fill("Delete this habit");
    await page.getByText("Create habit", { exact: true }).locator("..").click({ force: true });
    await expect(page.getByText("Delete this habit").first()).toBeVisible();
    await page.locator(".flex-row.justify-between.items-start .rounded-lg.p-2").first().click();
    await page.getByText("Delete", { exact: true }).first().click();
    await expect(page.getByText("Delete this habit").first()).toBeVisible();
  });
});
