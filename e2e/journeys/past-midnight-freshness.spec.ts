import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { advanceToNextDay, installClock, pageLocalNow } from '../helpers/clock';
import { clickCaloriesAddEntry, fillCaloriesMacros } from '../helpers/forms';
import { expectRows, switchSection } from '../helpers/oracles';
import { seedFixture } from '../helpers/seed';

/**
 * J2b — "Past midnight", presentation half (decided contract D9b). Priority
 * P1, tag @p0.
 *
 * FIXED CONTRACT GAP **CG-1** (closed by `fix-day-rollover-refresh`): a
 * provider-level day-key watcher now bumps the refresh generation when the
 * local calendar day changes. Active sections refresh immediately, and
 * inactive mounted sections refresh when activated through the existing
 * `useActiveForegroundRefresh` path.
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

test.describe('P1 — Maya, the Daily Driver — J2b past-midnight freshness: no mounted surface labels a stale day "Today" (CG-1 — fix-day-rollover-refresh) @p0', () => {
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
    // Role-scoped: the mounted-but-inactive Overview preview card also renders
    // the habit name, and the old preceding-sibling walk resolved to that
    // inert copy. The ring is the only button labelled "<habit>: n of 1 today".
    const ring = page.getByRole('button', { name: new RegExp(`${HABIT_NAME}: \\d+ of 1 today`) });
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
