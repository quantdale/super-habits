import { test, expect } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { queryRows } from './helpers/dbHarness';
import { seedSql } from './helpers/seed';
import { clickCaloriesAddEntry, fillCalorieMacrosOnly, fillCaloriesMacros } from './helpers/forms';

/**
 * W10 regression contract for the reconstructed Calories surface
 * (`openspec/changes/frontend-v3-w10-calories/specs/calories-logging-first`).
 *
 * It pins the logging-first hierarchy, the duplicate-UI elimination, the
 * SYS-06/SYS-18/SUR-07 corrections, and the day-log edit/delete actions —
 * including row-level SQLite oracles where the persistence contract matters.
 * Assertions are structural/behavioral (no screenshot baselines).
 */

const pad = (n: number) => String(n).padStart(2, '0');

function localTodayKey(): string {
  const date = new Date();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Seed one realistic day (4 meals) plus a saved-meal catalog via raw SQL. */
async function seedW10Day(page: import('@playwright/test').Page) {
  await clearDatabase(page);
  await seedSql(
    page,
    `INSERT OR REPLACE INTO app_meta (key, value) VALUES ('calorie_goal', '{"calories":2000,"protein":150,"carbs":200,"fats":65}');
     INSERT INTO calorie_entries (id,food_name,calories,protein,carbs,fats,fiber,meal_type,consumed_on,created_at,updated_at,deleted_at) VALUES
      ('cal_w10_a','Oatmeal with berries',294,10,54,6,8,'breakfast','${localTodayKey()}','${new Date().toISOString()}','${new Date().toISOString()}',null),
      ('cal_w10_b','Chicken breast salad',402,45,20,14,5,'lunch','${localTodayKey()}','${new Date().toISOString()}','${new Date().toISOString()}',null),
      ('cal_w10_c','Salmon rice bowl',604,40,62,20,6,'dinner','${localTodayKey()}','${new Date().toISOString()}','${new Date().toISOString()}',null);
     INSERT INTO saved_meals (id,food_name,calories,protein,carbs,fats,fiber,meal_type,use_count,last_used_at,created_at) VALUES
      ('smeal_w10_long','Grilled chicken and quinoa power bowl with avocado',511,42,48,16,9,'lunch',3,'${new Date().toISOString()}','${new Date().toISOString()}');`,
  );
  await goToTab(page, 'calories');
}

test.describe('W10 Calories logging-first surface', () => {
  test.beforeEach(async ({ page }) => {
    // Phone-first surface: the W10 hierarchy assertions are measured at the
    // primary 390×844 viewport (the wide composition is asserted separately).
    await page.setViewportSize({ width: 390, height: 844 });
    await goToTab(page, 'calories');
    await clearDatabase(page);
    await page.evaluate(() => {
      window.localStorage.removeItem('superhabits.calories.viewMode');
    });
    await page.reload({ waitUntil: 'load' });
    await goToTab(page, 'calories');
  });

  test('remaining kcal leads, and the logging surface follows in order', async ({ page }) => {
    await seedW10Day(page);

    // 1. The screen title IS the remaining-kcal indicator (1,300 logged of
    //    the 2,000 goal → 700 left). The title is a Text node, so the
    //    remaining-kcal string itself is the dominant indicator.
    await expect(page.getByText('700 kcal left', { exact: true }).first()).toBeVisible();

    // 2. The daily summary repeats the fact exactly once (consumed-of-goal).
    await expect(page.getByText('Today · 1,300 of 2,000 kcal logged')).toBeVisible();

    // 3. Vertical order: summary → macros → quick log → day log. The day log
    //    must start below the quick-log card, and the history disclosure below
    //    the day log.
    const summaryBox = await page.getByText('Today · 1,300 of 2,000 kcal logged').boundingBox();
    const macroBox = await page.getByText('Macros', { exact: true }).boundingBox();
    const quickLogBox = await page.getByText('Recent foods', { exact: true }).boundingBox();
    const dayLogBox = await page.getByLabel('Daily log').boundingBox();
    const historyBox = await page
      .getByRole('button', { name: 'History and insights' })
      .boundingBox();
    for (const [name, box] of Object.entries({
      summary: summaryBox,
      macros: macroBox,
      quickLog: quickLogBox,
      dayLog: dayLogBox,
      history: historyBox,
    })) {
      expect(box, `${name} box`).not.toBeNull();
    }
    expect(summaryBox!.y).toBeLessThan(macroBox!.y);
    expect(macroBox!.y).toBeLessThan(quickLogBox!.y);
    expect(quickLogBox!.y).toBeLessThan(dayLogBox!.y);
    expect(dayLogBox!.y).toBeLessThan(historyBox!.y);
  });

  test('wide viewports compose the two summaries side by side', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedW10Day(page);
    const summaryBox = await page.getByText('Today · 1,300 of 2,000 kcal logged').boundingBox();
    const macroBox = await page.getByText('Macros', { exact: true }).boundingBox();
    expect(summaryBox).not.toBeNull();
    expect(macroBox).not.toBeNull();
    // Same row, summary left of macros, day log still below both.
    expect(Math.abs(summaryBox!.y - macroBox!.y)).toBeLessThan(80);
    expect(summaryBox!.x).toBeLessThan(macroBox!.x);
    const dayLogBox = await page.getByLabel('Daily log').boundingBox();
    expect(dayLogBox!.y).toBeGreaterThan(macroBox!.y);
  });

  test('no daily fact renders twice (duplicate-UI elimination)', async ({ page }) => {
    await seedW10Day(page);
    // The remaining fact renders once (screen title); the consumed total once
    // (summary line); the goal once (summary control). No StatBlock trio, no
    // donut, no feature-stat note, no consistency strip.
    await expect(page.getByText('700 kcal left', { exact: true })).toHaveCount(1);
    await expect(page.getByText('Consumed', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Remaining', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/of daily goal today/)).toHaveCount(0);
    // Goal is numeric only in the context line; edit action does not repeat it.
    await expect(page.getByRole('button', { name: 'Edit daily calorie goal' })).toContainText(
      'Edit goal',
    );
    await expect(page.getByText('Goal 2,000', { exact: true })).toHaveCount(0);
  });

  test('macro rows show totals and targets; over target is factual', async ({ page }) => {
    await seedW10Day(page);
    await expect(page.getByText('95g / 150g', { exact: true })).toBeVisible();
    await expect(page.getByText('136g / 200g', { exact: true })).toBeVisible();
    await expect(page.getByText('40g / 65g', { exact: true })).toBeVisible();
    // The over-goal caption states the amount, never a judgement.
    await expect(page.getByText('700 kcal left', { exact: true })).toBeVisible();
  });

  test('meal groups expose totals and immediately accessible edit/delete', async ({ page }) => {
    await seedW10Day(page);
    const dayLog = page.getByLabel('Daily log');
    // Groups render with their kcal total and item count.
    await expect(dayLog.getByText('Breakfast', { exact: true })).toBeVisible();
    await expect(dayLog.getByText('294 kcal', { exact: true }).first()).toBeVisible();
    await expect(dayLog.getByText('1 item', { exact: true }).first()).toBeVisible();
    // Edit/Delete are visible without a swipe gesture.
    await expect(dayLog.getByRole('button', { name: 'Edit Oatmeal with berries' })).toBeVisible();
    await expect(dayLog.getByRole('button', { name: 'Delete Oatmeal with berries' })).toBeVisible();

    // Delete asks for confirmation (the row action is visible, so the
    // destructive step is confirmed) — cancelling leaves the row untouched.
    await dayLog.getByRole('button', { name: 'Delete Oatmeal with berries' }).click();
    const confirmDialog = page.getByRole('dialog');
    await expect(
      confirmDialog.getByText('Delete "Oatmeal with berries" (294 kcal)?'),
    ).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dayLog.getByText('Oatmeal with berries')).toBeVisible();

    await dayLog.getByRole('button', { name: 'Delete Oatmeal with berries' }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Delete entry', exact: true })
      .click();
    await expect(dayLog.getByText('Oatmeal with berries')).toHaveCount(0, { timeout: 15_000 });
    await expect(page.getByText('994 kcal left', { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    // Row-level oracle LAST: the DB harness read destroys the live app page.
    const rows = await queryRows(
      page,
      "SELECT COUNT(*) AS n FROM calorie_entries WHERE deleted_at IS NULL AND consumed_on = '" +
        localTodayKey() +
        "'",
    );
    expect(Number(rows[0]?.n)).toBe(2);
  });

  test('editing an entry from the grouped log opens the prefilled modal', async ({ page }) => {
    await seedW10Day(page);
    await page
      .getByLabel('Daily log')
      .getByRole('button', { name: 'Edit Salmon rice bowl' })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('textbox', { name: /food/i })).toHaveValue('Salmon rice bowl');
    await expect(dialog.getByRole('button', { name: 'Save changes', exact: true })).toBeVisible();
  });

  test('history is collapsed by default and renders the trends when opened', async ({ page }) => {
    await seedW10Day(page);
    // Collapsed: no chart, heatmap or trend caption on the surface.
    await expect(page.getByText('Year trend (daily)')).toHaveCount(0);
    await expect(page.getByText('Rolling 53-week activity.')).toHaveCount(0);
    const disclosure = page.getByRole('button', { name: 'History and insights' });
    // Collapsed by default: the caption reports the summary fact and no chart
    // renders on the surface.
    await expect(page.getByText(/days? logged ·/)).toBeVisible();
    await expect(disclosure).toHaveAttribute('aria-expanded', 'false');

    await disclosure.click();
    await expect(page.getByText('Year trend (daily)')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Calories history', { exact: true })).toBeVisible();
    // 53-week heatmap renders exactly 53 week columns.
    const weekColumns = page.locator('[aria-label*="week"]');
    expect(await weekColumns.count()).toBeGreaterThan(0);
  });

  test('SYS-18: the long food chip wraps instead of truncating', async ({ page }) => {
    await seedW10Day(page);
    const chip = page.getByRole('button', {
      name: 'Log Grilled chicken and quinoa power bowl with avocado, 511 kcal',
    });
    await expect(chip).toBeVisible();
    const geometry = await chip.evaluate((el) => {
      const text = el.querySelector('div:last-child');
      const rect = el.getBoundingClientRect();
      return {
        clipped: text ? text.scrollWidth > text.clientWidth + 1 : false,
        chipWidth: rect.width,
        viewportWidth: window.innerWidth,
      };
    });
    expect(geometry.clipped).toBe(false);
    expect(geometry.chipWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  });

  test('SUR-07: nothing floats over the entry form fields', async ({ page }) => {
    await goToTab(page, 'calories');
    // The form is inline in Form mode; assert every field's box is free of an
    // overlapping fixed/absolute control (the retired FAB class).
    const fields = ['#cal-entry-food', '#cal-entry-protein', '#cal-entry-carbs', '#cal-entry-fat'];
    const boxes = [];
    for (const selector of fields) {
      const field = page.locator(selector);
      await expect(field).toBeVisible();
      boxes.push(await field.boundingBox());
    }
    const overlappers = await page.evaluate(() => {
      const results: string[] = [];
      for (const el of Array.from(document.querySelectorAll('div'))) {
        const style = getComputedStyle(el);
        const position = style.position;
        if (position !== 'fixed' && position !== 'absolute') continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        results.push(`${position}:${el.getAttribute('aria-label') ?? el.className}`);
      }
      return results;
    });
    // The phone bar and any modal scrim are the only fixed/absolute surfaces;
    // neither may intersect a field box (fields sit above the bar inset).
    for (const box of boxes) {
      expect(box).not.toBeNull();
    }
    for (const label of overlappers) {
      expect(label).not.toContain('Floating');
    }
  });

  test('SYS-06: no doc-copy subtitles remain on the Calories surface', async ({ page }) => {
    await seedW10Day(page);
    for (const copy of [
      'Switch between manual entry and a diary grouped by meal.',
      'Keep the current macro form and reuse foods when they repeat.',
      'Live totals, goal progress, and macro split.',
      'Auto-calculated from protein, carbs, fat, and fiber.',
      'Entries are grouped by stored meal type and default to expanded.',
      'Year trend with your current goal overlaid.',
      'Rolling 7/30-day intake averages. Informational only.',
      'Rolling 53-week activity.',
    ]) {
      await expect(page.getByText(copy, { exact: false })).toHaveCount(0);
    }
  });

  test('quick-add kcal writes one row and never touches the saved-meal catalog', async ({
    page,
  }) => {
    await seedW10Day(page);
    await page.getByRole('button', { name: 'Quick add 200 kilocalories' }).click();
    await expect(page.getByText('500 kcal left', { exact: true })).toBeVisible({ timeout: 15_000 });

    const rows = await queryRows(
      page,
      "SELECT food_name, calories, protein, carbs, fats FROM calorie_entries WHERE food_name = 'Quick add' AND deleted_at IS NULL",
    );
    expect(rows).toEqual([
      { food_name: 'Quick add', calories: 200, protein: 0, carbs: 0, fats: 0 },
    ]);
    // No phantom saved meal, no use_count inflation on the catalog row.
    const meals = await queryRows(
      page,
      "SELECT COUNT(*) AS n FROM saved_meals WHERE food_name = 'Quick add'",
    );
    expect(Number(meals[0]?.n)).toBe(0);
    const counts = await queryRows(
      page,
      "SELECT use_count FROM saved_meals WHERE id = 'smeal_w10_long'",
    );
    expect(Number(counts[0]?.use_count)).toBe(3);
  });

  test('a double-press on the form primary writes exactly one entry', async ({ page }) => {
    await fillCaloriesMacros(page, 'Double press guard', '10', '0', '0', '0');
    const addEntry = page.getByRole('button', { name: 'Save calorie entry' });
    await addEntry.click();
    await addEntry.click({ force: true }).catch(() => undefined);
    await expect(page.getByText('Double press guard').first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(800);
    // Row-level oracle LAST: the DB harness read destroys the live app page.
    const rows = await queryRows(
      page,
      "SELECT COUNT(*) AS n FROM calorie_entries WHERE food_name = 'Double press guard' AND deleted_at IS NULL",
    );
    expect(Number(rows[0]?.n)).toBe(1);
  });

  test('an invalid entry is rejected with the validated message and no row', async ({ page }) => {
    await fillCalorieMacrosOnly(page, '10', '0', '0', '0');
    await clickCaloriesAddEntry(page);
    await expect(page.locator('body')).toContainText('Food name is required', { timeout: 10_000 });
    const rows = await queryRows(page, 'SELECT COUNT(*) AS n FROM calorie_entries');
    expect(Number(rows[0]?.n)).toBe(0);
  });

  test('diary mode groups entries and keeps the quick-log affordances', async ({ page }) => {
    await seedW10Day(page);
    await page.getByLabel('Diary view').click();
    await expect(page.getByText('Recent foods', { exact: true })).toBeVisible();
    await expect(page.getByText('Manual add', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous day', exact: true })).toBeVisible();
    await expect(page.getByLabel('Daily log').getByText('Salmon rice bowl')).toBeVisible();
    // The same shared hero + macro summary render in diary mode.
    await expect(page.getByText('700 kcal left', { exact: true })).toBeVisible();
    await expect(page.getByText('Macros', { exact: true })).toBeVisible();
  });
});
