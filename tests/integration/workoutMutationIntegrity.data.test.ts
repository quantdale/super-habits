import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Workout/local-first write-integrity contracts against real SQLite:
 *
 * - a schedule move is one unit of work (never "moved to nowhere"),
 * - `runBackupMutation` fails closed when a mutation queues sync intents but
 *   reports `changed: false` (the transaction rolls back instead of committing
 *   row writes while silently dropping their intents),
 * - concurrent same-row edits merge inside the serialized transaction instead
 *   of letting a stale snapshot overwrite a sibling field,
 * - concurrent "add set" taps land on distinct set numbers.
 */
describe('workout mutation integrity (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  async function seedRoutine(name: string): Promise<string> {
    const workout = await import('@/features/workout/workout.data');
    await workout.addRoutine(name, 'strength');
    const row = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM workout_routines WHERE name = ? AND deleted_at IS NULL`,
      [name],
    );
    return row!.id;
  }

  it('a failed schedule move applies neither leg (never moves to nowhere)', async () => {
    db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');
    const routineId = await seedRoutine('Move Me');

    await workout.upsertWeeklyPlanEntry({
      weekday: 1,
      routineId,
      planKind: 'workout',
      note: null,
    });

    // The destination leg rejects (unknown routine) AFTER the source leg has
    // been written inside the same transaction — which must roll back with it.
    await expect(
      workout.rescheduleWorkoutDate({
        fromDateKey: '2026-10-19',
        toDateKey: '2026-10-20',
        routineId: 'wrk_missing',
      }),
    ).rejects.toThrow('Routine not found.');

    const source = await workout.resolveWorkoutScheduleForDate('2026-10-19');
    expect(source.planKind).toBe('workout');
    expect(source.routineId).toBe(routineId);
    const destination = await workout.resolveWorkoutScheduleForDate('2026-10-20');
    expect(destination.planKind).toBe('rest');
    expect(destination.routineId).toBeNull();

    const intents = await db.getAllAsync<{ operation: string }>(
      `SELECT operation FROM sync_outbox WHERE entity = 'workout_schedule_overrides'`,
    );
    expect(intents).toEqual([]);
  });

  it('a successful move commits both legs and both sync intents atomically', async () => {
    db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');
    const routineId = await seedRoutine('Move Me Too');

    await workout.rescheduleWorkoutDate({
      fromDateKey: '2026-10-19',
      toDateKey: '2026-10-20',
      routineId,
    });

    const source = await workout.resolveWorkoutScheduleForDate('2026-10-19');
    expect(source.planKind).toBe('rest');
    expect(source.note).toBe('Moved to 2026-10-20');
    const destination = await workout.resolveWorkoutScheduleForDate('2026-10-20');
    expect(destination.planKind).toBe('workout');
    expect(destination.routineId).toBe(routineId);
    expect(destination.movedFromDateKey).toBe('2026-10-19');

    const intents = await db.getAllAsync<{ operation: string }>(
      `SELECT operation FROM sync_outbox WHERE entity = 'workout_schedule_overrides' ORDER BY operation`,
    );
    expect(intents.map((row) => row.operation)).toEqual(['create', 'create']);
  });

  it('a move rejects impossible calendar dates before touching either day', async () => {
    db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');
    const routineId = await seedRoutine('Calendar Guard');

    await expect(
      workout.rescheduleWorkoutDate({
        fromDateKey: '2026-02-30',
        toDateKey: '2026-02-31',
        routineId,
      }),
    ).rejects.toThrow('A valid source and destination date are required.');

    const intents = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM sync_outbox WHERE entity = 'workout_schedule_overrides'`,
    );
    expect(intents).toEqual([]);
  });

  it('runBackupMutation fails closed when intents are queued under changed=false', async () => {
    db = await freshDatabase();
    const { runBackupMutation } = await import('@/core/sync/syncedMutation');
    const { getDatabase } = await import('@/core/db/client');
    const database = await getDatabase();

    await expect(
      runBackupMutation({
        db: database,
        mutate: async (transactionDb, enqueue) => {
          await transactionDb.runAsync(
            `INSERT INTO workout_routines
             (id, name, description, goal_tag, created_at, updated_at, deleted_at)
             VALUES ('wrk_bad', 'Should roll back', NULL, NULL, '2026-10-17', '2026-10-17', NULL)`,
          );
          enqueue({
            entity: 'workout_routines',
            id: 'wrk_bad',
            updatedAt: '2026-10-17',
            operation: 'create',
          });
          return { changed: false, value: undefined };
        },
      }),
    ).rejects.toThrow(/changed=false/);

    const rows = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM workout_routines WHERE id = 'wrk_bad'`,
    );
    expect(rows).toEqual([]);
    const intents = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM sync_outbox WHERE id = 'wrk_bad'`,
    );
    expect(intents).toEqual([]);
  });

  it('a mid-copy failure leaves no half-built duplicate (copy is one transaction)', async () => {
    db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');
    const routineId = await seedRoutine('Atomic Copy');
    const exerciseId = await workout.addExercise({ routineId, name: 'Row', sortOrder: 1 });
    await workout.addDefaultSet(exerciseId);
    await workout.addDefaultSet(exerciseId);

    // Deterministic fault injection: throw on the SECOND copied set insert,
    // after the copy has already written the shell, the exercise, and one set.
    const originalRunAsync = db.runAsync.bind(db);
    let setInserts = 0;
    (db as { runAsync: typeof db.runAsync }).runAsync = async (sql, params) => {
      if (sql.includes('INSERT INTO routine_exercise_sets')) {
        setInserts += 1;
        if (setInserts === 2) throw new Error('injected mid-copy failure');
      }
      return originalRunAsync(sql, params);
    };
    try {
      await expect(workout.duplicateRoutine(routineId)).rejects.toThrow(
        'injected mid-copy failure',
      );
    } finally {
      (db as { runAsync: typeof db.runAsync }).runAsync = originalRunAsync;
    }

    const routines = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM workout_routines WHERE deleted_at IS NULL`,
    );
    expect(routines).toHaveLength(1);
    const copiedRows = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM routine_exercises WHERE routine_id <> ?`,
      [routineId],
    );
    expect(copiedRows).toEqual([]);
    const copiedSets = await db.getAllAsync<{ id: string }>(
      `SELECT s.id FROM routine_exercise_sets s
       INNER JOIN routine_exercises e ON e.id = s.exercise_id
       WHERE e.routine_id <> ?`,
      [routineId],
    );
    expect(copiedSets).toEqual([]);
  });

  it('concurrent same-row routine edits merge instead of clobbering a sibling field', async () => {
    db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');
    const routineId = await seedRoutine('Merge Me');

    await Promise.all([
      workout.updateRoutine(routineId, { description: 'fresh description' }),
      workout.updateRoutine(routineId, { goalTag: 'strength' }),
    ]);

    const row = await db.getFirstAsync<{ name: string; description: string; goal_tag: string }>(
      `SELECT name, description, goal_tag FROM workout_routines WHERE id = ?`,
      [routineId],
    );
    expect(row).toEqual({
      name: 'Merge Me',
      description: 'fresh description',
      goal_tag: 'strength',
    });
  });

  it('concurrent add-set taps land on distinct set numbers', async () => {
    db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');
    const routineId = await seedRoutine('Set Numbers');
    const exerciseId = await workout.addExercise({
      routineId,
      name: 'Squat',
      sortOrder: 1,
    });

    await Promise.all([
      workout.addDefaultSet(exerciseId),
      workout.addDefaultSet(exerciseId),
      workout.addDefaultSet(exerciseId),
    ]);

    const sets = await db.getAllAsync<{ set_number: number }>(
      `SELECT set_number FROM routine_exercise_sets WHERE exercise_id = ? ORDER BY set_number`,
      [exerciseId],
    );
    expect(sets.map((row) => row.set_number)).toEqual([1, 2, 3]);
  });

  it('adding a set after a mid-list delete never reuses a surviving number', async () => {
    db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');
    const routineId = await seedRoutine('Numbering After Delete');
    const exerciseId = await workout.addExercise({
      routineId,
      name: 'Deadlift',
      sortOrder: 1,
    });
    await workout.addDefaultSet(exerciseId);
    await workout.addDefaultSet(exerciseId);
    await workout.addDefaultSet(exerciseId);

    const middle = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM routine_exercise_sets
       WHERE exercise_id = ? AND set_number = 2 AND deleted_at IS NULL`,
      [exerciseId],
    );
    await workout.deleteSet(middle!.id);
    await workout.addDefaultSet(exerciseId);

    const sets = await db.getAllAsync<{ set_number: number }>(
      `SELECT set_number FROM routine_exercise_sets WHERE exercise_id = ? AND deleted_at IS NULL ORDER BY set_number`,
      [exerciseId],
    );
    // COUNT-based numbering would insert 3 and duplicate the surviving 3.
    expect(sets.map((row) => row.set_number)).toEqual([1, 3, 4]);
  });
});
