import { test, expect } from '../e2e/fixtures';
import { goToTab } from '../e2e/helpers/navigation';
import { clearDatabase } from '../e2e/helpers/db';
import { queryRows, returnToApp, runSql } from '../e2e/helpers/dbHarness';

/**
 * Workout draft reload lead 2: a rest-timer adjustment must be checkpointed.
 *
 * The guided session's only durable record is `app_meta.workout.active_session_draft`.
 * It is written on Start, on measurement edits (debounced), and on every phase
 * transition — but NOT on a rest adjustment, which used to exist only in React
 * state. A reload (or a background kill) right after tapping "Add 15 seconds of
 * rest" therefore restored the PRESCRIBED rest length: the user's deliberate
 * extension silently vanished while the set it applied to stayed completed.
 *
 * The assertion is a row-level oracle plus the user-visible recovery: the draft
 * must already carry the adjusted remaining time when the interruption lands,
 * and a resumed session must show the extended rest.
 *
 * Quiescence note: the adjustment write is fired from the tap and is
 * intentionally not awaited on the tap path, so one short settle precedes the
 * DB harness round trip (the same rule the Focus metadata spec documents for
 * queued writes). The defect under test is that the write was never issued at
 * all, which no settle can repair.
 */

const ROUTINE = 'Rest Checkpoint Day';
const REST_SECONDS = 90;

test.describe('Workout rest adjustment durability', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goToTab(page, 'workout');
    await clearDatabase(page);
  });

  test('a rest adjustment is checkpointed before an interruption', async ({ page }) => {
    await runSql(
      page,
      `INSERT INTO workout_routines (id, name, created_at, updated_at, deleted_at)
       VALUES ('wrk_rest_checkpoint', '${ROUTINE}', '2026-10-18T09:00:00.000Z',
               '2026-10-18T09:00:00.000Z', NULL);
       INSERT INTO routine_exercises (id, routine_id, name, sort_order, created_at, updated_at, deleted_at)
       VALUES ('ex_rest_checkpoint', 'wrk_rest_checkpoint', 'Press', 0,
               '2026-10-18T09:00:00.000Z', '2026-10-18T09:00:00.000Z', NULL);
       INSERT INTO routine_exercise_sets
         (id, exercise_id, set_number, active_seconds, rest_seconds, created_at, updated_at, deleted_at)
       VALUES ('eset_rest_checkpoint_1', 'ex_rest_checkpoint', 1, 5, ${REST_SECONDS},
               '2026-10-18T09:00:00.000Z', '2026-10-18T09:00:00.000Z', NULL),
              ('eset_rest_checkpoint_2', 'ex_rest_checkpoint', 2, 5, ${REST_SECONDS},
               '2026-10-18T09:00:00.000Z', '2026-10-18T09:00:00.000Z', NULL);`,
    );
    await returnToApp(page);
    await goToTab(page, 'workout');
    await page.getByRole('button', { name: `Open ${ROUTINE} routine` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Start workout' }).click();

    // Entering the rest phase checkpoints the prescribed 1:30 rest.
    await page.getByRole('button', { name: 'Complete set 1' }).click();
    await expect(page.getByText('Rest', { exact: true })).toBeVisible();
    await expect(page.getByText('1:30', { exact: true })).toBeVisible();

    // The adjustment is user-authored session state: two steps extend it to 2:00.
    await page.getByRole('button', { name: 'Add 15 seconds of rest' }).click();
    await page.getByRole('button', { name: 'Add 15 seconds of rest' }).click();
    await expect(page.getByText('2:00', { exact: true })).toBeVisible();

    // Quiescence for the queued checkpoint write, then the durable oracle (this
    // read navigates away, i.e. it IS the interruption).
    await page.waitForTimeout(750);
    const drafts = await queryRows(
      page,
      `SELECT value FROM app_meta WHERE key = 'workout.active_session_draft'`,
    );
    expect(drafts).toHaveLength(1);
    const draft = JSON.parse(String(drafts[0]?.value)) as { remainingSeconds?: number };
    // Before the fix this stayed at the prescribed 90: the extension was never
    // written, so the reload silently restored 1:30.
    expect(draft.remainingSeconds).toBe(REST_SECONDS + 30);

    // And the user-visible consequence: the resumed session keeps the extension.
    await returnToApp(page);
    await goToTab(page, 'workout');
    await page.getByRole('button', { name: `Resume workout · ${ROUTINE}` }).click();
    await expect(page.getByText('Rest', { exact: true })).toBeVisible();
    await expect(page.getByText('2:00', { exact: true })).toBeVisible();
  });
});
