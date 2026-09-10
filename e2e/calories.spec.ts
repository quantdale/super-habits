import { test, expect } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { queryRows } from './helpers/dbHarness';
import { clickCaloriesAddEntry, fillCalorieMacrosOnly, fillCaloriesMacros } from './helpers/forms';

function localTodayKey(): string {
  const date = new Date();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

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

  test('shows empty state on first load', async ({ page }) => {
    await expect(page.getByText('Today: 0 kcal')).toBeVisible();
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
    await expect(page.getByText('Today: 147 kcal')).toBeVisible();

    // Row oracle: the entry persisted on today's date with the computed kcal.
    const rows = await queryRows(
      page,
      `SELECT food_name, calories, consumed_on FROM calorie_entries WHERE deleted_at IS NULL`,
    );
    expect(rows).toEqual([
      { food_name: 'Chicken breast', calories: 147, consumed_on: localTodayKey() },
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
    await expect(page.getByText('Oats - 235 kcal', { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByLabel('Diary view').click();
    await expect(page.getByText('Quick add', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Daily log', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('body')).toContainText('Oats', { timeout: 15_000 });
    await expect(page.locator('body')).toContainText('235 kcal', { timeout: 15_000 });
    await expect(page.locator('body')).toContainText('Logged', { timeout: 15_000 });

    await page.reload();
    await page.waitForLoadState('load');
    await goToTab(page, 'calories');
    await expect(page.getByText('Quick add', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Daily log', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('body')).toContainText('Oats', { timeout: 15_000 });
    await expect(page.locator('body')).toContainText('235 kcal', { timeout: 15_000 });
    await expect(page.locator('body')).toContainText('Logged', { timeout: 15_000 });

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

    await expect(page.getByText('Protein 0g / 180g')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Carbs 0g / 220g')).toBeVisible();
    await expect(page.getByText('Fats 0g / 70g')).toBeVisible();

    // Targets persist across a full reload (app_meta calorie_targets).
    await page.reload({ waitUntil: 'load' });
    await goToTab(page, 'calories');
    await expect(page.getByText('Protein 0g / 180g')).toBeVisible({ timeout: 15_000 });

    const rows = await queryRows(page, `SELECT value FROM app_meta WHERE key = 'calorie_targets'`);
    expect(rows).toHaveLength(1);
    expect(JSON.parse(String(rows[0]?.value))).toMatchObject({
      protein: 180,
      carbs: 220,
      fats: 70,
    });
  });

  test('macro targets modal rejects grams over 999', async ({ page }) => {
    await page.getByLabel('Edit daily macro targets').click();
    await page.getByLabel('Protein (g)').fill('1000');
    await page.getByText('Save targets', { exact: true }).click();
    await expect(page.getByText('Macro grams must be 999 or less.')).toBeVisible();
  });

  test('goal modal save updates the goal line and progress bar', async ({ page }) => {
    await page.getByText('Goal: 2000 kcal ✎').click();
    await expect(page.getByText('Daily goals', { exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Calories (kcal)' }).fill('1500');
    await page.getByText('Save goals', { exact: true }).click();

    await expect(page.getByText('Goal: 1500 kcal ✎')).toBeVisible({ timeout: 15_000 });

    const rows = await queryRows(page, `SELECT value FROM app_meta WHERE key = 'calorie_goal'`);
    expect(rows).toHaveLength(1);
    expect(JSON.parse(String(rows[0]?.value))).toMatchObject({ calories: 1500 });
  });
});
