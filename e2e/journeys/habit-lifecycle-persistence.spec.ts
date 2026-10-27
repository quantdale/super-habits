import { expect, type Page } from '@playwright/test';
import { defineJourney } from '../helpers/journey';
import { expectRows } from '../helpers/oracles';
import { ensureAppContext, returnToApp, runSql } from '../helpers/dbHarness';

/**
 * "Habit lifecycle writes are user-visible" (P2, Priya the Power User)
 *
 * Pause/Archive/Resume/Restore are fired by the habit detail modal on top of
 * SQLite writes. An earlier state silently failed: the handler's promise was
 * discarded (`void`), any thrown write vanished, AND the modal closed
 * unconditionally — so a failed pause looked exactly like a successful one.
 *
 * This journey pins the repaired contract:
 *  - a successful lifecycle write closes the modal and persists (status +
 *    lifecycle_history row oracle);
 *  - a FAILED write keeps the detail modal open and renders an inline alert
 *    (no silent no-op) — forced with the established RAISE(ABORT) trigger
 *    pattern (see habits-w7-audit.spec.ts), once for pause/resume and once
 *    for archive restore inside a single app session;
 *  - after the injected failure is removed, retrying both writes from a fresh
 *    detail session persists and closes the modal.
 *
 * Every mutating step asserts the actual persisted row, not only rendered
 * text. DB-context handoffs (which destroy the app page) are minimized to the
 * trigger install + drop.
 */

const HABIT_WHERE = "name LIKE 'Habit 1%' AND deleted_at IS NULL";
const FAIL_TRIGGER = 'habit_lifecycle_write_fail';

async function dismissStartupRestorePromptIfPresent(page: Page) {
  const dismissButton = page.getByText('Not now', { exact: true });
  if (await dismissButton.isVisible().catch(() => false)) {
    await dismissButton.click();
  }
}

async function installLifecycleFailTrigger(page: Page) {
  await runSql(
    page,
    `CREATE TRIGGER ${FAIL_TRIGGER} BEFORE UPDATE ON habits
     WHEN new.name LIKE 'Habit 1%'
     BEGIN SELECT RAISE(ABORT, 'intentional lifecycle failure'); END;`,
  );
}

async function dropLifecycleFailTrigger(page: Page) {
  await runSql(page, `DROP TRIGGER IF EXISTS ${FAIL_TRIGGER};`);
}

/** The app always re-lands on Today after a harness round-trip. */
async function openHabitDetailSettings(page: Page) {
  await page.getByRole('tab', { name: 'Habits', exact: true }).first().click();
  // A paused/archived habit is hidden by the default Active filter; switch
  // the status filter to All before looking for the row (established pattern
  // from habits-w7-audit.spec.ts).
  await page.getByRole('button', { name: 'Filter and sort', exact: true }).click();
  await page.getByRole('tab', { name: 'Filter habits: All', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Open Habit 1 — ☕ details', exact: true }).click();
  await page.getByRole('tab', { name: 'Settings', exact: true }).click();
}

defineJourney({
  persona: 'P2 — Priya, the Power User',
  goal: 'habit pause/archive writes are user-visible and persist or fail loudly',
  fixture: 'SMALL',
  risks: ['R6'],
  steps: [
    {
      name: 'reset and seed SMALL; the seeded habit is active',
      run: async ({ page }) => {
        await ensureAppContext(page);
        await expectRows(
          page,
          `SELECT COUNT(*) AS n, MIN(status) AS status FROM habits WHERE ${HABIT_WHERE}`,
          (rows) => {
            expect(Number(rows[0]?.n ?? 0)).toBe(1);
            expect(rows[0]?.status).toBe('active');
          },
        );
        await returnToApp(page);
        await dismissStartupRestorePromptIfPresent(page);
        await openHabitDetailSettings(page);
        await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
      },
    },
    {
      name: 'pausing from the detail modal closes it after the write and persists active→paused',
      run: async ({ page }) => {
        await expect(page.getByRole('button', { name: 'Edit habit' })).toBeVisible();
        await page.getByRole('button', { name: 'Pause', exact: true }).click();
        // The modal closes only once the write returned; a silent failure used
        // to close it anyway — the row oracle below proves the write landed.
        await expect(page.getByRole('button', { name: 'Edit habit' })).toBeHidden();
        await expectRows(
          page,
          `SELECT status, lifecycle_history FROM habits WHERE ${HABIT_WHERE}`,
          (rows) => {
            expect(rows[0]?.status).toBe('paused');
            expect(rows[0]?.lifecycle_history).not.toBeNull();
          },
        );
        await returnToApp(page);
      },
    },
    {
      name: 'injected write failure keeps the modal open with an inline alert (resume and archive)',
      run: async ({ page }) => {
        await ensureAppContext(page);
        await installLifecycleFailTrigger(page);
        await returnToApp(page);
        await dismissStartupRestorePromptIfPresent(page);
        // Resume against the trigger: loud failure, still-open modal.
        await openHabitDetailSettings(page);
        await page.getByRole('button', { name: 'Resume', exact: true }).click();
        await expect(page.getByText('The pause change did not save. Try again.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Edit habit' })).toBeVisible();
        // Same session, archive against the trigger: its own alert, modal open.
        await page.getByRole('button', { name: 'Archive', exact: true }).click();
        await expect(page.getByText('The lifecycle change did not save. Try again.')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Edit habit' })).toBeVisible();
        // Let the in-worker failed transaction fully unwind before the page is
        // destroyed (OPFS handle quiescence; see the harness retry comment).
        await page.waitForTimeout(2000);
      },
    },
    {
      name: 'once the injected failure is removed, resume and archive retry cleanly and persist',
      run: async ({ page }) => {
        await dropLifecycleFailTrigger(page);
        await returnToApp(page);
        // Give the freshly booted app worker a beat to reclaim OPFS handles.
        await page.waitForTimeout(2000);
        await dismissStartupRestorePromptIfPresent(page);
        await openHabitDetailSettings(page);
        await page.getByRole('button', { name: 'Resume', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Edit habit' })).toBeHidden();
        await expectRows(page, `SELECT status FROM habits WHERE ${HABIT_WHERE}`, (rows) => {
          expect(rows[0]?.status).toBe('active');
        });
        await returnToApp(page);
        await openHabitDetailSettings(page);
        await page.getByRole('button', { name: 'Archive', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Edit habit' })).toBeHidden();
        await expectRows(page, `SELECT status FROM habits WHERE ${HABIT_WHERE}`, (rows) => {
          expect(rows[0]?.status).toBe('archived');
        });
        await returnToApp(page);
      },
    },
  ],
});
