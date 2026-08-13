import { expect, type Page } from '@playwright/test';
import { defineJourney } from '../helpers/journey';
import { ACTIVE_SECTION_SELECTOR, expectRows, switchSection } from '../helpers/oracles';
import { resetAll } from '../helpers/reset';
import { returnToApp, runSql } from '../helpers/dbHarness';
import { openNewTodoModal, submitTodoModal } from '../helpers/navigation';

/**
 * J6 — "Chain reaction" (task 4.6, P3 — Priya, the Power User).
 *
 * A linked action must fire EXACTLY once per user completion, record the
 * execution, and never double-apply when the source is re-completed
 * (untick → tick). A rule whose target has been deleted must skip with
 * `target_missing` — not error and not resurrect the target.
 *
 * Scenario: source todo "Finish retro review report" is linked to target todo
 * "Drink water after the retro" with the `todo.completed` trigger and the
 * `todo.complete` effect. All source/target interactions happen through the
 * real UI (the todos list checkbox); the rule itself is authored through the
 * todo editor's Linked Actions card. The orchestrating engine's execution rows
 * are asserted with row-level oracles (`linked_action_events`,
 * `linked_action_executions`, `linked_action_rules`, `todos`).
 *
 * Why the target deletion is done with SQL and not the UI delete: the app's
 * `removeTodo()` path deliberately soft-deletes the rule referencing the
 * target as well (cleanup), which makes `target_missing` unreachable through
 * a pure UI delete. Deleting the row directly simulates the stale-link state
 * the engine's defensive skip exists for (target gone, rule still active).
 */

const SOURCE = 'Finish retro review report';
const TARGET = 'Drink water after the retro';

/** The source's executions (one per fire), oldest first. */
function executionsSql(): string {
  return `
    SELECT e.status, e.effect_type, e.notice_payload, r.status AS rule_status
    FROM linked_action_executions e
    JOIN linked_action_rules r ON r.id = e.rule_id
    WHERE r.source_entity_id = (SELECT id FROM todos WHERE title = '${SOURCE}')
    ORDER BY e.created_at ASC`;
}

/** @returns the queue-count line rendered in the Todos "Today's queue" card. */
async function expectQueueCounts(page: Page, pending: number, completed: number): Promise<void> {
  await expect(
    page.getByText(`${pending} pending, ${completed} completed`, { exact: true }),
  ).toBeVisible();
}

/** Toggle the semantic todo checkbox in the active section and wait for the
 * refresh to commit before a journey issues another toggle. */
