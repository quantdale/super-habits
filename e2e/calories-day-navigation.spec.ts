import { type Page, expect, test } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { ensureAppContext, queryRows } from './helpers/dbHarness';
import { seedSql } from './helpers/seed';

const pad = (n: number) => String(n).padStart(2, '0');

/** Browser-local date key `days` from today (negative = past). */
function dateKeyOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoAtLocal(key: string, hour: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d, hour, 0, 0, 0);
  return dt.toISOString();
}

/**
 * Insert a calorie entry on a past day directly through the DB harness (the
 * UI form can only log to today), then reload the app so it is visible.
 */
async function seedPastDayEntry(page: Page, dateKey: string, foodName: string) {
  const created = isoAtLocal(dateKey, 9);
  await seedSql(
    page,
    `INSERT INTO calorie_entries (id,food_name,calories,protein,carbs,fats,fiber,meal_type,consumed_on,created_at,updated_at,deleted_at)
     VALUES ('cal_e2e_${dateKey}','${foodName}',300,10,50,6,8,'breakfast','${dateKey}','${created}','${created}',null);`,
  );
  await ensureAppContext(page);
  await goToTab(page, 'calories');
}

test.describe('Calories diary day navigation', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'calories');
    await clearDatabase(page);
    await page.evaluate(() => {
      window.localStorage.setItem('superhabits.calories.viewMode', 'diary');
    });
    await page.reload({ waitUntil: 'load' });
    await goToTab(page, 'calories');
  });

  test('prev/next/jump-to-today with per-day totals header', async ({ page }) => {
    await seedPastDayEntry(page, dateKeyOffset(-1), 'Yesterday oats');

    const prev = page.getByRole('button', { name: 'Previous day', exact: true });
    const next = page.getByRole('button', { name: 'Next day', exact: true });
    const jumpToday = page.getByRole('button', { name: 'Jump to today' });

    // Today selected: no forward navigation, already on today.
    await expect(next).toBeDisabled();
    await expect(jumpToday).toBeDisabled();

    // Past day shows the navigator header totals and its entries. Scope to
    // the daily-log region: the same food name also renders as a Frequent
    // re-log chip outside it.
    await prev.click();
    await expect(page.getByText('Yesterday', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/300 kcal · P 10g · C 50g · F 6g/)).toBeVisible();
    await expect(page.getByLabel('Daily log').getByText('Yesterday oats')).toBeVisible();
    await expect(next).toBeEnabled();

    // Forward again lands back on today's (empty) log.
    await next.click();
    await expect(page.getByText('No meals logged on this day')).toBeVisible();
    await expect(next).toBeDisabled();

    // Jump-to-today re-enables from a past day.
    await prev.click();
    await expect(jumpToday).toBeEnabled();
    await jumpToday.click();
    await expect(page.getByText('No meals logged on this day')).toBeVisible();
    await expect(jumpToday).toBeDisabled();
  });

  test('week strip shows logged-day dots and disables future days', async ({ page }) => {
    const now = new Date();
    const mondayOffset = (now.getDay() + 6) % 7;
    // On Monday, yesterday belongs to the previous Monday-start strip. Seed
    // today instead so the assertion remains inside the rendered week.
    const loggedDateOffset = mondayOffset === 0 ? 0 : -1;
    await seedPastDayEntry(page, dateKeyOffset(loggedDateOffset), 'Logged oats');

    // At least one strip cell carries a logged dot (non-transparent marker).
    const countLoggedDots = () =>
      page.evaluate(() => {
        let colored = 0;
        for (const cell of Array.from(document.querySelectorAll('[aria-label^="Select "]'))) {
          for (const dot of Array.from(cell.querySelectorAll('div[style]'))) {
            const bg = (dot as HTMLElement).style.backgroundColor;
            if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') colored += 1;
          }
        }
        return colored;
      });
    await expect.poll(countLoggedDots, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);

    // Tomorrow's cell (when inside the Monday-start strip) must be disabled.
    test.skip(mondayOffset === 6, 'Sunday start leaves no future day in the week strip');
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const label = tomorrow.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    await expect(page.getByRole('button', { name: `Select ${label}` })).toBeDisabled();
  });

  test('copy-day end-to-end surfaces the structured outcome and repeat behavior', async ({
    page,
  }) => {
    await seedPastDayEntry(page, dateKeyOffset(-2), 'Copy source oats');

    // Select yesterday so the seeded day-before-yesterday is an earlier candidate.
    await page.getByRole('button', { name: 'Previous day', exact: true }).click();
    await expect(page.getByText('Yesterday', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Copy a previous day' }).click();
    await expect(page.getByText('Copies every entry from the chosen day into')).toBeVisible();

    // Candidate rows are filtered to earlier logged days only.
    await page.getByRole('button', { name: /into Yesterday$/ }).click();

    // Structured outcome surfaced as inline status text; copied entry appears
    // in the Daily log region (the name also renders as a Frequent chip).
    await expect(page.getByLabel('Copy day status')).toContainText(/Copied 1 entry into/, {
      timeout: 15_000,
    });
    await expect(page.getByLabel('Daily log').getByText('Copy source oats')).toBeVisible();

    // Repeated invocation duplicates by design — the status reports THIS
    // invocation's copied count (1), while the list now holds both copies.
    await page.getByRole('button', { name: 'Copy a previous day' }).click();
    await page.getByRole('button', { name: /into Yesterday$/ }).click();
    await expect(page.getByLabel('Copy day status')).toContainText(/Copied 1 entry into/, {
      timeout: 15_000,
    });
    await expect(page.getByLabel('Daily log').getByText('Copy source oats')).toHaveCount(2);
  });

  test('copy modal offers no candidates when no earlier day is logged', async ({ page }) => {
    await seedPastDayEntry(page, dateKeyOffset(-1), 'Yesterday oats');

    // On yesterday, the only logged day (yesterday itself) is not an earlier
    // candidate, and future days are excluded by construction.
    await page.getByRole('button', { name: 'Previous day', exact: true }).click();
    await page.getByRole('button', { name: 'Copy a previous day' }).click();
    await expect(page.getByText('No earlier logged days')).toBeVisible();
  });

  test('entry day correction moves the entry in place and fixes both day totals', async ({
    page,
  }) => {
    await seedPastDayEntry(page, dateKeyOffset(-1), 'Misfiled ramen');
    const today = dateKeyOffset(0);

    // Yesterday holds the misfiled 300 kcal entry.
    await page.getByRole('button', { name: 'Previous day', exact: true }).click();
    await expect(page.getByLabel('Daily log').getByText('Misfiled ramen')).toBeVisible();

    // Edit → change the consumed day to today.
    await page.getByLabel('Edit Misfiled ramen').click();
    await expect(page.getByLabel('Consumed date')).toHaveValue(dateKeyOffset(-1));
    await page.getByLabel('Consumed date').fill(today);
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();

    // Yesterday's ledger is empty again…
    await expect(page.getByText('No meals logged on this day')).toBeVisible({ timeout: 15_000 });

    // …and today holds the SAME entry; macros are preserved (kcal is
    // recomputed from macros on save — the shipped update contract).
    await page.getByRole('button', { name: 'Next day', exact: true }).click();
    await expect(page.getByLabel('Daily log').getByText('Misfiled ramen')).toBeVisible();
    await expect(page.getByText(/kcal · P 10g · C 50g · F 6g/)).toBeVisible();

    // Identity survives a hard reload: exactly one row, now on today.
    await page.reload({ waitUntil: 'load' });
    await goToTab(page, 'calories');
    await expect(page.getByLabel('Daily log').getByText('Misfiled ramen')).toBeVisible();
    const rows = await queryRows(
      page,
      `SELECT id, consumed_on FROM calorie_entries WHERE food_name = 'Misfiled ramen' AND deleted_at IS NULL;`,
    );
    expect(rows).toEqual([{ id: `cal_e2e_${dateKeyOffset(-1)}`, consumed_on: today }]);
  });
});
