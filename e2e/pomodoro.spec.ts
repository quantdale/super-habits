import { test, expect } from './fixtures';
import { goToTab, openNewTodoModal, submitTodoModal } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { queryRows, returnToApp } from './helpers/dbHarness';

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

  test('authoring a custom preset persists through app_meta', async ({ page }) => {
    await page.getByRole('button', { name: 'Manage presets' }).click();
    const manager = page.getByRole('dialog');
    await manager.getByRole('button', { name: 'New preset' }).click();
    await manager.getByRole('textbox', { name: 'Preset name' }).fill('Laptop focus');
    await manager.getByRole('textbox', { name: 'Preset focus minutes' }).fill('45');
    await manager.getByRole('button', { name: 'Create preset' }).click();
    await expect(manager.getByRole('button', { name: 'Delete preset Laptop focus' })).toBeVisible();
    await manager.getByLabel('Close').click();
    // The new preset is immediately selectable on the main card; its chip
    // label carries the focus/break summary, unlike the manager's buttons.
    await expect(page.getByRole('button', { name: /^Laptop focus · / })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const rows = await queryRows(page, `SELECT value FROM app_meta WHERE key = 'pomodoro_presets'`);
    expect(String(rows[0]?.value)).toContain('Laptop focus');
    await returnToApp(page);
    await goToTab(page, 'pomodoro');

    await page.reload();
    await page.waitForLoadState('load');
    await goToTab(page, 'pomodoro');
    await page.getByRole('button', { name: 'Manage presets' }).click();
    await expect(page.getByRole('dialog').getByText('Laptop focus')).toBeVisible();
  });

  test('logged session gets a post-hoc note and todo link from history', async ({ page }) => {
    await goToTab(page, 'todos');
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill('Write report');
    await submitTodoModal(page, { waitForClose: true });

    await queryRows(
      page,
      `INSERT INTO pomodoro_sessions (id, started_at, ended_at, duration_seconds, session_type, created_at)
       VALUES ('pom_e2e_corr', datetime('now'), datetime('now', '+25 minutes'), 1500, 'focus', datetime('now'))`,
    );
    await returnToApp(page);
    await goToTab(page, 'pomodoro');

    await page
      .getByRole('button', { name: /Edit focus session from/ })
      .first()
      .click();
    const editor = page.getByRole('dialog');
    await expect(editor.getByText('Edit focus session')).toBeVisible();
    await editor.getByRole('textbox', { name: 'Session note' }).fill('Finished the report draft');
    await editor.getByRole('button', { name: 'Link todo Write report' }).click();
    await editor.getByRole('button', { name: 'Save session changes' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 10_000 });

    // The history row now shows the linked title and the corrected note.
    const row = page.getByRole('button', { name: /Edit focus session from/ }).first();
    await expect(row.getByText('Write report')).toBeVisible();
    await expect(row.getByText('“Finished the report draft”')).toBeVisible();

    const rows = await queryRows(
      page,
      `SELECT note, linked_todo_title FROM pomodoro_sessions WHERE id = 'pom_e2e_corr'`,
    );
    expect(rows[0]?.note).toBe('Finished the report draft');
    expect(rows[0]?.linked_todo_title).toBe('Write report');
    const intents = await queryRows(
      page,
      `SELECT operation FROM sync_outbox WHERE entity = 'pomodoro_sessions' AND id = 'pom_e2e_corr'`,
    );
    expect(intents.map((intent) => intent.operation)).toEqual(['update']);
    await returnToApp(page);
  });
});
