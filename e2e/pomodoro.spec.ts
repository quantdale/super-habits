import { test, expect } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';

test.describe('Pomodoro', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'pomodoro');
    await clearDatabase(page);
    await goToTab(page, 'pomodoro');
  });

  test('shows idle state on first load', async ({ page }) => {
    await expect(page.getByText('25:00')).toBeVisible();
    await expect(page.getByText('Start focus', { exact: true })).toBeVisible();
  });

  test('shows empty session history on first load', async ({ page }) => {
    await expect(page.getByText('Complete a session to start your garden')).toBeVisible();
    await expect(page.locator('text=/ min$/')).toHaveCount(0);
  });

  test('starts timer and shows running state', async ({ page }) => {
    await page.getByText('Start focus', { exact: true }).click();
    await expect(page.getByText('Pause', { exact: true })).toBeEnabled({ timeout: 3_000 });
    const timer = page.locator('.text-5xl').getByText(/^\d{2}:\d{2}$/);
    await expect(timer).not.toHaveText('25:00', { timeout: 5_000 });
  });

  test('resets timer', async ({ page }) => {
    await page.getByText('Start focus', { exact: true }).click();
    // Wave-v2 rename: the reset control reads 'Reset (not logged)' while the
    // focus session is under a minute.
    await page.getByRole('button', { name: /^Reset \(not logged\)$/ }).click();
    await expect(page.getByText('25:00')).toBeVisible();
    await expect(page.getByText('Start focus', { exact: true })).toBeVisible();
  });
});
