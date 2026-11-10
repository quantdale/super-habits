import { test, expect, type Page } from './fixtures';
import { goToTab, openNewTodoModal, submitTodoModal } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { queryRows, returnToApp } from './helpers/dbHarness';
import { seedSql } from './helpers/seed';

/**
 * Tier-2 silent-write honesty: To Do row actions.
 *
 * A rejected LOCAL write (SQLite refusing the row mutation) must never look
 * like a tap that quietly did nothing. The contract pinned here, per site:
 *
 *  a. the failure is VISIBLE and announced (the in-app notice banner, which is
 *     the accessible surface the Tier-1 todo handlers already use);
 *  b. the row and the durable state stay at the PRE-TAP value — no optimistic
 *     completion, no tombstone, no reward minted — and the UI keeps rendering
 *     that unchanged state;
 *  c. once the injected failure is removed, the SAME action retried from the
 *     UI succeeds and persists exactly once.
 *
 * Failure injection uses the established real-SQLite technique the W7/W10/W11
 * suites proved: a `RAISE(ABORT)` trigger installed through the same-origin DB
 * harness (`e2e/helpers/dbHarness.ts`). `e2e/helpers/failure.ts` injects at the
 * REMOTE boundary only (its routes match `*.supabase.co`), which cannot fail a
 * local OPFS write — the hermetic `dist/` export has no Supabase host at all —
 * so it is deliberately not used here.
 *
 * Harness rule: navigating to the DB document destroys the app page's React
 * state. Every test therefore installs the trigger BEFORE the surface is
 * opened, and query/drop only at an interaction boundary.
 */

const TOGGLE_TRIGGER = 'wfail_todo_toggle';
const DELETE_TRIGGER = 'wfail_todo_delete';

/**
 * The notice banner's own accessible name is the RAW write error (an engine
 * sentence such as "Error finalizing statement"), so assertions pin the stable
 * notice identity instead: `.reason` renders as body text and `.source`/`.target`
 * render as the overline. A successful write shows neither.
 */
