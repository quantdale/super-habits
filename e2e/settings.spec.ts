import { expect, test } from "@playwright/test";
import { clearDatabase } from "./helpers/db";
import { goToTab, openNewTodoModal, submitTodoModal } from "./helpers/navigation";

async function dismissStartupRestorePromptIfPresent(page: import("@playwright/test").Page) {
  const dismissButton = page.getByText("Not now", { exact: true });
  if (await dismissButton.isVisible().catch(() => false)) {
    await dismissButton.click();
  }
}

test.describe("Settings backup restore", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");
    await clearDatabase(page);
  });

  test("shows the backup restore section on an empty device", async ({ page }) => {
    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await dismissStartupRestorePromptIfPresent(page);

    await expect(page.getByText("Backup restore")).toBeVisible();
    await expect(
      page.getByText("Habits restore definitions only. Habit completion history stays local-only."),
    ).toBeVisible();
    await expect(
      page.getByText("Calories restore entries only. Saved meals stay local-only."),
    ).toBeVisible();
  });

  test("blocks first-phase restore after synced local data exists", async ({ page }) => {
    await goToTab(page, "todos");
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).type("Local todo");
    await submitTodoModal(page, { waitForClose: true });

    await page.goto("/settings", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Backup restore")).toBeVisible();
    await expect(
      page.getByText(
        "Restore is only available on an empty device in this phase. Existing active synced local rows block import.",
      ),
    ).toBeVisible();
  });
});
