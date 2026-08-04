import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { advanceToNextDay, installClock, pageLocalNow } from '../helpers/clock';
import { returnToApp } from '../helpers/dbHarness';
import { expectRows, switchSection } from '../helpers/oracles';
import { seedFixture } from '../helpers/seed';

/**
 * J2a — "Past midnight", write half (decision D9a). Priority P1, tag @p0.
 *
 * The browser clock crosses midnight while sections are mounted. Write
 * correctness (D9a): every data-layer write derives its `date_key` from
 * `toDateKey()` at call time, so a tick issued after midnight lands on the NEW
 * day, rows written before the boundary keep their original keys (the past is
 * the past), and a reload agrees with what was written. Presentation freshness
 * (D9b) is the separate CG-1 contract guarded by J2b; this journey only pins
 * the write side.
 *
 * NON-UTC BROWSER TIMEZONE — mechanism and evidence.
 * The harness `defineJourney()` creates its context via `browser.newContext()`
 * without options, so it cannot set a non-UTC timezone. This spec therefore
 * hand-rolls the shared-context wiring and sets `timezoneId: 'Asia/Manila'`
 * on the context. Verified empirically with a Playwright probe against the
 * installed chromium: the page reports `Intl.DateTimeFormat().resolvedOptions()
 * .timeZone === 'Asia/Manila'` (offset +480 min), and `page.clock.install()`
 * renders the installed epoch in that timezone (`2026-08-03T15:55:00Z` appears
 * as Manila 2026-08-03 23:55). The Node process on this machine is also
 * Asia/Manila (offset +480), so the harness `advanceToNextDay()` — which
 * computes the next local midnight in the Node timezone — agrees with the
 * browser; `process.env.TZ` is pinned here too so that Node-side helper math
 * stays Manila on CI. The date-key assertions are robust to any residual
 * Node/browser TZ skew: `advanceToNextDay` always lands inside the NEXT Manila
 * calendar day for any feasible Node timezone.
 *
 * Clock semantics used here: rows written before a clock jump keep the
 * timestamps they were written with; the jump only changes what `toDateKey()`
 * returns for subsequent writes. The clock is installed before the app's first
 * render so `AppProviders` bootstrap observes the controlled time.
 */
process.env.TZ = 'Asia/Manila';

const JOURNEY_TZ = 'Asia/Manila';

/** Manila 2026-08-03 23:55 == 2026-08-03T15:55Z (Asia/Manila is UTC+8, no DST). */
const START_EPOCH = Date.UTC(2026, 7, 3, 15, 55, 0, 0);

/** The SMALL fixture's single habit (fixture builder names habit i=0 "Habit 1 — ☕"). */
const HABIT_NAME = 'Habit 1 — ☕';

/** Regex matching the habit ring's accessible name for a given today-count. */
const ringLabel = (count: number) => new RegExp(`Habit 1 — ☕: ${count} of 1 today`);

