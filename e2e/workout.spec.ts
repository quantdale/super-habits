import { test, expect } from "@playwright/test";
import { goToTab } from "./helpers/navigation";
import { clearDatabase } from "./helpers/db";
import { fillRoutineName } from "./helpers/forms";
import { clickSwipeDeleteAction, swipeLeftRevealWorkoutRoutineRow } from "./helpers/gestures";

test.describe("Workout", () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, "workout");
    await clearDatabase(page);
    await goToTab(page, "workout");
  });

  test("shows empty state when no routines exist", async ({ page }) => {
    await expect(page.getByText("Add routine", { exact: true })).toBeVisible();
    await expect(page.getByText("Workout history")).toBeVisible();
  });

  test("does not add routine with empty name", async ({ page }) => {
    await page.getByText("Add routine", { exact: true }).click();
    await expect(page.getByText("Add routine", { exact: true })).toBeVisible();
  });

  test("adds a new routine", async ({ page }) => {
    await fillRoutineName(page, "Push day");
    await page.getByText("Add routine", { exact: true }).click();
    await expect(page.getByText("Push day")).toBeVisible();
  });

  test("completes a workout", async ({ page }) => {
    await fillRoutineName(page, "Pull day");
    await page.getByText("Add routine", { exact: true }).click();
    await expect(page.getByText("Pull day")).toBeVisible();
    await page.getByText("Complete workout", { exact: true }).first().click();
    await expect(page.getByText("Workout history")).toBeVisible();
  });

  test("routine persists after reload", async ({ page }) => {
    await fillRoutineName(page, "Leg day");
    await page.getByText("Add routine", { exact: true }).click();
    await expect(page.getByText("Leg day")).toBeVisible();

    await page.reload();
    await page.waitForLoadState("load");
    await goToTab(page, "workout");
    await expect(page.getByText("Leg day")).toBeVisible();
  });

  test("swipe delete removes the routine after web confirmation", async ({ page }) => {
    await fillRoutineName(page, "Leg press");
    await page.getByText("Add routine", { exact: true }).click();
    await expect(page.getByText("Leg press")).toBeVisible();
    await swipeLeftRevealWorkoutRoutineRow(page);
    await clickSwipeDeleteAction(page, "Leg press");
    await page.getByText("Delete routine", { exact: true }).click({ force: true });
    await expect(page.getByText("Leg press")).not.toBeVisible();
  });
});
