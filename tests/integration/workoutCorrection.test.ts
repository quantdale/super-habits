import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Workout correction paths against real SQLite: deleting an accidentally
 * logged session cascades through its snapshot rows with one durable delete
 * intent per touched row (the saved_meals hard-delete exception — these log
 * tables carry no deleted_at column) while routine templates survive; custom
 * exercises round-trip through archive/restore and in-place edits.
 */
describe('workout correction (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('deletes an accidental log with cascade + per-row intents, keeping the template', async () => {
    db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');

    await workout.addRoutine('OOPS Push', 'accidental');
    const routineId = (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM workout_routines WHERE name = 'OOPS Push'`,
    ))!.id;
    await workout.addExercise({ routineId, name: 'Bench Press' });
    await workout.completeRoutine(routineId);

    const logId = (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM workout_logs WHERE routine_id = ?`,
      [routineId],
    ))!.id;
    // Session snapshot rows as a guided session would persist them.
    await db.runAsync(
      `INSERT INTO workout_session_exercises (id, log_id, exercise_name, sets_completed, created_at)
       VALUES ('wsex_t1', ?, 'Bench Press', 3, datetime('now'))`,
      [logId],
    );
    await db.runAsync(
      `INSERT INTO workout_session_sets
         (id, session_exercise_id, set_number, weight, reps, weight_unit, completed, created_at)
       VALUES ('wset_t1', 'wsex_t1', 1, 80, 8, 'kg', 1, datetime('now'))`,
    );

    expect(await workout.deleteWorkoutLog(logId)).toBe(true);

    expect(
      await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM workout_logs WHERE id = ?', [
        logId,
      ]),
    ).toEqual({ n: 0 });
    expect(
      await db.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM workout_session_exercises WHERE log_id = ?`,
        [logId],
      ),
    ).toEqual({ n: 0 });
    expect(
      await db.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM workout_session_sets WHERE id = 'wset_t1'`,
      ),
    ).toEqual({ n: 0 });

    const intents = await db.getAllAsync<{ entity: string; operation: string }>(
      `SELECT entity, operation FROM sync_outbox
       WHERE (entity = 'workout_logs' AND id = ?)
          OR (entity = 'workout_session_exercises' AND id = 'wsex_t1')
          OR (entity = 'workout_session_sets' AND id = 'wset_t1')`,
      [logId],
    );
    expect(intents).toHaveLength(3);
    expect(intents.every((intent) => intent.operation === 'delete')).toBe(true);

    // Template survives; history queries no longer see the deleted log.
    const routine = await workout.listRoutines();
    expect(routine.filter((r) => r.id === routineId)).toHaveLength(1);
    const exercises = await workout.listExercises(routineId);
    expect(exercises).toHaveLength(1);
    const today = new Date().toISOString().slice(0, 10);
    const range = await workout.listWorkoutLogsForRange(today, today);
    expect(range.filter((log) => log.id === logId)).toHaveLength(0);
  });

  it('returns false for an unknown log without writing intents', async () => {
    db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');

    expect(await workout.deleteWorkoutLog('wrk_does_not_exist')).toBe(false);
    const intents = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM sync_outbox WHERE id = 'wrk_does_not_exist'`,
    );
    expect(intents).toEqual({ n: 0 });
  });

  it('renames a routine template in place without touching past logs', async () => {
    db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');

    await workout.addRoutine('Squat Day', 'legs');
    const routineId = (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM workout_routines WHERE name = 'Squat Day'`,
    ))!.id;
    await workout.completeRoutine(routineId);

    await workout.updateRoutine(routineId, { name: 'Leg Day' });

    const routine = await db.getFirstAsync<{ name: string; updated_at: string }>(
      'SELECT name, updated_at FROM workout_routines WHERE id = ?',
      [routineId],
    );
    expect(routine?.name).toBe('Leg Day');
    // The completed log keeps its snapshot identity untouched by the rename.
    const log = await db.getFirstAsync<{ routine_name: string | null }>(
      'SELECT routine_name FROM workout_logs WHERE routine_id = ?',
      [routineId],
    );
    expect(log?.routine_name).toBe('Squat Day');
    // Durable outbox coalesces per (entity, id): one live row holding the
    // latest operation for the routine.
    const intents = await db.getAllAsync<{ operation: string }>(
      `SELECT operation FROM sync_outbox WHERE entity = 'workout_routines' AND id = ?`,
      [routineId],
    );
    expect(intents.map((intent) => intent.operation)).toEqual(['update']);
  });

  it('archives, restores, and edits custom exercises with durable intents', async () => {
    db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');

    const id = await workout.createCustomExercise({
      name: 'Tempo Curl',
      primaryArea: 'biceps',
      modality: 'weighted_strength',
    });

    await workout.archiveCustomExercise(id);
    expect(
      (await workout.listCustomExercises()).filter((exercise) => exercise.id === id),
    ).toHaveLength(0);
    const archived = (await workout.listCustomExercises(true)).find(
      (exercise) => exercise.id === id,
    );
    expect(archived?.deleted_at).toBeTruthy();

    expect(await workout.restoreCustomExercise(id)).toBe(true);
    const restored = (await workout.listCustomExercises()).find((exercise) => exercise.id === id);
    expect(restored?.deleted_at).toBeNull();

    await workout.updateCustomExercise(id, { name: 'Incline Curl', modality: 'bodyweight' });
    const edited = (await workout.listCustomExercises()).find((exercise) => exercise.id === id);
    expect(edited?.name).toBe('Incline Curl');
    expect(edited?.modality).toBe('bodyweight');

    // Coalesced outbox row keeps only the latest operation for this id…
    const intents = await db.getAllAsync<{ operation: string }>(
      `SELECT operation FROM sync_outbox WHERE entity = 'custom_exercises' AND id = ?`,
      [id],
    );
    expect(intents.map((intent) => intent.operation)).toEqual(['update']);
    // …and a delete followed by a restore still leaves a live update intent
    // so the remote converges on the restored row.
    // Restoring an already-active exercise is a no-op.
    expect(await workout.restoreCustomExercise(id)).toBe(false);
  });
});
