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

  it('preserves an original occurrence date when a cleared-date copy is completed from a notification', async () => {
    const todos = await import('@/features/todos/todos.data');
    const actions = await import('@/features/todos/todoNotificationActions.data');
    // Created WITH a date: that date is the ORIGINAL occurrence, not an edit.
    const id = await todos.addTodo({ title: 'Notification dated repeat', recurrence: 'daily' });
    const originalKey = toDateKey();
    const input = { todoId: id, actionKey: `done:${id}`, occurrenceId: `reminder:${id}` };
    // Clearing the VISIBLE due date is not an occurrence-date edit.
    await todos.updateTodo(id, { dueDate: null });
    expect((await actions.completeTodoFromNotification(input)).status).toBe('applied');
    expect(
      await db.getFirstAsync('SELECT due_date, recurrence_date_key FROM todos WHERE id=?', [id]),
    ).toEqual({ due_date: null, recurrence_date_key: originalKey });
  });

  it('keeps an occurrence scheduled after creation keyless and spawns from the handled day', async () => {
    const todos = await import('@/features/todos/todos.data');
    const actions = await import('@/features/todos/todoNotificationActions.data');
    // Started without a date, then scheduled later: the visible due date is an
    // edit, not the occurrence date the row was created for.
    const id = await todos.addTodo({
      title: 'Notification scheduled later',
      recurrence: 'daily',
      dueDate: null,
    });
    const scheduledDueDate = addLocalDays(toDateKey(), 5);
    await todos.updateTodo(id, { dueDate: scheduledDueDate });
    const input = { todoId: id, actionKey: `done:${id}`, occurrenceId: `reminder:${id}` };
    expect((await actions.completeTodoFromNotification(input)).status).toBe('applied');
    expect(
      await db.getFirstAsync('SELECT due_date, recurrence_date_key FROM todos WHERE id=?', [id]),
    ).toEqual({ due_date: scheduledDueDate, recurrence_date_key: null });
    // The spawn follows the handled day, not the edited future due date; the
    // stored key and the next spawn therefore agree on the same occurrence gap.
    expect(await todos.listPendingTodos()).toMatchObject([
      { due_date: addLocalDays(toDateKey(), 1) },
    ]);
  });

  it('never invents an occurrence date for an undated copy completed from a notification', async () => {
    const todos = await import('@/features/todos/todos.data');
    const actions = await import('@/features/todos/todoNotificationActions.data');
    const id = await todos.addTodo({
      title: 'Notification undated repeat',
      recurrence: 'daily',
      dueDate: null,
    });
    const input = { todoId: id, actionKey: `done:${id}`, occurrenceId: `reminder:${id}` };
    expect((await actions.completeTodoFromNotification(input)).status).toBe('applied');
    // Completion derives the handled day from completed_at; it must not persist
    // an occurrence key that a later reopen would read as an ORIGINAL date.
    expect(
      await db.getFirstAsync('SELECT due_date, recurrence_date_key FROM todos WHERE id=?', [id]),
    ).toEqual({ due_date: null, recurrence_date_key: null });
    // The handled day stays covered, so a same-day reload adds no duplicate.
    const { findMissingRecurrenceIds } = await import('@/features/todos/todos.domain');
    expect(
      findMissingRecurrenceIds(await todos.listAllActiveTodosForRecurrence(), toDateKey()),
    ).toEqual([]);
  });
});
