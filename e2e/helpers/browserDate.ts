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
export function browserLocalTodayKey(page: Page): Promise<string> {
  return browserLocalDateKeyOffset(page, 0);
}

/**
 * Browser-local `YYYY-MM-DD` for today + `days` (negative = past), same
 * contract as `browserLocalTodayKey`. Use this instead of a Node-side
 * `new Date()` whenever a spec seeds or asserts a daily date key.
 */
export async function browserLocalDateKeyOffset(page: Page, days: number): Promise<string> {
  return page.evaluate((offset) => {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const pad = (n: number) => String(n).padStart(2, '0');
    return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
  }, days);
}

/** Browser-local weekday (0 = Sunday), mirroring `new Date().getDay()`. */
export async function browserLocalWeekday(page: Page): Promise<number> {
  return page.evaluate(() => new Date().getDay());
}

/**
 * Browser-local `toLocaleDateString('en-US', options)` label for today +
 * `days`. Mirrors app-side label formatting (e.g. the Calories week-strip
 * `Select <label>` cells in `DiaryDayNavigator.tsx`) so a host in another
 * timezone cannot produce a different label than the one the app rendered.
 */
export async function browserLocalDateLabel(
  page: Page,
  days: number,
  options: {
    weekday?: 'short' | 'long' | 'narrow';
    month?: 'short' | 'long' | 'narrow' | 'numeric' | '2-digit';
    day?: 'numeric' | '2-digit';
  },
): Promise<string> {
  return page.evaluate(
    ({ offset, opts }) => {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      return date.toLocaleDateString('en-US', opts);
    },
    { offset: days, opts: options },
  );
}
