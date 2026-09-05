import { test, expect } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { queryRows, returnToApp } from './helpers/dbHarness';
import { fillRoutineName } from './helpers/forms';
import { clickSwipeDeleteAction, swipeLeftRevealWorkoutRoutineRow } from './helpers/gestures';

test.describe('Workout', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'workout');
    await clearDatabase(page);
    await goToTab(page, 'workout');
  });

  test('shows empty state when no routines exist', async ({ page }) => {
    await expect(page.getByText('Add routine', { exact: true })).toBeVisible();
    await expect(page.getByText('Workout history')).toBeVisible();
  });

  test('does not add routine with empty name', async ({ page }) => {
    await page.getByText('Add routine', { exact: true }).click();
    await expect(page.getByText('Add routine', { exact: true })).toBeVisible();
  });

  test('adds a new routine', async ({ page }) => {
    await fillRoutineName(page, 'Push day');
    await page.getByText('Add routine', { exact: true }).click();
    await expect(page.getByText('Push day')).toBeVisible();
  });

  test('completes a workout', async ({ page }) => {
    await fillRoutineName(page, 'Pull day');
    await page.getByText('Add routine', { exact: true }).click();
    await expect(page.getByText('Pull day')).toBeVisible();
    await page.getByText('Complete workout', { exact: true }).first().click();
    await expect(page.getByText('Workout history')).toBeVisible();
    // The session card only renders after the log write has refreshed state,
    // so the SQLite read below can never race the transaction commit.
    await expect(page.getByLabel(/Open session from/).first()).toBeVisible();
    // Real completion oracle, not just a heading that is always visible.
    const rows = await queryRows(
      page,
      "SELECT COUNT(*) AS n FROM workout_logs WHERE routine_id IN (SELECT id FROM workout_routines WHERE name = 'Pull day')",
    );
    expect(Number(rows[0]?.n)).toBe(1);
    await returnToApp(page);
    await goToTab(page, 'workout');
    await expect(page.getByLabel(/Open session from/).first()).toBeVisible();
  });

  test('routine persists after reload', async ({ page }) => {
    await fillRoutineName(page, 'Leg day');
    await page.getByText('Add routine', { exact: true }).click();
    await expect(page.getByText('Leg day')).toBeVisible();

    await page.reload();
    await page.waitForLoadState('load');
    await goToTab(page, 'workout');
    await expect(page.getByText('Leg day')).toBeVisible();
  });

  test('swipe delete removes the routine after web confirmation', async ({ page }) => {
    await fillRoutineName(page, 'Leg press');
    await page.getByText('Add routine', { exact: true }).click();
    await expect(page.getByText('Leg press')).toBeVisible();
    await swipeLeftRevealWorkoutRoutineRow(page);
    await clickSwipeDeleteAction(page, 'Leg press');
    await page.getByText('Delete routine', { exact: true }).click({ force: true });
    await expect(page.getByText('Leg press')).not.toBeVisible();
  });

  test('timed session records weight/reps, timing, and a new personal record', async ({ page }) => {
    // Create a routine with one exercise whose active phase is short enough
    // to time out naturally inside the test budget.
    await fillRoutineName(page, 'Push day');
    await page.getByText('Add routine', { exact: true }).click();
    await expect(page.getByText('Push day')).toBeVisible();
    await page.getByText('Push day', { exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder(/e\.g\. Rows, Curls, Push-ups/i).fill('Bench Press');
    await dialog.getByText('Add', { exact: true }).click({ force: true });
    await expect(dialog.getByText('Start workout', { exact: true })).toBeVisible();
    await dialog.getByRole('textbox', { name: 'Active (seconds)' }).fill('8');
    // Wait until the shorter timing is committed and reflected back.
    await expect(dialog.getByRole('textbox', { name: 'Active (seconds)' })).toHaveValue('8', {
      timeout: 10_000,
    });

    await dialog.getByText('Start workout', { exact: true }).click({ force: true });

    // Run the single active phase: enter what was lifted while it runs, then
    // let it time out naturally (Skip would mark the set skipped).
    await expect(page.getByText('Log this set (optional)')).toBeVisible();
    await page.getByText('Start', { exact: true }).first().click();
    await page.getByRole('textbox', { name: 'Weight' }).fill('80');
    await page.getByRole('textbox', { name: 'Reps' }).fill('8');
    await expect(page.getByText('Workout complete!')).toBeVisible({ timeout: 20_000 });

    await page.getByLabel('Notes (optional)').fill('Felt strong');
    await page.getByText('Save and finish', { exact: true }).click();

    // First-ever weighted set for the exercise is a new personal record.
    await expect(page.getByText('Workout saved')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('New personal records')).toBeVisible();
    await page.getByText('Done', { exact: true }).click();

    // History detail shows the real per-set provenance and PR math.
    await page
      .getByLabel(/Open session from/)
      .first()
      .click();
    await expect(page.getByText('Session detail')).toBeVisible();
    // The detail dialog shows the exercise twice by design: once as the
    // exercise row and once under "Session personal records".
    const detail = page.getByRole('dialog');
    await expect(detail.getByText('Bench Press').first()).toBeVisible();
    await expect(page.getByText(/80 × 8/)).toBeVisible();
    await expect(detail.getByText(/est\. 1RM 101/)).toBeVisible();
    await expect(page.getByText('Duration')).toBeVisible();
    await expect(page.getByText('Quick log — no exercises recorded.')).not.toBeVisible();
  });

  test('quick-complete logs are labeled distinctly from timed sessions', async ({ page }) => {
    // A routine with exercises exists but was never run through the timer;
    // the quick "Complete workout" action logs a content-free session.
    await fillRoutineName(page, 'Push day');
    await page.getByText('Add routine', { exact: true }).click();
    await expect(page.getByText('Push day')).toBeVisible();
    await page.getByText('Push day', { exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByPlaceholder(/e\.g\. Rows, Curls, Push-ups/i).fill('Bench Press');
    await dialog.getByText('Add', { exact: true }).click({ force: true });
    // Close without force: the Add handler re-renders the dialog async, and a
    // forced click during that window is silently dropped, leaving the modal
    // open. Wait for the close to actually land before touching the page.
    await dialog.getByLabel('Close').click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

    await fillRoutineName(page, 'Quick day');
    await page.getByText('Add routine', { exact: true }).click();
    await expect(page.getByText('Quick day')).toBeVisible();
    await page.getByText('Complete workout', { exact: true }).first().click();

    // The quick log is the only (and therefore newest) session.
    await page
      .getByLabel(/Open session from/)
      .first()
      .click();
    await expect(page.getByText('Quick log — no exercises recorded.')).toBeVisible();
    await expect(page.getByText('Bench Press')).not.toBeVisible();
  });

  test('renames a routine template without disturbing past sessions', async ({ page }) => {
    await fillRoutineName(page, 'Draft name');
    await page.getByText('Add routine', { exact: true }).click();
    await expect(page.getByText('Draft name')).toBeVisible();
    await page.getByText('Complete workout', { exact: true }).first().click();
    await expect(page.getByLabel(/Open session from/).first()).toBeVisible();

    await page.getByText('Draft name', { exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Rename routine' }).click();
    await dialog.getByRole('textbox', { name: 'Routine name' }).fill('Final name');
    await dialog.getByRole('button', { name: 'Save routine name' }).click();
    await expect(dialog.getByText('Final name')).toBeVisible();
    await dialog.getByLabel('Close').click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Final name', { exact: true }).first()).toBeVisible();

    // The earlier quick log keeps its snapshot name — template edits never
    // rewrite completed history.
    const names = await queryRows(page, 'SELECT routine_name FROM workout_logs');
    expect(names.map((row) => row.routine_name)).toEqual(['Draft name']);
    await returnToApp(page);
    await goToTab(page, 'workout');
    await expect(page.getByText('Final name', { exact: true }).first()).toBeVisible();
  });

  test('accidentally logged session can be deleted and disappears from history', async ({
    page,
  }) => {
    await fillRoutineName(page, 'Oops quick log');
    await page.getByText('Add routine', { exact: true }).click();
    await expect(page.getByText('Oops quick log')).toBeVisible();
    await page.getByText('Complete workout', { exact: true }).first().click();
    await expect(page.getByLabel(/Open session from/).first()).toBeVisible();

    const countAfterComplete = await queryRows(page, 'SELECT COUNT(*) AS n FROM workout_logs');
    expect(Number(countAfterComplete[0]?.n)).toBe(1);
    await returnToApp(page);
    await goToTab(page, 'workout');

    await page
      .getByLabel(/Open session from/)
      .first()
      .click();
    const detail = page.getByRole('dialog');
    await expect(detail.getByText('Session detail')).toBeVisible();
    await expect(detail.getByText('Quick log — no exercises recorded.')).toBeVisible();
    await detail.getByRole('button', { name: 'Delete logged session' }).click();
    await page.getByText('Delete session', { exact: true }).last().click({ force: true });

    await expect(page.getByText('Recent sessions')).toHaveCount(0);
    // The routine template survives; only the mistaken log row is gone.
    await expect(page.getByText('Oops quick log', { exact: true }).first()).toBeVisible();
    const countAfterDelete = await queryRows(page, 'SELECT COUNT(*) AS n FROM workout_logs');
    expect(Number(countAfterDelete[0]?.n)).toBe(0);
    const routines = await queryRows(page, 'SELECT COUNT(*) AS n FROM workout_routines');
    expect(Number(routines[0]?.n)).toBe(1);
    await returnToApp(page);
  });

  test('custom exercise manager edits, archives, and restores custom exercises', async ({
    page,
  }) => {
    // Seed a custom exercise at the DB layer (picker creation is covered by
    // the gym-v2 journey) so the manager can be exercised without nesting a
    // second dialog stack.
    await queryRows(
      page,
      `INSERT INTO custom_exercises (id, name, description, primary_area, secondary_areas, equipment, modality, unilateral, supports_external_load, created_at, updated_at, deleted_at)
       VALUES ('cex_e2e_manager', 'Cable Fly', NULL, 'chest', '[]', 'cable', 'weighted_strength', 0, 1, datetime('now'), datetime('now'), NULL)`,
    );
    await returnToApp(page);
    await goToTab(page, 'workout');

    await fillRoutineName(page, 'Custom manager');
    await page.getByText('Add routine', { exact: true }).click();
    await page.getByText('Custom manager', { exact: true }).first().click();

    const builder = page.getByRole('dialog');
    await builder.getByRole('button', { name: 'Manage custom exercises' }).click();
    const manager = page.getByRole('dialog').last();
    await expect(manager.getByText('Custom exercises')).toBeVisible();
    await expect(manager.getByText('Cable Fly')).toBeVisible();

    await manager.getByRole('button', { name: 'Archive custom exercise Cable Fly' }).click();
    await page.getByText('Archive exercise', { exact: true }).last().click({ force: true });
    await expect(manager.getByText('Archived')).toBeVisible();
    await manager.getByRole('button', { name: 'Restore custom exercise Cable Fly' }).click();
    await expect(
      manager.getByRole('button', { name: 'Archive custom exercise Cable Fly' }),
    ).toBeVisible();

    await manager.getByRole('button', { name: 'Edit custom exercise Cable Fly' }).click();
    await manager.getByRole('textbox', { name: 'Edit custom exercise name' }).fill('Pec Deck');
    await manager.getByRole('button', { name: 'Save custom exercise changes' }).click();
    await expect(manager.getByText('Pec Deck')).toBeVisible();

    await manager.getByLabel('Close').click();
    // Library picker now lists the renamed exercise for routine building.
    await builder.getByText('Choose from exercise library', { exact: true }).click();
    const picker = page.getByRole('dialog').last();
    await picker.getByRole('textbox', { name: 'Exercise library search' }).fill('Pec Deck');
    await expect(picker.getByRole('button', { name: 'Add Pec Deck' })).toBeVisible();
  });
});
