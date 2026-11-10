import { test, expect, type Page } from './fixtures';
import { goToTab } from './helpers/navigation';
import { clearDatabase } from './helpers/db';
import { queryRows, returnToApp, runSql } from './helpers/dbHarness';
import { fillRoutineName } from './helpers/forms';
import { seedSql } from './helpers/seed';
import { clickSwipeDeleteAction, swipeLeftRevealWorkoutRoutineRow } from './helpers/gestures';

/**
 * Tier-2 silent-write honesty: the Workout surface (part 4).
 *
 * Every user-initiated write on this feature is pinned at the REAL SQLite
 * boundary, per site:
 *
 *  a. a rejected write is VISIBLE (`accessibilityRole="alert"` on the surface
 *     the user acted from — the landing, the open sheet/modal, or the card
 *     that owns the row), and it never closes/dismisses as if it saved;
 *  b. the UI keeps the PRE-TAP state and the durable rows agree (no tombstone,
 *     no log, no plan row, no override, no outbox intent);
 *  c. once the injected failure is removed, retrying the same action from the
 *     UI commits exactly once.
 *
 * Failure injection uses the established real-SQLite technique
 * (`RAISE(ABORT)` trigger installed through `e2e/helpers/dbHarness.ts`, as in
 * `habits-w7*.spec.ts`, `todos-write-failure.spec.ts`,
 * `planning-w115-reliability.spec.ts`). `e2e/helpers/failure.ts` only injects
 * at the REMOTE (`*.supabase.co`) boundary, which cannot fail a local OPFS
 * write — the hermetic `dist/` export bundles no Supabase host — so it is
 * deliberately unused here.
 *
 * Harness rule: entering the DB document destroys the app page's React state,
 * so every trigger is installed BEFORE the surface under test is opened and
 * row reads happen only at an interaction boundary.
 */

const ROUTINE_INSERT = 'wf_routine_insert';
const ROUTINE_DELETE = 'wf_routine_delete';
const LOG_INSERT = 'wf_log_insert';
const LOG_DELETE = 'wf_log_delete';
const PLAN_INSERT = 'wf_plan_insert';
const OVERRIDE_INSERT = 'wf_override_insert';
const WEIGHT_DELETE = 'wf_weight_delete';
const EXERCISE_INSERT = 'wf_exercise_insert';
const META_DELETE = 'wf_meta_delete';
const CUSTOM_RENAME = 'wf_custom_rename';
const CUSTOM_ARCHIVE = 'wf_custom_archive';

/** Alert copy the workout handlers pin (see `workoutWriteFailure.ts`). */
const COPY = {
  routineCreate: 'Could not add the routine. Try again.',
  routineDelete: 'Could not remove the routine. Try again.',
  quickLog: 'Could not log the workout. Try again.',
  plan: 'Could not save that day. Try again.',
  moveWorkout: 'Could not move the workout. Try again.',
  exerciseAdd: 'Could not add the exercise. Try again.',
  weightDelete: 'Could not delete that entry. Try again.',
  discard: 'Could not discard that workout. Try again.',
  sessionDelete: 'Could not delete that session. Try again.',
  customEdit: 'Could not save that exercise. Try again.',
  customArchive: 'Could not archive that exercise. Try again.',
} as const;

async function createRoutine(page: Page, name: string): Promise<void> {
  await fillRoutineName(page, name);
  await page.getByText('Add routine', { exact: true }).click();
  await expect(
    page.getByRole('button', { name: `Open ${name} routine`, exact: true }),
  ).toBeVisible();
}

/**
 * Browser-evaluated weekday label (1 = Monday … 7 = Sunday), so a host in
 * another timezone cannot name a different day than the app rendered.
 */
async function weekdayLabel(page: Page): Promise<string> {
  const index = await page.evaluate(() => (new Date().getDay() + 6) % 7);
  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index];
}

/** Browser-local tomorrow as `YYYY-MM-DD`, the value the move dialog defaults to. */
async function tomorrowDateKey(page: Page): Promise<string> {
  return page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  });
}

async function openHistory(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'History and insights' }).click();
}

