import { test, expect } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { advanceToNextDay, installClock, setLocalTime } from './helpers/clock';
import { queryRows, returnToApp } from './helpers/dbHarness';
import { browserLocalDateKeyOffset } from './helpers/browserDate';
import { seedSql } from './helpers/seed';

/**
 * Backwards clock / timezone move with an explicitly selected historical day.
 *
 * Confirmed defect: the Calories surface clamped a now-impossible (future)
 * selection only for WRITES while every read, the hero context line and the
 * day log kept the raw selection. After a backwards move the surface still
 * displayed Nov 17 while the form/quick-add wrote to the new "today" (Nov 10) —
 * the entry never appeared in the day log under the form — and copy-day
 * targeted a future day.
 *
 * Contract: the day the surface SHOWS is the day every write uses. When the
 * selection can no longer be a past day, the surface shows today and the pin
 * is released, so a quick log lands on the visible day.
 *
 * Manila (UTC+8, pinned by playwright.config.ts):
 *   START = 2026-11-18 23:40 local, BACK_TO = 2026-11-10 00:30 local.
 */
const START = new Date(Date.UTC(2026, 10, 18, 15, 40, 0));
const BACK_TO = new Date(Date.UTC(2026, 10, 9, 16, 30, 0));
const BACKWARDS_TODAY = '2026-11-10';

test.describe('Calories backwards clock move', () => {
  test('keeps the shown day and the written day identical', async ({ page }) => {
    await installClock(page, START);
    await goToTab(page, 'calories');
    await clearDatabase(page);
    await page.evaluate(() => {
      window.localStorage.setItem('superhabits.calories.viewMode', 'diary');
    });
    // The clock survives reloads; install before the app re-renders.
    await page.reload({ waitUntil: 'load' });
    await goToTab(page, 'calories');

    // 1. The user explicitly opens a past day (Nov 17).
    await page.getByRole('button', { name: 'Previous day', exact: true }).click();
    await expect(page.getByText('Yesterday', { exact: true }).first()).toBeVisible();

    // 2. The clock moves BACKWARDS past that day (now Nov 10 locally).
    await setLocalTime(page, BACK_TO);
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

    // 3. The surface must not keep displaying a day that is now in the future.
    //    Scope to the Calories panel: the shell's section tabs also contain
    //    a "Today" label, so a page-wide match would be a false positive.
    const panel = page.locator('#sh-section-panel-calories');
    await expect(panel.getByText(/Today · 0 of 2,000 kcal logged/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(panel.getByText(/Tue, Nov 17/)).toHaveCount(0);
    await expect(panel.getByText('No entries logged on this day')).toBeVisible();

    // 4. A quick log lands on the day the surface now shows (and is visible
    //    there immediately — pre-fix it landed on the invisible day).
    await page.getByLabel('Quick add 200 kilocalories').click();
    await expect(page.getByText('1,800 kcal left')).toBeVisible({ timeout: 15_000 });
    await returnToApp(page);

    const rows = await queryRows(
      page,
      `SELECT consumed_on FROM calorie_entries WHERE food_name = 'Quick add' AND deleted_at IS NULL;`,
    );
    expect(rows).toEqual([{ consumed_on: BACKWARDS_TODAY }]);

    // No row was written to the day the surface stopped showing, and nothing
    // exists in the future relative to the new local day.
    expect(await browserLocalDateKeyOffset(page, 7)).toBe('2026-11-17');
    const future = await queryRows(
      page,
      `SELECT COUNT(*) AS n FROM calorie_entries WHERE consumed_on > '${BACKWARDS_TODAY}';`,
    );
    expect(Number(future[0]?.n ?? -1)).toBe(0);
  });
});

test('deleting a previous-day entry after midnight keeps the new day visible', async ({ page }) => {
  await installClock(page, START);
  await goToTab(page, 'calories');
  await clearDatabase(page);
  const oldDay = await browserLocalDateKeyOffset(page, 0);
  const newDay = await browserLocalDateKeyOffset(page, 1);
  const timestamp = START.toISOString();
  await seedSql(
    page,
    `INSERT INTO calorie_entries
       (id, food_name, calories, protein, carbs, fats, fiber, meal_type, consumed_on, created_at, updated_at)
     VALUES
       ('cal_1', 'Late dinner', 300, 20, 30, 10, 3, 'dinner', '${oldDay}', '${timestamp}', '${timestamp}'),
       ('cal_2', 'Morning oats', 450, 15, 75, 10, 5, 'breakfast', '${newDay}', '${timestamp}', '${timestamp}');`,
  );
  await goToTab(page, 'calories');

  await page.getByLabel('Delete Late dinner').click();
  const dialog = page.getByRole('dialog', { name: 'Delete entry' });
  await expect(dialog).toBeVisible();

  await advanceToNextDay(page);
  const panel = page.locator('#sh-section-panel-calories');
  await expect(panel.getByText('Today · 450 of 2,000 kcal logged')).toBeVisible();
  await expect(panel.getByText('2 days logged · 375 kcal average · last 52 weeks')).toBeVisible();

  await dialog.getByRole('button', { name: 'Delete entry' }).click();
  // Wait for the post-delete refresh to publish its updated history.
  await expect(panel.getByText('1 day logged · 450 kcal average · last 52 weeks')).toBeVisible();
  await expect(panel.getByText('Today · 450 of 2,000 kcal logged')).toBeVisible();
  await expect(page.getByLabel('Daily log').getByText('Morning oats')).toBeVisible();

  const rows = await queryRows(
    page,
    'SELECT id, consumed_on FROM calorie_entries WHERE deleted_at IS NULL ORDER BY id',
  );
  expect(rows).toEqual([{ id: 'cal_2', consumed_on: newDay }]);
});
