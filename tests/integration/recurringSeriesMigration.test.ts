import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDatabase, freshDatabase, type TestDatabase } from './helpers/db';
import type { Todo } from '@/core/db/types';

const ISO = '2026-11-15T10:00:00.000Z';
const visibleColumns =
  'id, title, notes, priority, completed, due_date, recurrence, recurrence_id, created_at, updated_at, deleted_at, completed_at';

describe('recurrence migration 26 over a genuine frozen schema 25', () => {
  let directory: string;
  let filename: string;
  let db: TestDatabase | undefined;
  beforeEach(async () => {
    vi.setSystemTime(new Date(ISO));
    directory = mkdtempSync(path.join(tmpdir(), 'superhabits-recurrence-upgrade-'));
    filename = path.join(directory, 'fixture.db');
    const seed = createTestDatabase(filename);
    await seed.execAsync(`
      CREATE TABLE app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      CREATE TRIGGER freeze_v25 BEFORE INSERT ON app_meta
      WHEN NEW.key = 'db_schema_version' AND NEW.value = '26'
      BEGIN SELECT RAISE(ABORT, 'injected migration freeze at v25'); END;
    `);
    await seed.closeAsync();
    await expect(freshDatabase(filename)).rejects.toThrow('injected migration freeze at v25');
    db = createTestDatabase(filename);
    expect(
      await db.getFirstAsync("SELECT value FROM app_meta WHERE key = 'db_schema_version'"),
    ).toEqual({ value: '25' });
    expect(
      await db.getFirstAsync(
        "SELECT name FROM sqlite_master WHERE name = 'todo_recurrence_series'",
      ),
    ).toBeNull();
    await db.runAsync(
      `INSERT INTO todos (id, title, notes, priority, completed, due_date, recurrence, recurrence_id, created_at, updated_at, completed_at)
      VALUES ('todo_1', 'Historical title', 'History', 'normal', 1, '2026-11-15', 'daily', 'rec_1', ?, ?, ?)`,
      [ISO, ISO, ISO],
    );
    await db.runAsync(
      `INSERT INTO todos (id, title, notes, priority, completed, due_date, recurrence, recurrence_id, created_at, updated_at)
      VALUES ('todo_2', 'Series title', 'Series notes', 'normal', 0, '2026-11-16', 'daily', 'rec_1', ?, ?)`,
      [ISO, ISO],
    );
  });
  afterEach(async () => {
    await db?.closeAsync();
    vi.useRealTimers();
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  async function upgrade() {
    await db!.execAsync('DROP TRIGGER freeze_v25;');
    await db!.closeAsync();
    db = await freshDatabase(filename);
    return db;
  }

  it('reconstructs a live pending template, preserves history, and retains isolation after restart', async () => {
    const before = await db!.getAllAsync(`SELECT ${visibleColumns} FROM todos ORDER BY id`);
    const current = await upgrade();
    expect(await current.getAllAsync(`SELECT ${visibleColumns} FROM todos ORDER BY id`)).toEqual(
      before,
    );
    expect(
      await current.getFirstAsync('SELECT id, title, notes, priority FROM todo_recurrence_series'),
    ).toEqual({ id: 'rec_1', title: 'Series title', notes: 'Series notes', priority: 'normal' });
    expect(await current.getAllAsync('SELECT id FROM sync_outbox')).toEqual([]);
    const todos = await import('@/features/todos/todos.data');
    await todos.updateTodo('todo_2', {
      title: 'Only this copy',
      notes: 'Only today',
      priority: 'urgent',
    });
    await current.closeAsync();
    db = await freshDatabase(filename);
    const restarted = await import('@/features/todos/todos.data');
    await restarted.completeTodo('todo_2');
    expect(
      await db.getFirstAsync(
        "SELECT title, notes, priority, due_date FROM todos WHERE id NOT IN ('todo_1','todo_2') AND deleted_at IS NULL",
      ),
    ).toEqual({
      title: 'Series title',
      notes: 'Series notes',
      priority: 'normal',
      due_date: '2026-11-17',
    });
    expect(await db.getFirstAsync('SELECT COUNT(*) AS count FROM todo_recurrence_series')).toEqual({
      count: 1,
    });
  });

  it('rolls back the new table, columns and reconstruction if the version bump fails', async () => {
    const before = await db!.getAllAsync(`SELECT ${visibleColumns} FROM todos ORDER BY id`);
    await db!.closeAsync();
    db = undefined;
    await expect(freshDatabase(filename)).rejects.toThrow('injected migration freeze at v25');
    db = createTestDatabase(filename);
    expect(
      await db.getFirstAsync("SELECT value FROM app_meta WHERE key = 'db_schema_version'"),
    ).toEqual({ value: '25' });
    expect(
      await db.getFirstAsync(
        "SELECT name FROM sqlite_master WHERE name = 'todo_recurrence_series'",
      ),
    ).toBeNull();
    expect(
      (await db.getAllAsync<{ name: string }>('PRAGMA table_info(todos)')).map((row) => row.name),
    ).not.toContain('recurrence_date_key');
    expect(await db.getAllAsync(`SELECT ${visibleColumns} FROM todos ORDER BY id`)).toEqual(before);
    await upgrade();
    expect(
      await db.getFirstAsync("SELECT value FROM app_meta WHERE key = 'db_schema_version'"),
    ).toEqual({ value: '27' });
  });

  it.each(['migration', 'legacy restore'] as const)(
    'does not retract a same-tick edited legacy follow-up after %s',
    async (mode) => {
      await db!.runAsync(
        "UPDATE todos SET title='Edited future copy', notes='Keep this', priority='urgent' WHERE id='todo_2'",
      );
      if (mode === 'migration') await upgrade();
      else {
        const rows = await db!.getAllAsync<Todo>('SELECT * FROM todos ORDER BY id');
        await db!.closeAsync();
        db = await freshDatabase();
        const { applyRemoteTodos } = await import('@/features/todos/todos.data');
        await applyRemoteTodos(db as never, rows);
      }
      const todos = await import('@/features/todos/todos.data');
      await todos.setTodoCompletionState('todo_1', 0);
      expect(
        await db!.getFirstAsync('SELECT title, deleted_at FROM todos WHERE id = ?', ['todo_2']),
      ).toEqual({ title: 'Edited future copy', deleted_at: null });
    },
  );
});
