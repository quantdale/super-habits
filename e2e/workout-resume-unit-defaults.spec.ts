import { test, expect } from '../e2e/fixtures';
import { goToTab } from '../e2e/helpers/navigation';
import { clearDatabase } from '../e2e/helpers/db';
import { returnToApp, runSql } from '../e2e/helpers/dbHarness';

/**
 * A resumed draft keeps the weight unit its values were typed in (#286), so the
 * history defaults seeded into its NOT-yet-entered sets must use that unit too.
 *
 * Scenario: a kg session is started, then the weight preference changes to lb
 * while the session sits as a draft. On resume the screen still labels and
 * saves weights in kg, so a previous 100 kg set must seed "100" — not the lb
 * conversion (~220.5), which accepting the default would log as 220.5 kg.
 */

const ROUTINE = 'Unit Resume Day';

test.describe('Workout resume weight-unit defaults', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goToTab(page, 'workout');
    await clearDatabase(page);
  });

  test('a resumed kg draft seeds history defaults in kg after the preference became lb', async ({
    page,
  }) => {
    await runSql(
      page,
      `INSERT INTO workout_routines (id, name, created_at, updated_at, deleted_at)
       VALUES ('wrk_unit_resume', '${ROUTINE}', '2026-10-18T09:00:00.000Z',
               '2026-10-18T09:00:00.000Z', NULL);
       INSERT INTO routine_exercises
         (id, routine_id, name, sort_order, modality, created_at, updated_at, deleted_at)
       VALUES ('ex_unit_resume', 'wrk_unit_resume', 'Press', 0, 'weighted_strength',
               '2026-10-18T09:00:00.000Z', '2026-10-18T09:00:00.000Z', NULL);
       INSERT INTO routine_exercise_sets
         (id, exercise_id, set_number, active_seconds, rest_seconds, created_at, updated_at, deleted_at)
       VALUES ('eset_unit_resume_1', 'ex_unit_resume', 1, 30, 60,
               '2026-10-18T09:00:00.000Z', '2026-10-18T09:00:00.000Z', NULL),
              ('eset_unit_resume_2', 'ex_unit_resume', 2, 30, 60,
               '2026-10-18T09:00:00.000Z', '2026-10-18T09:00:00.000Z', NULL);
       INSERT INTO workout_logs (id, routine_id, completed_at, created_at)
       VALUES ('wlog_unit_resume', 'wrk_unit_resume', '2026-10-18T09:30:00.000Z',
               '2026-10-18T09:30:00.000Z');
       INSERT INTO workout_session_exercises
         (id, log_id, exercise_name, sets_completed, modality, created_at)
       VALUES ('wsex_unit_resume', 'wlog_unit_resume', 'Press', 2, 'weighted_strength',
               '2026-10-18T09:30:00.000Z');
       INSERT INTO workout_session_sets
         (id, session_exercise_id, set_number, weight, weight_unit, reps, completed, created_at)
       VALUES ('sset_unit_resume_1', 'wsex_unit_resume', 1, 100, 'kg', 8, 1, '2026-10-18T09:30:00.000Z'),
              ('sset_unit_resume_2', 'wsex_unit_resume', 2, 100, 'kg', 8, 1, '2026-10-18T09:30:00.000Z');`,
    );
    await returnToApp(page);
    await goToTab(page, 'workout');
    await page.getByRole('button', { name: `Open ${ROUTINE} routine` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Start workout' }).click();

    // A kg session (no preference yet): set 1 is seeded from the 100 kg history.
    await expect(page.getByRole('textbox', { name: 'Weight' })).toHaveValue('100');
    await page.getByRole('button', { name: 'Complete set 1' }).click();
    await expect(page.getByText('Rest', { exact: true })).toBeVisible();

    // The preference flips to lb while the session sits as a draft (this write
    // navigates away, i.e. it IS the interruption).
    await page.waitForTimeout(750);
    await runSql(
      page,
      `INSERT OR REPLACE INTO app_meta (key, value)
       VALUES ('workout_preferences', '{"effortScale":"off","goalWeight":{"value":165,"unit":"lb"},"workoutReminder":null}');`,
    );
    await returnToApp(page);
    await goToTab(page, 'workout');
    await page.getByRole('button', { name: `Resume workout · ${ROUTINE}` }).click();
    await expect(page.getByText('Rest', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Skip rest' }).click();

    // Set 2 was never entered: its default comes from history, in the session's kg.
    await expect(page.getByRole('textbox', { name: 'Weight' })).toHaveValue('100');
  });
});
