import { expect, type Page } from '@playwright/test';
import { defineJourney } from '../helpers/journey';
import { expectRows, switchSection } from '../helpers/oracles';
import { resetAll } from '../helpers/reset';
import { APP_BASE_URL, returnToApp } from '../helpers/dbHarness';
import { openNewTodoModal, submitTodoModal } from '../helpers/navigation';

/**
 * J9 — "Two tabs" (task 4.9, P4 — Sam, the Error-Prone User).
 *
 * SuperHabits is a PWA on an offline-first stack: the web build stores its
 * SQLite database in OPFS, which grants ONE writer per origin storage
 * partition. Opening the app in a second tab on the same device must therefore
 * surface the intentional bootstrap gate ("Unable to start" + the actionable
 * "close other SuperHabits tabs" message) — never a blank screen, a console-only
 * error, or a silently broken UI — and the first tab must stay healthy and
 * writable once the second tab closes.
 *
 * The shared storage partition is the crux: two pages in the SAME browser
 * context share OPFS (verified empirically with a probe), while a SECOND
 * context gets its own partition and loads cleanly. That contrast is asserted
 * explicitly: it proves the second-tab failure is the single-writer lock, not
 * a broken export.
 */

const FIRST_NOTE = 'Tab one first note';
const SECOND_NOTE = 'Tab one second note';

async function addTodoViaUi(page: Page, title: string): Promise<void> {
  await openNewTodoModal(page);
  await page.getByPlaceholder(/Add a task/i).fill(title);
  await submitTodoModal(page);
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
}

defineJourney({
  persona: 'P4 — Sam, the Error-Prone User',
  goal: 'a second tab surfaces the actionable bootstrap error, never a blank screen, and the first tab stays healthy and writable',
  risks: ['R10'],
  steps: [
    {
      name: 'tab one: reset, boot, and write a todo',
      run: async ({ page }) => {
        await resetAll(page);
        await returnToApp(page);
        await switchSection(page, 'todos');
        await addTodoViaUi(page, FIRST_NOTE);
      },
    },
    {
      name: 'tab two (same origin, same partition): the actionable bootstrap gate, not a blank screen',
      run: async ({ page }) => {
        // A second PAGE in the SAME context shares the origin's OPFS partition
        // with the first tab — this is the "another tab" a PWA user opens.
        const second = await page.context().newPage();
        await second.goto(`${APP_BASE_URL}/`, { waitUntil: 'domcontentloaded' });

        // The intentional gate title — its presence proves the page is not
        // blank and the failure was handled, not swallowed.
        await expect(second.getByText('Unable to start', { exact: true })).toBeVisible({
          timeout: 60_000,
        });
        // The actionable copy (exact web message from getDbBootstrapErrorMessage).
        await expect(second.getByText(/could not start its local database/i)).toBeVisible();
        await expect(second.getByText(/close other SuperHabits tabs/i)).toBeVisible();
        await expect(second.getByText(/Your data is still safe on this device/i)).toBeVisible();
        // The app shell is gated away — nothing silently half-renders.
        await expect(second.getByRole('button', { name: 'Today', exact: true })).toHaveCount(0);
        await expect(second.getByRole('button', { name: 'To Do', exact: true })).toHaveCount(0);
      },
    },
    {
      name: 'contrast: a fresh context on the same origin loads cleanly (the lock, not the build, blocks tab two)',
      run: async ({ page }) => {
        const browser = page.context().browser();
        expect(browser).not.toBeNull();
        const freshContext = await browser!.newContext();
        try {
          const fresh = await freshContext.newPage();
          await fresh.goto(`${APP_BASE_URL}/`, { waitUntil: 'domcontentloaded' });
          // Separate partition -> no lock contention: the app boots normally.
          await expect(fresh.getByRole('button', { name: 'Today', exact: true })).toBeVisible({
            timeout: 60_000,
          });
          await expect(fresh.getByText('Unable to start', { exact: true })).toHaveCount(0);
        } finally {
          await freshContext.close();
        }
      },
    },
    {
      name: 'closing tab two leaves tab one healthy and writable',
      run: async ({ page }) => {
        // Close the second tab (created in a previous step, same context).
        const pages = page.context().pages();
        for (const p of pages) {
          if (p !== page) {
            await p.close();
          }
        }
        // The first tab still shows its data and can be written to.
        await switchSection(page, 'todos');
        await expect(page.getByText(FIRST_NOTE, { exact: true }).first()).toBeVisible();
        await addTodoViaUi(page, SECOND_NOTE);

        // Row-level oracle: both writes persisted, exactly one per todo.
        await expectRows(
          page,
          `SELECT title FROM todos WHERE deleted_at IS NULL ORDER BY created_at ASC`,
          (rows) => {
            expect(rows.map((r) => r.title)).toEqual([FIRST_NOTE, SECOND_NOTE]);
          },
        );
        await expectRows(
          page,
          'SELECT COUNT(*) AS n FROM todos WHERE deleted_at IS NULL',
          (rows) => {
            expect(Number(rows[0]?.n ?? 0)).toBe(2);
          },
        );
      },
    },
  ],
});
