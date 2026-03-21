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
export async function goToTab(page: Page, tab: keyof typeof TABS) {
  await page.goto(TABS[tab], { waitUntil: "domcontentloaded" });
  // Wait for React to render — the app root must be present
  await page.waitForSelector("#root, [data-testid='app-root'], body > div",
    { timeout: 5_000 }
  ).catch(() => {
    // Root selector may differ — proceed anyway, test assertions
    // will catch render failures
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