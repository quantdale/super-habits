import { test, expect } from './fixtures';
import { clearDatabase } from './helpers/db';
import { expectUnchanged } from './helpers/oracles';
import { goToTab, openNewTodoModal, submitTodoModal } from './helpers/navigation';
import { seedFixture } from './helpers/seed';

test.describe('Momentum Garden', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(90_000);
    await goToTab(page, 'overview');
    await clearDatabase(page);
    await goToTab(page, 'overview');
  });

  test('shows a neutral ready state on an empty device', async ({ page }) => {
    await expect(page.getByText('Momentum Garden', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Your garden is ready for today.', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('body')).not.toContainText(/dead|failed|broken streak|warning/i);
  });

  test('reflects a completed task and reconstructs the same state after reload', async ({
    page,
  }) => {
    await goToTab(page, 'todos');
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill('Momentum task');
    await submitTodoModal(page);
    const completionControl = page.getByRole('checkbox', {
      name: 'Mark complete: Momentum task',
    });
    await expect(completionControl).toBeVisible();
    await completionControl.click();
    await expect(page.getByRole('button', { name: 'Show completed tasks' })).toBeVisible();

    await goToTab(page, 'overview');
    await expect(page.getByText('Today: activity from Tasks.', { exact: true })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('button', { name: 'View Momentum Garden' }).click();
    await expect(page.getByText('Recent growth', { exact: true })).toBeVisible();
    await expect(page.getByText(/Tasks on 1 day/)).toBeVisible();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await goToTab(page, 'overview');
    await expect(page.getByText('Today: activity from Tasks.', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('shows independent multi-domain contributions in the deeper view', async ({ page }) => {
    test.setTimeout(120_000);
    await seedFixture(page, 'TYPICAL');
    await goToTab(page, 'overview');
    await expect(page.getByText('Momentum Garden', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Today: activity from/)).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'View Momentum Garden' }).click();
    await expect(page.getByText('Why each area grows', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Tasks', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('Habits', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('Focus', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('Workout', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('Nutrition', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('Recent growth', { exact: true })).toBeVisible();

    // Rapid window changes must leave the detail view on the latest request,
    // even when the earlier bounded read resolves later.
    const sevenDays = page.getByRole('button', { name: '7 days', exact: true });
    const twentyEightDays = page.getByRole('button', { name: '28 days', exact: true });
    await sevenDays.click();
    await twentyEightDays.click();
    await sevenDays.click();
    await expect(page.getByText(/last 7 days ending/)).toBeVisible({ timeout: 20_000 });
  });

  test('is keyboard-operable, reduced-motion understandable, and read-only', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await goToTab(page, 'todos');
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill('Read-only garden source');
    await submitTodoModal(page);
    const completionControl = page.getByRole('checkbox', {
      name: 'Mark complete: Read-only garden source',
    });
    await expect(completionControl).toBeVisible();
    await completionControl.click();
    await expect(page.getByRole('button', { name: 'Show completed tasks' })).toBeVisible();
    await goToTab(page, 'overview');

    const viewButton = page.getByRole('button', { name: 'View Momentum Garden' });
    await viewButton.focus();
    await expect(viewButton).toBeFocused();

    await expectUnchanged(
      page,
      `SELECT 'todo' AS kind, id, CAST(completed AS TEXT) AS value, completed_at AS marker
       FROM todos WHERE deleted_at IS NULL
       UNION ALL
       SELECT 'outbox' AS kind, entity || ':' || id, operation, updated_at
       FROM sync_outbox
       ORDER BY kind, id`,
      async (currentPage) => {
        await currentPage.getByRole('button', { name: 'View Momentum Garden' }).press('Enter');
        await expect(currentPage.getByText('Recent growth', { exact: true })).toBeVisible({
          timeout: 20_000,
        });
        await expect(currentPage.getByText('Tasks', { exact: true }).last()).toBeVisible();
      },
    );
  });
});
