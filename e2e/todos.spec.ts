import { test, expect } from "@playwright/test";
import { goToTab, openNewTodoModal, submitTodoModal } from "./helpers/navigation";
import { clearDatabase } from "./helpers/db";
import { clickSwipeDeleteAction, swipeLeftToRevealRowActions } from "./helpers/gestures";

test.describe("Todos", () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, "todos");
    await clearDatabase(page);
    await goToTab(page, "todos");
  });

  test("shows empty state when no todos exist", async ({ page }) => {
    await expect(page.getByText(/No pending tasks/i)).toBeVisible();
  });

  test("does not add todo with empty title", async ({ page }) => {
    await openNewTodoModal(page);
    await submitTodoModal(page);
    await expect(page.getByText(/No pending tasks/i)).toBeVisible();
  });

  test("adds a new todo", async ({ page }) => {
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill("Buy groceries");
    await submitTodoModal(page);
    await expect(page.getByText("Buy groceries")).toBeVisible();
  });

  test("completes a todo", async ({ page }) => {
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill("Read a book");
    await submitTodoModal(page);
    await page.getByText("Read a book").click();
    await expect(page.getByText("Read a book")).toBeVisible();
  });

  test("deletes a todo", async ({ page }) => {
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill("Delete me");
    await submitTodoModal(page);
    await expect(page.getByText("Delete me")).toBeVisible();
    await swipeLeftToRevealRowActions(page, "Delete me");
    await clickSwipeDeleteAction(page, "Delete me");
    await expect(page.getByText("Delete me")).not.toBeVisible();
  });

  test("todo persists after hard reload", async ({ page }) => {
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill("Persistent todo");
    await submitTodoModal(page);
    await expect(page.getByText("Persistent todo")).toBeVisible();

    await page.reload();
    await page.waitForLoadState("load");
    await goToTab(page, "todos");

    await expect(page.getByText("Persistent todo")).toBeVisible();
  });
});
