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

  test("completing a linked source todo completes the target todo", async ({ page }) => {
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill("Linked target task");
    await submitTodoModal(page);
    await expect(page.getByText("Linked target task")).toBeVisible();

    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill("Linked source task");

    await page.getByText("Add linked action", { exact: true }).locator("..").click({ force: true });
    await expect(page.getByText("Task completed", { exact: true })).toBeVisible();
    await expect(page.getByText("Complete target task", { exact: true })).toHaveCount(0);

    await page.getByText("Task completed", { exact: true }).click({ force: true });
    const editorDialog = page.getByRole("dialog");
    await editorDialog.getByText("Todos", { exact: true }).click({ force: true });
    await editorDialog.getByText("Choose target item", { exact: true }).locator("..").click({ force: true });

    const targetPickerDialog = page.getByRole("dialog").filter({ hasText: "Linked Actions target picker" });
    await targetPickerDialog.getByText("Linked target task", { exact: true }).click({ force: true });
    await targetPickerDialog.getByText("Use existing task", { exact: true }).locator("..").click({ force: true });
    await page.getByText("Complete target task", { exact: true }).click({ force: true });
    await submitTodoModal(page);

    await page.getByRole("button", { name: "" }).nth(1).click({ force: true });
    await expect(page.getByText(/Linked Actions updated/i)).toBeVisible();
    await expect(page.getByText("No pending tasks", { exact: true })).toBeVisible();
  });

  test("recurring todos show linked-actions disabled message", async ({ page }) => {
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill("Recurring source todo");
    await page.getByText("Repeat daily", { exact: true }).click({ force: true });

    await expect(
      page.getByText("Recurring tasks cannot be Linked Action sources yet.", { exact: true }),
    ).toBeVisible();
  });
});
