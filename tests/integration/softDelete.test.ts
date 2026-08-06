import { describe, expect, it } from 'vitest';
import type { TestDatabase } from './helpers/db';
import { freshDatabase } from './helpers/db';

/**
 * Task 2.7 — soft-delete behaviour across every feature data layer, against a
 * REAL database.
 *
 * The app's invariant: `todos`, `habits`, `calorie_entries`,
 * `workout_routines` (plus the nested `routine_exercises` /
 * `routine_exercise_sets`) are never hard-deleted — deletes are
 * `UPDATE ... SET deleted_at`, every read path filters `deleted_at IS NULL`,
 * and old rows stay recoverable. The exceptions are documented:
 * `habit_completions` hard-deletes when a count decrements to 0 and
 * `saved_meals` is a local-only table hard-deleted on purpose. Tables without
 * a `deleted_at` column at all (`workout_logs`, `pomodoro_sessions`) have no
 * tombstone concept and are quoted as-is.
 *
 * Because better-sqlite3 exposes no statement-trace event in v13, the "no
 * DELETE FROM fires" half of the contract is asserted two ways: a
 * `prepare`-level tracer proves no DELETE statement is issued against the
 * synced tables, and the surviving row (still present with `deleted_at` set)
 * proves the data was never removed and can be revived.
 */

/** Intercepts every prepared statement so DELETE usage can be asserted. */
function installDeleteTracer(db: TestDatabase): {
  deletes: string[];
  assertNoHardDeleteOn(table: string): void;
} {
  const deletes: string[] = [];
  // The local declaration only covers the adapter's surface; the raw handle
  // is the real better-sqlite3 Database, whose `prepare` we can wrap.
  const raw = db.raw as unknown as { prepare: (sql: string) => unknown };
  const originalPrepare = raw.prepare.bind(raw);
  raw.prepare = (sql: string) => {
    if (/^\s*DELETE\s/i.test(sql)) deletes.push(sql);
    return originalPrepare(sql);
  };
  return {
    deletes,
    assertNoHardDeleteOn(table: string) {
      expect(
        deletes.some((sql) => new RegExp(`DELETE\\s+FROM\\s+${table}\\b`, 'i').test(sql)),
      ).toBe(false);
    },
  };
}

/** Revives a tombstoned row (simulates a future undo), as a recoverability oracle. */
async function revive(db: TestDatabase, table: string, id: string): Promise<void> {
  await db.runAsync(`UPDATE ${table} SET deleted_at = NULL WHERE id = ?`, [id]);
}

describe('soft-delete schema contract', () => {
  it('payload tables have deleted_at; local-only log tables do not', async () => {
    const db = await freshDatabase();
    const withTombstone = [
      'todos',
      'habits',
      'calorie_entries',
      'workout_routines',
      'routine_exercises',
      'routine_exercise_sets',
    ];
    const withoutTombstone = ['workout_logs', 'pomodoro_sessions', 'saved_meals'];

    for (const table of withTombstone) {
      const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
      expect(columns.map((c) => c.name)).toContain('deleted_at');
    }
    for (const table of withoutTombstone) {
      const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
      expect(columns.map((c) => c.name)).not.toContain('deleted_at');
    }
    await db.closeAsync();
  });
});

describe('todos soft delete', () => {
  it('every todo read path excludes a soft-deleted row, the row survives, and revive restores it', async () => {
    const db = await freshDatabase();
    const tracer = installDeleteTracer(db);
    const todos = await import('@/features/todos/todos.data');

    const keepId = await todos.addTodo({ title: 'keep' });
    const doomedId = await todos.addTodo({ title: 'doomed' });
    await todos.removeTodo(doomedId);

    // Read paths.
    expect((await todos.listTodos()).map((t) => t.id)).toEqual([keepId]);
    expect((await todos.listPendingTodos()).map((t) => t.id)).toEqual([keepId]);
    expect(await todos.countPendingTodos()).toBe(1);
    // toggleTodo on a deleted row must not error and must not resurrect it.
    await expect(todos.toggleTodo({ id: doomedId } as never)).resolves.toMatchObject({
      completed: 0,
    });

    // The row survives with a tombstone — removeTodo is UPDATE, never DELETE.
    const tombstone = await db.getFirstAsync<{ deleted_at: string }>(
      'SELECT deleted_at FROM todos WHERE id = ?',
      [doomedId],
    );
    expect(tombstone?.deleted_at).not.toBeNull();
    expect((await todos.listTodos()).map((t) => t.id)).toEqual([keepId]);
    tracer.assertNoHardDeleteOn('todos');

    // Recoverable: clearing the tombstone brings the row straight back.
    await revive(db, 'todos', doomedId);
    expect((await todos.listTodos()).map((t) => t.id).sort()).toEqual([doomedId, keepId].sort());

    await db.closeAsync();
  });
});

