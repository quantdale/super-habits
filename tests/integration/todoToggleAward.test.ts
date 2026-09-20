import { beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';
import type { TestDatabase } from './helpers/db';

/**
 * Todo toggle-result gating for the gamification fast path.
 *
 * `TodosScreen.handleToggleTodo` must gate `recordAction('todo', todo.id)` on
 * the confirmed toggle result (`shouldAwardTodoFastPath(result.completed)`,
 * mirroring `shouldAwardHabitFastPath`), not on the stale pre-toggle prop.
 * `setTodoCompletion` returns `completed: 0` (not a throw) for missing or
 * soft-deleted rows and lost races, and for the un-complete direction — and
 * `awardGamificationAction` with an explicit todo id awards unconditionally
 * (ledger idempotency only), so a stale-prop award would mint phantom XP and
 * block the later reconcile award for the same id via the unique
 * (kind, source_key) index.
 *
 * This suite pins the data-layer half of that contract: a confirmed
 * completion awards exactly once through the fast path; a failed or
 * non-completed toggle mints nothing; and a real completion that skips the
 * fast path is still healed by reconcile backfill with the exact entity id.
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

async function countTodoEvents(): Promise<number> {
  const row = await db.getFirstAsync<{ value: number }>(
    `SELECT COUNT(*) AS value FROM gamification_events WHERE event_kind = 'todo'`,
  );
  return row?.value ?? 0;
}

describe('todo toggle-result gating', () => {
  it('a confirmed completion passes the gate and awards exactly once', async () => {
    const { todos, gamification, domain, time } = await loadModules();
    const today = time.toDateKey();

    await todos.addTodo({ title: 'Gate confirmed completion' });
    const [todo] = await todos.listTodos();
    const result = await todos.toggleTodo(todo);
    expect(result.completed).toBe(1);
    expect(domain.shouldAwardTodoFastPath(result.completed)).toBe(true);

    const outcome = await gamification.awardGamificationAction({
      kind: 'todo',
      entityId: todo.id,
      todayKey: today,
    });
    expect(outcome?.result.events[0]).toMatchObject({ kind: 'todo', sourceKey: todo.id });

    // Replays can never double-award; reconcile stays quiet afterwards.
    expect(
      await gamification.awardGamificationAction({
        kind: 'todo',
        entityId: todo.id,
        todayKey: today,
      }),
    ).toBeNull();
    expect(await gamification.reconcileGamificationActivity({ todayKey: today })).toMatchObject({
      awarded: 0,
    });
    expect(await countTodoEvents()).toBe(1);
  });

  it('a failed or non-completed toggle fails the gate and mints nothing', async () => {
    const { todos, gamification, domain, time } = await loadModules();
    const today = time.toDateKey();

    // Missing row: the data layer returns completed 0 instead of throwing.
    const missing = await todos.setTodoCompletionState('todo_missing_ghost', 1);
    expect(missing.completed).toBe(0);
    expect(domain.shouldAwardTodoFastPath(missing.completed)).toBe(false);

    // Un-complete direction: completing then reopening ends pending.
    await todos.addTodo({ title: 'Gate un-complete direction' });
    const [todo] = await todos.listTodos();
    const completed = await todos.toggleTodo(todo);
    expect(completed.completed).toBe(1);
    const reopened = await todos.toggleTodo({ ...todo, completed: 1 });
    expect(reopened.completed).toBe(0);
    expect(domain.shouldAwardTodoFastPath(reopened.completed)).toBe(false);

    // The screen follows the gate, so no fast-path award fires for either.
    // The reopened todo ends pending, the ghost never existed: reconcile
    // finds no completed todo and mints nothing.
    expect(await gamification.reconcileGamificationActivity({ todayKey: today })).toMatchObject({
      awarded: 0,
    });
    expect(await countTodoEvents()).toBe(0);
  });

  it('reconcile heals a real completion that skipped the fast path', async () => {
    const { todos, gamification, time } = await loadModules();
    const today = time.toDateKey();

    await todos.addTodo({ title: 'Gate reconcile heals' });
    const [todo] = await todos.listTodos();
    const result = await todos.toggleTodo(todo);
    expect(result.completed).toBe(1);

    // Fast path missed entirely: no awardGamificationAction call.
    const reconciled = await gamification.reconcileGamificationActivity({ todayKey: today });
    expect(reconciled.awarded).toBe(1);
    const keys = await db.getAllAsync<{ source_key: string }>(
      `SELECT source_key FROM gamification_events WHERE event_kind = 'todo'`,
    );
    expect(keys.map((row) => row.source_key)).toEqual([todo.id]);

    const second = await gamification.reconcileGamificationActivity({ todayKey: today });
    expect(second.awarded).toBe(0);
    expect(await countTodoEvents()).toBe(1);
  });
});
