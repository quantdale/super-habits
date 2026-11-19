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

  test('series editing from completed history preserves that historical occurrence', async ({
    page,
  }) => {
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill('Historical daily title');
    await page.getByText('Repeat daily', { exact: true }).click();
    await submitTodoModal(page);
    await page.getByRole('checkbox', { name: 'Mark complete: Historical daily title' }).click();
    await expect(page.getByText('1 completed', { exact: true })).toBeVisible();
    await expect(page.getByText('1 open', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Show completed tasks' }).click();
    const completed = page.getByRole('checkbox', {
      name: 'Mark incomplete: Historical daily title',
    });
    await expect(completed).toBeVisible();
    await completed.locator('..').getByLabel('More actions for Historical daily title').click();
    await page.getByRole('button', { name: 'Edit', exact: true }).click();
    await page.getByText('This & future tasks', { exact: true }).click();
    await page.getByPlaceholder(/Add a task/i).fill('Future daily title');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Edit task' })).toBeHidden();
    await expect(
      page.getByRole('checkbox', { name: 'Mark complete: Future daily title' }),
    ).toBeVisible();
    expect(
      await queryRows(
        page,
        'SELECT title, completed FROM todos WHERE deleted_at IS NULL ORDER BY completed DESC',
      ),
    ).toEqual([
      { title: 'Historical daily title', completed: 1 },
      { title: 'Future daily title', completed: 0 },
    ]);
  });
});
