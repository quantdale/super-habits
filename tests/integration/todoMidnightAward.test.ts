import { beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';
import type { TestDatabase } from './helpers/db';

/**
 * Midnight-straddle double-pay guard for todo rewards.
 *
 * Todo ledger source keys are per-todo-per-day (`<dateKey>:<todoId>`), derived
 * from `toDateKey()` at AWARD time. A completion that lands just before local
 * midnight whose fast-path award re-reads the day just after it gets keyed
 * under the NEXT day — while the todo's `completed_at` belongs to the action
 * day. Housekeeping reconcile finds the todo by `completed_at` inside the
 * action day's range, computes the action-day key, finds no match, and pays
 * the same completion AGAIN (double XP), and the stray next-day row marks a
 * zero-activity day active in the streak/week strip.
 *
 * The habit path guards exactly this failure mode
 * (`shouldAwardHabitFastPath` requires `dateKey === todayKey`); this suite
 * pins the mirrored todo guard: a cross-midnight completion must refuse the
 * fast path and degrade to reconcile, which pays exactly ONCE under the
 * action-day key.
 *
 * The screen contract is emulated faithfully: the action day is bracketed by
 * clock reads around the write (see `TodosScreen.handleToggleTodo`), and the
 * fast path runs only when the gate passes — exactly the call sequence the
 * buggy one-argument gate allowed.
 */

let db: TestDatabase;

beforeEach(async () => {
  db = await freshDatabase();
});

/**
 * Feature data layers must be imported AFTER `freshDatabase()` resets the
 * module registry — a static import would bind the previous test's database.
 */
async function loadModules() {
  const todos = await import('@/features/todos/todos.data');
  const gamification = await import('@/features/gamification/gamification.data');
  const domain = await import('@/features/todos/todos.domain');
  const time = await import('@/lib/time');
  return { todos, gamification, domain, time };
}

describe('todo midnight-straddle award', () => {
  it('a completion that straddles local midnight pays exactly once, on its action day', async () => {
    const { todos, gamification, domain, time } = await loadModules();
    const dayD = time.toDateKey();
    const nextDay = time.addLocalDays(dayD, 1);

    await todos.addTodo({ title: 'Completed just before midnight' });
    const [todo] = await todos.listTodos();
    const result = await todos.toggleTodo(todo);
    expect(result.completed).toBe(1);

    // The screen bracketed the write with these two day reads; the award ran
    // after the boundary, so the fast path must refuse.
    const actionDateKey = dayD;
    const awardDayKey = nextDay;
    if (domain.shouldAwardTodoFastPath(result.completed, actionDateKey, awardDayKey)) {
      await gamification.awardGamificationAction({
        kind: 'todo',
        entityId: todo.id,
        todayKey: awardDayKey,
      });
    }

    // Housekeeping runs across the bounded lookback; both days are exercised
    // so the heal pass lands wherever it would in production.
    await gamification.runGamificationHousekeeping({ todayKey: nextDay });

    const rows = await db.getAllAsync<{ source_key: string; date_key: string }>(
      `SELECT source_key, date_key FROM gamification_events WHERE event_kind = 'todo'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ source_key: `${dayD}:${todo.id}`, date_key: dayD });

    // A second housekeeping pass must stay quiet: the action is paid.
    await gamification.runGamificationHousekeeping({ todayKey: nextDay });
    const again = await db.getFirstAsync<{ value: number }>(
      `SELECT COUNT(*) AS value FROM gamification_events WHERE event_kind = 'todo'`,
    );
    expect(again?.value).toBe(1);
  });

  it('same-day completions still take the fast path (guard is not over-broad)', async () => {
    const { todos, gamification, domain, time } = await loadModules();
    const today = time.toDateKey();

    await todos.addTodo({ title: 'Ordinary same-day completion' });
    const [todo] = await todos.listTodos();
    const result = await todos.toggleTodo(todo);
    expect(result.completed).toBe(1);

    if (domain.shouldAwardTodoFastPath(result.completed, today, today)) {
      const outcome = await gamification.awardGamificationAction({
        kind: 'todo',
        entityId: todo.id,
        todayKey: today,
      });
      expect(outcome?.result.events[0]).toMatchObject({
        kind: 'todo',
        sourceKey: `${today}:${todo.id}`,
      });
    } else {
      throw new Error('same-day completion must pass the fast-path gate');
    }
  });
});
