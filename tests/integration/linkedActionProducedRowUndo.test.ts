import { afterEach, describe, expect, it } from 'vitest';
import { toDateKey } from '@/lib/time';
import { freshDatabase, type TestDatabase } from './helpers/db';
import { saveTodoRules } from './helpers/linkedActionRules';

/**
 * Driver question for the per-source-day dedupe (cfdc446f): does an untick of
 * the source REVERSE the produced row (delete the calorie entry / focus
 * session / workout log), which would turn the dedupe into "zero rows after
 * untick → retick"?
 *
 * Answer pinned here against real SQLite: source reopen/decrement is NOT an
 * undo. The data layer's only reopen compensation is the pristine recurring-copy
 * retraction (`removePristineSpawnedCopyWithinTransaction`); no path consumes
 * `linked_action_executions.produced_entity_id` to delete or reverse an effect,
 * and no `linked_action_rules.deleted_at`/src reopen dispatch exists. So the
 * produced row persists across untick, and the second tick's fire is a
 * duplicate — leaving EXACTLY ONE produced row, not zero.
 *
 * Counts are asserted at each step: tick (1), untick (still 1), retick (1).
 */
describe('produced-row effects are not reversed by a source untick', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  async function producedRows(): Promise<{
    calories: { id: string }[];
    sessions: { id: string }[];
    workouts: { id: string }[];
    executions: { status: string; produced_entity_id: string | null }[];
  }> {
    return {
      calories: await db.getAllAsync<{ id: string }>(
        'SELECT id FROM calorie_entries WHERE deleted_at IS NULL',
      ),
      sessions: await db.getAllAsync<{ id: string }>('SELECT id FROM pomodoro_sessions'),
      workouts: await db.getAllAsync<{ id: string }>('SELECT id FROM workout_logs'),
      executions: await db.getAllAsync<{ status: string; produced_entity_id: string | null }>(
        'SELECT status, produced_entity_id FROM linked_action_executions ORDER BY created_at ASC, id ASC',
      ),
    };
  }

  async function authorTodoLogRules(todoId: string): Promise<void> {
    await saveTodoRules(todoId, [
      {
        triggerType: 'todo.completed',
        target: {
          feature: 'calories',
          entityType: 'calorie_log',
          entityId: null,
          effect: {
            kind: 'log',
            type: 'calorie.log',
            dateStrategy: 'today',
            templateSource: 'inline',
            savedMealId: null,
            foodName: 'Post-run smoothie',
            calories: 250,
            protein: 0,
            carbs: 0,
            fats: 0,
            fiber: 0,
            mealType: 'snack',
          },
        },
      },
      {
        triggerType: 'todo.completed',
        target: {
          feature: 'pomodoro',
          entityType: 'pomodoro_session',
          entityId: null,
          effect: {
            kind: 'log',
            type: 'pomodoro.log',
            sessionType: 'focus',
            durationSeconds: 1500,
          },
        },
      },
    ]);
  }

  it('tick → untick → retick leaves exactly one produced row per effect (never zero)', async () => {
    db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const sourceId = await todos.addTodo({ title: 'Evening wind-down' });
    await authorTodoLogRules(sourceId);

    // Step 1 — tick: every produced-row effect applies once.
    await todos.completeTodo(sourceId);
    const afterTick = await producedRows();
    expect(afterTick.calories).toHaveLength(1);
    expect(afterTick.sessions).toHaveLength(1);
    expect(afterTick.workouts).toHaveLength(0);
    expect(afterTick.executions.map((row) => row.status)).toEqual(['applied', 'applied']);
    const producedIds = {
      calorie: afterTick.calories[0].id,
      session: afterTick.sessions[0].id,
    };

    // Step 2 — untick: NO reverse/undo path exists, so the rows stay put and
    // the executions stay terminal (no compensating execution is written).
    await todos.setTodoCompletionState(sourceId, 0);
    const afterUntick = await producedRows();
    expect(afterUntick.calories).toHaveLength(1);
    expect(afterUntick.sessions).toHaveLength(1);
    expect(afterUntick.workouts).toHaveLength(0);
    expect(afterUntick.calories[0].id).toBe(producedIds.calorie);
    expect(afterUntick.sessions[0].id).toBe(producedIds.session);
    // Still exactly the two original terminal receipts — an untick writes
    // no event and no execution (only a genuine 0→1 completion does).
    expect(afterUntick.executions.map((row) => row.status)).toEqual(['applied', 'applied']);

    // Step 3 — retick: classified duplicate, so the same produced rows remain
    // and none is re-minted. NOT zero (no reversal happened) and NOT six.
    await todos.completeTodo(sourceId);
    const afterRetick = await producedRows();
    expect(afterRetick.calories).toHaveLength(1);
    expect(afterRetick.sessions).toHaveLength(1);
    expect(afterRetick.workouts).toHaveLength(0);
    expect(afterRetick.calories[0].id).toBe(producedIds.calorie);
    expect(afterRetick.sessions[0].id).toBe(producedIds.session);

    // The retick did fire (a new source event exists), it just resolved to the
    // existing durable receipts instead of minting new rows.
    const events = await db.getAllAsync<{ id: string }>('SELECT id FROM linked_action_events');
    expect(events).toHaveLength(2);
    expect(
      await db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM sync_outbox WHERE entity IN (?, ?)',
        ['calorie_entries', 'pomodoro_sessions'],
      ),
    ).toEqual({ n: 2 });
  });

  it('habit decrement → increment also leaves the produced rows intact (exactly one)', async () => {
    db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const workout = await import('@/features/workout/workout.data');
    const sourceId = await habits.addHabit('Mobility routine', 1);
    await workout.addRoutine('Mobility flow', '');
    const [routine] = await workout.listRoutines();
    await db.runAsync(`UPDATE habits SET created_at = ?, rule_history = ? WHERE id = ?`, [
      '2026-01-01T00:00:00.000Z',
      JSON.stringify([
        { effective_from_date: '2026-01-01', weekdays: [1, 2, 3, 4, 5, 6, 7], target_per_day: 1 },
      ]),
      sourceId,
    ]);
    const { saveHabitRules } = await import('./helpers/linkedActionRules');
    await saveHabitRules(sourceId, [
      {
        triggerType: 'habit.completed_for_day',
        target: {
          feature: 'pomodoro',
          entityType: 'pomodoro_session',
          entityId: null,
          effect: {
            kind: 'log',
            type: 'pomodoro.log',
            sessionType: 'focus',
            durationSeconds: 900,
          },
        },
      },
      {
        triggerType: 'habit.completed_for_day',
        target: {
          feature: 'workout',
          entityType: 'workout_routine',
          entityId: routine.id,
          effect: { kind: 'log', type: 'workout.log', notes: null },
        },
      },
    ]);

    const today = toDateKey();
    await habits.incrementHabit(sourceId, today);
    const afterIncrement = await producedRows();
    expect(afterIncrement.sessions).toHaveLength(1);
    expect(afterIncrement.workouts).toHaveLength(1);

    // Decrement hard-deletes the source COMPLETION row — the produced session is
    // untouched (no reverse path), which is what makes the retick dedupe safe.
    await habits.decrementHabit(sourceId, today);
    const afterDecrement = await producedRows();
    expect(afterDecrement.sessions).toHaveLength(1);
    expect(afterDecrement.workouts).toHaveLength(1);
    expect(
      await db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM habit_completions WHERE habit_id = ?',
        [sourceId],
      ),
    ).toEqual({ n: 0 });

    await habits.incrementHabit(sourceId, today);
    const afterRecross = await producedRows();
    expect(afterRecross.sessions).toHaveLength(1);
    expect(afterRecross.workouts).toHaveLength(1);
    expect(afterRecross.sessions[0].id).toBe(afterDecrement.sessions[0].id);
    expect(afterRecross.workouts[0].id).toBe(afterDecrement.workouts[0].id);
  });
});
