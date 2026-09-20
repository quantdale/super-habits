import { afterEach, describe, expect, it } from 'vitest';
import { toDateKey } from '@/lib/time';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Workout Gym V2 query and mutator coverage against real SQLite: body-weight
 * corrections, exercise ordering, session read models (totals, last-performed,
 * logged sets, performance rows), and schedule overrides. The existing
 * integration suites cover log deletion, routine rename, and custom exercises;
 * these reads/writes were previously exercised only through the UI or not at
 * all.
 */
describe('workout Gym V2 queries (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('body-weight entries round-trip, correct in place, and soft-delete once', async () => {
    db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');

    const first = await workout.addBodyWeightEntry({
      weight: 80.5,
      unit: 'kg',
      measuredAt: '2026-09-08T08:00:00.000Z',
      note: 'morning',
    });
    const second = await workout.addBodyWeightEntry({
      weight: 81,
      unit: 'kg',
      measuredAt: '2026-09-09T08:00:00.000Z',
    });

    expect((await workout.listBodyWeightEntries()).map((entry) => entry.id)).toEqual([
      second,
      first,
    ]);

    await workout.updateBodyWeightEntry(first, { weight: 79.5, unit: 'lb', note: '  corrected  ' });
    expect(
      await db.getFirstAsync<{ weight: number; unit: string; note: string | null }>(
        'SELECT weight, unit, note FROM body_weight_entries WHERE id = ?',
        [first],
      ),
    ).toEqual({ weight: 79.5, unit: 'lb', note: 'corrected' });

    // Unknown ids are a no-op and invalid weights fail validation.
    await expect(
      workout.updateBodyWeightEntry('bw_missing', { weight: 80 }),
    ).resolves.toBeUndefined();
    await expect(workout.addBodyWeightEntry({ weight: 0, unit: 'kg' })).rejects.toThrow();

    await workout.deleteBodyWeightEntry(first);
    expect((await workout.listBodyWeightEntries()).map((entry) => entry.id)).toEqual([second]);
    await workout.deleteBodyWeightEntry(first);
    const intents = await db.getAllAsync<{ operation: string }>(
      `SELECT operation FROM sync_outbox WHERE entity = 'body_weight_entries' AND id = ?`,
      [first],
    );
    expect(intents.map((row) => row.operation)).toEqual(['delete']);
  });

  it('exercise reorder persists sort_order and enqueues updates only for a valid routine set', async () => {
    db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');

    await workout.addRoutine('Push Day', 'chest');
    const routineId = (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM workout_routines WHERE name = 'Push Day' AND deleted_at IS NULL`,
    ))!.id;
    const exerciseA = await workout.addExercise({
      routineId,
      name: 'Bench Press',
      sortOrder: 1,
    });
    const exerciseB = await workout.addExercise({
      routineId,
      name: 'Overhead Press',
      sortOrder: 2,
    });

    await workout.updateExerciseOrder([exerciseB, exerciseA]);
    const ordered = await workout.listExercises(routineId);
    expect(ordered.map((exercise) => exercise.id)).toEqual([exerciseB, exerciseA]);

    const intents = await db.getAllAsync<{ id: string; operation: string }>(
      `SELECT id, operation FROM sync_outbox
       WHERE entity = 'routine_exercises' AND id IN (?, ?)`,
      [exerciseA, exerciseB],
    );
    expect(intents).toHaveLength(2);
    expect(intents.every((intent) => intent.operation === 'update')).toBe(true);

    // An unknown/mixed set is a no-op: the first id does not resolve.
    await workout.updateExerciseOrder(['ex_missing', exerciseA]);
    expect((await workout.listExercises(routineId)).map((exercise) => exercise.id)).toEqual([
      exerciseB,
      exerciseA,
    ]);
  });

  it('session reads reflect logged sets, totals, last-performed, and skipped outcomes', async () => {
    db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');

    await workout.addRoutine('Pull Day', 'back');
    const routineId = (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM workout_routines WHERE name = 'Pull Day' AND deleted_at IS NULL`,
    ))!.id;
    await workout.addExercise({ routineId, name: 'Row', sortOrder: 1 });
    await workout.completeRoutine(routineId);

    const logId = (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM workout_logs WHERE routine_id = ?`,
      [routineId],
    ))!.id;
    await db.runAsync(
      `INSERT INTO workout_session_exercises (id, log_id, exercise_name, sets_completed, created_at)
       VALUES ('wsex_q1', ?, 'Row', 2, datetime('now'))`,
      [logId],
    );
    await db.runAsync(
      `INSERT INTO workout_session_sets
         (id, session_exercise_id, set_number, weight, reps, weight_unit, completed, created_at)
       VALUES ('wset_q1', 'wsex_q1', 1, 60, 10, 'kg', 1, datetime('now'))`,
    );
    await db.runAsync(
      `INSERT INTO workout_session_sets
         (id, session_exercise_id, set_number, weight, reps, weight_unit, completed, created_at)
       VALUES ('wset_q2', 'wsex_q1', 2, NULL, NULL, NULL, 0, datetime('now'))`,
    );

    // Prefill reads keep only completed weighted sets; outcomes keep skipped ones.
    expect(await workout.listRecentLoggedSets()).toEqual([
      {
        exerciseName: 'Row',
        catalogExerciseId: null,
        setNumber: 1,
        weight: 60,
        reps: 10,
      },
    ]);
    expect(await workout.listLoggedSetsForExerciseNames(['Row'])).toEqual([
      { exerciseName: 'Row', catalogExerciseId: null, weight: 60, reps: 10 },
    ]);
    const outcomes = await workout.listRecentWorkoutSetOutcomes();
    expect(outcomes.map((outcome) => [outcome.setNumber, outcome.completed])).toEqual([
      [2, 0],
      [1, 1],
    ]);

    const todayKey = toDateKey();
    const totals = await workout.listSessionTotalsForRange(todayKey, todayKey);
    expect(totals).toEqual([{ id: logId, completedAt: expect.any(String), totalSets: 2 }]);

    const lastPerformed = await workout.getLastPerformedByRoutine();
    expect(lastPerformed.get(routineId)).toBe(totals[0].completedAt);

    const performance = await workout.listWorkoutPerformanceRows();
    expect(performance.filter((row) => row.exerciseName === 'Row')).toHaveLength(2);
  });

  it('persists a fully-skipped exercise with setsCompleted 0 and completed=0 rows', async () => {
    db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');

    await workout.addRoutine('Skip Audit', 'strength');
    const routineId = (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM workout_routines WHERE name = 'Skip Audit' AND deleted_at IS NULL`,
    ))!.id;

    // Mirrors the fixed handleFinish wiring: every attempted exercise is
    // logged, including one whose sets were all skipped.
    await workout.logWorkoutSession({
      routineId,
      exercises: [
        {
          exerciseName: 'Bench',
          setsCompleted: 0,
          sets: [
            { setNumber: 1, weight: 80, reps: 8, completed: false },
            { setNumber: 2, weight: 82.5, reps: 6, completed: false },
          ],
        },
        {
          exerciseName: 'Row',
          setsCompleted: 2,
          sets: [
            { setNumber: 1, weight: 60, reps: 10, completed: true },
            { setNumber: 2, weight: 60, reps: 10, completed: true },
          ],
        },
      ],
    });

    const logId = (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM workout_logs WHERE routine_id = ?`,
      [routineId],
    ))!.id;
    const detail = await workout.getWorkoutLogDetail(logId);
    expect(detail?.exercises.map((e) => [e.exercise_name, e.sets_completed])).toEqual([
      ['Bench', 0],
      ['Row', 2],
    ]);
    expect(detail?.sets).toHaveLength(4);
    expect((detail?.sets ?? []).filter((s) => s.completed === 0)).toHaveLength(2);
    expect((detail?.sets ?? []).filter((s) => s.completed === 1)).toHaveLength(2);
    const perExercise = await db.getAllAsync<{
      exercise_name: string;
      set_number: number;
      completed: number;
    }>(
      `SELECT e.exercise_name AS exercise_name, s.set_number AS set_number, s.completed AS completed
       FROM workout_session_sets s
       INNER JOIN workout_session_exercises e ON e.id = s.session_exercise_id
       WHERE e.log_id = ?
       ORDER BY e.created_at ASC, e.id ASC, s.set_number ASC`,
      [logId],
    );
    expect(perExercise).toEqual([
      { exercise_name: 'Bench', set_number: 1, completed: 0 },
      { exercise_name: 'Bench', set_number: 2, completed: 0 },
      { exercise_name: 'Row', set_number: 1, completed: 1 },
      { exercise_name: 'Row', set_number: 2, completed: 1 },
    ]);

    // Measurable reads still exclude the skipped rows: prefill sees only Row.
    const prefill = await workout.listRecentLoggedSets();
    expect(prefill.filter((r) => r.exerciseName === 'Bench')).toEqual([]);
    expect(prefill.filter((r) => r.exerciseName === 'Row')).toHaveLength(2);
    // Outcomes keep the skips so progression holds instead of advancing.
    const outcomes = await workout.listRecentWorkoutSetOutcomes();
    expect(outcomes.filter((o) => o.exerciseName === 'Bench').map((o) => o.completed)).toEqual([
      0, 0,
    ]);
    // Session totals count only completed work (2), not skipped rows.
    const todayKey = toDateKey();
    const totals = await workout.listSessionTotalsForRange(todayKey, todayKey);
    expect(totals).toEqual([{ id: logId, completedAt: expect.any(String), totalSets: 2 }]);
  });

  it('reschedule writes a rest and workout override and validates input', async () => {
    db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');

    await workout.addRoutine('Leg Day', 'legs');
    const routineId = (await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM workout_routines WHERE name = 'Leg Day' AND deleted_at IS NULL`,
    ))!.id;

    await workout.rescheduleWorkoutDate({
      fromDateKey: '2026-09-20',
      toDateKey: '2026-09-21',
      routineId,
    });

    const overrides = await db.getAllAsync<{
      date_key: string;
      override_kind: string;
      routine_id: string | null;
      note: string | null;
    }>(
      `SELECT date_key, override_kind, routine_id, note
       FROM workout_schedule_overrides WHERE deleted_at IS NULL ORDER BY date_key ASC`,
    );
    expect(overrides).toEqual([
      {
        date_key: '2026-09-20',
        override_kind: 'rest',
        routine_id: null,
        note: 'Moved to 2026-09-21',
      },
      {
        date_key: '2026-09-21',
        override_kind: 'workout',
        routine_id: routineId,
        note: 'Moved from 2026-09-20',
      },
    ]);
    const intents = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'workout_schedule_overrides'`,
    );
    expect(Number(intents?.n)).toBe(2);

    await expect(
      workout.setWorkoutScheduleOverride({ dateKey: 'not-a-date', overrideKind: 'rest' }),
    ).rejects.toThrow();
    await expect(
      workout.setWorkoutScheduleOverride({ dateKey: '2026-09-22', overrideKind: 'workout' }),
    ).rejects.toThrow();
  });
});
