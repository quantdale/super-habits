import { test, expect } from './fixtures';
import { goToTab, openNewTodoModal, submitTodoModal } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { queryRows, returnToApp, runSql } from './helpers/dbHarness';
import { clickSwipeDeleteAction, swipeLeftToRevealRowActions } from './helpers/gestures';

test.describe('Todos', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'todos');
    await clearDatabase(page);
    await goToTab(page, 'todos');
  });

  test('shows empty state when no todos exist', async ({ page }) => {
    await expect(page.getByText('No pending tasks', { exact: true }).last()).toBeVisible();
  });

  test('does not add todo with empty title', async ({ page }) => {
    await openNewTodoModal(page);
    await submitTodoModal(page);
    await expect(page.getByText('No pending tasks', { exact: true }).last()).toBeVisible();
  });

  test('adds a new todo', async ({ page }) => {
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill('Buy groceries');
    await submitTodoModal(page);
    await expect(page.getByText('Buy groceries')).toBeVisible();

    const rows = await queryRows(
      page,
      `SELECT title, completed FROM todos WHERE deleted_at IS NULL`,
    );
    expect(rows).toEqual([{ title: 'Buy groceries', completed: 0 }]);
  });

  test('completes a todo', async ({ page }) => {
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill('Read a book');
    await submitTodoModal(page);
    const completionControl = page.getByRole('checkbox', { name: 'Mark complete: Read a book' });
    await expect(completionControl).toBeVisible();
    await expect(completionControl).toHaveAttribute('aria-checked', 'false');
    await completionControl.click();
    const showCompleted = page.getByRole('button', { name: 'Show completed tasks' });
    await expect(showCompleted).toBeVisible();
    await showCompleted.click();
    // The completed row can mount in more than one surface container once
    // completed tasks are shown; assert the first instance's state.
    await expect(
      page.getByRole('checkbox', { name: 'Mark incomplete: Read a book' }).first(),
    ).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('Read a book').first()).toBeVisible();

    const rows = await queryRows(
      page,
      `SELECT title, completed FROM todos WHERE deleted_at IS NULL`,
    );
    expect(rows).toEqual([{ title: 'Read a book', completed: 1 }]);
  });

  test('deletes a todo', async ({ page }) => {
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill('Delete me');
    await submitTodoModal(page);
    await expect(page.getByText('Delete me')).toBeVisible();
    await swipeLeftToRevealRowActions(page, 'Delete me');
    await clickSwipeDeleteAction(page, 'Delete me');
    // Swipe Delete opens the shared confirmation dialog; deleting requires an
    // explicit confirm there.
    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog.getByText('Delete "Delete me"?')).toBeVisible();
    await deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Delete me', { exact: true })).not.toBeVisible();

    const rows = await queryRows(page, `SELECT deleted_at FROM todos`);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deleted_at).not.toBeNull();
  });

  test('todo persists after hard reload', async ({ page }) => {
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill('Persistent todo');
    await submitTodoModal(page);
    await expect(page.getByText('Persistent todo').filter({ visible: true }).last()).toBeVisible();

    await page.reload();
    await page.waitForLoadState('load');
    await goToTab(page, 'todos');

    await expect(page.getByText('Persistent todo').filter({ visible: true }).last()).toBeVisible();
  });

  test('completing a linked source todo completes the target todo', async ({ page }) => {
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill('Linked target task');
    await submitTodoModal(page);
    await expect(
      page.getByText('Linked target task').filter({ visible: true }).last(),
    ).toBeVisible();

    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill('Linked source task');

    await page.getByText('Add linked action', { exact: true }).locator('..').click({ force: true });
    await expect(page.getByText('Task completed', { exact: true })).toBeVisible();
    await expect(page.getByText('Complete target task', { exact: true })).toHaveCount(0);

    await page.getByText('Task completed', { exact: true }).click({ force: true });
    const editorDialog = page.getByRole('dialog');
    await editorDialog.getByText('Todos', { exact: true }).click({ force: true });
    await editorDialog
      .getByText('Choose target item', { exact: true })
      .locator('..')
      .click({ force: true });

    const targetPickerDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Linked Actions target picker' });
    await targetPickerDialog
      .getByText('Linked target task', { exact: true })
      .click({ force: true });
    await targetPickerDialog
      .getByText('Use existing task', { exact: true })
      .locator('..')
      .click({ force: true });
    await page.getByText('Complete target task', { exact: true }).click({ force: true });
    await submitTodoModal(page);

    await page
      .getByRole('checkbox', { name: 'Mark complete: Linked source task' })
      .click({ force: true });
    await expect(page.getByText(/Linked Actions updated/i)).toBeVisible();
    await expect(
      page.getByText('No pending tasks', { exact: true }).filter({ visible: true }).last(),
    ).toBeVisible();

    // Row oracle: completing the source completed the linked target too.
    const rows = await queryRows(
      page,
      `SELECT title, completed FROM todos WHERE deleted_at IS NULL ORDER BY created_at ASC`,
    );
    expect(rows).toEqual([
      { title: 'Linked target task', completed: 1 },
      { title: 'Linked source task', completed: 1 },
    ]);
  });

  test('todo project and goal associations survive create, reload, cancelled edit, and edit', async ({
    page,
  }) => {
    // Seed the two parents directly so the test exercises the Todo create/edit
    // orchestration rather than the Project/Goal authoring flows.
    await runSql(
      page,
      `INSERT INTO projects (id, name, description, color, status, target_date, completed_at, sort_order, created_at, updated_at, deleted_at)
       VALUES ('proj_e2e_assoc', 'Alpha project', NULL, '#4F46E5', 'active', NULL, NULL, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', NULL);
       INSERT INTO goals (id, project_id, title, description, horizon, target_date, status, completed_at, progress_percent, created_at, updated_at, deleted_at)
       VALUES ('goal_e2e_assoc', 'proj_e2e_assoc', 'Ship release', NULL, 'quarter', NULL, 'active', NULL, 0, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', NULL);`,
    );
    await returnToApp(page);
    await goToTab(page, 'todos');

    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill('Association task');
    const projectChip = page.getByRole('button', { name: 'Alpha project', exact: true });
    const goalChip = page.getByRole('button', { name: 'Ship release', exact: true });
    await expect(projectChip).toBeVisible();
    await expect(goalChip).toBeVisible();
    await projectChip.click();
    await goalChip.click();
    await expect(projectChip).toHaveAttribute('aria-pressed', 'true');
    await expect(goalChip).toHaveAttribute('aria-pressed', 'true');
    await submitTodoModal(page);
    await expect(page.getByText('Association task').filter({ visible: true }).last()).toBeVisible();

    const created = await queryRows(
      page,
      `SELECT project_id, goal_id FROM todos WHERE title = 'Association task' AND deleted_at IS NULL`,
    );
    expect(created).toEqual([{ project_id: 'proj_e2e_assoc', goal_id: 'goal_e2e_assoc' }]);

    await returnToApp(page);
    await goToTab(page, 'todos');
    await expect(page.getByText('Association task').filter({ visible: true }).last()).toBeVisible();

    // A cancelled edit must not silently clear or rewrite the associations.
    await page.getByLabel('More actions for Association task').first().click({ force: true });
    await page.getByRole('button', { name: 'Edit', exact: true }).click({ force: true });
    await expect(projectChip).toHaveAttribute('aria-pressed', 'true');
    await expect(goalChip).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'None', exact: true }).last().click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();

    const afterCancel = await queryRows(
      page,
      `SELECT project_id, goal_id FROM todos WHERE title = 'Association task' AND deleted_at IS NULL`,
    );
    expect(afterCancel).toEqual([{ project_id: 'proj_e2e_assoc', goal_id: 'goal_e2e_assoc' }]);

    await returnToApp(page);
    await goToTab(page, 'todos');
    await page.getByLabel('More actions for Association task').first().click({ force: true });
    await page.getByRole('button', { name: 'Edit', exact: true }).click({ force: true });
    await page.getByRole('button', { name: 'None', exact: true }).last().click();
    await page.getByRole('button', { name: 'Save changes', exact: true }).click({ force: true });
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const afterSave = await queryRows(
      page,
      `SELECT project_id, goal_id FROM todos WHERE title = 'Association task' AND deleted_at IS NULL`,
    );
    expect(afterSave).toEqual([{ project_id: 'proj_e2e_assoc', goal_id: null }]);
  });

  test('recurring todos show linked-actions disabled message', async ({ page }) => {
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill('Recurring source todo');
    await page.getByText('Repeat daily', { exact: true }).click({ force: true });

    await expect(
      page.getByText(
        "Linked actions attach to one task copy, and each day's repeat is a new copy \u2014 recurring tasks can't be sources yet.",
        { exact: true },
      ),
    ).toBeVisible();
  });

  test('recurring series: template edit preserves history; stop ends the series', async ({
    page,
  }) => {
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill('Daily stretch');
    await page.getByText('Repeat daily', { exact: true }).click({ force: true });
    await submitTodoModal(page);
    await expect(page.getByText('Daily stretch').filter({ visible: true }).last()).toBeVisible();

    // Completing today's copy spawns the next daily copy.
    await page
      .getByRole('checkbox', { name: 'Mark complete: Daily stretch' })
      .first()
      .click({ force: true });
    await expect(page.getByText('Daily stretch').filter({ visible: true }).last()).toBeVisible();
    // Wait for the post-completion refresh: the remaining visible copy must
    // be the spawned pending one (1 open / 1 completed), not a stale row.
    await expect(page.getByText('1 open', { exact: true })).toBeVisible();
    await expect(page.getByText('1 completed', { exact: true })).toBeVisible();

    // Series-scope rename on the pending copy: history keeps the old title.
    await page.getByLabel('More actions for Daily stretch').first().click({ force: true });
    await page.getByRole('button', { name: 'Edit', exact: true }).click({ force: true });
    await expect(page.getByText('This & future tasks', { exact: true })).toBeVisible();
    await page.getByText('This & future tasks', { exact: true }).click({ force: true });
    await page.getByPlaceholder(/Add a task/i).fill('Morning stretch');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click({ force: true });
    await expect(page.getByText('Morning stretch').filter({ visible: true }).last()).toBeVisible();
    await expect(page.getByText('Daily stretch', { exact: true })).not.toBeVisible();
    await page.getByRole('button', { name: 'Show completed tasks' }).click();
    await expect(page.getByText('Daily stretch').filter({ visible: true }).last()).toBeVisible();
    await page.getByRole('button', { name: 'Hide completed tasks' }).click();

    // Stopping removes the future copy without touching completed history.
    await page.getByLabel('More actions for Morning stretch').first().click({ force: true });
    await page.getByRole('button', { name: 'Edit', exact: true }).click({ force: true });
    await page.getByText('Stop repeating (keeps history)', { exact: true }).click({ force: true });
    const stopDialog = page.getByRole('dialog');
    await expect(stopDialog.getByText(/will stop creating new daily copies/)).toBeVisible();
    await stopDialog.getByRole('button', { name: 'Stop repeating', exact: true }).click();
    await expect(page.getByText('No pending tasks', { exact: true }).last()).toBeVisible();
    await page.getByRole('button', { name: 'Show completed tasks' }).click();
    await expect(
      page.getByRole('checkbox', { name: 'Mark incomplete: Daily stretch' }).first(),
    ).toBeVisible();

    // Row oracle: completed history keeps its original title, and the stopped
    // future copy is tombstoned — no live pending row remains.
    const live = await queryRows(
      page,
      `SELECT title, completed FROM todos WHERE deleted_at IS NULL ORDER BY created_at ASC`,
    );
    expect(live).toEqual([{ title: 'Daily stretch', completed: 1 }]);
    const stopped = await queryRows(
      page,
      `SELECT title FROM todos WHERE deleted_at IS NOT NULL ORDER BY created_at ASC`,
    );
    expect(stopped).toEqual([{ title: 'Morning stretch' }]);
  });
});