test.describe('Workout write-failure honesty', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await goToTab(page, 'workout');
    await clearDatabase(page);
    await goToTab(page, 'workout');
  });

  test('a rejected routine create keeps the typed name and reports it, then creates once on retry', async ({
    page,
  }) => {
    // Narrowest supported width: the failure copy must not overflow it.
    await page.setViewportSize({ width: 360, height: 800 });
    await seedSql(
      page,
      `CREATE TRIGGER ${ROUTINE_INSERT}
         BEFORE INSERT ON workout_routines
         BEGIN SELECT RAISE(ABORT, 'routine-create-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'workout');

    await fillRoutineName(page, 'Blocked routine');
    await page.getByText('Add routine', { exact: true }).click();

    // (a) Visible + accessible failure on the form that owns the write.
    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(COPY.routineCreate);
    const box = await alert.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(360);

    // (b) The typed draft survives and nothing was persisted.
    await expect(page.getByRole('textbox', { name: 'New routine name' })).toHaveValue(
      'Blocked routine',
    );
    const afterFailure = await queryRows(
      page,
      `SELECT COUNT(*) AS n FROM workout_routines WHERE deleted_at IS NULL`,
    );
    expect(Number(afterFailure[0]?.n ?? -1)).toBe(0);
    const intentsAfterFailure = await queryRows(
      page,
      `SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'workout_routines'`,
    );
    expect(Number(intentsAfterFailure[0]?.n ?? -1)).toBe(0);

    // (c) Retry with the failure removed creates exactly one routine.
    await seedSql(page, `DROP TRIGGER ${ROUTINE_INSERT};`);
    await returnToApp(page);
    await goToTab(page, 'workout');
    await fillRoutineName(page, 'Blocked routine');
    await page.getByText('Add routine', { exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Open Blocked routine routine', exact: true }),
    ).toBeVisible();

    const afterRetry = await queryRows(
      page,
      `SELECT COUNT(*) AS n FROM workout_routines WHERE deleted_at IS NULL`,
    );
    expect(Number(afterRetry[0]?.n ?? -1)).toBe(1);
    const intentsAfterRetry = await queryRows(
      page,
      `SELECT operation FROM sync_outbox WHERE entity = 'workout_routines'`,
    );
    expect(intentsAfterRetry).toEqual([{ operation: 'create' }]);
    await returnToApp(page);
  });

  test('a rejected routine delete keeps the routine listed and live, then tombstones once on retry', async ({
    page,
  }) => {
    await createRoutine(page, 'Doomed routine');

    await seedSql(
      page,
      `CREATE TRIGGER ${ROUTINE_DELETE}
         BEFORE UPDATE ON workout_routines
         WHEN NEW.deleted_at IS NOT NULL
         BEGIN SELECT RAISE(ABORT, 'routine-delete-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'workout');

    await swipeLeftRevealWorkoutRoutineRow(page);
    await clickSwipeDeleteAction(page, 'Doomed routine');
    await page.getByText('Delete routine', { exact: true }).click({ force: true });

    // (a) The rejection is announced at the surface that owns the row.
    const deleteAlert = page.getByRole('alert');
    await expect(deleteAlert).toBeVisible();
    await expect(deleteAlert).toContainText(COPY.routineDelete);
    // (b) The routine is still a live, reachable row.
    await expect(
      page.getByRole('button', { name: 'Open Doomed routine routine', exact: true }),
    ).toBeVisible();
    const afterFailure = await queryRows(
      page,
      `SELECT deleted_at FROM workout_routines WHERE name = 'Doomed routine'`,
    );
    expect(afterFailure).toEqual([{ deleted_at: null }]);
    const deleteIntentsAfterFailure = await queryRows(
      page,
      `SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'workout_routines' AND operation = 'delete'`,
    );
    expect(Number(deleteIntentsAfterFailure[0]?.n ?? -1)).toBe(0);

    // (c) Retry after the failure is cleared tombstones exactly that row.
    await seedSql(page, `DROP TRIGGER ${ROUTINE_DELETE};`);
    await returnToApp(page);
    await goToTab(page, 'workout');
    await swipeLeftRevealWorkoutRoutineRow(page);
    await clickSwipeDeleteAction(page, 'Doomed routine');
    await page.getByText('Delete routine', { exact: true }).click({ force: true });
    await expect(
      page.getByRole('button', { name: 'Open Doomed routine routine', exact: true }),
    ).toHaveCount(0);

    const afterRetry = await queryRows(
      page,
      `SELECT deleted_at FROM workout_routines WHERE name = 'Doomed routine'`,
    );
    expect(afterRetry).toHaveLength(1);
    expect(afterRetry[0]?.deleted_at).not.toBeNull();
    const intentsAfterRetry = await queryRows(
      page,
      `SELECT operation FROM sync_outbox WHERE entity = 'workout_routines'`,
    );
    expect(intentsAfterRetry).toEqual([{ operation: 'delete' }]);
    await returnToApp(page);
  });

  test('a rejected quick log reports it, leaves today unlogged and earns no reward, then logs once on retry', async ({
    page,
  }) => {
    await createRoutine(page, 'Quick blocked');

    await seedSql(
      page,
      `CREATE TRIGGER ${LOG_INSERT}
         BEFORE INSERT ON workout_logs
         BEGIN SELECT RAISE(ABORT, 'quick-log-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'workout');

    await page.getByText('Complete workout', { exact: true }).first().click();

    // (a) Visible failure. (b) No session is claimed and nothing was written.
    const logAlert = page.getByRole('alert');
    await expect(logAlert).toBeVisible();
    await expect(logAlert).toContainText(COPY.quickLog);
    // The landing's completed-today marker is the visible claim a quick log
    // makes, so it is what must stay absent after a rejection.
    await expect(page.getByText('Logged', { exact: true })).toHaveCount(0);
    const logsAfterFailure = await queryRows(page, `SELECT COUNT(*) AS n FROM workout_logs`);
    expect(Number(logsAfterFailure[0]?.n ?? -1)).toBe(0);
    const rewardsAfterFailure = await queryRows(
      page,
      'SELECT COUNT(*) AS n FROM gamification_events',
    );
    expect(Number(rewardsAfterFailure[0]?.n ?? -1)).toBe(0);

    // (c) The retry commits exactly one log and its one reward.
    await seedSql(page, `DROP TRIGGER ${LOG_INSERT};`);
    await returnToApp(page);
    await goToTab(page, 'workout');
    await page.getByText('Complete workout', { exact: true }).first().click();
    await expect(page.getByText('Logged', { exact: true })).toBeVisible();

    const logsAfterRetry = await queryRows(page, `SELECT COUNT(*) AS n FROM workout_logs`);
    expect(Number(logsAfterRetry[0]?.n ?? -1)).toBe(1);
    const rewardsAfterRetry = await queryRows(
      page,
      'SELECT COUNT(*) AS n FROM gamification_events',
    );
    expect(Number(rewardsAfterRetry[0]?.n ?? -1)).toBe(1);
    await returnToApp(page);
  });

  test('a rejected weekly-plan assignment reports inside the open plan sheet and assigns once on retry', async ({
    page,
  }) => {
    await createRoutine(page, 'Planned routine');
    const todayLabel = await weekdayLabel(page);

    await seedSql(
      page,
      `CREATE TRIGGER ${PLAN_INSERT}
         BEFORE INSERT ON workout_weekly_plan
         BEGIN SELECT RAISE(ABORT, 'plan-write-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'workout');

    await page.getByText('Plan week', { exact: true }).click();
    const plan = page.getByRole('dialog', { name: 'Plan your week' });
    const chip = plan.getByRole('button', {
      name: `${todayLabel} Planned routine`,
      exact: true,
    });
    await chip.click();

    // (a) The failure is announced INSIDE the still-open sheet.
    await expect(plan.getByRole('alert')).toContainText(COPY.plan);
    // (b) The chip does not claim an assignment the database does not hold.
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    expect(
      await queryRows(
        page,
        `SELECT COUNT(*) AS n FROM workout_weekly_plan WHERE deleted_at IS NULL`,
      ),
    ).toEqual([{ n: 0 }]);

    // (c) Retry after the failure is cleared writes exactly one day.
    await seedSql(page, `DROP TRIGGER ${PLAN_INSERT};`);
    await returnToApp(page);
    await goToTab(page, 'workout');
    await page.getByText('Plan week', { exact: true }).click();
    const retried = page.getByRole('dialog', { name: 'Plan your week' });
    const retriedChip = retried.getByRole('button', {
      name: `${todayLabel} Planned routine`,
      exact: true,
    });
    await retriedChip.click();
    await expect(retriedChip).toHaveAttribute('aria-pressed', 'true');

    const planRows = await queryRows(
      page,
      `SELECT plan_kind FROM workout_weekly_plan WHERE deleted_at IS NULL`,
    );
    expect(planRows).toEqual([{ plan_kind: 'workout' }]);
    await returnToApp(page);
  });

  test('a rejected one-day override reports inside the day sheet and applies once on retry', async ({
    page,
  }) => {
    await createRoutine(page, 'Override routine');

    await seedSql(
      page,
      `CREATE TRIGGER ${OVERRIDE_INSERT}
         BEFORE INSERT ON workout_schedule_overrides
         BEGIN SELECT RAISE(ABORT, 'override-write-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'workout');

    await page.getByText('Change today', { exact: true }).click();
    const sheet = page.getByRole('dialog', { name: 'Plan today' });
    await expect(sheet.getByText('Just today', { exact: true })).toBeVisible();
    await sheet.getByRole('button', { name: 'Override routine', exact: true }).click();

    // (a) Visible failure inside the open sheet (the landing copy behind it is
    // unreachable, so it cannot be the surface).
    await expect(sheet.getByRole('alert')).toContainText(COPY.plan);
    // (b) The sheet stays open and usable for a retry — asserted BEFORE the
    // harness round trip, which destroys the app page's React state.
    await expect(sheet.getByText('Just today', { exact: true })).toBeVisible();
    expect(
      await queryRows(
        page,
        `SELECT COUNT(*) AS n FROM workout_schedule_overrides WHERE deleted_at IS NULL`,
      ),
    ).toEqual([{ n: 0 }]);

    // (c) Retry writes exactly one override.
    await seedSql(page, `DROP TRIGGER ${OVERRIDE_INSERT};`);
    await returnToApp(page);
    await goToTab(page, 'workout');
    await page.getByText('Change today', { exact: true }).click();
    const retried = page.getByRole('dialog', { name: 'Plan today' });
    await retried.getByRole('button', { name: 'Override routine', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const overrides = await queryRows(
      page,
      `SELECT override_kind FROM workout_schedule_overrides WHERE deleted_at IS NULL`,
    );
    expect(overrides).toEqual([{ override_kind: 'workout' }]);
    await returnToApp(page);
  });

  test('a rejected "move workout" reports inside the move dialog and moves once on retry', async ({
    page,
  }) => {
    await createRoutine(page, 'Move blocked');
    await page.getByText('Change today', { exact: true }).click();
    const overrideSheet = page.getByRole('dialog', { name: 'Plan today' });
    await overrideSheet.getByRole('button', { name: 'Move blocked', exact: true }).click();
    await expect(page.getByText('Move workout to another day', { exact: true })).toBeVisible();

    await seedSql(
      page,
      `CREATE TRIGGER ${OVERRIDE_INSERT}
         BEFORE INSERT ON workout_schedule_overrides
         BEGIN SELECT RAISE(ABORT, 'move-write-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'workout');
    await page.getByText('Move workout to another day', { exact: true }).click();
    const move = page.getByRole('dialog', { name: 'Move workout' });
    const target = await tomorrowDateKey(page);
    await move.getByRole('textbox', { name: 'New date' }).fill(target);
    await move.getByRole('button', { name: 'Move workout', exact: true }).click();

    // (a) The dialog owns the surface and stays open with its own alert.
    await expect(move.getByRole('alert')).toContainText(COPY.moveWorkout);
    // (b) The move is atomic: the destination leg was rejected, so the SOURCE
    // leg must not have committed either — today still carries the original
    // workout override and no second row was minted.
    expect(
      await queryRows(
        page,
        `SELECT COUNT(*) AS n FROM workout_schedule_overrides WHERE deleted_at IS NULL`,
      ),
    ).toEqual([{ n: 1 }]);
    expect(
      await queryRows(
        page,
        `SELECT override_kind FROM workout_schedule_overrides WHERE deleted_at IS NULL`,
      ),
    ).toEqual([{ override_kind: 'workout' }]);

    // (c) Retry after the failure is cleared moves exactly once (two rows: the
    // vacated day and the destination), and the move dialog closes on success.
    await seedSql(page, `DROP TRIGGER ${OVERRIDE_INSERT};`);
    await returnToApp(page);
    await goToTab(page, 'workout');
    await page.getByText('Move workout to another day', { exact: true }).click();
    const retried = page.getByRole('dialog', { name: 'Move workout' });
    await retried.getByRole('textbox', { name: 'New date' }).fill(target);
    await retried.getByRole('button', { name: 'Move workout', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    const overrides = await queryRows(
      page,
      `SELECT override_kind FROM workout_schedule_overrides WHERE deleted_at IS NULL ORDER BY override_kind`,
    );
    // Two rows now: the vacated source day is rest, the destination is the
    // moved workout. Exactly one move, not a doubled one.
    expect(overrides).toEqual([{ override_kind: 'rest' }, { override_kind: 'workout' }]);
    expect(
      await queryRows(
        page,
        `SELECT COUNT(*) AS n FROM workout_schedule_overrides WHERE deleted_at IS NULL`,
      ),
    ).toEqual([{ n: 2 }]);
    await returnToApp(page);
  });

  test('a rejected library add reports inside the picker and adds once on retry', async ({
    page,
  }) => {
    await createRoutine(page, 'Library blocked');
    await seedSql(
      page,
      `CREATE TRIGGER ${EXERCISE_INSERT}
         BEFORE INSERT ON routine_exercises
         BEGIN SELECT RAISE(ABORT, 'exercise-add-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'workout');
    await page.getByRole('button', { name: 'Open Library blocked routine', exact: true }).click();
    const failingBuilder = page.getByRole('dialog', { name: 'Library blocked' });
    await failingBuilder.getByText('Choose from exercise library', { exact: true }).click();
    const picker = page.getByRole('dialog', { name: 'Exercise library' });
    await picker.getByRole('button', { name: 'Add Barbell Bench Press', exact: true }).click();

    // (a) The picker is the topmost surface, so it must own the alert…
    await expect(picker.getByRole('alert')).toContainText(COPY.exerciseAdd);
    // (b) …and nothing was added to the routine.
    expect(
      await queryRows(page, `SELECT COUNT(*) AS n FROM routine_exercises WHERE deleted_at IS NULL`),
    ).toEqual([{ n: 0 }]);

    // (c) Retry adds exactly one exercise with its default set.
    await seedSql(page, `DROP TRIGGER ${EXERCISE_INSERT};`);
    await returnToApp(page);
    await goToTab(page, 'workout');
    await page.getByRole('button', { name: 'Open Library blocked routine', exact: true }).click();
    const retriedBuilder = page.getByRole('dialog', { name: 'Library blocked' });
    await retriedBuilder.getByText('Choose from exercise library', { exact: true }).click();
    const retriedPicker = page.getByRole('dialog', { name: 'Exercise library' });
    await retriedPicker
      .getByRole('button', { name: 'Add Barbell Bench Press', exact: true })
      .click();
    await expect(retriedBuilder.getByText('Barbell Bench Press', { exact: true })).toBeVisible();

    expect(
      await queryRows(page, `SELECT COUNT(*) AS n FROM routine_exercises WHERE deleted_at IS NULL`),
    ).toEqual([{ n: 1 }]);
    expect(
      await queryRows(
        page,
        `SELECT COUNT(*) AS n FROM routine_exercise_sets WHERE deleted_at IS NULL`,
      ),
    ).toEqual([{ n: 1 }]);
    await returnToApp(page);
  });

  test('a rejected body-weight delete keeps the entry on the card, then deletes once on retry', async ({
    page,
  }) => {
    await openHistory(page);
    await page.getByText('Log weight', { exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Log body weight' });
    await dialog.getByRole('textbox', { name: 'Weight', exact: true }).fill('80');
    await dialog.getByText('Save weight and goal', { exact: true }).click();
    await expect(page.getByText('80 kg', { exact: true })).toBeVisible();

    await seedSql(
      page,
      `CREATE TRIGGER ${WEIGHT_DELETE}
         BEFORE UPDATE ON body_weight_entries
         WHEN NEW.deleted_at IS NOT NULL
         BEGIN SELECT RAISE(ABORT, 'weight-delete-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'workout');
    await openHistory(page);

    await page
      .getByLabel(/^Delete body weight /)
      .first()
      .click();
    const confirm = page.getByRole('dialog', { name: 'Delete body-weight entry' });
    await confirm.getByText('Delete entry', { exact: true }).click();

    // (a) The disclosure that owns the row reports the rejection…
    const weightAlert = page.getByRole('alert');
    await expect(weightAlert).toBeVisible();
    await expect(weightAlert).toContainText(COPY.weightDelete);
    // (b) …and the measurement is still on the card and in the database.
    await expect(page.getByText('80 kg', { exact: true })).toBeVisible();
    const afterFailure = await queryRows(page, `SELECT deleted_at FROM body_weight_entries`);
    expect(afterFailure).toEqual([{ deleted_at: null }]);

    // (c) Retry removes exactly that entry.
    await seedSql(page, `DROP TRIGGER ${WEIGHT_DELETE};`);
    await returnToApp(page);
    await goToTab(page, 'workout');
    await openHistory(page);
    await page
      .getByLabel(/^Delete body weight /)
      .first()
      .click();
    const retried = page.getByRole('dialog', { name: 'Delete body-weight entry' });
    await retried.getByText('Delete entry', { exact: true }).click();
    await expect(page.getByText('80 kg', { exact: true })).toHaveCount(0);

    const afterRetry = await queryRows(page, `SELECT deleted_at FROM body_weight_entries`);
    expect(afterRetry).toHaveLength(1);
    expect(afterRetry[0]?.deleted_at).not.toBeNull();
    const intentsAfterRetry = await queryRows(
      page,
      `SELECT operation FROM sync_outbox WHERE entity = 'body_weight_entries'`,
    );
    expect(intentsAfterRetry).toEqual([{ operation: 'delete' }]);
    await returnToApp(page);
  });

  test('a rejected discard of a finished workout keeps the recovery record and the banner, then discards on retry', async ({
    page,
  }) => {
    // Seed the durable recovery slot directly: this spec pins the DISCARD
    // write, not the session UI that produces it (that flow is covered by
    // `workout.spec.ts` and `workout-finish-celebration.spec.ts`).
    const startedAtIso = new Date(Date.now() - 60_000).toISOString();
    await seedSql(
      page,
      `INSERT INTO app_meta (key, value) VALUES
         ('workout.pending_save', '${JSON.stringify({
           routineId: 'wrk_wfail_pending',
           startedAtIso,
           phaseIndex: 0,
           elapsedSeconds: 60,
           enteredSets: {},
           dispositions: {},
           exerciseNames: [],
           routineName: 'Recovery probe',
           updatedAt: startedAtIso,
         })}');`,
    );
    await seedSql(
      page,
      `CREATE TRIGGER ${META_DELETE}
         BEFORE DELETE ON app_meta
         WHEN OLD.key = 'workout.pending_save'
         BEGIN SELECT RAISE(ABORT, 'discard-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'workout');
    await expect(page.getByText('Workout finished — not saved yet')).toBeVisible();

    await page.getByText('Discard finished workout', { exact: true }).click();
    await page.getByText('Discard', { exact: true }).last().click({ force: true });

    // (a) Reported on the landing that owns the action…
    const discardAlert = page.getByRole('alert');
    await expect(discardAlert).toBeVisible();
    await expect(discardAlert).toContainText(COPY.discard);
    // (b) …and the finished session is still recoverable in the UI.
    await expect(page.getByText('Workout finished — not saved yet')).toBeVisible();
    expect(
      await queryRows(
        page,
        `SELECT COUNT(*) AS n FROM app_meta WHERE key = 'workout.pending_save'`,
      ),
    ).toEqual([{ n: 1 }]);

    // (c) Retry discards the record exactly once and the hero moves on.
    await seedSql(page, `DROP TRIGGER ${META_DELETE};`);
    await returnToApp(page);
    await goToTab(page, 'workout');
    await expect(page.getByText('Workout finished — not saved yet')).toBeVisible();
    await page.getByText('Discard finished workout', { exact: true }).click();
    await page.getByText('Discard', { exact: true }).last().click({ force: true });
    await expect(page.getByText('Workout finished — not saved yet')).toHaveCount(0);
    expect(
      await queryRows(
        page,
        `SELECT COUNT(*) AS n FROM app_meta WHERE key = 'workout.pending_save'`,
      ),
    ).toEqual([{ n: 0 }]);
    await returnToApp(page);
  });

  test('a rejected discard of an in-progress draft keeps the draft and the resume action', async ({
    page,
  }) => {
    await createRoutine(page, 'Draft probe');
    const startedAtIso = new Date(Date.now() - 30_000).toISOString();
    const routineRow = await queryRows(
      page,
      `SELECT id FROM workout_routines WHERE name = 'Draft probe' AND deleted_at IS NULL`,
    );
    const draftRoutineId = String(routineRow[0]?.id);
    await seedSql(
      page,
      `INSERT INTO app_meta (key, value) VALUES
         ('workout.active_session_draft', '${JSON.stringify({
           routineId: draftRoutineId,
           startedAtIso,
           phaseIndex: 0,
           dispositions: {},
           enteredSets: {},
         })}');`,
    );
    await seedSql(
      page,
      `CREATE TRIGGER ${META_DELETE}
         BEFORE DELETE ON app_meta
         WHEN OLD.key = 'workout.active_session_draft'
         BEGIN SELECT RAISE(ABORT, 'discard-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'workout');
    await expect(page.getByText('Session in progress')).toBeVisible();

    await page.getByText('Discard workout', { exact: true }).click();
    await page.getByText('Discard', { exact: true }).last().click({ force: true });

    // (a) Reported, (b) the draft is still there and still resumable.
    const draftAlert = page.getByRole('alert');
    await expect(draftAlert).toBeVisible();
    await expect(draftAlert).toContainText(COPY.discard);
    await expect(page.getByText('Session in progress')).toBeVisible();
    expect(
      await queryRows(
        page,
        `SELECT COUNT(*) AS n FROM app_meta WHERE key = 'workout.active_session_draft'`,
      ),
    ).toEqual([{ n: 1 }]);

    // (c) Retry discards it exactly once.
    await seedSql(page, `DROP TRIGGER ${META_DELETE};`);
    await returnToApp(page);
    await goToTab(page, 'workout');
    await expect(page.getByText('Session in progress')).toBeVisible();
    await page.getByText('Discard workout', { exact: true }).click();
    await page.getByText('Discard', { exact: true }).last().click({ force: true });
    await expect(page.getByText('Session in progress')).toHaveCount(0);
    expect(
      await queryRows(
        page,
        `SELECT COUNT(*) AS n FROM app_meta WHERE key = 'workout.active_session_draft'`,
      ),
    ).toEqual([{ n: 0 }]);
    await returnToApp(page);
  });

  test('a rejected session delete keeps the stored session and offers the retry from the modal', async ({
    page,
  }) => {
    await createRoutine(page, 'History blocked');
    await page.getByText('Complete workout', { exact: true }).first().click();
    await expect(page.getByText('Logged', { exact: true })).toBeVisible();

    await seedSql(
      page,
      `CREATE TRIGGER ${LOG_DELETE}
         BEFORE DELETE ON workout_logs
         BEGIN SELECT RAISE(ABORT, 'session-delete-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'workout');
    await openHistory(page);
    await page
      .getByLabel(/^Open session from /)
      .first()
      .click();
    const detail = page.getByRole('dialog', { name: 'Session detail' });
    await detail.getByRole('button', { name: 'Delete logged session' }).click();
    await page.getByText('Delete session', { exact: true }).last().click({ force: true });

    // (a) The still-open modal explains itself (b) and the log is intact.
    await expect(detail.getByRole('alert')).toContainText(COPY.sessionDelete);
    const afterFailure = await queryRows(page, `SELECT COUNT(*) AS n FROM workout_logs`);
    expect(Number(afterFailure[0]?.n ?? -1)).toBe(1);
    const deleteIntentsAfterFailure = await queryRows(
      page,
      `SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'workout_logs' AND operation = 'delete'`,
    );
    expect(Number(deleteIntentsAfterFailure[0]?.n ?? -1)).toBe(0);

    // (c) Retry from the same modal deletes the session exactly once.
    await seedSql(page, `DROP TRIGGER ${LOG_DELETE};`);
    await returnToApp(page);
    await goToTab(page, 'workout');
    await openHistory(page);
    await page
      .getByLabel(/^Open session from /)
      .first()
      .click();
    const retried = page.getByRole('dialog', { name: 'Session detail' });
    await retried.getByRole('button', { name: 'Delete logged session' }).click();
    await page.getByText('Delete session', { exact: true }).last().click({ force: true });
    await expect(page.getByText('Recent sessions')).toHaveCount(0);

    const afterRetry = await queryRows(page, `SELECT COUNT(*) AS n FROM workout_logs`);
    expect(Number(afterRetry[0]?.n ?? -1)).toBe(0);
    const intentsAfterRetry = await queryRows(
      page,
      `SELECT operation FROM sync_outbox WHERE entity = 'workout_logs'`,
    );
    expect(intentsAfterRetry).toEqual([{ operation: 'delete' }]);
    await returnToApp(page);
  });

  test('a rejected custom-exercise rename keeps the editor open with the draft, then saves on retry', async ({
    page,
  }) => {
    await seedSql(
      page,
      `INSERT INTO custom_exercises (id, name, description, primary_area, secondary_areas, equipment, modality, unilateral, supports_external_load, created_at, updated_at, deleted_at)
       VALUES ('cex_wfail_manager', 'Cable Fly', NULL, 'chest', '[]', 'cable', 'weighted_strength', 0, 1, datetime('now'), datetime('now'), NULL)`,
    );
    await returnToApp(page);
    await goToTab(page, 'workout');
    await createRoutine(page, 'Manager blocked');
    await page.getByRole('button', { name: 'Open Manager blocked routine', exact: true }).click();
    const builder = page.getByRole('dialog', { name: 'Manager blocked' });
    await builder.getByRole('button', { name: 'Manage custom exercises' }).click();
    const manager = page.getByRole('dialog', { name: 'Custom exercises' });
    await expect(manager.getByText('Cable Fly')).toBeVisible();

    await seedSql(
      page,
      `CREATE TRIGGER ${CUSTOM_RENAME}
         BEFORE UPDATE ON custom_exercises
         WHEN NEW.name <> OLD.name
         BEGIN SELECT RAISE(ABORT, 'custom-rename-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'workout');
    await page.getByRole('button', { name: 'Open Manager blocked routine', exact: true }).click();
    const builderFailing = page.getByRole('dialog', { name: 'Manager blocked' });
    await builderFailing.getByRole('button', { name: 'Manage custom exercises' }).click();
    const failing = page.getByRole('dialog', { name: 'Custom exercises' });
    await failing.getByRole('button', { name: 'Edit custom exercise Cable Fly' }).click();
    await failing.getByRole('textbox', { name: 'Edit custom exercise name' }).fill('Pec Deck');
    await failing.getByRole('button', { name: 'Save custom exercise changes' }).click();

    // (a) The manager reports it (b) and keeps the editor + draft so a retry
    // needs no re-typing; the stored name is untouched.
    await expect(failing.getByRole('alert')).toContainText(COPY.customEdit);
    await expect(failing.getByRole('textbox', { name: 'Edit custom exercise name' })).toHaveValue(
      'Pec Deck',
    );
    const afterFailure = await queryRows(
      page,
      `SELECT name FROM custom_exercises WHERE id = 'cex_wfail_manager'`,
    );
    expect(afterFailure).toEqual([{ name: 'Cable Fly' }]);

    // (c) Saving again from the same editor renames exactly once.
    await runSql(page, `DROP TRIGGER ${CUSTOM_RENAME};`);
    await returnToApp(page);
    await goToTab(page, 'workout');
    await page.getByRole('button', { name: 'Open Manager blocked routine', exact: true }).click();
    const builderRetry = page.getByRole('dialog', { name: 'Manager blocked' });
    await builderRetry.getByRole('button', { name: 'Manage custom exercises' }).click();
    const retried = page.getByRole('dialog', { name: 'Custom exercises' });
    await retried.getByRole('button', { name: 'Edit custom exercise Cable Fly' }).click();
    await retried.getByRole('textbox', { name: 'Edit custom exercise name' }).fill('Pec Deck');
    await retried.getByRole('button', { name: 'Save custom exercise changes' }).click();
    await expect(retried.getByText('Pec Deck', { exact: true })).toBeVisible();

    const afterRetry = await queryRows(
      page,
      `SELECT name FROM custom_exercises WHERE id = 'cex_wfail_manager'`,
    );
    expect(afterRetry).toEqual([{ name: 'Pec Deck' }]);
    const intentsAfterRetry = await queryRows(
      page,
      `SELECT operation FROM sync_outbox WHERE entity = 'custom_exercises'`,
    );
    expect(intentsAfterRetry).toEqual([{ operation: 'update' }]);
    await returnToApp(page);
  });

  test('a rejected custom-exercise archive keeps it active and listed, then archives once on retry', async ({
    page,
  }) => {
    await seedSql(
      page,
      `INSERT INTO custom_exercises (id, name, description, primary_area, secondary_areas, equipment, modality, unilateral, supports_external_load, created_at, updated_at, deleted_at)
       VALUES ('cex_wfail_archive', 'Cable Row', NULL, 'back', '[]', 'cable', 'weighted_strength', 0, 1, datetime('now'), datetime('now'), NULL)`,
    );
    await returnToApp(page);
    await goToTab(page, 'workout');
    await createRoutine(page, 'Archive blocked');
    await page.getByRole('button', { name: 'Open Archive blocked routine', exact: true }).click();
    const builder = page.getByRole('dialog', { name: 'Archive blocked' });
    await builder.getByRole('button', { name: 'Manage custom exercises' }).click();
    const manager = page.getByRole('dialog', { name: 'Custom exercises' });
    await expect(manager.getByText('Cable Row')).toBeVisible();

    await seedSql(
      page,
      `CREATE TRIGGER ${CUSTOM_ARCHIVE}
         BEFORE UPDATE ON custom_exercises
         WHEN NEW.deleted_at IS NOT NULL
         BEGIN SELECT RAISE(ABORT, 'custom-archive-blocked'); END;`,
    );
    await returnToApp(page);
    await goToTab(page, 'workout');
    await page.getByRole('button', { name: 'Open Archive blocked routine', exact: true }).click();
    const builderFailing = page.getByRole('dialog', { name: 'Archive blocked' });
    await builderFailing.getByRole('button', { name: 'Manage custom exercises' }).click();
    const failing = page.getByRole('dialog', { name: 'Custom exercises' });
    await failing.getByRole('button', { name: 'Archive custom exercise Cable Row' }).click();
    await page.getByText('Archive exercise', { exact: true }).last().click({ force: true });

    // (a) Visible failure (b) and the exercise is still active / restorable.
    await expect(failing.getByRole('alert')).toContainText(COPY.customArchive);
    await expect(
      failing.getByRole('button', { name: 'Archive custom exercise Cable Row' }),
    ).toBeVisible();
    await expect(
      failing.getByRole('button', { name: 'Restore custom exercise Cable Row to library' }),
    ).toHaveCount(0);
    const afterFailure = await queryRows(
      page,
      `SELECT deleted_at FROM custom_exercises WHERE id = 'cex_wfail_archive'`,
    );
    expect(afterFailure).toEqual([{ deleted_at: null }]);

    // (c) Retry archives exactly that exercise.
    await seedSql(page, `DROP TRIGGER ${CUSTOM_ARCHIVE};`);
    await returnToApp(page);
    await goToTab(page, 'workout');
    await page.getByRole('button', { name: 'Open Archive blocked routine', exact: true }).click();
    const builderRetry = page.getByRole('dialog', { name: 'Archive blocked' });
    await builderRetry.getByRole('button', { name: 'Manage custom exercises' }).click();
    const retried = page.getByRole('dialog', { name: 'Custom exercises' });
    await retried.getByRole('button', { name: 'Archive custom exercise Cable Row' }).click();
    await page.getByText('Archive exercise', { exact: true }).last().click({ force: true });
    await expect(
      retried.getByRole('button', { name: 'Restore custom exercise Cable Row to library' }),
    ).toBeVisible();

    const afterRetry = await queryRows(
      page,
      `SELECT deleted_at FROM custom_exercises WHERE id = 'cex_wfail_archive'`,
    );
    expect(afterRetry[0]?.deleted_at).not.toBeNull();
    const intentsAfterRetry = await queryRows(
      page,
      `SELECT operation FROM sync_outbox WHERE entity = 'custom_exercises'`,
    );
    expect(intentsAfterRetry).toEqual([{ operation: 'delete' }]);
    await returnToApp(page);
  });
});
