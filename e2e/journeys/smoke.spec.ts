import { expect } from '@playwright/test';
import { defineJourney } from '../helpers/journey';
import { expectRows, switchSection } from '../helpers/oracles';
import { returnToApp } from '../helpers/dbHarness';

/**
 * Harness smoke journey — proves the journeys project + the whole shared
 * harness (reset, seed, app interaction, row oracle) work end to end. It is
 * the placeholder that keeps the `journeys` project non-empty; the real
 * journeys (J1–J10) are written by other agents on top of these helpers.
 */
defineJourney({
  persona: 'HARNESS — smoke',
  goal: 'reset → seed TYPICAL → add a todo → assert the row + UI',
  fixture: 'TYPICAL',
  tags: ['@smoke'],
  risks: ['R1', 'R5'],
  steps: [
    {
      name: 'reset and seed TYPICAL, then assert seeded rows exist',
      run: async ({ page }) => {
        // The declaration's `fixture: 'TYPICAL'` already reset+seeded before
        // this step. Assert the seeded data is actually reachable.
        await expectRows(
          page,
          'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL',
          (rows) => {
            const n = Number(rows[0]?.n ?? 0);
            expect(n).toBeGreaterThan(0);
          },
        );
      },
    },
    {
      name: 'app shows the Todos tab and an empty-related UI state',
      run: async ({ page }) => {
        await returnToApp(page);
        await switchSection(page, 'todos');
        await expect(page.getByRole('button', { name: 'Add task' }).last()).toBeVisible();
      },
    },
    {
      name: 'add a todo through the UI and assert it persists as a row',
      run: async ({ page }) => {
        await switchSection(page, 'todos');
        await page.getByRole('button', { name: 'Add task' }).last().click();
        await page.getByPlaceholder(/Add a task/i).fill('Smoke journey todo');
        await page.getByText('Add task', { exact: true }).locator('..').click({ force: true });
        await expect(page.getByText('Smoke journey todo').first()).toBeVisible();
        await expectRows(
          page,
          "SELECT title FROM todos WHERE title = 'Smoke journey todo' AND deleted_at IS NULL",
          (rows) => {
            expect(rows).toHaveLength(1);
          },
        );
      },
    },
  ],
});
