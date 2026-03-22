import { test, expect } from "@playwright/test";
import { goToTab } from "./helpers/navigation";
import { clearDatabase } from "./helpers/db";
import { fillRoutineName } from "./helpers/forms";
import { clickSwipeDeleteAction, swipeLeftRevealWorkoutRoutineRow } from "./helpers/gestures";

// RN Alert.alert has no web implementation (see e2e/habits.spec.ts). Swipe Delete calls Alert;
// on Chromium E2E the confirmation never runs, so deleteRoutine is not invoked.

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

  test("swipe delete: no confirmation on web (Alert.alert no-op), routine remains", async ({
    page,
  }) => {
    await fillRoutineName(page, "Leg press");
    await page.getByText("Add routine", { exact: true }).click();
    await expect(page.getByText("Leg press")).toBeVisible();
    await swipeLeftRevealWorkoutRoutineRow(page);
    await clickSwipeDeleteAction(page);
    await expect(page.getByText("Leg press")).toBeVisible();
  });
});
