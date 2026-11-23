import { test, expect } from './fixtures';
import { clearDatabase } from './helpers/db';
import { queryRows } from './helpers/dbHarness';
import { goToTab, openNewTodoModal, submitTodoModal } from './helpers/navigation';

test.describe('Recurring task lifecycle review', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'todos');
    await clearDatabase(page);
    await goToTab(page, 'todos');
  });

  test('completing an undated daily task does not recreate today on reload', async ({ page }) => {
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill('Daily reload check');
    await page.getByText('Repeat daily', { exact: true }).click();
    await submitTodoModal(page);
    await page.getByRole('checkbox', { name: 'Mark complete: Daily reload check' }).click();
    await expect(page.getByText('1 completed', { exact: true })).toBeVisible();
    await expect(page.getByText('1 open', { exact: true })).toBeVisible();
    await page.reload();
    await goToTab(page, 'todos');
    await expect(page.getByText('1 open', { exact: true })).toBeVisible();
    expect(
      await queryRows(
        page,
        'SELECT completed FROM todos WHERE deleted_at IS NULL ORDER BY completed',
      ),
    ).toEqual([{ completed: 0 }, { completed: 1 }]);
  });

  test("deleting today's recurring occurrence survives a reload", async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-15T02:00:00.000Z'));
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill('Reload sentinel');
    await submitTodoModal(page);
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill('Skip this daily copy');
    await page.getByPlaceholder('Optional', { exact: true }).fill('2026-11-15');
    await page.getByText('Repeat daily', { exact: true }).click();
    await submitTodoModal(page);
    await page.getByLabel('More actions for Skip this daily copy').click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('1 open', { exact: true })).toBeVisible();
    await page.reload();
    await goToTab(page, 'todos');
    // Wait for the post-rollover list read, not the initial empty render.
    await expect(
      page.getByRole('button', { name: 'Edit task: Reload sentinel', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('1 open', { exact: true })).toBeVisible();
    expect(await queryRows(page, 'SELECT title FROM todos WHERE deleted_at IS NULL')).toEqual([
      { title: 'Reload sentinel' },
    ]);
    expect(
      await queryRows(
        page,
        "SELECT operation FROM sync_outbox WHERE entity='todos' ORDER BY operation",
      ),
    ).toEqual([{ operation: 'create' }, { operation: 'delete' }]);
  });
});
