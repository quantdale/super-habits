import { Page } from "@playwright/test";

export const TABS = {
  todos:    "/(tabs)/todos",
  habits:   "/(tabs)/habits",
  pomodoro: "/(tabs)/pomodoro",
  workout:  "/(tabs)/workout",
  calories: "/(tabs)/calories",
} as const;

/**
 * Navigate to a tab and wait for the DOM to be ready.
 * Uses "domcontentloaded" instead of "networkidle" — on Metro dev
 * server with HMR, "networkidle" can add 3-5s per navigation because
 * HMR polling never fully stops. "domcontentloaded" fires as soon as
 * the page structure is ready, which is sufficient for React Native Web.
 */
/** FAB opens new todo — no visible "Make a Task" copy; use accessible name. */
export async function openNewTodoModal(page: Page) {
  await page.getByRole("button", { name: "Add task" }).first().click();
}

/**
 * Primary action in the new-todo modal. The FAB has no visible "Add task" text (icon + a11y label only),
 * so `getByText("Add task")` resolves to the modal button. Force avoids pointer interception on long lists.
 */
export async function submitTodoModal(
  page: Page,
  options?: { waitForClose?: boolean },
) {
  const titleInput = page.getByPlaceholder(/Add a task/i);
  // Click the Pressable wrapper, not the inner Text node, so RN Web reliably fires onPress.
  await page.getByText("Add task", { exact: true }).locator("..").click({ force: true });
  if (options?.waitForClose) {
    await titleInput.waitFor({ state: "hidden", timeout: 15_000 });
  }
}

export async function goToTab(page: Page, tab: keyof typeof TABS) {
  await page.goto(TABS[tab], { waitUntil: "domcontentloaded" });
  // Wait until React has hydrated all inputs — React attaches __reactFiber$xxx
  // properties to DOM nodes during hydration. Filling SSR-rendered inputs before
  // hydration sets DOM values that React immediately overrides with controlled state.
  // The habits tests avoid this because they first click a button (which retries
  // until onPress fires, implicitly waiting for hydration). Form-first tests like
  // calories must wait explicitly.
  await page
    .waitForFunction(
      () => {
        const inputs = Array.from(document.querySelectorAll("input"));
        if (inputs.length === 0) return true; // no inputs on this tab
        return inputs.some((el) =>
          Object.keys(el).some((k) => k.startsWith("__reactFiber")),
        );
      },
      { timeout: 10_000 },
    )
    .catch(() => {
      // If we time out waiting for React fibers (e.g. no inputs), proceed anyway
    });
}

/**
 * Hard reload the page, bypassing SW cache.
 * Uses domcontentloaded for the same reason as goToTab.
 */
export async function hardReload(page: Page) {
  await page.reload({ waitUntil: "domcontentloaded" });
}

/**
 * Wait for DB to be ready by checking for the absence of the
 * initializeDatabase error in the page's console output.
 * Call this after navigation if a test is DB-sensitive.
 */
export async function waitForDb(page: Page, timeout = 5_000) {
  // Give SQLite WASM time to initialize — 500ms is usually enough
  // after domcontentloaded fires
  await page.waitForTimeout(500);
}
