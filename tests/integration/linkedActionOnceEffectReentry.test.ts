import { afterEach, describe, expect, it } from 'vitest';
import { addLocalDays, toDateKey } from '@/lib/time';
import { freshDatabase, type TestDatabase } from './helpers/db';
import { saveHabitRules, saveTodoRules } from './helpers/linkedActionRules';

/**
 * One produced side effect per (rule, source, source day).
 *
 * `todo.completed` fires once per 0→1 completion, and a user can legitimately
 * untick → retick the same task on the same local day. `habit.completed_for_day`
 * likewise re-fires when a decrement drops the count below the target and the
 * next increment crosses it again. The produced-log effects (`calorie.log`,
 * `pomodoro.log`, `workout.log`) are NOT idempotent by target state — they mint
 * a fresh row per application — so the engine's re-entry guard must recognize
 * the second fire of the same source day as a duplicate, exactly as it already
 * does for `habit.increment`.
 *
 * `openspec/specs/linked-actions-policy-truth/spec.md` states the contract:
 * "re-completion or replay does not duplicate it".
 */
describe('once-per-source-day effects are not re-applied by a re-completion', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  async function backdateHabit(habitId: string): Promise<void> {
    // The shipped write gate refuses pre-creation dates, so a fixture habit
    // used with fixed source days must already exist then.
    await db.runAsync(`UPDATE habits SET created_at = ?, rule_history = ? WHERE id = ?`, [
      '2026-01-01T00:00:00.000Z',
      JSON.stringify([
        { effective_from_date: '2026-01-01', weekdays: [1, 2, 3, 4, 5, 6, 7], target_per_day: 1 },
      ]),
      habitId,
    ]);
  }

  async function countOnce(sql: string, params: (string | number)[]): Promise<number> {
    const row = await db.getFirstAsync<{ n: number }>(sql, params);
    return row?.n ?? 0;
  }

  it('a calorie log fires once for one source task even after untick → retick', async () => {
    db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const sourceId = await todos.addTodo({ title: 'Evening run' });
    await saveTodoRules(sourceId, [
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
    ]);

    await todos.completeTodo(sourceId);
    // Exactly what the Todos checkbox does: untick, then tick again.
    await todos.setTodoCompletionState(sourceId, 0);
    await todos.completeTodo(sourceId);

    expect(
      await countOnce('SELECT COUNT(*) AS n FROM calorie_entries WHERE deleted_at IS NULL', []),
    ).toBe(1);
    expect(
      await countOnce(
        `SELECT COUNT(*) AS n FROM linked_action_executions WHERE status = 'applied'`,
        [],
      ),
    ).toBe(1);

    // A genuine completion on a different day is still a new source action.
    const today = toDateKey();
    const engine = (await import('@/core/linked-actions/linkedActions.engine')).linkedActionsEngine;
    const earlierDay = addLocalDays(today, -1);
    const earlier = await engine.processSourceAction({
      eventId: 'levt_earlier_day',
      occurredAt: `${earlierDay}T09:00:00.000Z`,
      feature: 'todos',
      entityType: 'todo',
      entityId: sourceId,
      triggerType: 'todo.completed',
      sourceDateKey: earlierDay,
    });
    expect(earlier.effects[0]?.status).toBe('applied');
    expect(
      await db.getAllAsync<{ consumed_on: string }>(
        'SELECT consumed_on FROM calorie_entries WHERE deleted_at IS NULL ORDER BY consumed_on',
      ),
    ).toEqual([{ consumed_on: earlierDay }, { consumed_on: today }]);
  });

  it('a focus-session log fires once for one source task even after untick → retick', async () => {
    db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const sourceId = await todos.addTodo({ title: 'Deep work block' });
    await saveTodoRules(sourceId, [
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

    await todos.completeTodo(sourceId);
    await todos.setTodoCompletionState(sourceId, 0);
    await todos.completeTodo(sourceId);

    expect(await countOnce('SELECT COUNT(*) AS n FROM pomodoro_sessions', [])).toBe(1);
    expect(await db.getAllAsync<{ id: string }>('SELECT id FROM pomodoro_sessions')).toHaveLength(
      1,
    );
  });

  it('a focus-session log fires once per source day after a decrement → increment re-crossing', async () => {
    db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const sourceId = await habits.addHabit('Mobility routine', 1);
    await backdateHabit(sourceId);
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
    ]);

    const today = toDateKey();
    await habits.incrementHabit(sourceId, today);
    await habits.decrementHabit(sourceId, today);
    await habits.incrementHabit(sourceId, today);

    expect(await countOnce('SELECT COUNT(*) AS n FROM pomodoro_sessions', [])).toBe(1);
  });

  it('a workout log fires once per source day after a decrement → increment re-crossing', async () => {
    db = await freshDatabase();
    const habits = await import('@/features/habits/habits.data');
    const workout = await import('@/features/workout/workout.data');
    const sourceId = await habits.addHabit('Gym prompt', 1);
    await backdateHabit(sourceId);
    await workout.addRoutine('Push day', '');
    const [routine] = await workout.listRoutines();
    await saveHabitRules(sourceId, [
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
    await habits.decrementHabit(sourceId, today);
    await habits.incrementHabit(sourceId, today);

    expect(await countOnce('SELECT COUNT(*) AS n FROM workout_logs', [])).toBe(1);
  });

  it('control: todo.complete still records a fresh skipped execution on re-fire', async () => {
    db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const sourceId = await todos.addTodo({ title: 'Source' });
    const targetId = await todos.addTodo({ title: 'Target' });
    await saveTodoRules(sourceId, [
      {
        triggerType: 'todo.completed',
        target: {
          feature: 'todos',
          entityType: 'todo',
          entityId: targetId,
          effect: { kind: 'binary', type: 'todo.complete' },
        },
      },
    ]);

    await todos.completeTodo(sourceId);
    await todos.setTodoCompletionState(sourceId, 0);
    await todos.completeTodo(sourceId);

    const executions = await db.getAllAsync<{ status: string }>(
      'SELECT status FROM linked_action_executions ORDER BY created_at ASC, id ASC',
    );
    expect(executions.map((row) => row.status)).toEqual(['applied', 'skipped']);
  });
});
