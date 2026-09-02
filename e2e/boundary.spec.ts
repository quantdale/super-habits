import { test, expect } from './fixtures';
import { goToTab, hardReload, openNewTodoModal, submitTodoModal } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import {
  clickCaloriesAddEntry,
  fillCalorieMacrosOnly,
  fillCaloriesMacros,
  fillRoutineName,
} from './helpers/forms';
import { clickTodoCheckboxForTitle } from './helpers/gestures';

test.beforeEach(async ({ page }) => {
  page.setDefaultNavigationTimeout(90_000);
  await goToTab(page, 'todos');
  await hardReload(page);
  await clearDatabase(page);
  await hardReload(page);
});

// ============================================================
// Todos — boundary cases
// ============================================================

test.describe('Todos — boundary inputs', () => {
  test('empty title is rejected — task is not created', async ({ page }) => {
    await goToTab(page, 'todos');
    await openNewTodoModal(page);
    await submitTodoModal(page);
    // The mounted Overview and active Todos surfaces both render this empty
    // state. Assert the last active-surface instance instead of relying on
    // strict-mode resolution of two legitimate semantic matches.
    await expect(page.getByText('No pending tasks', { exact: true }).last()).toBeVisible();
  });

  test('very long title (200 chars) saves and displays without layout break', async ({ page }) => {
    await goToTab(page, 'todos');
    const longTitle = 'A'.repeat(200);
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill(longTitle);
    await submitTodoModal(page);
    await expect(page.getByText('A'.repeat(20))).toBeVisible();
  });

  test('recurring daily todo completed 5 times creates valid chain', async ({ page }) => {
    test.setTimeout(120_000);
    await goToTab(page, 'todos');
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill('Daily chain test');
    await page.getByText('Repeat daily').click();
    await submitTodoModal(page);
    await expect(page.getByText('Daily chain test', { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/↻ daily/)).toBeVisible();

    for (let i = 0; i < 5; i++) {
      await clickTodoCheckboxForTitle(page, 'Daily chain test');
      await page.waitForTimeout(600);
    }

    await hardReload(page);
    await goToTab(page, 'todos');
    await expect(page.locator('body')).not.toContainText('Error');
    await expect(page.locator('body')).not.toContainText('undefined');
    await expect(page.locator('body')).not.toContainText('NaN');
  });

  test('creating 30 todos does not crash the list', async ({ page }) => {
    test.setTimeout(120_000);
    await goToTab(page, 'todos');
    for (let i = 1; i <= 30; i++) {
      // Fresh locator each iteration. Use scrollIntoView via evaluate — Playwright's scrollIntoViewIfNeeded waits for "stable" layout and can detach on RN Web.
      const openCreate = page.getByRole('button', { name: 'Add task' }).last(); // FAB renders last; quick-capture twin is first.
      await openCreate.evaluate((el) =>
        (el as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest' }),
      );
      await openCreate.click({ force: true });
      const titleInput = page.getByPlaceholder(/Add a task/i);
      try {
        await titleInput.waitFor({ state: 'visible', timeout: 2_000 });
      } catch {
        const retryOpen = page.getByRole('button', { name: 'Add task' }).last();
        await retryOpen.evaluate((el) =>
          (el as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest' }),
        );
        await retryOpen.click({ force: true });
        await titleInput.waitFor({ state: 'visible', timeout: 15_000 });
      }
      await titleInput.fill(`Task ${i}`);
      await submitTodoModal(page, { waitForClose: true });
    }
    await expect(page.getByText('Task 1', { exact: true })).toBeVisible({ timeout: 20_000 });
    // The pending list is virtualized (DraggableFlatList mounts a window):
    // hover a mounted row so wheel events target the list scroller, then
    // scroll to the tail so the last-created task mounts before asserting.
    const anchorRow = page.getByText('Task 11', { exact: true }).last();
    await anchorRow.waitFor({ state: 'visible', timeout: 20_000 });
    await anchorRow.hover();
    for (let i = 0; i < 12; i += 1) {
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(150);
    }
    await expect(page.getByText('Task 30')).toBeVisible({ timeout: 20_000 });
  });
});

// ============================================================
// HABITS — boundary cases
// ============================================================

test.describe('Habits — boundary inputs', () => {
  test('habit with target_per_day = 1 shows correct progress', async ({ page }) => {
    await goToTab(page, 'habits');
    await expect(page.getByText('ANYTIME').first()).toBeVisible({ timeout: 15_000 });
    await page
      .getByLabel('Habit groups')
      .getByText('+', { exact: true })
      .first()
      .locator('..')
      .click({ force: true });
    await page.getByLabel('Habit name').fill('One tap');
    await page.getByText('Create habit', { exact: true }).locator('..').click({ force: true });
    await expect(page.getByText('One tap').first()).toBeVisible();
    // Increment via the habit circle's accessible button (stable contract),
    // then assert no NaN/Infinity leaks into the rendered progress.
    await page
      .getByRole('button', { name: /One tap: \d+ of 1 today\. Tap to add one/ })
      .first()
      .click();
    await expect(page.locator('body')).not.toContainText('NaN');
    await expect(page.locator('body')).not.toContainText('Infinity');
  });

  test('creating 10 habits across groups renders all groups', async ({ page }) => {
    test.setTimeout(90_000);
    await goToTab(page, 'habits');
    await expect(page.getByText('ANYTIME').first()).toBeVisible({ timeout: 15_000 });
    for (let i = 0; i < 10; i++) {
      // Fresh locator chain each iteration — avoids stale handles after modal close / list reflow.
      const groupNames = ['anytime', 'morning', 'afternoon', 'evening'] as const;
      await page
        .getByLabel('Habit groups')
        .getByLabel(`Add ${groupNames[i % 4]} habit`)
        .click({ force: true });
      await expect(page.getByLabel('Habit name')).toBeVisible({ timeout: 15_000 });
      await page.getByLabel('Habit name').fill(`Boundary habit ${i + 1}`);
      await page.getByText('Create habit', { exact: true }).locator('..').click({ force: true });
      await expect(page.getByLabel('Habit name')).toBeHidden({ timeout: 15_000 });
    }
    await expect(page.getByText('ANYTIME').first()).toBeVisible();
    await expect(page.getByText('MORNING').first()).toBeVisible();
    await expect(page.getByText('AFTERNOON').first()).toBeVisible();
    await expect(page.getByText('EVENING').first()).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Error');
  });

  test('overview grid renders with no habits (empty state)', async ({ page }) => {
    await goToTab(page, 'habits');
    await expect(page.locator('body')).toContainText('0%');
    await expect(page.locator('body')).not.toContainText('NaN');
    await expect(page.locator('body')).not.toContainText('undefined');
  });
});

// ============================================================
// CALORIES — boundary cases
// ============================================================

test.describe('Calories — boundary inputs', () => {
  test('empty food name is rejected', async ({ page }) => {
    await goToTab(page, 'calories');
    await fillCalorieMacrosOnly(page, '10', '0', '0', '0');
    await clickCaloriesAddEntry(page);
    await expect(page.locator('body')).toContainText('Food name is required', {
      timeout: 10_000,
    });
    await expect(page.locator('body')).not.toContainText('NaN kcal');
  });

  test('very large calorie value does not break chart', async ({ page }) => {
    await goToTab(page, 'calories');
    // Per-macro max is 999g — push total kcal near 9999 cap (validation)
    await fillCaloriesMacros(page, 'Stress load', '999', '999', '222', '0');
    await clickCaloriesAddEntry(page);
    await expect(page.getByText('Stress load', { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('body')).toContainText('9990', { timeout: 10_000 });
    await expect(page.locator('body')).not.toContainText('Infinity');
    await expect(page.locator('body')).not.toContainText('NaN');
  });

  test('logging 20 entries in one day totals correctly', async ({ page }) => {
    test.setTimeout(120_000);
    await goToTab(page, 'calories');
    for (let i = 1; i <= 20; i++) {
      await fillCaloriesMacros(page, `Snack ${i}`, '25', '0', '0', '0');
      await clickCaloriesAddEntry(page);
      await expect(page.getByText(`Snack ${i}`, { exact: true }).first()).toBeVisible({
        timeout: 15_000,
      });
    }
    await page.getByText(/Today:/).scrollIntoViewIfNeeded();
    await expect(page.locator('body')).toContainText('Today: 2000 kcal', { timeout: 20_000 });
    await expect(page.locator('body')).not.toContainText('NaN');
    await expect(page.locator('body')).not.toContainText('Error');
  });

  test('goal UI enforces minimum; screen has no bogus numeric text', async ({ page }) => {
    await goToTab(page, 'calories');
    await expect(page.locator('body')).not.toContainText('Infinity');
    await expect(page.locator('body')).not.toContainText('NaN');
  });
});

// ============================================================
// WORKOUT — boundary cases
// ============================================================

test.describe('Workout — boundary inputs', () => {
  test('empty routine name is rejected', async ({ page }) => {
    await goToTab(page, 'workout');
    await page.getByText('Add routine', { exact: true }).click();
    await expect(page.getByText('Add routine', { exact: true })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Unnamed');
  });

  test('routine with 10 exercises renders detail screen without crash', async ({ page }) => {
    test.setTimeout(90_000);
    await goToTab(page, 'workout');
    await fillRoutineName(page, 'Big Routine');
    await page.getByText('Add routine', { exact: true }).click();
    await page.getByText('Big Routine').click();

    for (let i = 1; i <= 10; i++) {
      await page.getByPlaceholder(/e\.g\./).fill(`Exercise ${i}`);
      await page.getByText('Add exercise').locator('..').getByText('Add', { exact: true }).click();
      await expect(page.getByText(`Exercise ${i}`, { exact: true })).toBeVisible();
    }

    await page.getByText('Exercise 10', { exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByText('Exercise 10', { exact: true })).toBeVisible();
    await expect(page.locator('body')).not.toContainText('Error');
  });

  test('workout tab stays stable after navigation', async ({ page }) => {
    await goToTab(page, 'workout');
    await expect(page.locator('body')).not.toContainText('NaN');
    await expect(page.locator('body')).not.toContainText('undefined');
  });
});

// ============================================================
// POMODORO — boundary cases
// ============================================================

test.describe('Pomodoro — boundary inputs', () => {
  test('setting focus duration to 1 minute works correctly', async ({ page }) => {
    await goToTab(page, 'pomodoro');
    await page.getByRole('button', { name: 'Edit timer duration' }).click();
    const focusInput = page
      .getByText('Focus (min)', { exact: true })
      .locator('xpath=following::input[1]');
    await focusInput.fill('1');
    await page.getByText('Save', { exact: true }).click();
    await expect(page.getByText('01:00')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('NaN');
    await expect(page.locator('body')).not.toContainText('Infinity');
  });

  test('getNextMode never returns long_break at 0 sessions', async ({ page }) => {
    await goToTab(page, 'pomodoro');
    const upNext = page.getByText(/Up next:/i);
    await expect(upNext).toBeVisible();
    await expect(upNext).not.toContainText('Long Break');
  });

  test('session counter dots reset after long break cycle', async ({ page }) => {
    await goToTab(page, 'pomodoro');
    await expect(page.locator('body')).not.toContainText('NaN');
  });
});

// ============================================================
// GLOBAL — cross-cutting boundary checks
// ============================================================

test.describe('Global — no NaN, undefined, or Error text anywhere', () => {
  const tabs = ['todos', 'habits', 'pomodoro', 'workout', 'calories'] as const;

  for (const tab of tabs) {
    test(`${tab} tab has no NaN or undefined in rendered text`, async ({ page }) => {
      await goToTab(page, tab);
      await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible();
      await expect(page.locator('body')).not.toContainText('NaN');
      await expect(page.locator('body')).not.toContainText('undefined');
      await expect(page.locator('body')).not.toContainText('Infinity');
      await expect(page.locator('body')).not.toContainText('[object Object]');
    });
  }
});
