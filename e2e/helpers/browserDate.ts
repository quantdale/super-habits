import type { Page } from '@playwright/test';

/**
 * Browser-local `YYYY-MM-DD` "today", mirroring the app's `toDateKey()`
 * contract in `lib/time.ts` (local-calendar getters, never UTC).
 *
 * MUST be evaluated inside the Chromium context: `playwright.config.ts`
 * pins the browser timezone to `Asia/Manila`, so a Node-side `new Date()`
 * on a non-Manila host (e.g. a UTC CI runner) between 16:00 and midnight
 * UTC resolves to the PREVIOUS calendar day and would seed browser-local
 * daily-plan fixtures for the wrong date. Never substitute
 * `toISOString().slice(0, 10)` — that is a UTC date.
 *
 * Harness rule: call while the page is still in app context; navigating to
 * the DB harness document destroys React state.
 */
export async function browserLocalTodayKey(page: Page): Promise<string> {
  return page.evaluate(() => {
    const date = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
  });
}
