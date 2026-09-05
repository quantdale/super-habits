import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Recurring-series correction against real SQLite: template edits must never
 * rewrite completed history, stopping must make rollover scans permanently
 * unable to respawn the series, and a restart must start a distinct chain.
 * These are the exact resurrection/history-rewrite failure modes the
 * functional-completion contracts forbid.
 */
describe('recurring series correction (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('template edit renames live copies but preserves completed history', async () => {
    db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');

    const id = await todos.addTodo({ title: 'Stretch', recurrence: 'daily' });
    const first = await db.getFirstAsync<{ recurrence_id: string }>(
      'SELECT recurrence_id FROM todos WHERE id = ?',
      [id],
    );
    expect(first?.recurrence_id).toMatch(/^rec_/);

    await todos.toggleTodo({ id } as never);
    const spawned = await db.getFirstAsync<{ id: string; title: string; due_date: string }>(
      `SELECT id, title, due_date FROM todos
       WHERE recurrence_id = ? AND completed = 0 AND deleted_at IS NULL`,
      [first!.recurrence_id],
    );
    expect(spawned).not.toBeNull();

    await todos.updateRecurringSeriesTemplate(first!.recurrence_id, {
      title: 'Morning stretch',
    });

    const completed = await db.getFirstAsync<{ title: string }>(
      'SELECT title FROM todos WHERE id = ?',
      [id],
    );
    expect(completed?.title).toBe('Stretch');
    const renamed = await db.getFirstAsync<{ title: string }>(
      `SELECT title FROM todos WHERE id = ?`,
      [spawned!.id],
    );
    expect(renamed?.title).toBe('Morning stretch');
  });

  it('stopping ends the series forever: no rollover respawn, history stays visible', async () => {
    db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');
    const domain = await import('@/features/todos/todos.domain');

    const id = await todos.addTodo({ title: 'Meds', recurrence: 'daily' });
    const first = await db.getFirstAsync<{ recurrence_id: string }>(
      'SELECT recurrence_id FROM todos WHERE id = ?',
      [id],
    );
    const recId = first!.recurrence_id;

    await todos.toggleTodo({ id } as never);

    await todos.stopRecurringSeries(recId);

    const remaining = await db.getAllAsync<{
      id: string;
      recurrence: string | null;
      deleted_at: string | null;
      completed: 0 | 1;
    }>('SELECT id, recurrence, deleted_at, completed FROM todos WHERE recurrence_id = ?', [recId]);
    expect(remaining.length).toBeGreaterThanOrEqual(2);
    expect(remaining.every((row) => row.recurrence === null)).toBe(true);
    const pending = remaining.filter((row) => row.completed === 0 && row.deleted_at === null);
    expect(pending).toHaveLength(0);
    const history = remaining.find((row) => row.completed === 1);
    expect(history?.deleted_at).toBeNull();

    // The rollover scan must never request a new instance for this series.
    const all = await todos.listAllActiveTodosForRecurrence();
    expect(domain.findMissingRecurrenceIds(all, domain.getTodayDateKey())).not.toContain(recId);

    // Every touched row recorded exactly one durable intent; today's completed
    // row an update, the removed future copy a delete.
    const intents = await db.getAllAsync<{ id: string; operation: string }>(
      `SELECT id, operation FROM sync_outbox WHERE entity = 'todos'`,
    );
    expect(intents.length).toBeGreaterThanOrEqual(2);
    const futureCopy = remaining.find((row) => row.completed === 0 && row.deleted_at !== null);
    expect(intents.find((row) => row.id === futureCopy?.id)?.operation).toBe('delete');
    expect(intents.find((row) => row.id === history?.id)?.operation).toBe('update');
  });

  it('restart creates a fresh independent series', async () => {
    db = await freshDatabase();
    const todos = await import('@/features/todos/todos.data');

    const stoppedId = await todos.addTodo({ title: 'Old', recurrence: 'daily' });
    const stopped = await db.getFirstAsync<{ recurrence_id: string }>(
      'SELECT recurrence_id FROM todos WHERE id = ?',
      [stoppedId],
    );
    await todos.stopRecurringSeries(stopped!.recurrence_id);

    const freshId = await todos.addTodo({ title: 'Journal' });
    await todos.updateTodo(freshId, { recurrence: 'daily' });
    const restarted = await db.getFirstAsync<{ recurrence: string; recurrence_id: string }>(
      'SELECT recurrence, recurrence_id FROM todos WHERE id = ?',
      [freshId],
    );
    expect(restarted?.recurrence).toBe('daily');
    expect(restarted?.recurrence_id).toMatch(/^rec_/);
    expect(restarted?.recurrence_id).not.toBe(stopped!.recurrence_id);
  });
});
