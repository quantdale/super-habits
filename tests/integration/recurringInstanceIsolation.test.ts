import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addLocalDays, toDateKey } from '@/lib/time';
import { freshDatabase, type TestDatabase } from './helpers/db';

vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '1.0.0' } } }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

const ORIGINAL = { title: 'Stretch', notes: 'Series notes', priority: 'normal' as const };
const OVERRIDE = { title: 'Extra stretch today', notes: 'Only today', priority: 'urgent' as const };

describe('recurring instances do not become the series template', () => {
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

  async function seed() {
    const todos = await import('@/features/todos/todos.data');
    const id = await todos.addTodo({ ...ORIGINAL, recurrence: 'daily' });
    const row = (await db.getFirstAsync<{ recurrence_id: string }>(
      'SELECT recurrence_id FROM todos WHERE id = ?',
      [id],
    ))!;
    return { todos, id, recurrenceId: row.recurrence_id };
  }
  async function future(recurrenceId: string, id: string) {
    return db.getFirstAsync<{
      id: string;
      title: string;
      notes: string;
      priority: string;
      due_date: string;
    }>(
      'SELECT id, title, notes, priority, due_date FROM todos WHERE recurrence_id = ? AND id <> ? AND deleted_at IS NULL AND completed = 0 ORDER BY due_date DESC LIMIT 1',
      [recurrenceId, id],
    );
  }

  it.each(['completion', 'bulk', 'rollover'] as const)(
    'preserves title/notes/priority through %s',
    async (mode) => {
      const { todos, id, recurrenceId } = await seed();
      await todos.updateTodo(id, OVERRIDE);
      if (mode === 'completion') await todos.completeTodo(id);
      else if (mode === 'bulk') await todos.bulkSetTodoCompletion([id], 1);
      else {
        const [template] = await todos.getRecurringTodosByIds([recurrenceId]);
        await todos.createRecurringInstance({
          title: template.title,
          notes: template.notes,
          priority: template.priority,
          recurrenceId,
          dueDate: addLocalDays(toDateKey(), 1),
        });
      }
      expect(await future(recurrenceId, id)).toMatchObject(ORIGINAL);
      expect(
        await db.getFirstAsync('SELECT title, notes, priority FROM todos WHERE id = ?', [id]),
      ).toEqual(OVERRIDE);
    },
  );

  it('changes only the selected occurrence and never pre-creates a future copy on edit', async () => {
    const { todos, id, recurrenceId } = await seed();
    await todos.updateTodo(id, OVERRIDE);
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM todos')).toEqual({ count: 1 });
    expect(await future(recurrenceId, id)).toBeNull();
  });

  it('an instance-only future due date does not shift the series calendar', async () => {
    const { todos, id, recurrenceId } = await seed();
    const today = toDateKey();
    await todos.updateTodo(id, { dueDate: addLocalDays(today, 10) });
    await todos.completeTodo(id);
    expect((await future(recurrenceId, id))!.due_date).toBe(addLocalDays(today, 1));
  });

  it('clearing one occurrence date does not suppress the next-day rollover', async () => {
    const { todos, id, recurrenceId } = await seed();
    await todos.updateTodo(id, { dueDate: null });
    vi.setSystemTime(new Date(2026, 10, 16, 10));
    const { findMissingRecurrenceIds } = await import('@/features/todos/todos.domain');
    expect(
      findMissingRecurrenceIds(await todos.listAllActiveTodosForRecurrence(), toDateKey()),
    ).toContain(recurrenceId);
  });

  it.each(['single', 'bulk'] as const)(
    '%s completion of an undated occurrence scheduled later does not adopt the edited due date as its occurrence day',
    async (mode) => {
      const todos = await import('@/features/todos/todos.data');
      const { findMissingRecurrenceIds } = await import('@/features/todos/todos.domain');
      // Started with `Repeat daily` and no date: the occurrence has NO original
      // date. Scheduling it afterwards edits only the VISIBLE due date.
      const id = await todos.addTodo({
        title: 'Scheduled later',
        recurrence: 'daily',
        dueDate: null,
      });
      const { recurrence_id: recurrenceId } = (await db.getFirstAsync<{
        recurrence_id: string;
      }>('SELECT recurrence_id FROM todos WHERE id = ?', [id]))!;
      const scheduledDueDate = addLocalDays(toDateKey(), 5);
      await todos.updateTodo(id, { dueDate: scheduledDueDate });
      if (mode === 'single') await todos.completeTodo(id);
      else await todos.bulkSetTodoCompletion([id], 1);
      // `recurrence_date_key` is the ORIGINAL occurrence date and stays NULL: a
      // due date edited after creation is not the occurrence this row belonged
      // to. Completion must not back-fill the key from that visible date.
      expect(
        await db.getFirstAsync('SELECT due_date, recurrence_date_key FROM todos WHERE id=?', [id]),
      ).toEqual({ due_date: scheduledDueDate, recurrence_date_key: null });
      // The spawn follows the handled day, not the edited future due date.
      expect((await future(recurrenceId, id))!.due_date).toBe(addLocalDays(toDateKey(), 1));
      // Same day covered: the completed row answers for the day it was handled.
      expect(
        findMissingRecurrenceIds(await todos.listAllActiveTodosForRecurrence(), toDateKey()),
      ).toEqual([]);

      // Reopening retracts that pristine copy, and re-completing must land on
      // the SAME next day. Before the fix the stored key claimed the edited
      // future date, so the second spawn jumped to scheduledDueDate + 1.
      if (mode === 'single') await todos.setTodoCompletionState(id, 0);
      else await todos.bulkSetTodoCompletion([id], 0);
      expect(await future(recurrenceId, id)).toBeNull();
      if (mode === 'single') await todos.completeTodo(id);
      else await todos.bulkSetTodoCompletion([id], 1);
      expect(
        await db.getFirstAsync('SELECT recurrence_date_key FROM todos WHERE id=?', [id]),
      ).toEqual({ recurrence_date_key: null });
      expect((await future(recurrenceId, id))!.due_date).toBe(addLocalDays(toDateKey(), 1));
    },
  );

  it('uses the committed series template rather than stale rollover input', async () => {
    const { todos, recurrenceId } = await seed();
    const [stale] = await todos.getRecurringTodosByIds([recurrenceId]);
    await todos.updateRecurringSeriesTemplate(recurrenceId, { title: 'New series title' });
    await todos.createRecurringInstance({
      title: stale.title,
      notes: stale.notes,
      priority: stale.priority,
      recurrenceId,
      dueDate: addLocalDays(toDateKey(), 1),
    });
    expect(
      await db.getFirstAsync('SELECT title FROM todos WHERE due_date = ?', [
        addLocalDays(toDateKey(), 1),
      ]),
    ).toEqual({ title: 'New series title' });
  });

  it('retracts a pristine canonical follow-up when an overridden occurrence is reopened', async () => {
    const { todos, id, recurrenceId } = await seed();
    await todos.updateTodo(id, OVERRIDE);
    await todos.completeTodo(id);
    expect(await future(recurrenceId, id)).toMatchObject(ORIGINAL);
    await todos.setTodoCompletionState(id, 0);
    expect(await future(recurrenceId, id)).toBeNull();
  });

  it('preserves completed history while later instance overrides cannot overwrite a series edit', async () => {
    const { todos, id, recurrenceId } = await seed();
    await todos.completeTodo(id);
    const completed = await db.getFirstAsync('SELECT * FROM todos WHERE id = ?', [id]);
    const firstFollowUp = (await future(recurrenceId, id))!;
    await todos.updateRecurringSeriesTemplate(recurrenceId, { title: 'New series title' });
    expect(await db.getFirstAsync('SELECT * FROM todos WHERE id = ?', [id])).toEqual(completed);
    await todos.updateTodo(firstFollowUp.id, OVERRIDE);
    await todos.completeTodo(firstFollowUp.id);
    expect(await future(recurrenceId, firstFollowUp.id)).toMatchObject({
      ...ORIGINAL,
      title: 'New series title',
    });
  });

  it('does not resurrect a stopped series from a queued stale spawn', async () => {
    const { todos, recurrenceId } = await seed();
    await todos.stopRecurringSeries(recurrenceId);
    await todos.createRecurringInstance({
      ...ORIGINAL,
      recurrenceId,
      dueDate: addLocalDays(toDateKey(), 1),
    });
    expect(
      await db.getAllAsync(
        "SELECT id FROM todos WHERE recurrence = 'daily' AND deleted_at IS NULL",
      ),
    ).toEqual([]);
  });

  it('refuses a preview payload changed before confirmation without importing any rows', async () => {
    await seed();
    const { exportPortableBackup } = await import('@/core/portable/portableExport');
    const exported = await exportPortableBackup();
    if (!exported.ok) throw new Error(exported.error);
    await db.closeAsync();
    db = await freshDatabase();
    const { preparePortableImport, confirmPortableImport } =
      await import('@/core/portable/portableImport');
    const prepared = await preparePortableImport({
      fileName: exported.fileName,
      text: exported.json,
    });
    if (prepared.status !== 'ready') throw new Error('valid preview rejected');
    prepared.file.entities.todos![0].title = 'Changed after validation';
    expect(await confirmPortableImport({ file: prepared.file })).toMatchObject({
      status: 'blocked',
      reason: 'invalid',
    });
    expect(await db.getAllAsync('SELECT id FROM todos')).toEqual([]);
    expect(await db.getAllAsync('SELECT id FROM todo_recurrence_series')).toEqual([]);
    expect(await db.getAllAsync('SELECT id FROM sync_outbox')).toEqual([]);
  });

  it('retains series identity and one-off isolation across a portable export/import', async () => {
    const { todos, id, recurrenceId } = await seed();
    await todos.updateTodo(id, OVERRIDE);
    const { exportPortableBackup } = await import('@/core/portable/portableExport');
    const exported = await exportPortableBackup();
    if (!exported.ok) throw new Error(exported.error);
    await db.closeAsync();
    db = await freshDatabase();
    const { preparePortableImport, confirmPortableImport } =
      await import('@/core/portable/portableImport');
    const prepared = await preparePortableImport({
      fileName: exported.fileName,
      text: exported.json,
    });
    expect(prepared.status).toBe('ready');
    if (prepared.status !== 'ready') throw new Error('portable recurrence fixture rejected');
    expect((await confirmPortableImport({ file: prepared.file })).status).toBe('restored');
    const restoredTodos = await import('@/features/todos/todos.data');
    await restoredTodos.completeTodo(id);
    expect(await future(recurrenceId, id)).toMatchObject(ORIGINAL);
  });
});
