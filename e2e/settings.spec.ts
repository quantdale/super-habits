import { expect, test } from './fixtures';
import { clearDatabase } from './helpers/db';
import { goToTab, openNewTodoModal, submitTodoModal } from './helpers/navigation';
import { openSettingsScreen } from './helpers/commandObservation';

async function dismissStartupRestorePromptIfPresent(page: import('@playwright/test').Page) {
  const dismissButton = page.getByText('Not now', { exact: true });
  if (await dismissButton.isVisible().catch(() => false)) {
    await dismissButton.click();
  }
}

test.describe('Settings backup restore', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('load');
    await clearDatabase(page);
  });

  test('shows the backup restore section on an empty device', async ({ page }) => {
    await openSettingsScreen(page);
    await dismissStartupRestorePromptIfPresent(page);

    await expect(page.getByText('Backup status and restore', { exact: true })).toBeVisible();
    await page.getByText('Current restore disclosures').scrollIntoViewIfNeeded();
    await expect(
      page.getByText(
        'Habits restore definitions only (phase-one restore surface). Habit completion history is included in Backup V2 restore.',
      ),
    ).toBeVisible();
    await expect(
      page.getByText(
        'Calories restore entries only (phase-one restore surface). Saved meals are included in Backup V2 restore.',
      ),
    ).toBeVisible();
    await expect(page.getByText('Backup identity', { exact: true })).toBeVisible();
    await expect(page.getByText('Unavailable', { exact: true }).last()).toBeVisible();
    await expect(
      page.getByText('Remote backup is not configured.', { exact: false }).first(),
    ).toBeVisible();
  });

  test('blocks first-phase restore after synced local data exists', async ({ page }) => {
    await goToTab(page, 'todos');
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).type('Local todo');
    await submitTodoModal(page, { waitForClose: true });

    await openSettingsScreen(page);

    await expect(page.getByText('Backup status and restore', { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        'Restore is only available on an empty device. Any local user data — including history such as focus sessions or workout logs — blocks import.',
      ),
    ).toBeVisible();
  });
});
