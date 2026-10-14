import { test, expect } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { queryRows } from './helpers/dbHarness';
import { seedSql } from './helpers/seed';
import { clickCaloriesAddEntry, fillCalorieMacrosOnly, fillCaloriesMacros } from './helpers/forms';
import { rapidPress } from './helpers/gestures';
import { browserLocalTodayKey } from './helpers/browserDate';

test.describe('Calories', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'calories');
    await clearDatabase(page);
    await page.evaluate(() => {
      window.localStorage.removeItem('superhabits.calories.viewMode');
    });
    await page.reload({ waitUntil: 'load' });
    await goToTab(page, 'calories');
  });

  test('shows the remaining-kcal hero on first load', async ({ page }) => {
    // W10: the default goal is 2,000 kcal, so an empty day shows the whole
    // goal remaining as the screen title (the daily summary repeats the
    // consumed-of-goal context below it).
    await expect(page.getByText('2,000 kcal left')).toBeVisible();
    await expect(page.getByText(/0 of 2,000 kcal logged/)).toBeVisible();
  });

  test('does not add entry with empty food name', async ({ page }) => {
    await fillCalorieMacrosOnly(page, '10', '0', '0', '0');
    await clickCaloriesAddEntry(page);
    await expect(page.locator('body')).toContainText('Food name is required', {
      timeout: 10_000,
    });
  });

  test('adds a calorie entry and updates daily total', async ({ page }) => {
    await fillCaloriesMacros(page, 'Chicken breast', '30', '0', '3', '0');
    await clickCaloriesAddEntry(page);
    await expect(page.locator('body')).toContainText('Chicken breast', { timeout: 15_000 });
    await expect(page.locator('body')).toContainText('147 kcal', { timeout: 15_000 });
    await expect(page.getByText(/147 of 2,000 kcal logged/)).toBeVisible();
    await expect(page.getByText('1,853 kcal left')).toBeVisible();

    // Row oracle: the entry persisted on today's date with the computed kcal.
    // The expected `consumed_on` is the BROWSER's local date key (the app's
    // `toDateKey()` contract) — post-W17 correction H08: a host-side
    // `new Date()` follows the host timezone and disagrees across the
    // UTC/Manila calendar boundary.
    const oracleTodayKey = await browserLocalTodayKey(page);
    const rows = await queryRows(
      page,
      `SELECT food_name, calories, consumed_on FROM calorie_entries WHERE deleted_at IS NULL`,
    );
    expect(rows).toEqual([
      { food_name: 'Chicken breast', calories: 147, consumed_on: oracleTodayKey },
    ]);
  });

  test('selects different meal types', async ({ page }) => {
    const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
    for (const meal of mealTypes) {
      await page.getByText(meal, { exact: true }).click();
      await expect(page.getByText(meal, { exact: true })).toBeVisible();
    }
  });

  test('entry persists after reload', async ({ page }) => {
    await fillCaloriesMacros(page, 'Oats', '10', '40', '5', '5');
    await clickCaloriesAddEntry(page);
    await expect(page.getByText('Oats', { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('body')).toContainText('235 kcal', { timeout: 15_000 });

    await page.getByLabel('Diary view').click();
    // W10 diary: the quick-log card's fast entry paths and the meal-grouped
    // day log (labeled "Daily log") carry the entry; the Oats row sits in its
    // Breakfast group with its computed kcal.
    await expect(page.getByText('Recent foods', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('Daily log')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('body')).toContainText('Oats', { timeout: 15_000 });
    await expect(page.locator('body')).toContainText('235 kcal', { timeout: 15_000 });
    await expect(
      page.getByLabel('Daily log').getByText('Breakfast', { exact: true }),
    ).toBeVisible();

    await page.reload();
    await page.waitForLoadState('load');
    await goToTab(page, 'calories');
    await expect(page.getByText('Recent foods', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('Daily log')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('body')).toContainText('Oats', { timeout: 15_000 });
    await expect(page.locator('body')).toContainText('235 kcal', { timeout: 15_000 });

    // Row oracle: exactly one live entry survived the reload.
    const rows = await queryRows(
      page,
      `SELECT food_name, calories FROM calorie_entries WHERE deleted_at IS NULL`,
    );
    expect(rows).toEqual([{ food_name: 'Oats', calories: 235 }]);
  });

  test('macro targets modal edits protein/carbs/fats only and re-renders the bars', async ({
    page,
  }) => {
    await page.getByLabel('Edit daily macro targets').click();
    await expect(page.getByText('Daily targets', { exact: true })).toBeVisible();

    // Targets drive the three macro bars; daily calories stay owned by the
    // goal modal, so no kcal field exists here.
    await expect(page.getByLabel('Daily calories (kcal)')).toHaveCount(0);

    await page.getByLabel('Protein (g)').fill('180');
    await page.getByLabel('Carbs (g)').fill('220');
    await page.getByLabel('Fats (g)').fill('70');
    await page.getByText('Save targets', { exact: true }).click();

    // W10 macro summary: one row per macro — label on the left, the
    // logged/target pair on the right — with a slim progress bar beneath.
    await expect(page.getByText('Protein', { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('0g / 180g', { exact: true })).toBeVisible();
    await expect(page.getByText('0g / 220g', { exact: true })).toBeVisible();
    await expect(page.getByText('0g / 70g', { exact: true })).toBeVisible();

    // Targets persist across a full reload (app_meta calorie_targets).
    await page.reload({ waitUntil: 'load' });
    await goToTab(page, 'calories');
    await expect(page.getByText('0g / 180g', { exact: true })).toBeVisible({ timeout: 15_000 });

    const rows = await queryRows(page, `SELECT value FROM app_meta WHERE key = 'calorie_targets'`);
    expect(rows).toHaveLength(1);
    expect(JSON.parse(String(rows[0]?.value))).toMatchObject({
      protein: 180,
      carbs: 220,
      fats: 70,
    });
  });

  test('failed macro-target write preserves editor and does not update displayed targets', async ({
    page,
  }) => {
    // Real SQLite trigger rejects the write. DB harness navigation destroys
    // React state, so seed before opening the modal and query rows last.
    await seedSql(
      page,
      `CREATE TRIGGER reject_macro_target_write
         BEFORE INSERT ON app_meta
         WHEN NEW.key = 'calorie_targets'
         BEGIN SELECT RAISE(ABORT, 'target-write-blocked'); END;`,
    );
    await goToTab(page, 'calories');
    await page.getByLabel('Edit daily macro targets').click();
    await page.getByLabel('Protein (g)').fill('180');
    await page.getByRole('button', { name: 'Save targets' }).click();

    await expect(
      page.getByText('Could not finish saving targets. Please try again.'),
    ).toBeVisible();
    await expect(page.getByLabel('Protein (g)')).toHaveValue('180');
    await expect(page.getByText('0g / 150g', { exact: true })).toBeVisible();

    const rows = await queryRows(page, "SELECT value FROM app_meta WHERE key = 'calorie_targets'");
    expect(rows).toHaveLength(0);
  });

  test('partial backup-intent failure keeps the committed local target visible', async ({
    page,
  }) => {
    // app_meta commits, then the separate backup settings outbox transaction
    // rejects. UI must reconcile the persisted target instead of showing stale
    // macro bars or an inaccurate total failure.
    await seedSql(
      page,
      `CREATE TRIGGER reject_backup_settings_intent
         BEFORE INSERT ON sync_outbox
         WHEN NEW.entity = 'user_backup_settings'
         BEGIN SELECT RAISE(ABORT, 'backup-outbox-blocked'); END;`,
    );
    await goToTab(page, 'calories');
    await page.getByLabel('Edit daily macro targets').click();
    await page.getByLabel('Protein (g)').fill('180');
    await page.getByRole('button', { name: 'Save targets' }).click();

    await expect(
      page.getByText('Targets saved locally. Backup update could not be confirmed.'),
    ).toBeVisible();
    await expect(page.getByLabel('Protein (g)')).not.toBeVisible();
    await expect(page.getByText('0g / 180g', { exact: true })).toBeVisible();

    const rows = await queryRows(page, "SELECT value FROM app_meta WHERE key = 'calorie_targets'");
    expect(rows).toHaveLength(1);
    expect(JSON.parse(String(rows[0]?.value))).toMatchObject({ protein: 180 });
  });

  test('macro targets modal rejects grams over 999', async ({ page }) => {
    await page.getByLabel('Edit daily macro targets').click();
    await page.getByLabel('Protein (g)').fill('1000');
    await page.getByText('Save targets', { exact: true }).click();
    await expect(page.getByText('Macro grams must be 999 or less.')).toBeVisible();
  });

  test('double-pressing a quick-add chip logs exactly one entry', async ({ page }) => {
    // CG-3 defect class on the quick-add path: `saveKcal` checks React
    // `saving` state (async — both same-tick presses see `false`), so a chip
    // double-press writes two `calorie_entries`. The shared synchronous guard
    // drops the second press before any write begins. MAX_QUICK_ADD_KCAL +
    // integer validation are unchanged.
    await rapidPress(page.getByLabel('Quick add 200 kilocalories'), 2);

    // The hero total only re-renders after the entry write has refreshed
    // state, so the SQLite read below can never race the transaction commit
    // (reading rows destroys the app page — never query before this signal).
    // Double 200-kcal presses move the total off the full-goal title on fixed
    // and unfixed builds alike; the strict oracle below is what distinguishes
    // them.
    await expect(page.getByText('2,000 kcal left')).not.toBeVisible();
    // Strict one-row contract: a double-press is ONE entry, never two.
    const rows = await queryRows(
      page,
      "SELECT COUNT(*) AS n FROM calorie_entries WHERE food_name = 'Quick add' AND deleted_at IS NULL",
    );
    expect(Number(rows[0]?.n)).toBe(1);
  });

  test('macro targets modal rejects empty fields instead of saving zero', async ({ page }) => {
    // `Number('') === 0` used to pass the non-negative check, so clearing a
    // field silently saved 0 and hid that macro bar (`buildTargetProgress`
    // hides non-positive targets). Empty is now invalid, not zero; daily
    // calories stay owned by the goal modal.
    await page.getByLabel('Edit daily macro targets').click();
    await expect(page.getByText('Daily targets', { exact: true })).toBeVisible();
    await page.getByLabel('Protein (g)').fill('');
    await page.getByText('Save targets', { exact: true }).click();
    await expect(page.getByText('Enter a value for every field.')).toBeVisible();

    // No silent zero persisted: the targets row is never written.
    const rows = await queryRows(
      page,
      `SELECT COUNT(*) AS n FROM app_meta WHERE key = 'calorie_targets'`,
    );
    expect(Number(rows[0]?.n)).toBe(0);
  });

  test('goal modal save updates the goal line and progress bar', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit daily calorie goal' }).click();
    await expect(page.getByText('Daily goals', { exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Calories (kcal)' }).fill('1500');
    await page.getByText('Save goals', { exact: true }).click();

    await expect(page.getByText('Today · 0 of 1,500 kcal logged')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'Edit daily calorie goal' })).toContainText(
      'Edit goal',
    );
    await expect(page.getByText('1,500 kcal left')).toBeVisible();

    const rows = await queryRows(page, `SELECT value FROM app_meta WHERE key = 'calorie_goal'`);
    expect(rows).toHaveLength(1);
    expect(JSON.parse(String(rows[0]?.value))).toMatchObject({ calories: 1500 });
  });
});
