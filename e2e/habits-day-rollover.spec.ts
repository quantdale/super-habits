import { test, expect } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { returnToApp } from './helpers/dbHarness';
import { seedSql } from './helpers/seed';
import { advanceToNextDay, installClock } from './helpers/clock';

/**
 * Habits check-in day-strip selection across a local-midnight rollover while
 * the app stays mounted (the CG-1 / `past-midnight-freshness` scenario,
 * applied to the Habits day strip's `selectedDateKey`).
 *
 * Regression pin for the unconditional selection snap in `HabitsScreen`: the
 * rollover effect used to force `selectedDateKey` to the new day even when the
 * user had deliberately selected a past day in the day strip (e.g. backfilling
 * yesterday at 23:58). Mirrors the Calories D9b contract: a selection that
 * points at "today" follows the new day; an explicitly selected past day
 * stays put.
 *
 * Manila 2026-08-03 23:55 == 2026-08-03T15:55Z (Asia/Manila is UTC+8, no DST;
 * playwright.config.ts pins the browser timezone).
 */
const START_EPOCH = Date.UTC(2026, 7, 3, 15, 55, 0, 0);

test.describe('Habits day strip rollover', () => {
  test.beforeEach(async ({ page }) => {
    // Install the fake clock BEFORE the first navigation that mounts the app.
    await installClock(page, new Date(START_EPOCH));
    await goToTab(page, 'habits');
    await clearDatabase(page);
    await goToTab(page, 'habits');
    await seedSql(
      page,
      `INSERT INTO habits (id,name,target_per_day,reminder_time,category,icon,color,created_at,updated_at,deleted_at) VALUES ('habit_rollover_1','Drink water',1,null,'anytime','💧','#22c55e','2026-07-01T10:00:00.000Z','2026-07-01T10:00:00.000Z',null);`,
    );
    await returnToApp(page);
    await goToTab(page, 'habits');
  });

  test('a deliberately selected past day stays selected across midnight', async ({ page }) => {
    const pastPill = page.getByRole('button', {
      name: /^Sunday: 0 of 1 scheduled habits complete/,
    });

    // 23:55 on the boundary day: the user starts backfilling yesterday
    // (Sun Aug 2) in the day strip.
    await expect(pastPill).toHaveAttribute('aria-pressed', 'false');
    await pastPill.click();
    await expect(pastPill).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('0 of 1 done on Sun 2')).toBeVisible();

    // Cross local midnight with the app still mounted; no habit row changes.
    await advanceToNextDay(page);

    // The backfilled selection must stay on Sun Aug 2…
    await expect(pastPill).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('0 of 1 done on Sun 2')).toBeVisible();
    // …and must not be yanked to the new day.
    await expect(page.getByText('0 of 1 done today')).toHaveCount(0);
  });

  test('a selection that was on today follows the new day across midnight', async ({ page }) => {
    // The default selection is today (Mon Aug 3).
    await expect(page.getByText('0 of 1 done today')).toBeVisible();

    await advanceToNextDay(page);

    // D9b first leg: viewing today must follow to the new day (Tue Aug 4).
    await expect(page.getByText('0 of 1 done today')).toBeVisible();
    const newTodayPill = page.getByRole('button', { name: /^Tuesday, today:/ });
    await expect(newTodayPill).toHaveAttribute('aria-pressed', 'true');
  });
});
