import { test, expect } from './fixtures';
import { clearDatabase } from './helpers/db';
import { runSql } from './helpers/dbHarness';
import { goToTab } from './helpers/navigation';

test.beforeEach(async ({ page }) => {
  await goToTab(page, 'workout');
  await clearDatabase(page);
});

test('exercise progress includes both recorded names of a renamed custom exercise', async ({
  page,
}) => {
  // Two sessions selected the same custom exercise from the library, before
  // and after renaming it. The session snapshots intentionally retain both names.
  await runSql(
    page,
    `INSERT INTO custom_exercises
       (id, name, primary_area, secondary_areas, modality, created_at, updated_at)
     VALUES ('cex_1', 'Cable Curl', 'arms', '[]', 'weighted_strength',
             '2026-10-17T09:00:00.000Z', '2026-10-18T09:00:00.000Z');
     INSERT INTO workout_routines (id, name, created_at, updated_at)
     VALUES ('wrk_1', 'Workout', '2026-10-17T09:00:00.000Z', '2026-10-17T09:00:00.000Z');
     INSERT INTO workout_logs (id, routine_id, completed_at, created_at)
     VALUES
       ('wrk_2', 'wrk_1', '2026-10-17T09:00:00.000Z', '2026-10-17T09:00:00.000Z'),
       ('wrk_3', 'wrk_1', '2026-10-18T09:00:00.000Z', '2026-10-18T09:00:00.000Z');
     INSERT INTO workout_session_exercises
       (id, log_id, exercise_name, sets_completed, catalog_exercise_id, modality, created_at)
     VALUES
       ('wsex_1', 'wrk_2', 'Cable Biceps Curl', 1, 'cex_1', 'weighted_strength', '2026-10-17T09:00:00.000Z'),
       ('wsex_2', 'wrk_3', 'Cable Curl', 1, 'cex_1', 'weighted_strength', '2026-10-18T09:00:00.000Z');
     INSERT INTO workout_session_sets
       (id, session_exercise_id, set_number, weight, weight_unit, reps, completed, created_at)
     VALUES
       ('sset_1', 'wsex_1', 1, 15, 'kg', 8, 1, '2026-10-17T09:00:00.000Z'),
       ('sset_2', 'wsex_2', 1, 20, 'kg', 8, 1, '2026-10-18T09:00:00.000Z');`,
  );
  await goToTab(page, 'workout');
  await page.getByRole('button', { name: 'History and insights' }).click();
  await page.getByRole('button', { name: 'Cable Curl', exact: true }).click();
  await expect(page.getByText(/2 sessions · 2 performed sets/)).toBeVisible();
  await expect(page.getByText(/Set 1 · 15 × 8/)).toBeVisible();
  await expect(page.getByText(/Set 1 · 20 × 8/)).toBeVisible();
});