// The `journeys` project (playwright.config.ts) runs one context per file with
// `workers: 1`; a serial describe plus a single shared page keeps continuity —
// the whole point of a journey. There is no per-step reset: state accumulates.
test.describe
  .serial('P1 — Maya, the Daily Driver — J2a past-midnight writes land on the new date_key @p0', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ timezoneId: JOURNEY_TZ });
    page = await context.newPage();
    // Install the fake clock BEFORE the first render, so every data-layer call
    // in this journey sees the controlled Manila time.
    await installClock(page, new Date(START_EPOCH));
  });

  test.afterAll(async () => {
    await context?.close().catch(() => {});
  });

  test('1. seed SMALL on the boundary day under a non-UTC browser timezone @p0', async () => {
    await seedFixture(page, 'SMALL');

    // Empirical non-UTC evidence: the browser session itself (not the Node
    // process) must report the Manila timezone.
    const tzName = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
    expect(tzName).toBe(JOURNEY_TZ);
    const localNow = await pageLocalNow(page);
    expect(localNow).toMatch(/^2026-08-03T/);

    await switchSection(page, 'habits');
    await expect(page.getByText(HABIT_NAME, { exact: true }).first()).toBeVisible();

    // Starting state: the seeded habit exists with NO completions yet, so the
    // boundary day is clean before the first tick.
    await expectRows(page, 'SELECT COUNT(*) AS n FROM habit_completions', (rows) => {
      expect(Number(rows[0]?.n ?? 0)).toBe(0);
    });
  });

  test('2. ticks before midnight write the boundary-day date_key (twice over) @p0', async () => {
    await returnToApp(page);
    await switchSection(page, 'habits');

    const ring = page
      .getByText(HABIT_NAME, { exact: true })
      .locator('xpath=preceding-sibling::*[1]');

    await ring.click();
    // The ring's accessible name reflects the fresh count — waiting on it
    // guarantees the write AND the section refresh have completed.
    await expect(page.getByRole('button', { name: ringLabel(1) })).toBeVisible();
    await ring.click();
    await expect(page.getByRole('button', { name: ringLabel(2) })).toBeVisible();

    // Row-level oracle: exactly one completion row, on the boundary-day key.
    await expectRows(
      page,
      'SELECT date_key, count FROM habit_completions ORDER BY date_key',
      (rows) => {
        expect(rows).toEqual([{ date_key: '2026-08-03', count: 2 }]);
      },
    );
  });

  test('3. after midnight a tick writes the NEW date_key; pre-boundary rows are untouched @p0', async () => {
    await returnToApp(page);
    await switchSection(page, 'habits');

    await advanceToNextDay(page);
    const localNow = await pageLocalNow(page);
    expect(localNow).toMatch(/^2026-08-04/);

    // NOTE: we deliberately do NOT assert what the ring shows here. Asserting
    // the stale-boundary count ("2 of 1 today") is racy: the section's
    // mount-refresh is async (`await listHabits()` then
    // `getHabitCountByDate(toDateKey())`), so it can read `toDateKey()` after
    // the clock advanced and resolve for the new day instead. Presentation
    // freshness is the separate CG-1 contract in J2b; J2a only pins write
    // correctness. The authoritative signal is the post-tick label below,
    // which can only turn green once the NEW day's row exists.

    const ring = page
      .getByText(HABIT_NAME, { exact: true })
      .locator('xpath=preceding-sibling::*[1]');
    await ring.click();

    // The label flips to the NEW day's count (1) after the write + refresh —
    // the deterministic signal that the post-midnight row landed.
    await expect(page.getByRole('button', { name: ringLabel(1) })).toBeVisible();

    // Row-level oracle: the pre-boundary row (count 2 on 2026-08-03) is
    // untouched, and the post-midnight tick created a NEW row on 2026-08-04.
    // Exact deep-equality is also the negative oracle — no unexpected extra row.
    await expectRows(
      page,
      'SELECT date_key, count FROM habit_completions ORDER BY date_key',
      (rows) => {
        expect(rows).toEqual([
          { date_key: '2026-08-03', count: 2 }, // untouched pre-boundary row
          { date_key: '2026-08-04', count: 1 }, // new day, written after rollover
        ]);
      },
    );
  });

  test('4. a reload agrees with what was written @p0', async () => {
    await returnToApp(page);
    await switchSection(page, 'habits');

    // The reloaded app computes "today" from the controlled clock (Manila
    // 2026-08-04) and must agree with what was written after rollover: the ring
    // reads 1 for today.
    await expect(page.getByRole('button', { name: ringLabel(1) })).toBeVisible();

    // Persisted-state oracle: the exact same two rows survive the reload.
    await expectRows(
      page,
      'SELECT date_key, count FROM habit_completions ORDER BY date_key',
      (rows) => {
        expect(rows).toEqual([
          { date_key: '2026-08-03', count: 2 },
          { date_key: '2026-08-04', count: 1 },
        ]);
      },
    );
  });
});
