import { test, expect } from './fixtures';
import { clearDatabase } from './helpers/db';
import { queryRows } from './helpers/dbHarness';
import { goToTab, openNewTodoModal, submitTodoModal } from './helpers/navigation';

test.describe('Task instance notes', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'todos');
    await clearDatabase(page);
    await goToTab(page, 'todos');
  });

  for (const recurring of [false, true]) {
    test(`clearing notes persists for ${recurring ? 'one recurring occurrence' : 'a one-off task'}`, async ({
      page,
    }) => {
      await openNewTodoModal(page);
      await page.getByPlaceholder(/Add a task/i).fill('Clear instance notes');
      await page.getByPlaceholder('Optional notes').fill('Keep only in the series template');
      if (recurring) await page.getByText('Repeat daily', { exact: true }).click();
      await submitTodoModal(page);
      const edit = page.getByRole('button', {
        name: 'Edit task: Clear instance notes',
        exact: true,
      });
      await edit.click();
      await page.getByPlaceholder('Optional notes').fill('');
      await page.getByRole('button', { name: 'Save changes', exact: true }).click();
      await expect(page.getByRole('dialog', { name: 'Edit task' })).toBeHidden();
      await edit.click();
      await expect(page.getByPlaceholder('Optional notes')).toHaveValue('');
      expect(await queryRows(page, 'SELECT notes FROM todos WHERE deleted_at IS NULL')).toEqual([
        { notes: '' },
      ]);
      if (recurring) {
        expect(
          await queryRows(
            page,
            'SELECT notes FROM todo_recurrence_series WHERE deleted_at IS NULL',
          ),
        ).toEqual([{ notes: 'Keep only in the series template' }]);
      }
    });
  }
});
