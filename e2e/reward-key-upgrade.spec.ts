import { expect, test, type Page } from './fixtures';
import { clearDatabase } from './helpers/db';
import { goToTab, hardReload, openNewTodoModal, submitTodoModal } from './helpers/navigation';
import { queryRows, returnToApp, runSql } from './helpers/dbHarness';

/**
 * Upgrade compatibility for the todo reward key.
 *
 * Todos used to be keyed by the bare todo id in `gamification_events`. They are
 * keyed per local day now (`<dateKey>:<todoId>`) so a task reopened and
 * completed again on a later day is a second real action. The old rows survive
 * an app update, so the first reconcile after upgrading must treat the legacy
 * row as already covering the completion day it paid for — otherwise every
 * previously rewarded task would be paid twice on upgrade day.
 *
 * The scenario seeds that exact old-format state (a paid bare-id row and NO
 * day-qualified row), reloads the app to force the post-upgrade reconcile, and
 * asserts the ledger gained nothing and the XP total is unchanged.
 */

const LEVEL_LABEL = /Level 1, Starter\./;

async function addTodo(page: Page, title: string) {
  await openNewTodoModal(page);
  await page.getByPlaceholder(/Add a task/i).fill(title);
  await submitTodoModal(page);
  await expect(page.getByText(title).first()).toBeVisible();
}

test.describe('Todo reward key upgrade compatibility', () => {
  test.beforeEach(async ({ page }) => {
    await goToTab(page, 'todos');
    await clearDatabase(page);
    await goToTab(page, 'todos');
  });

  test('an old bare-id award is not paid again after the upgrade reload', async ({ page }) => {
    await addTodo(page, 'Water the plants');
    await page
      .getByRole('checkbox', { name: 'Mark complete: Water the plants' })
      .first()
      .click({ force: true });
    await expect(page.getByText('1 completed', { exact: true })).toBeVisible();

    const [todo] = await queryRows(page, `SELECT id FROM todos WHERE title = 'Water the plants'`);
    const todoId = todo.id as string;

    // Rebuild the ledger exactly as the pre-per-day build left it: a bare-id
    // row for today, and nothing under the new day-qualified key.
    await runSql(
      page,
      `DELETE FROM gamification_events;
       DELETE FROM gamification_quests;
       INSERT INTO gamification_events (id, event_kind, source_key, date_key, xp, created_at)
       VALUES ('gxp_legacy_todo', 'todo', '${todoId}',
               date('now', 'localtime'), 5, '2026-01-01T00:00:00.000Z');`,
    );
    await returnToApp(page);

    const before = await queryRows(
      page,
      `SELECT COUNT(*) AS n, COALESCE(SUM(xp), 0) AS xp FROM gamification_events
        WHERE event_kind = 'todo'`,
    );
    expect(before).toEqual([{ n: 1, xp: 5 }]);

    // Reload: mount + housekeeping reconcile runs against the legacy ledger.
    await returnToApp(page);
    await hardReload(page);
    await goToTab(page, 'overview');
    await expect(page.getByText('Level & Streaks').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel(LEVEL_LABEL)).toBeVisible();
    // The day still reads as active (the legacy row carries XP), so the streak
    // surface did not lose the day either. Assert BEFORE opening the DB harness:
    // a harness handle open across a reload blocks the next boot.
    await expect(page.getByLabel(/1 active day in the last week/)).toBeVisible();

    const after = await queryRows(
      page,
      `SELECT source_key, date_key, xp FROM gamification_events
        WHERE event_kind = 'todo' ORDER BY date_key ASC`,
    );
    // Still exactly one legacy row, untouched: no minted day-qualified twin.
    expect(after).toHaveLength(1);
    expect(after[0].source_key).toBe(todoId);
    expect(after[0].xp).toBe(5);
  });

  test('the legacy row covers only its own day: a later re-completion pays once', async ({
    page,
  }) => {
    await addTodo(page, 'Water the plants');
    await page
      .getByRole('checkbox', { name: 'Mark complete: Water the plants' })
      .first()
      .click({ force: true });
    await expect(page.getByText('1 completed', { exact: true })).toBeVisible();

    const [todo] = await queryRows(page, `SELECT id FROM todos WHERE title = 'Water the plants'`);
    const todoId = todo.id as string;

    // The old build paid YESTERDAY under the bare id.
    await runSql(
      page,
      `DELETE FROM gamification_events;
       DELETE FROM gamification_quests;
       INSERT INTO gamification_events (id, event_kind, source_key, date_key, xp, created_at)
       VALUES ('gxp_legacy_todo', 'todo', '${todoId}',
               date('now', 'localtime', '-1 day'), 5, '2026-01-01T00:00:00.000Z');
       UPDATE todos SET completed = 0, completed_at = NULL WHERE id = '${todoId}';`,
    );
    await returnToApp(page);
    await hardReload(page);
    await goToTab(page, 'todos');

    // A genuine completion today is a NEW action and must pay.
    const checkbox = page.getByRole('checkbox', { name: 'Mark complete: Water the plants' });
    await checkbox.first().click({ force: true });
    await expect(page.getByText('1 completed', { exact: true })).toBeVisible();

    const rows = await queryRows(
      page,
      `SELECT source_key, xp FROM gamification_events
        WHERE event_kind = 'todo' ORDER BY date_key ASC`,
    );
    // Yesterday's legacy row survives and today's day-qualified row was minted
    // exactly once — the two coexist without either being double-paid.
    expect(rows).toHaveLength(2);
    expect(rows[0].source_key).toBe(todoId);
    expect(rows[1].source_key).toBe(`${await todayKey(page)}:${todoId}`);

    // A reload cannot pay today a second time.
    await hardReload(page);
    const afterReload = await queryRows(
      page,
      `SELECT COUNT(*) AS n FROM gamification_events WHERE event_kind = 'todo'`,
    );
    expect(afterReload).toEqual([{ n: 2 }]);
  });
});

/** Today's local date key, read from the app's own clock seam. */
async function todayKey(page: Page): Promise<string> {
  const [row] = await queryRows(page, `SELECT date('now', 'localtime') AS today`);
  return row.today as string;
}
