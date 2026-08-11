import { type Page } from '@playwright/test';

/**
 * Browser-clock control for day-rollover journeys.
 *
 * `toDateKey()` in the app reads `new Date()` at call time and the Pomodoro
 * tick uses `Date.now()` deltas, so moving the browser clock is sufficient —
 * no application hook required. The clock MUST be installed before the app's
 * first render (i.e. before any navigation that mounts the app), otherwise
 * `AppProviders` bootstrap has already captured real time.
 *
 * Semantics that matter:
 * - Rows written *before* a clock jump keep the timestamps they were written
 *   with. The past is the past: a habit ticked at 23:55 keeps its 23:55
 *   timestamp and its old `date_key` after an `advanceToNextDay()`.
 * - `installClock` fakes `Date`, timers, and `requestAnimationFrame`. Timers
 *   keep flowing (the clock is not paused) unless you use `pauseAt`/`resume`.
 */

export type ClockTime = number | string | Date;

// `page.clock.install()` is page/context-scoped and survives navigations, but
// the page's `window` flag is lost on navigation. Track pages individually so
// separate journey files in the same worker never suppress one another's
// clock installation.
const clockInstalledPages = new WeakSet<Page>();

/**
 * Install the fake clock BEFORE any app render. Must be called before the
 * first navigation that mounts the app. No-op if already installed for this
 * page.
 */
export async function installClock(page: Page, time?: ClockTime): Promise<void> {
  if (clockInstalledPages.has(page)) return;
  await page.clock.install({ time });
  clockInstalledPages.add(page);
}

/**
 * Jump the page clock to an explicit local wall time (the browser's local
 * timezone, which is what `toDateKey()` uses). Must be installed first; also
 * installs if needed (safe to call as the first action).
 */
export async function setLocalTime(page: Page, time: ClockTime): Promise<void> {
  await installClock(page);
  await page.clock.setSystemTime(time);
}

/** Number of ms from a local midnight to a given day offset (0 = today). */
export function buildLocalMidnight(dayOffset: number, atLocal = new Date()): Date {
  const d = new Date(atLocal);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  return d;
}

/**
 * Advance the clock to just after the next local midnight (`dayOffset=1` by
 * default, or any positive offset), simulating a day rollover while the app is
 * mounted. Returns the target Date for assertions.
 *
 * NOTE: the moment "now" is evaluated from the *page* clock, so this works
 * even after arbitrary prior `setSystemTime` calls.
 */
export async function advanceToNextDay(
  page: Page,
  opts: { days?: number; afterMidnightMs?: number } = {},
): Promise<Date> {
  await installClock(page);
  const days = opts.days ?? 1;
  const afterMidnightMs = opts.afterMidnightMs ?? 60_000; // 00:01 local
  const nowMs: number = await page.evaluate(() => Date.now());
  const target = buildLocalMidnight(days, new Date(nowMs));
  target.setMilliseconds(target.getMilliseconds() + afterMidnightMs);
  await page.clock.setSystemTime(target);
  return target;
}

/**
 * Assert the "now" the page clock reports, as a local ISO-ish string. Useful
 * for journeys that want to confirm the rollover actually happened.
 */
export async function pageLocalNow(page: Page): Promise<string> {
  return page.evaluate(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  });
}
