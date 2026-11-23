import { test, expect } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { queryRows, returnToApp } from './helpers/dbHarness';
import { seedSql } from './helpers/seed';
import { advanceToNextDay, installClock, setLocalTime } from './helpers/clock';

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

  test('releases a selected day that becomes future after a clock rewind', async ({ page }) => {
    await page.getByRole('button', { name: /^Sunday: 0 of 1 scheduled habits complete/ }).click();
    await expect(page.getByText('0 of 1 done on Sun 2')).toBeVisible();

    // Local Saturday Aug 1. The selected Sunday is now outside the strip.
    await setLocalTime(page, new Date(Date.UTC(2026, 7, 1, 3)));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    const currentDay = page.getByRole('button', { name: /^Saturday, today:/ });
    await expect(currentDay).toBeVisible();
    await expect(currentDay).toHaveAttribute('aria-pressed', 'true');
    const checkIn = page.getByRole('checkbox', { name: 'Drink water: 0 of 1 today. Check in.' });
    await checkIn.click();
    await expect(page.getByText('1 of 1 done today')).toBeVisible();

    await advanceToNextDay(page, { days: 2 });
    await expect(page.getByRole('button', { name: /^Monday, today:/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await queryRows(page, 'SELECT date_key, count FROM habit_completions')).toEqual([
      { date_key: '2026-08-01', count: 1 },
    ]);
  });

  test('editing a habit after a clock rewind uses the target effective today', async ({ page }) => {
    await seedSql(
      page,
      `UPDATE habits SET target_per_day = 2, rule_history =
        '[{"effective_from_date":"2026-07-01","weekdays":[1,2,3,4,5,6,7],"target_per_day":1},{"effective_from_date":"2026-08-04","weekdays":[1,2,3,4,5,6,7],"target_per_day":2}]'
        WHERE id = 'habit_rollover_1';`,
    );
    await returnToApp(page);
    await goToTab(page, 'habits');
    await expect(
      page.getByRole('checkbox', { name: 'Drink water: 0 of 1 today. Check in.' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Open Drink water details' }).click();
    await page.getByRole('dialog').getByRole('tab', { name: 'Settings', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Edit habit', exact: true }).click();
    const editor = page.getByRole('dialog').filter({ hasText: 'Edit Habit' });
    await expect(editor.getByLabel('Target per day', { exact: true })).toHaveValue('1');
    await editor.getByLabel('Habit name').fill('Drink more water');
    await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(editor).toBeHidden();
    await expect(
      page.getByRole('checkbox', { name: 'Drink more water: 0 of 1 today. Check in.' }),
    ).toBeVisible();

    await advanceToNextDay(page);
    await expect(
      page.getByRole('button', { name: 'Drink more water: 0 of 2 today. Add one.' }),
    ).toBeVisible();
  });
});
