import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { advanceToNextDay, installClock, pageLocalNow } from '../helpers/clock';
import { clickCaloriesAddEntry, fillCaloriesMacros } from '../helpers/forms';
import { expectRows, switchSection } from '../helpers/oracles';
import { seedFixture } from '../helpers/seed';

/**
 * J2b — "Past midnight", presentation half (decided contract D9b). Priority
 * P1, tag @p0.
 *
 * QUARANTINED CONTRACT GAP **CG-1** (see docs/testing/known-gaps.md, D13
 * protocol). The DECIDED contract: a mounted surface must never label a stale
 * day "Today". When the local calendar day changes while the app is open, the
 * ACTIVE section refreshes its day-scoped data, and INACTIVE mounted sections
 * are marked stale so they refresh on activation rather than rendering held
 * values from memory.
 *
 * The application does NOT satisfy this contract today: `useActiveForegroundRefresh`
 * fires on `isActive` transitions and on `visibilitychange`/`AppState`
 * foreground, and a midnight tick is neither — so an active section keeps
 * yesterday's numbers under a "Today" label until some interaction. The
 * companion change **fix-day-rollover-refresh** (a provider-level day-key
 * watcher that bumps a context value the sections already consume for refresh)
 * implements the decided contract. Per D13, the quarantine is removed IN THAT
 * CHANGE, never here.
 *
 * The journey is written to the DECIDED contract, not to current behaviour,
 * and registered with `test.describe.fixme` — it is expected to FAIL today if
 * un-quarantined (step 3's assertion is the one that cannot pass while the
 * active section holds yesterday's "Today: 410 kcal"). Kept fixme'd, it is
 * reported as skipped: a named, tracked gap rather than a red suite.
 *
 * Wiring mirrors J2a (hand-rolled shared context): the harness
 * `defineJourney()` cannot express a non-UTC `timezoneId`, so the context is
 * created here with `Asia/Manila`. See J2a's file header for the empirically
 * verified non-UTC timezone mechanism.
 */
process.env.TZ = 'Asia/Manila';

const JOURNEY_TZ = 'Asia/Manila';

/** Manila 2026-08-03 23:55 == 2026-08-03T15:55Z (Asia/Manila is UTC+8, no DST). */
const START_EPOCH = Date.UTC(2026, 7, 3, 15, 55, 0, 0);

/** The SMALL fixture's single habit (fixture builder names habit i=0 "Habit 1 — ☕"). */
const HABIT_NAME = 'Habit 1 — ☕';

/** Regex matching the habit ring's accessible name for a given today-count. */
const ringLabel = (count: number) => new RegExp(`Habit 1 — ☕: ${count} of 1 today`);

// test.describe.fixme = the D13 quarantine: the journey is registered against
// the decided contract (D9b) but must not execute until the companion change
// `fix-day-rollover-refresh` lands. All steps below follow that decided
// contract; step 3 is the assertion that cannot pass today.
test.describe
  .fixme('P1 — Maya, the Daily Driver — J2b past-midnight freshness: no mounted surface labels a stale day "Today" (CG-1 — fix-day-rollover-refresh) @p0', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext({ timezoneId: JOURNEY_TZ });
    page = await context.newPage();
    // Install the fake clock BEFORE the first render.
    await installClock(page, new Date(START_EPOCH));
  });

  test.afterAll(async () => {
    await context?.close().catch(() => {});
  });

  test('1. mount Habits + Calories and log the boundary day on both surfaces @p0', async () => {
    await seedFixture(page, 'SMALL');

    // Habits: tick the seeded habit once → "1 of 1 today" (boundary day).
    await switchSection(page, 'habits');
    const ring = page
      .getByText(HABIT_NAME, { exact: true })
      .locator('xpath=preceding-sibling::*[1]');
    await ring.click();
    await expect(page.getByRole('button', { name: ringLabel(1) })).toBeVisible();

    // Calories: log a 410-kcal meal on the boundary day
    // (30 g protein ×4 + 50 g carbs ×4 + 10 g fat ×9 = 410 kcal).
    await switchSection(page, 'calories');
    await fillCaloriesMacros(page, 'Oatmeal', '30', '50', '10', '0');
    await clickCaloriesAddEntry(page);
    await expect(page.getByText('Today: 410 kcal')).toBeVisible();

    // Both sections are now mounted; Calories is the active one.
  });

  test('2. advance past midnight while both sections are mounted @p0', async () => {
    await advanceToNextDay(page);
    const localNow = await pageLocalNow(page);
    expect(localNow).toMatch(/^2026-08-04/);
  });

  test('3. the ACTIVE mounted section presents the new day, not a stale "Today" @p0', async () => {
    // Decided contract (D9b): Calories is still the active, mounted section,
    // so a midnight tick must refresh its day-scoped data. Nothing has been
    // logged on the NEW day yet, so the "Today" header must show 0 kcal and
    // must NOT still show yesterday's 410 kcal. Today this fails: the active
    // section renders yesterday's totals under the "Today" header.
    await expect(page.getByText('Today: 0 kcal')).toBeVisible();
    await expect(page.getByText('Today: 410 kcal')).not.toBeVisible();
  });

  test('4. an INACTIVE mounted section refreshes on activation instead of rendering held values @p0', async () => {
    // Decided contract (D9b): Habits was mounted but inactive during the
    // rollover. On activation it must surface the new day rather than the
    // held "1 of 1 today" from the boundary day. The row oracle confirms the
    // database agrees: there is no completion for 2026-08-04 yet, so the
    // fresh truth is "0 of 1 today"; the only completion row is the
    // boundary-day one (the writes themselves are correct — D9a — it is the
    // presentation that must not lie).
    await switchSection(page, 'habits');
    await expect(page.getByRole('button', { name: ringLabel(0) })).toBeVisible();
    await expectRows(
      page,
      'SELECT date_key, count FROM habit_completions ORDER BY date_key',
      (rows) => {
        expect(rows).toEqual([{ date_key: '2026-08-03', count: 1 }]);
      },
    );
  });
});
