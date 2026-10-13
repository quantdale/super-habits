import { test, expect } from './fixtures';
import { browserLocalTodayKey } from './helpers/browserDate';
import { installClock } from './helpers/clock';

/**
 * W11.5.1 deterministic timezone regression for the W11.5 write-failure
 * fixtures (Codex P2 `PRRT_kwDORgzj086rvEQW`).
 *
 * `playwright.config.ts` pins Chromium to `Asia/Manila`. The rejected
 * Daily-Plan completion journey seeds a committed plan for "today" and
 * must derive that date from the BROWSER's local calendar — the same
 * contract as the app's `toDateKey()` — because a Node-side date on a UTC
 * host between 16:00 and midnight UTC is the previous calendar day and
 * would seed the fixture for the wrong day, failing the journey before the
 * intended SQLite UPDATE rejection is exercised.
 *
 * These tests prove the crossover deterministically with Playwright's
 * clock at a fixed instant instead of waiting for a wall-clock window:
 *
 *   2026-10-13T16:30:00.000Z  →  UTC date 2026-10-13
 *                            →  Asia/Manila date 2026-10-14
 *
 * The clock test is isolated (no app, no SQLite, no OPFS) so it can never
 * interact with app initialization or the worker lifecycle; the real
 * journeys run separately under the real clock.
 */

const CROSSOVER_INSTANT = '2026-10-13T16:30:00.000Z';
const CROSSOVER_UTC_DATE = '2026-10-13';
const CROSSOVER_MANILA_DATE = '2026-10-14';

/** The same instant on an ordinary same-calendar-day hour (no crossover). */
const SAME_DAY_INSTANT = '2026-10-13T08:00:00.000Z';
const SAME_DAY_DATE = '2026-10-13';

/** Manila calendar date for an instant, computed independently of the helper. */
function manilaDateKey(instant: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant));
}

test.describe('W11.5.1 planning fixture timezone determinism', () => {
  test('Chromium runs the pinned Asia/Manila timezone', async ({ page }) => {
    await page.goto('about:blank');
    const timeZone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    // The value playwright.config.ts pins; if this drifts, the crossover
    // expectations below would silently measure a different timezone.
    expect(timeZone).toBe('Asia/Manila');
  });

  test('browser-local date keys cross the UTC→Manila rollover deterministically', async ({
    page,
  }) => {
    await installClock(page, new Date(CROSSOVER_INSTANT));
    await page.goto('about:blank');

    const browserKey = await browserLocalTodayKey(page);

    // At 16:30 UTC the Manila calendar has already rolled to Oct 14.
    expect(browserKey).toBe(CROSSOVER_MANILA_DATE);
    expect(browserKey).toBe(manilaDateKey(CROSSOVER_INSTANT));

    // The UTC calendar date at the same instant is Oct 13 — exactly what
    // the pre-fix Node-side helper would have produced on a UTC host, so
    // the two derivations provably disagree inside the flagged window.
    const utcKey = new Date(CROSSOVER_INSTANT).toISOString().slice(0, 10);
    expect(utcKey).toBe(CROSSOVER_UTC_DATE);
    expect(browserKey).not.toBe(utcKey);
  });

  test('browser-local date keys agree with UTC on a same-calendar-day instant', async ({
    page,
  }) => {
    await installClock(page, new Date(SAME_DAY_INSTANT));
    await page.goto('about:blank');

    const browserKey = await browserLocalTodayKey(page);

    // No crossover at 08:00 UTC: browser-local and UTC dates agree, so the
    // helper tracks the browser calendar instead of blindly offsetting.
    expect(browserKey).toBe(SAME_DAY_DATE);
    expect(browserKey).toBe(new Date(SAME_DAY_INSTANT).toISOString().slice(0, 10));
    expect(browserKey).toBe(manilaDateKey(SAME_DAY_INSTANT));
  });
});
