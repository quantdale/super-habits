import { Page } from "@playwright/test";

export const TABS = {
  todos: "/(tabs)/todos",
  habits: "/(tabs)/habits",
  pomodoro: "/(tabs)/pomodoro",
  workout: "/(tabs)/workout",
  calories: "/(tabs)/calories",
} as const;

export async function goToTab(page: Page, tab: keyof typeof TABS) {
  // Metro dev server keeps a live connection open — "networkidle" never settles
  await page.goto(TABS[tab], { waitUntil: "load", timeout: 60_000 });
}

export async function waitForDb(page: Page) {
  // Wait for SQLite to be ready — no [db] initializeDatabase failed in console
  await page.waitForFunction(() => !(window as unknown as { __dbError?: boolean }).__dbError, {
    timeout: 8_000,
  });
}

export async function hardReload(page: Page) {
  await page.evaluate(() => {
    // Bypass SW cache on reload
    return new Promise<void>((resolve) => {
      window.location.reload();
      window.addEventListener("load", () => resolve(), { once: true });
    });
  });
  await page.waitForLoadState("load");
}
