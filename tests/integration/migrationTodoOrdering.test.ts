import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestDatabase, freshDatabase, type TestDatabase } from './helpers/db';
import type { Todo } from '@/core/db/types';
import type { BackupEntity } from '@/core/backup/backup.types';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

const dirs: string[] = [];
const handles: TestDatabase[] = [];
const closed = new WeakSet<TestDatabase>();
const early = '2026-01-01T10:00:00.000Z';
const late = '2026-01-02T10:00:00.000Z';

function fixtureFile(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-todo-ordering-'));
  dirs.push(dir);
  return path.join(dir, 'superhabits.db');
}

function openRaw(file: string): TestDatabase {
  const db = createTestDatabase(file);
  handles.push(db);
  return db;
}

async function reopen(file: string): Promise<TestDatabase> {
  const db = await freshDatabase(file);
  handles.push(db);
  return db;
}

async function close(db: TestDatabase): Promise<void> {
  if (closed.has(db)) return;
  await db.closeAsync();
  closed.add(db);
}

afterEach(async () => {
  for (const db of handles.splice(0)) await close(db);
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

function seedV5(db: TestDatabase): void {
  db.raw.exec(`
    CREATE TABLE app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    INSERT INTO app_meta VALUES ('db_schema_version', '5');
    CREATE TABLE todos (
      id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, notes TEXT,
      completed INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL, deleted_at TEXT
    );
  `);
  const insert = db.raw.prepare('INSERT INTO todos VALUES (?, ?, NULL, 0, ?, ?, NULL)');
  // Insertion order deliberately differs from both creation and display order.
  insert.run('todo_b', 'Newer', late, late);
  insert.run('todo_a', 'Older', early, early);
}

function addOrderingColumns(db: TestDatabase): void {
  db.raw.exec(`
    ALTER TABLE todos ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE todos ADD COLUMN due_date TEXT;
    ALTER TABLE todos ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal';
  `);
}

function orders(db: TestDatabase): { id: string; sort_order: number }[] {
  return db.raw.prepare('SELECT id, sort_order FROM todos ORDER BY id').all() as {
    id: string;
    sort_order: number;
  }[];
}

function version(db: TestDatabase): string {
  return (
    db.raw.prepare("SELECT value FROM app_meta WHERE key = 'db_schema_version'").get() as {
      value: string;
    }
  ).value;
}

function dump(db: TestDatabase): Record<string, unknown[]> {
  const tables = db.raw
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all() as { name: string }[];
  return Object.fromEntries(
    tables.map(({ name }) => [name, db.raw.prepare(`SELECT * FROM ${name} ORDER BY rowid`).all()]),
  );
}

function todo(id: string, sortOrder: number, createdAt: string): Todo {
  return {
    id,
    title: id,
    notes: null,
    completed: 0,
    completed_at: null,
    due_date: null,
    priority: 'normal',
    sort_order: sortOrder,
    recurrence: null,
    recurrence_id: null,
    project_id: null,
    goal_id: null,
    created_at: createdAt,
    updated_at: createdAt,
    deleted_at: null,
  };
}

describe('migration todo ordering: preservation, not an all-zero repair predicate', () => {
  it('backfills clean v5 only when adding the column; ties, completed rows and tombstones retain block-6 semantics', async () => {
    const file = fixtureFile();
    const old = openRaw(file);
    seedV5(old);
    old.raw.exec(`
      INSERT INTO todos VALUES ('todo_tie', 'Tie', NULL, 0, '${early}', '${early}', NULL);
      INSERT INTO todos VALUES ('todo_completed', 'Completed', NULL, 1, '${late}', '${late}', NULL);
      INSERT INTO todos VALUES ('todo_deleted', 'Deleted', NULL, 0, '${early}', '${late}', '${late}');
    `);
    await close(old);
    const db = await reopen(file);
    expect(version(db)).toBe('25');
    expect(orders(db)).toEqual([
      { id: 'todo_a', sort_order: 2 },
      { id: 'todo_b', sort_order: 4 },
      { id: 'todo_completed', sort_order: 4 },
      { id: 'todo_deleted', sort_order: 0 },
      { id: 'todo_tie', sort_order: 2 },
    ]);
    const before = dump(db);
    await close(db);
    expect(dump(await reopen(file))).toEqual(before);
  });

  it.each([
    ['valid v6 authored order', '6', [9, 2]],
    ['v6 legitimate all-zero order', '6', [0, 0]],
    ['column-present version5 authored order', '5', [9, 2]],
    ['column-present version5 mixed order', '5', [0, 2]],
  ] as const)(
    'preserves %s through the actual migration runner',
    async (_name, startVersion, values) => {
      const file = fixtureFile();
      const old = openRaw(file);
      seedV5(old);
      addOrderingColumns(old);
      old.raw.prepare('UPDATE todos SET sort_order = ? WHERE id = ?').run(values[0], 'todo_a');
      old.raw.prepare('UPDATE todos SET sort_order = ? WHERE id = ?').run(values[1], 'todo_b');
      old.raw
        .prepare("UPDATE app_meta SET value = ? WHERE key = 'db_schema_version'")
        .run(startVersion);
      const before = old.raw.prepare('SELECT * FROM todos ORDER BY id').all();
      await close(old);
      const db = await reopen(file);
      expect(version(db)).toBe('25');
      const after = db.raw.prepare('SELECT * FROM todos ORDER BY id').all();
      expect(after).toEqual(
        before.map((row) => ({
          ...row,
          recurrence: null,
          recurrence_id: null,
          project_id: null,
          goal_id: null,
          completed_at: null,
        })),
      );
    },
  );

  it('reproduces the historical autocommitted-ALTER window; current retry preserves zeros rather than pretending repair', async () => {
    const file = fixtureFile();
    const old = openRaw(file);
    seedV5(old);
    // b899a871: sort_order ALTER was outside applyMigration. The inner DDL,
    // backfill and version write roll back, but this column survives.
    await old.runAsync('ALTER TABLE todos ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
    await expect(
      old.withTransactionAsync(async () => {
        await old.runAsync('ALTER TABLE todos ADD COLUMN due_date TEXT');
        await old.runAsync("ALTER TABLE todos ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'");
        await old.runAsync(`UPDATE todos SET sort_order = (
        SELECT COUNT(*) FROM todos t2 WHERE t2.created_at <= todos.created_at AND t2.deleted_at IS NULL
      ) WHERE deleted_at IS NULL`);
        throw new Error('historical interruption before version6');
      }),
    ).rejects.toThrow('historical interruption');
    expect(version(old)).toBe('5');
    expect(orders(old).map((row) => row.sort_order)).toEqual([0, 0]);
    expect(
      old.raw
        .prepare('PRAGMA table_info(todos)')
        .all()
        .map((column) => column.name),
    ).not.toContain('due_date');
    await close(old);
    const db = await reopen(file);
    expect(version(db)).toBe('25');
    expect(orders(db).map((row) => row.sort_order)).toEqual([0, 0]);
    const { listPendingTodos } = await import('@/features/todos/todos.data');
    // This is an honest residual gap: all-zero display is newest-first, not
    // clean-v5's oldest-first ranking. No user intention is inferred.
    expect((await listPendingTodos()).map((row) => row.id)).toEqual(['todo_b', 'todo_a']);
    const before = dump(db);
    await close(db);
    expect(dump(await reopen(file))).toEqual(before);
  });

  it.each([
    ['all-zero', [0, 0, 0]],
    ['authored', [9, 2, 7]],
    ['mixed', [0, 3, 0]],
    ['already-ranked', [1, 2, 3]],
    ['tied timestamps', [0, 0, 2]],
  ] as const)(
    'preserves current %s rows, archived parents, completed history, tombstones, owner and outbox on restart',
    async (name, values) => {
      const file = fixtureFile();
      const db = await reopen(file);
      const { applyRemoteTodos } = await import('@/features/todos/todos.data');
      db.raw.exec(`
      INSERT INTO projects (id, name, color, status, created_at, updated_at)
        VALUES ('proj_archived', 'Archived', '#000000', 'archived', '${early}', '${early}');
      INSERT INTO habits (id, name, status, created_at, updated_at)
        VALUES ('habit_archived', 'Archived', 'archived', '${early}', '${early}');
      INSERT INTO app_meta VALUES ('account.owner_user_id', 'owner_fixture');
      INSERT INTO sync_outbox VALUES ('todos', 'todo_a', '${early}', 'update', 1, 'owner_fixture');
    `);
      await applyRemoteTodos(db as unknown as Parameters<typeof applyRemoteTodos>[0], [
        { ...todo('todo_a', values[0], early), project_id: 'proj_archived' },
        {
          ...todo('todo_b', values[1], name === 'tied timestamps' ? early : late),
          completed: 1,
          completed_at: late,
        },
        { ...todo('todo_deleted', values[2], early), deleted_at: late },
      ]);
      const before = dump(db);
      await close(db);
      const restarted = await reopen(file);
      expect(version(restarted)).toBe('25');
      expect(dump(restarted)).toEqual(before);
    },
  );

  it('loses the transient version5/column-only signature if a later migration interrupts before an appended repair', async () => {
    const file = fixtureFile();
    const old = openRaw(file);
    seedV5(old);
    old.raw.exec(`
      ALTER TABLE todos ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
      CREATE TRIGGER interrupt_version7 BEFORE INSERT ON app_meta
        WHEN NEW.key = 'db_schema_version' AND NEW.value = '7'
        BEGIN SELECT RAISE(ABORT, 'injected version7 interruption'); END;
    `);
    await close(old);
    await expect(reopen(file)).rejects.toThrow('injected version7 interruption');
    const inspector = openRaw(file);
    expect(version(inspector)).toBe('6');
    expect(orders(inspector).map((row) => row.sort_order)).toEqual([0, 0]);
    const columns = inspector.raw
      .prepare('PRAGMA table_info(todos)')
      .all()
      .map((column) => column.name);
    expect(columns).toContain('due_date');
    expect(columns).toContain('priority');
    inspector.raw.exec('DROP TRIGGER interrupt_version7');
    await close(inspector);
    const retry = await reopen(file);
    expect(version(retry)).toBe('25');
    expect(orders(retry).map((row) => row.sort_order)).toEqual([0, 0]);
  });

  it('supports explicit user-chosen reordering of ambiguous rows atomically with rollback and retry', async () => {
    const file = fixtureFile();
    const db = await reopen(file);
    const { applyRemoteTodos, updateTodoOrder } = await import('@/features/todos/todos.data');
    await applyRemoteTodos(db as unknown as Parameters<typeof applyRemoteTodos>[0], [
      todo('todo_a', 0, early),
      todo('todo_b', 0, late),
      { ...todo('todo_deleted', 0, early), deleted_at: late },
    ]);
    db.raw.exec(`CREATE TRIGGER interrupt_reorder BEFORE UPDATE OF sort_order ON todos
      WHEN OLD.id = 'todo_b'
      BEGIN SELECT RAISE(ABORT, 'injected explicit reorder interruption'); END;`);
    const before = dump(db);
    await expect(updateTodoOrder(['todo_a', 'todo_b'])).rejects.toThrow(
      'injected explicit reorder interruption',
    );
    expect(dump(db)).toEqual(before);
    db.raw.exec('DROP TRIGGER interrupt_reorder');
    await updateTodoOrder(['todo_a', 'todo_b']);
    expect(orders(db)).toEqual([
      { id: 'todo_a', sort_order: 1 },
      { id: 'todo_b', sort_order: 2 },
      { id: 'todo_deleted', sort_order: 0 },
    ]);
    expect(db.raw.prepare('SELECT * FROM todos WHERE id = ?').get('todo_deleted')).toEqual(
      (before.todos as Todo[]).find((row) => row.id === 'todo_deleted'),
    );
    expect(db.raw.prepare('SELECT id, operation FROM sync_outbox ORDER BY id').all()).toEqual([
      { id: 'todo_a', operation: 'update' },
      { id: 'todo_b', operation: 'update' },
    ]);
    const committed = dump(db);
    await close(db);
    expect(dump(await reopen(file))).toEqual(committed);
  });

  it('does not invent a migration/version bump for an empty current database', async () => {
    const file = fixtureFile();
    const db = await reopen(file);
    const before = dump(db);
    expect(version(db)).toBe('25');
    expect(orders(db)).toEqual([]);
    await close(db);
    expect(dump(await reopen(file))).toEqual(before);
  });

  it('rolls back clean-v5 DDL and ranks when the actual SQLite version write aborts, then retries once', async () => {
    const file = fixtureFile();
    const old = openRaw(file);
    seedV5(old);
    old.raw.exec(`CREATE TRIGGER interrupt_version6 BEFORE INSERT ON app_meta
      WHEN NEW.key = 'db_schema_version' AND NEW.value = '6'
      BEGIN SELECT RAISE(ABORT, 'injected version6 interruption'); END;`);
    const before = dump(old);
    await close(old);
    await expect(reopen(file)).rejects.toThrow('injected version6 interruption');
    const inspector = openRaw(file);
    expect(version(inspector)).toBe('5');
    expect(
      inspector.raw
        .prepare('PRAGMA table_info(todos)')
        .all()
        .map((column) => column.name),
    ).not.toContain('sort_order');
    expect(inspector.raw.prepare('SELECT * FROM todos ORDER BY rowid').all()).toEqual(before.todos);
    inspector.raw.exec('DROP TRIGGER interrupt_version6');
    await close(inspector);
    const retry = await reopen(file);
    expect(version(retry)).toBe('25');
    expect(orders(retry).map((row) => row.sort_order)).toEqual([1, 2]);
    const committed = dump(retry);
    await close(retry);
    expect(dump(await reopen(file))).toEqual(committed);
  });

  it('accepts a checksummed historical Portable V1 all-zero file and preserves its order across restart', async () => {
    const file = fixtureFile();
    const db = await reopen(file);
    const {
      KNOWN_HISTORICAL_BACKUP_SCOPE_V2_ENTITY_SET: entities,
      PORTABLE_V1_ENTITY_COLUMNS,
      BACKUP_SETTINGS_VERSION,
    } = await import('@/core/backup/backup.types');
    const { buildPortableBackupFile, computePortablePayloadChecksum } =
      await import('@/core/portable/portableFormat');
    const { checksumRows } = await import('@/lib/checksum');
    const { createId } = await import('@/lib/id');
    const olderId = createId('todo');
    const newerId = createId('todo');
    const portable = buildPortableBackupFile({
      exportedAt: late,
      appVersion: '1.0.0',
      platform: 'web',
      ownerFingerprint: null,
      rowsByEntity: { todos: [todo(olderId, 0, early), todo(newerId, 0, late)] },
      settings: {},
    });
    portable.formatVersion = 1;
    delete (portable as { backupScopeVersion?: number }).backupScopeVersion;
    for (const entity of Object.keys(portable.entities)) {
      if (!(entities as readonly string[]).includes(entity)) {
        delete portable.entities[entity as keyof typeof portable.entities];
        delete portable.integrity.entities[entity as keyof typeof portable.entities];
      }
    }
    for (const entity of entities) {
      const columns = PORTABLE_V1_ENTITY_COLUMNS[entity]!;
      portable.entities[entity] = (portable.entities[entity] ?? []).map((row) =>
        Object.fromEntries(columns.map((column) => [column, row[column]])),
      );
      portable.integrity.entities[entity] = checksumRows(portable.entities[entity], columns);
    }
    portable.integrity.payloadChecksum = computePortablePayloadChecksum(portable, {
      entities,
      columns: PORTABLE_V1_ENTITY_COLUMNS as Record<BackupEntity, readonly string[]>,
      settingsVersion: BACKUP_SETTINGS_VERSION,
    });
    const { preparePortableImport, confirmPortableImport } =
      await import('@/core/portable/portableImport');
    const prepared = await preparePortableImport({
      fileName: 'historical-v1.json',
      text: JSON.stringify(portable),
    });
    expect(prepared.status, JSON.stringify(prepared)).toBe('ready');
    if (prepared.status !== 'ready') throw new Error(JSON.stringify(prepared));
    expect(await confirmPortableImport({ file: prepared.file })).toMatchObject({
      status: 'restored',
    });
    expect(orders(db).map((row) => row.sort_order)).toEqual([0, 0]);
    const { listPendingTodos } = await import('@/features/todos/todos.data');
    expect((await listPendingTodos()).map((row) => row.id)).toEqual([newerId, olderId]);
    const before = dump(db);
    await close(db);
    expect(dump(await reopen(file))).toEqual(before);
  });
});
