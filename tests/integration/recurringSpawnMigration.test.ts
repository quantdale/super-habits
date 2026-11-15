import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestDatabase, freshDatabase, type TestDatabase } from './helpers/db';

const ISO = '2026-11-15T01:30:00.000Z';
const SNAPSHOT_COLUMNS =
  'id,title,completed,completed_at,due_date,recurrence,recurrence_id,recurrence_date_key,recurrence_touched,created_at,updated_at,deleted_at';

describe('completion-spawn migration 27 over genuine schema 26', () => {
  let directory: string;
  let filename: string;
  let db: TestDatabase | undefined;
  beforeEach(async () => {
    vi.stubEnv('TZ', 'Asia/Manila');
    vi.setSystemTime(new Date(ISO));
    directory = mkdtempSync(path.join(tmpdir(), 'superhabits-spawn-upgrade-'));
    filename = path.join(directory, 'fixture.db');
    const seed = createTestDatabase(filename);
    await seed.execAsync(`CREATE TABLE app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      CREATE TRIGGER freeze_v26 BEFORE INSERT ON app_meta
      WHEN NEW.key = 'db_schema_version' AND NEW.value = '27'
      BEGIN SELECT RAISE(ABORT,'injected freeze at v26'); END;`);
    await seed.closeAsync();
    await expect(freshDatabase(filename)).rejects.toThrow('injected freeze at v26');
    db = createTestDatabase(filename);
    expect(
      await db.getFirstAsync("SELECT value FROM app_meta WHERE key='db_schema_version'"),
    ).toEqual({ value: '26' });
    expect(
      (await db.getAllAsync<{ name: string }>('PRAGMA table_info(todos)')).map((r) => r.name),
    ).not.toContain('recurrence_spawned_by_id');
    await db.runAsync(
      'INSERT INTO todo_recurrence_series(id,title,priority,created_at,updated_at) VALUES(?,?,?,?,?)',
      ['rec_1', 'Series', 'normal', ISO, ISO],
    );
    await db.runAsync(
      `INSERT INTO todos(id,title,completed,completed_at,due_date,recurrence,recurrence_id,recurrence_date_key,recurrence_touched,created_at,updated_at)
      VALUES('todo_1','Parent',1,?,'2026-11-01','daily','rec_1','2026-11-01',1,?,?),
            ('todo_2','Legacy copy',0,NULL,'2026-11-16','daily','rec_1','2026-11-16',0,?,?)`,
      [ISO, ISO, ISO, ISO, ISO],
    );
  });
  afterEach(async () => {
    await db?.closeAsync();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  async function upgrade() {
    await db!.execAsync('DROP TRIGGER freeze_v26;');
    await db!.closeAsync();
    db = await freshDatabase(filename);
    return db;
  }

  it('preserves existing bytes, does not guess old parents, and retains unproven copies on undo', async () => {
    const before = await db!.getAllAsync(`SELECT ${SNAPSHOT_COLUMNS} FROM todos ORDER BY id`);
    const current = await upgrade();
    expect(await current.getAllAsync(`SELECT ${SNAPSHOT_COLUMNS} FROM todos ORDER BY id`)).toEqual(
      before,
    );
    expect(await current.getAllAsync('SELECT recurrence_spawned_by_id FROM todos')).toEqual([
      { recurrence_spawned_by_id: null },
      { recurrence_spawned_by_id: null },
    ]);
    expect(await current.getAllAsync('SELECT * FROM sync_outbox')).toEqual([]);
    vi.stubEnv('TZ', 'Pacific/Honolulu');
    const { setTodoCompletionState } = await import('@/features/todos/todos.data');
    await setTodoCompletionState('todo_1', 0);
    expect(
      await current.getFirstAsync('SELECT deleted_at FROM todos WHERE id=?', ['todo_2']),
    ).toEqual({ deleted_at: null });
  });

  it('rolls back the column/index when its version bump fails', async () => {
    const before = await db!.getAllAsync(`SELECT ${SNAPSHOT_COLUMNS} FROM todos ORDER BY id`);
    await db!.closeAsync();
    db = undefined;
    await expect(freshDatabase(filename)).rejects.toThrow('injected freeze at v26');
    db = createTestDatabase(filename);
    expect(
      (await db.getAllAsync<{ name: string }>('PRAGMA table_info(todos)')).map((r) => r.name),
    ).not.toContain('recurrence_spawned_by_id');
    expect(
      await db.getFirstAsync(
        "SELECT name FROM sqlite_master WHERE name='idx_todos_recurrence_spawn_parent'",
      ),
    ).toBeNull();
    expect(await db.getAllAsync(`SELECT ${SNAPSHOT_COLUMNS} FROM todos ORDER BY id`)).toEqual(
      before,
    );
    await upgrade();
    expect(
      await db.getFirstAsync("SELECT value FROM app_meta WHERE key='db_schema_version'"),
    ).toEqual({ value: '27' });
  });

  it('persists newly authored parent links across restart and a timezone move', async () => {
    await upgrade();
    const { completeTodo } = await import('@/features/todos/todos.data');
    await completeTodo('todo_2');
    const child = await db!.getFirstAsync<{ id: string }>(
      'SELECT id FROM todos WHERE recurrence_spawned_by_id=?',
      ['todo_2'],
    );
    expect(child).not.toBeNull();
    await db!.closeAsync();
    vi.stubEnv('TZ', 'Pacific/Honolulu');
    db = await freshDatabase(filename);
    const { setTodoCompletionState } = await import('@/features/todos/todos.data');
    await setTodoCompletionState('todo_2', 0);
    expect(await db.getFirstAsync('SELECT deleted_at FROM todos WHERE id=?', [child!.id])).toEqual({
      deleted_at: expect.any(String),
    });
  });
});