describe('habits soft delete', () => {
  it('listHabits excludes deleted habits and incrementHabit no-ops on them without orphan completions', async () => {
    const db = await freshDatabase();
    const tracer = installDeleteTracer(db);
    const habits = await import('@/features/habits/habits.data');

    const doomedId = await habits.addHabit('Doomed', 3);
    await habits.addHabit('Keep', 3);
    await habits.deleteHabit(doomedId);

    expect((await habits.listHabits()).map((h) => h.name)).toEqual(['Keep']);

    // Guard before writing: a soft-deleted habit must not accrete orphan
    // completion rows (habits.data incrementHabit's explicit check).
    const result = await habits.incrementHabit(doomedId, '2026-07-01');
    expect(result).toMatchObject({ count: 0 });
    const completions = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM habit_completions WHERE habit_id = ?',
      [doomedId],
    );
    expect(completions?.n).toBe(0);

    // Tombstone survives; no DELETE was issued; revival restores visibility.
    const tombstone = await db.getFirstAsync<{ deleted_at: string }>(
      'SELECT deleted_at FROM habits WHERE id = ?',
      [doomedId],
    );
    expect(tombstone?.deleted_at).not.toBeNull();
    tracer.assertNoHardDeleteOn('habits');

    await revive(db, 'habits', doomedId);
    expect((await habits.listHabits()).map((h) => h.id)).toContain(doomedId);

    await db.closeAsync();
  });
});

describe('calories soft delete', () => {
  it('list, summary and count queries exclude deleted entries; aggregates keep only live rows', async () => {
    const db = await freshDatabase();
    const tracer = installDeleteTracer(db);
    const calories = await import('@/features/calories/calories.data');

    await calories.addCalorieEntry({
      foodName: 'Salad',
      calories: 300,
      protein: 5,
      carbs: 10,
      fats: 15,
      mealType: 'lunch',
      consumedOn: '2026-07-01',
    });
    await calories.addCalorieEntry({
      foodName: 'Pasta',
      calories: 700,
      protein: 20,
      carbs: 90,
      fats: 20,
      mealType: 'dinner',
      consumedOn: '2026-07-01',
    });
    const entries = await calories.listCalorieEntries('2026-07-01');
    expect(entries).toHaveLength(2);
    const doomed = entries.find((e) => e.food_name === 'Pasta')!;
    await calories.deleteCalorieEntry(doomed.id);

    // Every read path.
    expect((await calories.listCalorieEntries('2026-07-01')).map((e) => e.food_name)).toEqual([
      'Salad',
    ]);
    const summary = await calories.getCalorieSummaryByRange('2026-07-01', '2026-07-01');
    expect(summary).toHaveLength(1);
    expect(summary[0].totalCalories).toBe(300);
    expect(await calories.countCalorieEntriesByRange('2026-07-01', '2026-07-01')).toBe(1);
    expect(await calories.hasAnyCalorieEntries()).toBe(true);

    // Delete the last live entry: the "has any" aggregate must go false.
    await calories.deleteCalorieEntry(entries.find((e) => e.food_name === 'Salad')!.id);
    expect(await calories.hasAnyCalorieEntries()).toBe(false);

    // Tombstone survives; no hard delete on the synced table; revival restores.
    const tombstone = await db.getFirstAsync<{ deleted_at: string }>(
      'SELECT deleted_at FROM calorie_entries WHERE id = ?',
      [doomed.id],
    );
    expect(tombstone?.deleted_at).not.toBeNull();
    tracer.assertNoHardDeleteOn('calorie_entries');

    await revive(db, 'calorie_entries', doomed.id);
    expect((await calories.listCalorieEntries('2026-07-01')).map((e) => e.food_name)).toContain(
      'Pasta',
    );

    await db.closeAsync();
  });
});

