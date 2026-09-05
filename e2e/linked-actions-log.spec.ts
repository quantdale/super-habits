import { test, expect } from './fixtures';
import { clearDatabase } from './helpers/db';
import { goToTab, openNewTodoModal, submitTodoModal } from './helpers/navigation';
import { queryRows, returnToApp } from './helpers/dbHarness';

/**
 * Wave 6 (task 6.3): the calorie.log / pomodoro.log effects are exposed for
 * authoring because the engine executes them — this proves the whole loop
 * through the real UI: author the rule in the todos editor's Linked Actions
 * card (produce-new target, inline template), complete the source task, and
 * verify the produced row with a DB oracle.
 */
test.describe('Linked Actions log targets', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultNavigationTimeout(90_000);
    await goToTab(page, 'todos');
    await clearDatabase(page);
    await goToTab(page, 'todos');
  });

  test('a todo linked to a focus-session log creates one pomodoro session on completion', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const source = 'Wind down for the night';

    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill(source);
    const dialog = page.getByRole('dialog');
    await dialog.getByText('Add linked action', { exact: true }).locator('..').click({
      force: true,
    });
    await dialog.getByText('Task completed', { exact: true }).click({ force: true });

    await dialog.getByText('Pomodoro', { exact: true }).click({ force: true });
    await dialog.getByText('Log pomodoro session', { exact: true }).click({ force: true });
    // Produce-new contract: no existing item is targeted, only a template.
    await expect(
      dialog.getByText('This effect creates a brand-new focus session log'),
    ).toBeVisible();
    await dialog.getByLabel('Linked rule focus minutes').fill('30');
    await submitTodoModal(page, { waitForClose: true });

    await page.getByRole('checkbox', { name: `Mark complete: ${source}` }).click({ force: true });
    await expect(page.getByText(/Linked Actions updated/)).toBeVisible({ timeout: 15_000 });

    const sessions = await queryRows(
      page,
      `SELECT duration_seconds, session_type FROM pomodoro_sessions`,
    );
    expect(sessions).toHaveLength(1);
    expect(Number(sessions[0].duration_seconds)).toBe(1800);
    expect(sessions[0].session_type).toBe('focus');
    const executions = await queryRows(
      page,
      `SELECT status, effect_type FROM linked_action_executions`,
    );
    expect(executions).toEqual([{ status: 'applied', effect_type: 'pomodoro.log' }]);
    await returnToApp(page);

    // The produced session is visible product surface, not just a row.
    await goToTab(page, 'pomodoro');
    await expect(page.getByText('30m', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  });

  test('a todo linked to a calorie entry creates a same-day entry from the inline template', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const source = 'Finish the evening study block';

    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill(source);
    const dialog = page.getByRole('dialog');
    await dialog.getByText('Add linked action', { exact: true }).locator('..').click({
      force: true,
    });
    await dialog.getByText('Task completed', { exact: true }).click({ force: true });

    await dialog.getByText('Calories', { exact: true }).click({ force: true });
    await dialog.getByText('Log calorie entry', { exact: true }).click({ force: true });
    await expect(dialog.getByText('This effect creates a brand-new calorie entry')).toBeVisible();
    await dialog.getByLabel('Linked rule food name').fill('Evening protein shake');
    await dialog.getByLabel('Linked rule calories').fill('250');
    await dialog.getByText('Dinner', { exact: true }).click({ force: true });
    await submitTodoModal(page, { waitForClose: true });

    await page.getByRole('checkbox', { name: `Mark complete: ${source}` }).click({ force: true });
    await expect(page.getByText(/Linked Actions logged/)).toBeVisible({
      timeout: 15_000,
    });

    const entries = await queryRows(
      page,
      `SELECT food_name, calories, meal_type, consumed_on FROM calorie_entries WHERE deleted_at IS NULL`,
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].food_name).toBe('Evening protein shake');
    expect(Number(entries[0].calories)).toBe(250);
    expect(entries[0].meal_type).toBe('dinner');
    expect(String(entries[0].consumed_on)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const executions = await queryRows(
      page,
      `SELECT status, effect_type FROM linked_action_executions`,
    );
    expect(executions).toEqual([{ status: 'applied', effect_type: 'calorie.log' }]);
    const intents = await queryRows(
      page,
      `SELECT operation FROM sync_outbox WHERE entity = 'calorie_entries'`,
    );
    expect(intents).toEqual([{ operation: 'create' }]);
    await returnToApp(page);
  });
});