async function expectWriteFailureNotice(page: Page, reason: string): Promise<void> {
  await expect(page.getByText(reason, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dismiss notice' })).toBeVisible();
}

test.describe('To Do write-failure honesty', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goToTab(page, 'todos');
    await clearDatabase(page);
    await goToTab(page, 'todos');
  });

  test('a rejected complete leaves the row pending, announces it, and the retry completes once', async ({
    page,
  }) => {
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill('Blocked complete');
    await submitTodoModal(page);
    await expect(
      page.getByRole('checkbox', { name: 'Mark complete: Blocked complete' }).first(),
    ).toBeVisible();

    // Reject only the pending -> completed UPDATE for this write.
    await seedSql(
      page,
      `CREATE TRIGGER ${TOGGLE_TRIGGER}
         BEFORE UPDATE ON todos
         WHEN NEW.completed = 1 AND OLD.completed = 0
         BEGIN SELECT RAISE(ABORT, 'That task could not be updated. Try again.'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'todos');

    const control = page.getByRole('checkbox', { name: 'Mark complete: Blocked complete' }).first();
    await expect(control).toHaveAttribute('aria-checked', 'false');
    await control.click();

    // (a) Visible + accessible failure surface.
    await expectWriteFailureNotice(page, 'todo_toggle_failed');
    // (b) The row is still pending in the UI, not optimistically completed.
    await expect(control).toHaveAttribute('aria-checked', 'false');
    await expect(
      page.getByRole('checkbox', { name: 'Mark incomplete: Blocked complete' }),
    ).toHaveCount(0);
    // ...and the durable state agrees: no completion, no outbox intent, no reward.
    const afterFailure = await queryRows(
      page,
      `SELECT completed FROM todos WHERE title = 'Blocked complete' AND deleted_at IS NULL`,
    );
    expect(afterFailure).toEqual([{ completed: 0 }]);
    const intentsAfterFailure = await queryRows(
      page,
      `SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'todos' AND operation = 'update'`,
    );
    expect(Number(intentsAfterFailure[0]?.n ?? -1)).toBe(0);
    const rewardsAfterFailure = await queryRows(
      page,
      'SELECT COUNT(*) AS n FROM gamification_events',
    );
    expect(Number(rewardsAfterFailure[0]?.n ?? -1)).toBe(0);

    // Clear the injected failure; the retry from the UI must land exactly once.
    await seedSql(page, `DROP TRIGGER ${TOGGLE_TRIGGER};`);
    await returnToApp(page);
    await goToTab(page, 'todos');
    const retried = page.getByRole('checkbox', { name: 'Mark complete: Blocked complete' }).first();
    await retried.click();
    await expect(
      page.getByRole('checkbox', { name: 'Mark incomplete: Blocked complete' }).first(),
    ).toBeVisible();

    const afterRetry = await queryRows(
      page,
      `SELECT completed FROM todos WHERE title = 'Blocked complete' AND deleted_at IS NULL`,
    );
    expect(afterRetry).toEqual([{ completed: 1 }]);
    const intentsAfterRetry = await queryRows(
      page,
      `SELECT operation FROM sync_outbox WHERE entity = 'todos'`,
    );
    expect(intentsAfterRetry).toEqual([{ operation: 'update' }]);
    const rewardsAfterRetry = await queryRows(
      page,
      'SELECT COUNT(*) AS n FROM gamification_events',
    );
    expect(Number(rewardsAfterRetry[0]?.n ?? -1)).toBe(1);
    await returnToApp(page);
  });

  test('a rejected delete keeps the task visible and live, then the retry tombstones once', async ({
    page,
  }) => {
    await openNewTodoModal(page);
    await page.getByPlaceholder(/Add a task/i).fill('Blocked delete');
    await submitTodoModal(page);
    await expect(page.getByText('Blocked delete').filter({ visible: true }).last()).toBeVisible();

    // Reject the soft-delete UPDATE (NEW.deleted_at set) only.
    await seedSql(
      page,
      `CREATE TRIGGER ${DELETE_TRIGGER}
         BEFORE UPDATE ON todos
         WHEN NEW.deleted_at IS NOT NULL
         BEGIN SELECT RAISE(ABORT, 'Could not delete that task. Try again.'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'todos');

    await page.getByLabel('More actions for Blocked delete').first().click({ force: true });
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click({
      force: true,
    });
    const confirmDialog = page
      .getByRole('dialog')
      .filter({ hasText: 'Delete "Blocked delete"?' })
      .last();
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Delete', exact: true }).click();

    // (a) Visible failure, (b) the task is still a live row on screen.
    await expectWriteFailureNotice(page, 'todo_delete_failed');
    await expect(page.getByText('Blocked delete').filter({ visible: true }).last()).toBeVisible();
    const stillLive = await queryRows(
      page,
      `SELECT deleted_at FROM todos WHERE title = 'Blocked delete'`,
    );
    expect(stillLive).toEqual([{ deleted_at: null }]);
    const deleteIntentsAfterFailure = await queryRows(
      page,
      `SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'todos' AND operation = 'delete'`,
    );
    expect(Number(deleteIntentsAfterFailure[0]?.n ?? -1)).toBe(0);

    // (c) Retry after the failure is cleared removes exactly that one row.
    await seedSql(page, `DROP TRIGGER ${DELETE_TRIGGER};`);
    await returnToApp(page);
    await goToTab(page, 'todos');
    await page.getByLabel('More actions for Blocked delete').first().click({ force: true });
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click({
      force: true,
    });
    await page
      .getByRole('dialog')
      .filter({ hasText: 'Delete "Blocked delete"?' })
      .last()
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    // The row is gone from the To Do list itself (other sections keep a
    // mounted, opacity-zero copy of their own summary text).
    await expect(page.getByRole('button', { name: 'Edit task: Blocked delete' })).toHaveCount(0);
    await expect(page.getByText('No pending tasks', { exact: true }).last()).toBeVisible();

    const afterRetry = await queryRows(
      page,
      `SELECT deleted_at FROM todos WHERE title = 'Blocked delete'`,
    );
    expect(afterRetry).toHaveLength(1);
    expect(afterRetry[0]?.deleted_at).not.toBeNull();
    const intentsAfterRetry = await queryRows(
      page,
      `SELECT operation FROM sync_outbox WHERE entity = 'todos'`,
    );
    expect(intentsAfterRetry).toEqual([{ operation: 'delete' }]);
    await returnToApp(page);
  });
});