async function toggleTodo(page: Page, title: string): Promise<void> {
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const checkbox = page
    .locator(ACTIVE_SECTION_SELECTOR)
    .getByRole('checkbox', { name: new RegExp(`^Mark (?:in)?complete: ${escapedTitle}$`) });
  const before = await checkbox.getAttribute('aria-checked');
  await checkbox.click({ force: true });
  const expected = before === 'true' ? 'false' : 'true';
  await expect
    .poll(
      async () => {
        const current = await page
          .locator(ACTIVE_SECTION_SELECTOR)
          .locator('[role="checkbox"]')
          .evaluateAll(
            (elements, target) =>
              elements
                .find((element) =>
                  (element.getAttribute('aria-label') ?? '').endsWith(`: ${target}`),
                )
                ?.getAttribute('aria-checked') ?? null,
            title,
          );
        // Completing a pending todo moves it into the collapsed completed
        // section, so its checkbox can disappear when the refresh commits.
        return current === expected || (expected === 'true' && current === null);
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}

/** Reveal the Completed section if it is currently hidden. Waits for the toggle
 * to exist first: right after a section switch the todo list loads async, and a
 * non-waiting count() check would race the render and skip the click. */
async function ensureCompletedShown(page: Page): Promise<void> {
  const show = page.getByText(/^Show completed/);
  await expect(show)
    .toBeVisible({ timeout: 15_000 })
    .catch(() => {
      // No completed items (or already shown) — nothing to reveal.
    });
  if ((await show.count()) > 0) {
    await show.click({ force: true });
    await expect(page.getByText(/^Hide completed/)).toBeVisible();
  }
}

/** Author the `todo.completed -> todo.complete` rule on the source todo. */
async function authorSourceRule(page: Page): Promise<void> {
  await page.getByText('Add linked action', { exact: true }).locator('..').click({ force: true });
  await expect(page.getByText('Task completed', { exact: true })).toBeVisible();
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
  await targetPickerDialog.getByText(TARGET, { exact: true }).click({ force: true });
  await targetPickerDialog
    .getByText('Use existing task', { exact: true })
    .locator('..')
    .click({ force: true });

  await page.getByText('Complete target task', { exact: true }).click({ force: true });
  await submitTodoModal(page);
}

defineJourney({
  persona: 'P3 — Priya, the Power User',
  goal: 'one linked action fires exactly once; the execution row exists; re-fire is suppressed; a deleted target skips with target_missing',
  risks: ['R4'],
  steps: [
    {
      // No `fixture` in the declaration: this journey builds its own rows through
      // the real UI so the source/target/rule ids are known to the oracles.
      name: 'setup: reset, boot, create source + target todos, author the linked rule',
      run: async ({ page }) => {
        await resetAll(page);
        await returnToApp(page);
        await switchSection(page, 'todos');

        // Target first: the rule editor's picker only lists pending tasks.
        await openNewTodoModal(page);
        await page.getByPlaceholder(/Add a task/i).fill(TARGET);
        await submitTodoModal(page);
        await expect(page.getByText(TARGET, { exact: true }).first()).toBeVisible();

        await openNewTodoModal(page);
        await page.getByPlaceholder(/Add a task/i).fill(SOURCE);
        await authorSourceRule(page);
        await expect(page.getByText(SOURCE, { exact: true }).first()).toBeVisible();

        await expectQueueCounts(page, 2, 0);
      },
    },
    {
      name: 'complete the source: target completes exactly once, notice appears, execution row exists',
      run: async ({ page }) => {
        await toggleTodo(page, SOURCE);

        // The target changed through the linked action (notice) and the app
        // reflects BOTH completed todos.
        await expect(page.getByText(/Linked Actions updated/)).toBeVisible();
        await expectQueueCounts(page, 0, 2);
        await page.getByRole('button', { name: 'Dismiss notice' }).click({ force: true });

        // Row-level oracle: exactly one execution, applied, with a persisted
        // notice payload and a source event of the right trigger/day.
        await expectRows(page, executionsSql(), (rows) => {
          expect(rows).toHaveLength(1);
          expect(rows[0]).toMatchObject({
            rule_status: 'active',
            status: 'applied',
            effect_type: 'todo.complete',
          });
          expect(rows[0].notice_payload).not.toBeNull();
        });
        await expectRows(
          page,
          `SELECT ev.trigger_type, ev.source_entity_id, ev.source_label
           FROM linked_action_events ev
           WHERE ev.source_entity_id = (SELECT id FROM todos WHERE title = '${SOURCE}')`,
          (rows) => {
            expect(rows).toHaveLength(1);
            expect(rows[0].trigger_type).toBe('todo.completed');
            expect(rows[0].source_label).toBe(SOURCE);
          },
        );
        await expectRows(
          page,
          `SELECT id, completed, deleted_at FROM todos WHERE title = '${TARGET}'`,
          (rows) => {
            expect(rows).toHaveLength(1);
            expect(rows[0].completed).toBe(1);
            expect(rows[0].deleted_at).toBeNull();
          },
        );
        await returnToApp(page);
      },
    },
    {
      name: 're-fire (untick then tick) does not double-apply the target effect',
      run: async ({ page }) => {
        await switchSection(page, 'todos');
        // Sync on the queue counts: the todo list is loaded (A + B completed).
        await expectQueueCounts(page, 0, 2);
        await ensureCompletedShown(page);

        await toggleTodo(page, SOURCE); // untick -> pending
        await expectQueueCounts(page, 1, 1);

        await toggleTodo(page, SOURCE); // tick again -> engine re-fires
        await expectQueueCounts(page, 0, 2);

        // The re-fire ran but the effect did NOT apply again: a second,
        // 'skipped' execution (target already completed); still exactly one
        // 'applied'. The target row is unchanged.
        await expectRows(page, executionsSql(), (rows) => {
          expect(rows.map((r) => r.status)).toEqual(['applied', 'skipped']);
          expect(rows[1].notice_payload).toBeNull();
        });
        await expectRows(
          page,
          `SELECT completed, deleted_at FROM todos WHERE title = '${TARGET}'`,
          (rows) => {
            expect(rows).toHaveLength(1);
            expect(rows[0].completed).toBe(1);
            expect(rows[0].deleted_at).toBeNull();
          },
        );
        await returnToApp(page);
      },
    },
    {
      name: 'deleting the target makes the next re-fire skip with target_missing',
      run: async ({ page }) => {
        // We are in DB context from the previous step's row oracle: soft-delete
        // the target directly (the UI delete would also remove the rule).
        await runSql(
          page,
          `UPDATE todos SET deleted_at = datetime('now') WHERE title = '${TARGET}'`,
        );
        await returnToApp(page);
        await switchSection(page, 'todos');

        await expectQueueCounts(page, 0, 1); // only the source remains, completed
        await ensureCompletedShown(page);

        await toggleTodo(page, SOURCE); // untick -> pending
        await expectQueueCounts(page, 1, 0);

        await toggleTodo(page, SOURCE); // tick again -> rule still active, target gone
        await expectQueueCounts(page, 0, 1);

        // The deleted target is gone from the app's list (soft-delete filter).
        await expect(page.getByText(TARGET, { exact: true })).toHaveCount(0);

        // Row-level oracle: a third execution, again 'skipped' (target_missing
        // — the effect's first guard before any already_completed check), and
        // no second 'applied' ever appears. The rule survives, the target is
        // soft-deleted.
        await expectRows(page, executionsSql(), (rows) => {
          expect(rows.map((r) => r.status)).toEqual(['applied', 'skipped', 'skipped']);
        });
        await expectRows(page, `SELECT deleted_at FROM todos WHERE title = '${TARGET}'`, (rows) => {
          expect(rows).toHaveLength(1); // soft-deleted row still exists
          expect(rows[0].deleted_at).not.toBeNull();
        });
        await expectRows(
          page,
          `SELECT status, deleted_at FROM linked_action_rules
           WHERE source_entity_id = (SELECT id FROM todos WHERE title = '${SOURCE}')`,
          (rows) => {
            expect(rows).toHaveLength(1);
            expect(rows[0].status).toBe('active');
            expect(rows[0].deleted_at).toBeNull();
          },
        );
      },
    },
  ],
});
