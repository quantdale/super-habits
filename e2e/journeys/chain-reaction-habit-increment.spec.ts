import { expect, type Page } from '@playwright/test';
import { defineJourney } from '../helpers/journey';
import { expectRows, switchSection } from '../helpers/oracles';
import { resetAll } from '../helpers/reset';
import { returnToApp } from '../helpers/dbHarness';
import { openNewTodoModal, submitTodoModal } from '../helpers/navigation';

/**
 * Linked Actions P0 regression: a todo.completed → habit.increment rule may
 * fire once per source/day, even when untick → tick creates fresh event and
 * chain ids. The rule is authored through the real todo editor and all
 * correctness assertions use SQLite row oracles.
 */

const SOURCE = 'Finish the daily report';
const TARGET = 'Drink water';

function executionsSql(): string {
  return `
    SELECT e.status, e.effect_type
    FROM linked_action_executions e
    JOIN linked_action_rules r ON r.id = e.rule_id
    WHERE r.source_entity_id = (SELECT id FROM todos WHERE title = '${SOURCE}')
    ORDER BY e.created_at ASC`;
}

async function toggleTodo(page: Page, title: string): Promise<void> {
  const row = page
    .getByText(title, { exact: true })
    .locator('xpath=ancestor::*[.//*[@role="button"]][1]');
  await row.getByRole('button').first().click({ force: true });
}

async function ensureCompletedShown(page: Page): Promise<void> {
  const show = page.getByText(/^Show completed/);
  await expect(show)
    .toBeVisible({ timeout: 15_000 })
    .catch(() => {
      // The completed section is already visible when there is no toggle.
    });
  if ((await show.count()) > 0) {
    await show.click({ force: true });
    await expect(page.getByText(/^Hide completed/)).toBeVisible();
  }
}

async function createTargetHabit(page: Page): Promise<void> {
  await switchSection(page, 'habits');
  await expect(page.getByText('ANYTIME').first()).toBeVisible({ timeout: 15_000 });
  await page
    .getByLabel('Habit groups')
    .getByText('Add', { exact: true })
    .first()
    .locator('..')
    .click({ force: true });
  await page.getByLabel('Habit name').fill(TARGET);
  await page.getByText('Create habit', { exact: true }).locator('..').click({ force: true });
  await expect(page.getByText(TARGET, { exact: true }).first()).toBeVisible();
}

async function authorIncrementRule(page: Page): Promise<void> {
  await openNewTodoModal(page);
  await page.getByPlaceholder(/Add a task/i).fill(SOURCE);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Add linked action', exact: true })
    .click({ force: true });
  await expect(page.getByText('Task completed', { exact: true })).toBeVisible();
  await page.getByText('Task completed', { exact: true }).click({ force: true });

  const editorDialog = page.getByRole('dialog');
  await editorDialog.getByText('Habits', { exact: true }).click({ force: true });
  await editorDialog
    .getByText('Choose target item', { exact: true })
    .locator('..')
    .click({ force: true });

  const targetPickerDialog = page
    .getByRole('dialog')
    .filter({ hasText: 'Linked Actions target picker' });
  await targetPickerDialog.getByText(TARGET, { exact: true }).click({ force: true });
  await targetPickerDialog
    .getByText('Use existing habit', { exact: true })
    .locator('..')
    .click({ force: true });

  await page.getByText('Increment target habit', { exact: true }).click({ force: true });
  await submitTodoModal(page);
}

defineJourney({
  persona: 'P3 — Priya, the Power User',
  goal: 'habit increment linked action fires once per source completion day',
  risks: ['R4'],
  steps: [
    {
      name: 'setup: reset, create target habit, and author the increment rule',
      run: async ({ page }) => {
        await resetAll(page);
        await returnToApp(page);
        await createTargetHabit(page);
        await switchSection(page, 'todos');
        await authorIncrementRule(page);
        await expect(page.getByText(SOURCE, { exact: true }).first()).toBeVisible();
      },
    },
    {
      name: 'complete source: target habit increments exactly once',
      run: async ({ page }) => {
        await toggleTodo(page, SOURCE);
        await expect(page.getByText(/Linked Actions updated/)).toBeVisible();
        await expectRows(page, executionsSql(), (rows) => {
          expect(rows).toEqual([{ status: 'applied', effect_type: 'habit.increment' }]);
        });
        await expectRows(
          page,
          `SELECT count FROM habit_completions WHERE habit_id = (SELECT id FROM habits WHERE name = '${TARGET}')`,
          (rows) => {
            expect(rows).toEqual([{ count: 1 }]);
          },
        );
        await returnToApp(page);
      },
    },
    {
      name: 'untick then tick: fresh source identity does not increment again',
      run: async ({ page }) => {
        await switchSection(page, 'todos');
        await ensureCompletedShown(page);
        await toggleTodo(page, SOURCE);
        await toggleTodo(page, SOURCE);

        // The duplicate result is intentionally not persisted as a second
        // execution row; the existing applied execution and one completion
        // prove that the non-idempotent effect ran once.
        await expectRows(page, executionsSql(), (rows) => {
          expect(rows).toEqual([{ status: 'applied', effect_type: 'habit.increment' }]);
        });
        await expectRows(
          page,
          `SELECT COUNT(*) AS count FROM linked_action_events WHERE source_entity_id = (SELECT id FROM todos WHERE title = '${SOURCE}')`,
          (rows) => {
            expect(rows).toEqual([{ count: 2 }]);
          },
        );
        await expectRows(
          page,
          `SELECT count FROM habit_completions WHERE habit_id = (SELECT id FROM habits WHERE name = '${TARGET}')`,
          (rows) => {
            expect(rows).toEqual([{ count: 1 }]);
          },
        );
      },
    },
  ],
});
