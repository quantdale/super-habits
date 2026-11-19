import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addLocalDays, toDateKey } from '@/lib/time';
import { freshDatabase, type TestDatabase } from './helpers/db';

describe('recurrence lifecycle across the screen rollover scan', () => {
  let db: TestDatabase;
  beforeEach(async () => {
    vi.setSystemTime(new Date(2026, 10, 15, 10));
    db = await freshDatabase();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    await db.closeAsync();
  });

  // The same read -> domain -> materialize path used on a fresh TodosScreen.
  async function rollover() {
    const todos = await import('@/features/todos/todos.data');
    const { findMissingRecurrenceIds } = await import('@/features/todos/todos.domain');
    const missing = findMissingRecurrenceIds(
      await todos.listAllActiveTodosForRecurrence(),
      toDateKey(),
    );
    const templates = await todos.getRecurringTodosByIds(missing);
    await todos.createRecurringInstances(
      templates.map((template) => ({
        title: template.title,
        notes: template.notes,
        priority: template.priority,
        recurrenceId: template.recurrence_id!,
        dueDate: toDateKey(),
      })),
    );
  }

  it.each(['single', 'bulk'] as const)(
    '%s completion of a task created by Repeat daily without a date stays completed on reload',
    async (mode) => {
      const todos = await import('@/features/todos/todos.data');
      const { findMissingRecurrenceIds } = await import('@/features/todos/todos.domain');
      // The editor explicitly sends null when no date is entered.
      const id = await todos.addTodo({ title: 'Daily review', recurrence: 'daily', dueDate: null });
      if (mode === 'single') await todos.completeTodo(id);
      else await todos.bulkSetTodoCompletion([id], 1);
      await rollover();
      expect(await todos.listPendingTodos()).toMatchObject([
        { due_date: addLocalDays(toDateKey(), 1) },
      ]);
      expect(
        await db.getFirstAsync('SELECT completed, due_date FROM todos WHERE id=?', [id]),
      ).toEqual({ completed: 1, due_date: null });
      // Completion must NOT invent an occurrence key: the row was never given
      // a date, and rollover derives its handled day from completed_at instead.
      expect(
        await db.getFirstAsync('SELECT recurrence_date_key FROM todos WHERE id=?', [id]),
      ).toEqual({ recurrence_date_key: null });
      // The completed row covers TODAY (it was handled today), so the same-day
      // reload cannot append a second copy of today's already-handled task.
      expect(
        findMissingRecurrenceIds(await todos.listAllActiveTodosForRecurrence(), toDateKey()),
      ).toEqual([]);
    },
  );

  it.each(['single', 'bulk'] as const)(
    '%s complete/reopen of a cleared-date occurrence keeps its original occurrence date and still rolls over',
    async (mode) => {
      const todos = await import('@/features/todos/todos.data');
      const { findMissingRecurrenceIds } = await import('@/features/todos/todos.domain');
      // Created WITH a date: the occurrence key is the original creation date.
      const id = await todos.addTodo({ title: 'Dated then undated', recurrence: 'daily' });
      const originalKey = toDateKey();
      const recurrenceRow = (await db.getFirstAsync<{ recurrence_id: string }>(
        'SELECT recurrence_id FROM todos WHERE id=?',
        [id],
      ))!;
      // The user clears only the VISIBLE due date; the original occurrence date
      // is not an edit surface and must survive completion and reopen.
      await todos.updateTodo(id, { dueDate: null });
      if (mode === 'single') {
        await todos.completeTodo(id);
        await todos.setTodoCompletionState(id, 0);
      } else {
        await todos.bulkSetTodoCompletion([id], 1);
        await todos.bulkSetTodoCompletion([id], 0);
      }
      expect(
        await db.getFirstAsync(
          'SELECT due_date, recurrence_date_key, completed FROM todos WHERE id=?',
          [id],
        ),
      ).toEqual({ due_date: null, recurrence_date_key: originalKey, completed: 0 });

      vi.setSystemTime(new Date(2026, 10, 16, 10));
      // The original occurrence date covers only itself: the next day is still
      // missing, so the chain keeps producing new copies.
      expect(
        findMissingRecurrenceIds(await todos.listAllActiveTodosForRecurrence(), toDateKey()),
      ).toContain(recurrenceRow.recurrence_id);
      await rollover();
      expect(await todos.listPendingTodos()).toMatchObject([
        { id, due_date: null, completed: 0, recurrence_date_key: originalKey },
        { due_date: toDateKey(), completed: 0 },
      ]);
      expect(
        await db.getAllAsync('SELECT id FROM todos WHERE recurrence_spawned_by_id = ?', [id]),
      ).toHaveLength(1);
    },
  );

  it.each(['single', 'bulk'] as const)(
    '%s undo of an undated completion restores pending coverage on the next day',
    async (mode) => {
      const todos = await import('@/features/todos/todos.data');
      const id = await todos.addTodo({
        title: 'Reopened undated daily task',
        recurrence: 'daily',
        dueDate: null,
      });
      if (mode === 'single') {
        await todos.completeTodo(id);
        await todos.setTodoCompletionState(id, 0);
      } else {
        await todos.bulkSetTodoCompletion([id], 1);
        await todos.bulkSetTodoCompletion([id], 0);
      }
      expect(await todos.listPendingTodos()).toMatchObject([{ id, due_date: null }]);
      vi.setSystemTime(new Date(2026, 10, 16, 10));
      await rollover();
      const pending = await todos.listPendingTodos();
      expect(pending).toHaveLength(1);
      expect(pending[0]).toMatchObject({
        id,
        completed: 0,
        due_date: null,
        recurrence_date_key: null,
      });
      expect(
        await db.getFirstAsync('SELECT operation FROM sync_outbox WHERE entity = ? AND id = ?', [
          'todos',
          id,
        ]),
      ).toEqual({ operation: 'update' });
    },
  );

  it('a deliberately deleted future copy is not recreated by completing its parent again', async () => {
    const todos = await import('@/features/todos/todos.data');
    const id = await todos.addTodo({ title: 'Skip tomorrow', recurrence: 'daily' });
    await todos.completeTodo(id);
    const [child] = await todos.listPendingTodos();
    await todos.removeTodo(child.id);
    await todos.setTodoCompletionState(id, 0);
    await todos.completeTodo(id);
    expect(await todos.listPendingTodos()).toEqual([]);
    expect(
      await db.getFirstAsync('SELECT operation FROM sync_outbox WHERE entity=? AND id=?', [
        'todos',
        child.id,
      ]),
    ).toEqual({ operation: 'delete' });
  });

  it('automatic undo retraction still permits a fresh child on recompletion', async () => {
    const todos = await import('@/features/todos/todos.data');
    const id = await todos.addTodo({ title: 'Undo repeat', recurrence: 'daily' });
    await todos.completeTodo(id);
    const [child] = await todos.listPendingTodos();
    await todos.setTodoCompletionState(id, 0);
    await todos.completeTodo(id);
    const pending = await todos.listPendingTodos();
    expect(pending).toHaveLength(1);
    expect(pending[0].id).not.toBe(child.id);
    expect(pending[0].recurrence_spawned_by_id).toBe(id);
  });

  it.each(['single', 'bulk'] as const)(
    "%s deletion of today's occurrence survives the next screen load",
    async (mode) => {
      const todos = await import('@/features/todos/todos.data');
      const id = await todos.addTodo({ title: 'Skip today', recurrence: 'daily' });
      if (mode === 'single') await todos.removeTodo(id);
      else await todos.bulkRemoveTodos([id]);
      await rollover();
      expect(await todos.listTodos()).toEqual([]);
      vi.setSystemTime(new Date(2026, 10, 16, 10));
      await rollover();
      expect(await todos.listTodos()).toMatchObject([{ due_date: toDateKey(), completed: 0 }]);
    },
  );

  it('deleting an undated occurrence skips only the current day', async () => {
    const todos = await import('@/features/todos/todos.data');
    const id = await todos.addTodo({ title: 'Undated skip', recurrence: 'daily', dueDate: null });
    await todos.removeTodo(id);
    await rollover();
    expect(await todos.listTodos()).toEqual([]);
    vi.setSystemTime(new Date(2026, 10, 16, 10));
    await rollover();
    expect(await todos.listTodos()).toMatchObject([{ due_date: toDateKey() }]);
  });

  it('keeps the existing pending-undated coverage until that task is handled', async () => {
    const todos = await import('@/features/todos/todos.data');
    const id = await todos.addTodo({ title: 'Still pending', recurrence: 'daily', dueDate: null });
    vi.setSystemTime(new Date(2026, 10, 18, 10));
    await rollover();
    expect(await todos.listTodos()).toMatchObject([{ id, due_date: null, completed: 0 }]);
  });

  it.each([
    [2026, 2, 8],
    [2026, 10, 1],
  ])(
    'handles an undated completion on DST date %i/%i/%i without duplicate rollover',
    async (year, month, day) => {
      vi.setSystemTime(new Date(year, month, day, 0, 59));
      const todos = await import('@/features/todos/todos.data');
      const id = await todos.addTodo({ title: 'DST repeat', recurrence: 'daily', dueDate: null });
      await todos.completeTodo(id);
      const tomorrow = addLocalDays(toDateKey(), 1);
      vi.setSystemTime(new Date(year, month, day, 23, 59));
      await rollover();
      expect(await todos.listPendingTodos()).toMatchObject([{ due_date: tomorrow }]);
      vi.setSystemTime(new Date(year, month, day + 1, 0, 1));
      await rollover();
      expect(await todos.listPendingTodos()).toMatchObject([{ due_date: tomorrow }]);
    },
  );
});
