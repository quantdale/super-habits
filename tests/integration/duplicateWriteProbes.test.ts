import { describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';

/**
 * Duplicate-write probes (Production Hardening V1 §4.2).
 *
 * Rapid repeated invocation of each sibling write path, classified:
 * intentionally repeatable (each call is a new user intent), idempotent
 * (same identity mutates once), or guarded (compare-and-swap / claim makes
 * exactly one call win). Every probe runs against real SQLite through the
 * unmodified data layers; none may throw, corrupt, or duplicate rows.
 */

async function outboxRows(db: {
  getAllAsync: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
}) {
  return db.getAllAsync<{ entity: string; id: string; operation: string }>(
    'SELECT entity, id, operation FROM sync_outbox',
  );
}

describe('duplicate-write probes', () => {
  it('concurrent todo toggles apply sequentially and deterministically', async () => {
    const db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const id = await todos.addTodo({ title: 'Tap twice' });

    // Two rapid toggles are two genuine flips: serialized transactions must
    // round-trip 0 -> 1 -> 0 every round (a torn read-modify-write would
    // flake between 0 and 1 across rounds).
    for (let round = 0; round < 5; round += 1) {
      await todos.setTodoCompletionState(id, 0);
      const row = (await todos.listTodos()).find((t) => t.id === id);
      expect(row).toBeDefined();
      await Promise.all([todos.toggleTodo(row!), todos.toggleTodo(row!)]);
      const after = await db.getFirstAsync<{ completed: number }>(
        'SELECT completed FROM todos WHERE id = ?',
        [id],
      );
      expect(after?.completed).toBe(0);
    }

    const rows = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM todos WHERE deleted_at IS NULL',
    );
    expect(rows).toHaveLength(1);
    await db.closeAsync();
  });

  it('concurrent idempotent completes: exactly one wins, loser enqueues nothing new', async () => {
    const db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const id = await todos.addTodo({ title: 'Complete twice' });

    // Explicit complete (not toggle) is idempotent: the second concurrent
    // call sees completed=1 inside its serialized transaction and is a
    // no-op, so the outbox holds exactly one coalesced intent.
    await Promise.all([todos.completeTodo(id), todos.completeTodo(id)]);

    const after = await db.getFirstAsync<{ completed: number }>(
      'SELECT completed FROM todos WHERE id = ?',
      [id],
    );
    expect(after?.completed).toBe(1);
    const intents = (await outboxRows(db)).filter((r) => r.entity === 'todos' && r.id === id);
    expect(intents).toHaveLength(1);
    expect(intents[0]?.operation).toBe('update');
    await db.closeAsync();
  });

  it('sequential todo adds are intentionally repeatable with distinct order slots', async () => {
    const db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');

    await todos.addTodo({ title: 'First' });
    await todos.addTodo({ title: 'Second' });

    const rows = await db.getAllAsync<{ title: string; sort_order: number }>(
      'SELECT title, sort_order FROM todos WHERE deleted_at IS NULL ORDER BY sort_order ASC',
    );
    expect(rows.map((r) => r.title)).toEqual(['First', 'Second']);
    expect(new Set(rows.map((r) => r.sort_order)).size).toBe(2);

    const creates = (await outboxRows(db)).filter(
      (r) => r.entity === 'todos' && r.operation === 'create',
    );
    expect(creates).toHaveLength(2);
    await db.closeAsync();
  });

  it('pomodoro completion with an explicit id is idempotent, even concurrently', async () => {
    const db = await freshDatabase();
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');
    const input = {
      id: 'pom_dup_probe',
      startedAtIso: '2026-04-01T10:00:00.000Z',
      endedAtIso: '2026-04-01T10:25:00.000Z',
      durationSeconds: 1500,
      type: 'focus' as const,
    };

    const first = await pomodoro.recordCompletedPomodoroSession(input);
    expect(first).toMatchObject({ id: 'pom_dup_probe', inserted: true });
    const replay = await pomodoro.recordCompletedPomodoroSession(input);
    expect(replay).toMatchObject({ id: 'pom_dup_probe', inserted: false });

    // True overlap must also dedupe, not throw a primary-key conflict: the
    // transaction serializer runs the second attempt after the first commits.
    const concurrent = await Promise.all([
      pomodoro.recordCompletedPomodoroSession(input),
      pomodoro.recordCompletedPomodoroSession(input),
    ]);
    expect(concurrent.every((r) => r.inserted === false)).toBe(true);

    const count = await db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM pomodoro_sessions WHERE id = ?',
      ['pom_dup_probe'],
    );
    expect(count?.n).toBe(1);
    await db.closeAsync();
  });

  it('concurrent workout set logs both land without corruption', async () => {
    const db = await freshDatabase();
    const workout = await import('@/features/workout/workout.data');

    await workout.addRoutine('Probe Routine', 'probe routine');
    const routine = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM workout_routines WHERE deleted_at IS NULL',
    );
    expect(routine).toBeDefined();
    const exerciseId = await workout.addExercise({ routineId: routine!.id, name: 'Probe Press' });

    const setInput = {
      exerciseId,
      setNumber: 1,
      activeSeconds: 40,
      restSeconds: 20,
    };
    await Promise.all([workout.addSet(setInput), workout.addSet({ ...setInput })]);

    const sets = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM routine_exercise_sets WHERE exercise_id = ? AND deleted_at IS NULL',
      [exerciseId],
    );
    expect(sets).toHaveLength(2);
    expect(new Set(sets.map((s) => s.id)).size).toBe(2);
    await db.closeAsync();
  });

  it('concurrent saved-meal upserts for one name keep a single row', async () => {
    const db = await freshDatabase();
    const calories = await import('@/features/calories/calories.data');
    const meal = {
      foodName: 'Probe Oats',
      calories: 300,
      protein: 10,
      carbs: 50,
      fats: 5,
      fiber: 4,
      mealType: 'breakfast',
    };

    await Promise.all([calories.upsertSavedMeal(meal), calories.upsertSavedMeal(meal)]);

    const rows = await db.getAllAsync<{ use_count: number }>(
      'SELECT use_count FROM saved_meals WHERE food_name = ?',
      ['Probe Oats'],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.use_count).toBe(2);
    await db.closeAsync();
  });

  it('pomodoro legacy backfill mints one update intent per touched row and is a no-op on retry', async () => {
    const db = await freshDatabase();
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');

    await db.runAsync(
      `INSERT INTO pomodoro_sessions (id, started_at, ended_at, duration_seconds, session_type, created_at)
       VALUES ('pom_legacy_probe', '2026-03-01T10:00:00.000Z', '2026-03-01T10:25:00.000Z', 1500, 'focus', '2026-03-01T10:25:00.000Z')`,
    );
    const updates = {
      associations: [{ sessionId: 'pom_legacy_probe', todoId: 'todo_1', todoTitle: 'Ship it' }],
      notes: [{ sessionId: 'pom_legacy_probe', note: 'deep work' }],
    };
    await pomodoro.backfillLegacyPomodoroSessionMeta(updates);

    const filled = await db.getFirstAsync<{
      linked_todo_id: string | null;
      linked_todo_title: string | null;
      note: string | null;
    }>('SELECT linked_todo_id, linked_todo_title, note FROM pomodoro_sessions WHERE id = ?', [
      'pom_legacy_probe',
    ]);
    expect(filled).toMatchObject({
      linked_todo_id: 'todo_1',
      linked_todo_title: 'Ship it',
      note: 'deep work',
    });

    const intents = (await outboxRows(db)).filter(
      (r) => r.entity === 'pomodoro_sessions' && r.id === 'pom_legacy_probe',
    );
    expect(intents).toHaveLength(1);
    expect(intents[0]?.operation).toBe('update');

    // Crash-retry re-run: NULL predicates match nothing, so no new intent.
    await pomodoro.backfillLegacyPomodoroSessionMeta(updates);
    const afterRetry = (await outboxRows(db)).filter(
      (r) => r.entity === 'pomodoro_sessions' && r.id === 'pom_legacy_probe',
    );
    expect(afterRetry).toHaveLength(1);
    await db.closeAsync();
  });
});
