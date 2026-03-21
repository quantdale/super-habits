import { test, expect } from "@playwright/test";
import { goToTab } from "./helpers/navigation";
import { clearDatabase } from "./helpers/db";

test.describe("Todos", () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, "todos");
    await clearDatabase(page);
    await goToTab(page, "todos");
  });

  test("shows empty state when no todos exist", async ({ page }) => {
    await expect(page.getByText("No Pending Tasks")).toBeVisible();
  });

  test("does not add todo with empty title", async ({ page }) => {
    await page.getByText("Make a Task").click();
    await page.getByText("Add task", { exact: true }).click();
    await expect(page.getByText("No Pending Tasks")).toBeVisible();
  });

  test("adds a new todo", async ({ page }) => {
    await page.getByText("Make a Task").click();
    await page.getByPlaceholder(/Add a task/i).fill("Buy groceries");
    await page.getByText("Add task", { exact: true }).click();
    await expect(page.getByText("Buy groceries")).toBeVisible();
  });

  test("completes a todo", async ({ page }) => {
    await page.getByText("Make a Task").click();
    await page.getByPlaceholder(/Add a task/i).fill("Read a book");
    await page.getByText("Add task", { exact: true }).click();
    await page.getByText("Read a book").click();
    await expect(page.getByText("Read a book")).toBeVisible();
  });

  test("deletes a todo", async ({ page }) => {
    await page.getByText("Make a Task").click();
    await page.getByPlaceholder(/Add a task/i).fill("Delete me");
    await page.getByText("Add task", { exact: true }).click();
    await expect(page.getByText("Delete me")).toBeVisible();
    await page.getByText("Delete", { exact: true }).click();
    await expect(page.getByText("Delete me")).not.toBeVisible();
  });

  test("todo persists after hard reload", async ({ page }) => {
    await page.getByText("Make a Task").click();
    await page.getByPlaceholder(/Add a task/i).fill("Persistent todo");
    await page.getByText("Add task", { exact: true }).click();
    await expect(page.getByText("Persistent todo")).toBeVisible();

    await page.reload();
    await page.waitForLoadState("load");
    await goToTab(page, "todos");

    await expect(page.getByText("Persistent todo")).toBeVisible();
  });
});