describe('workout soft delete', () => {
  it('deleted routines and exercises vanish from reads, keep their tombstones, and revive', async () => {
    const db = await freshDatabase();
    const tracer = installDeleteTracer(db);
    const workout = await import('@/features/workout/workout.data');

    await workout.addRoutine('Keep routine', 'kept');
    await workout.addRoutine('Doomed routine', 'doomed');

    // Seed exercises + sets inside the doomed routine before tombstoning it.
    const doomedRoutine = (await workout.listRoutines()).find((r) => r.name === 'Doomed routine')!;
    const ex1 = await workout.addExercise({ routineId: doomedRoutine.id, name: 'Push-ups' });
    await workout.addExercise({ routineId: doomedRoutine.id, name: 'Squats' });
    await workout.addSet({ exerciseId: ex1, setNumber: 1, activeSeconds: 40, restSeconds: 20 });

    await workout.deleteRoutine(doomedRoutine.id);
    expect((await workout.listRoutines()).map((r) => r.name)).toEqual(['Keep routine']);
    expect(await workout.getRoutineWithExercises(doomedRoutine.id)).toBeNull();
    tracer.assertNoHardDeleteOn('workout_routines');

    // deleteRoutine does NOT cascade: the nested exercises keep their rows and
    // are not tombstoned (the app leaves routine content alone; only the
    // parent is hidden, and only a direct deleteExercise tombstones an
    // exercise — see the next test). Nothing is hard-deleted anywhere.
    const exerciseRows = await db.getAllAsync<{ id: string; deleted_at: string | null }>(
      'SELECT id, deleted_at FROM routine_exercises WHERE routine_id = ?',
      [doomedRoutine.id],
    );
    expect(exerciseRows).toHaveLength(2);
    for (const row of exerciseRows) {
      expect(row.deleted_at).toBeNull();
    }
    tracer.assertNoHardDeleteOn('routine_exercises');
    tracer.assertNoHardDeleteOn('routine_exercise_sets');

    // Reviving the routine restores it with its exercises intact — the whole
    // delete was cursory at the row level, so a restore can bring it back.
    // Both routines share the same created_at millisecond, so listRoutines'
    // ORDER BY created_at DESC tie-break order is nondeterministic — assert
    // the revived set, not its display order.
    await revive(db, 'workout_routines', doomedRoutine.id);
    const revivedRoutineNames = (await workout.listRoutines()).map((r) => r.name);
    expect([...revivedRoutineNames].sort()).toEqual(['Doomed routine', 'Keep routine']);
    const revived = await workout.getRoutineWithExercises(doomedRoutine.id);
    expect(revived?.exercises.map((e) => e.name)).toEqual(['Push-ups', 'Squats']);

    await db.closeAsync();
  });

  it('deleteExercise tombstones that exercise and its sets', async () => {
    const db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');

    await workout.addRoutine('R', 'desc');
    const routine = (await workout.listRoutines())[0];
    const exId = await workout.addExercise({ routineId: routine.id, name: 'Plank' });
    const setId = await workout.addSet({
      exerciseId: exId,
      setNumber: 1,
      activeSeconds: 40,
      restSeconds: 20,
    });

    await workout.deleteExercise(exId);
    expect(await workout.listExercises(routine.id)).toHaveLength(0);

    const setRow = await db.getFirstAsync<{ deleted_at: string | null }>(
      'SELECT deleted_at FROM routine_exercise_sets WHERE id = ?',
      [setId],
    );
    expect(setRow?.deleted_at).not.toBeNull();
    expect(await workout.listSets(exId)).toHaveLength(0);

    await db.closeAsync();
  });
});

describe('pomodoro and workout logs have no soft delete', () => {
  it('pomodoro_sessions and workout_logs rows are never hidden by any read', async () => {
    const db = await freshDatabase();
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');
    const workout = await import('@/features/workout/workout.data');

    await workout.addRoutine('R', 'desc');
    const routine = (await workout.listRoutines())[0];
    await workout.completeRoutine(routine.id, 'log one');
    await workout.completeRoutine(routine.id, 'log two');

    await pomodoro.logPomodoroSession(
      '2026-07-01T00:00:00.000Z',
      '2026-07-01T00:25:00.000Z',
      1500,
      'focus',
    );
    await pomodoro.logPomodoroSession(
      '2026-07-02T00:00:00.000Z',
      '2026-07-02T00:25:00.000Z',
      1500,
      'focus',
    );

    // No tombstone column exists, so every row is visible to every read path.
    expect(await workout.listWorkoutLogs()).toHaveLength(2);
    // completed_at comes from the wall clock, so a "today" range — real local
    // keys converted through getUtcIsoRangeForLocalDateKeys — must catch both.
    const { toDateKey } = await import('@/lib/time');
    const today = toDateKey(new Date());
    expect(await workout.listWorkoutLogsForRange(today, today)).toHaveLength(2);
    // A past range that cannot contain wall-clock rows comes back empty.
    expect(await workout.listWorkoutLogsForRange('2020-01-01', '2020-01-01')).toHaveLength(0);
    expect(await pomodoro.listPomodoroSessions()).toHaveLength(2);

    await db.closeAsync();
  });
});
