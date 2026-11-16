import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addLocalDays, toDateKey } from '@/lib/time';
import { freshDatabase, type TestDatabase } from './helpers/db';

describe('recurring notification completion uses the canonical spawn boundary', () => {
  let db: TestDatabase;
  beforeEach(async () => {
    vi.stubEnv('TZ', 'Asia/Manila');
    vi.setSystemTime(new Date(2026, 10, 15, 10));
    db = await freshDatabase();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    await db.closeAsync();
  });

  async function seed() {
    const todos = await import('@/features/todos/todos.data');
    const actions = await import('@/features/todos/todoNotificationActions.data');
    const id = await todos.addTodo({ title: 'Notification repeat', recurrence: 'daily' });
    const input = { todoId: id, actionKey: `done:${id}`, occurrenceId: `reminder:${id}` };
    return { todos, actions, id, input };
  }

  it('undo retracts the notification-created child after a timezone change', async () => {
    const { todos, actions, id, input } = await seed();
    expect((await actions.completeTodoFromNotification(input)).status).toBe('applied');
    const [child] = await todos.listPendingTodos();
    expect(child).toBeDefined();
    vi.stubEnv('TZ', 'Pacific/Honolulu');
    await todos.setTodoCompletionState(id, 0);
    expect((await todos.listPendingTodos()).map((todo) => todo.id)).toEqual([id]);
    expect(
      await db.getFirstAsync('SELECT operation FROM sync_outbox WHERE entity=? AND id=?', [
        'todos',
        child.id,
      ]),
    ).toEqual({ operation: 'delete' });
  });

  it('rolls back the parent, notification claim and intents when spawning fails, then retries once', async () => {
    const { todos, actions, id, input } = await seed();
    const before = await db.getFirstAsync('SELECT * FROM todos WHERE id=?', [id]);
    const intents = await db.getAllAsync('SELECT * FROM sync_outbox ORDER BY entity,id');
    const original = db.runAsync.bind(db);
    const fault = vi.spyOn(db, 'runAsync').mockImplementation(async (sql, params) => {
      if (sql.includes('INSERT INTO todos')) throw new Error('Injected notification spawn failure');
      return original(sql, params);
    });
    await expect(actions.completeTodoFromNotification(input)).rejects.toThrow(
      'Injected notification spawn failure',
    );
    expect(await db.getFirstAsync('SELECT * FROM todos WHERE id=?', [id])).toEqual(before);
    expect(await db.getAllAsync('SELECT * FROM processed_notification_actions')).toEqual([]);
    expect(await db.getAllAsync('SELECT * FROM sync_outbox ORDER BY entity,id')).toEqual(intents);
    fault.mockRestore();
    const results = await Promise.all([
      actions.completeTodoFromNotification(input),
      actions.completeTodoFromNotification(input),
    ]);
    expect(results.map((result) => result.status)).toEqual(['applied', 'duplicate']);
    expect(await todos.listPendingTodos()).toMatchObject([{ recurrence_spawned_by_id: id }]);
  });

  it('uses the supplied completion instant when spawning across midnight', async () => {
    const { todos, actions, input } = await seed();
    const instant = new Date(2026, 10, 15, 23, 59, 59);
    vi.setSystemTime(new Date(2026, 10, 16, 0, 0, 1));
    await actions.completeTodoFromNotification({ ...input, now: instant });
    expect(await todos.listPendingTodos()).toMatchObject([
      { due_date: addLocalDays(toDateKey(instant), 1) },
    ]);
  });
});
