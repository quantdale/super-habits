import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createTestDatabase, type TestDatabase } from './helpers/db';
import { timestampToLocalDateKey } from '@/lib/time';

/**
 * Integration tests for the REAL bootstrap DDL + `runMigrations()` from
 * `core/db/client.ts`, executed against an in-process better-sqlite3 database
 * (task 2.5). These assert the SQL the app actually runs on cold start — the
 * mock-SQLite unit tests in `tests/db.client.test.ts` cannot.
 *
 * Each test opens a fresh database through `openDb()`, which re-registers the
 * `expo-sqlite` mock (via `vi.doMock`) so it can capture the raw database
 * `openDatabaseAsync()` returns. This deliberately avoids leaking a
 * `vi.doMock` registration into the next test (the pattern `tests/db.client.test.ts`
 * uses), and `vi.resetModules()` re-imports a clean `core/db/client.ts` whose
 * module-level `dbPromise` cache is empty.
 */

/**
 * The rollback test makes `applyMigration`'s version bump fail so a real
 * migration step does work and then rolls back. `setAppMetaText` is the only
 * part of `core/db/appMeta` that needs to be interruptible; the flag is
 * controlled per-test and stays off for every other test so the appMeta mock
 * is transparent.
 *
 * Migration 7 (CREATE TABLE for routine_exercises / routine_exercise_sets /
 * workout_session_exercises) is targeted because it is the first migration
 * whose work is NOT already present in the bootstrap DDL — migration 2's
 * ALTERs are no-ops on a fresh install (bootstrap already includes those
 * columns), so their rollback would assert nothing.
 */
const appMetaFailures = vi.hoisted(() => ({
  /** When true, the next `db_schema_version` write targeting version '7' throws. */
  failVersionSevenBump: false,
}));

vi.mock('@/core/db/appMeta', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/core/db/appMeta')>();
  return {
    ...real,
    setAppMetaText: vi.fn(
      async (
        db: Parameters<typeof real.setAppMetaText>[0],
        key: Parameters<typeof real.setAppMetaText>[1],
        value: Parameters<typeof real.setAppMetaText>[2],
      ) => {
        if (
          appMetaFailures.failVersionSevenBump &&
          key === real.appMetaKeys.dbSchemaVersion &&
          String(value) === '7'
        ) {
          appMetaFailures.failVersionSevenBump = false;
          throw new Error('simulated migration failure');
        }
        return real.setAppMetaText(db, key, value);
      },
    ),
  };
});

/** All tables the app creates (bootstrap DDL + migrations 2–13). */
const EXPECTED_TABLES = [
  'todos',
  'habits',
  'habit_completions',
  'pomodoro_sessions',
  'workout_routines',
  'workout_logs',
  'calorie_entries',
  'app_meta',
  'routine_exercises',
  'routine_exercise_sets',
  'workout_session_exercises',
  'saved_meals',
  'linked_action_rules',
  'linked_action_events',
  'linked_action_executions',
  'processed_notification_actions',
];

/** Named indexes the app creates (migrations 8, 10, 11). */
const EXPECTED_NAMED_INDEXES = [
  'idx_saved_meals_food_name',
  'idx_linked_action_rules_source_lookup',
  'idx_linked_action_rules_bidirectional_group',
  'idx_linked_action_events_chain',
  'idx_linked_action_events_source_lookup',
  'idx_linked_action_executions_source_rule',
  'idx_linked_action_executions_chain_guard',
  'idx_linked_action_executions_chain',
  'idx_processed_notification_actions_processed_at',
];

type OpenDbOptions = {
  /** Absolute path for a persistent database (reused across sessions). */
  filename?: string;
};

/**
 * Opens a fresh database through the real bootstrap + migrations. Returns the
 * bootstrapped database (the same instance `core/db/client.ts` caches).
 */
async function openDb(options: OpenDbOptions = {}): Promise<TestDatabase> {
  vi.resetModules();
  vi.doMock('expo-sqlite', async () => {
    const { createTestDatabase } = await import('./helpers/db');
    return {
      openDatabaseAsync: vi.fn(() => createTestDatabase(options.filename)),
    };
  });
  const { getDatabase } = await import('@/core/db/client');
  return (await getDatabase()) as unknown as TestDatabase;
}

describe('tests/integration/migrations', () => {
  it('bootstraps from zero and reaches stored schema version 13', async () => {
    const db = await openDb();

    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_meta WHERE key = ?',
      ['db_schema_version'],
    );
    expect(row?.value).toBe('13');

    const dateKeyFormat = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_meta WHERE key = ?',
      ['date_key_format'],
    );
    expect(dateKeyFormat?.value).toBe('local');
    await db.closeAsync();
  });

  it('creates every table and named index the app queries', async () => {
    const db = await openDb();

    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    const tableNames = tables.map((t) => t.name);
    for (const table of EXPECTED_TABLES) {
      expect(tableNames).toContain(table);
    }

    const indexes = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'index'",
    );
    const indexNames = indexes.map((i) => i.name);
    for (const index of EXPECTED_NAMED_INDEXES) {
      expect(indexNames).toContain(index);
    }

    // The UNIQUE(habit_id, date_key) table constraint materialises an auto-index.
    expect(indexNames).toContain('sqlite_autoindex_habit_completions_1');
    const habitColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(habits)');
    expect(habitColumns.map((column) => column.name)).toContain('rule_history');
    await db.closeAsync();
  });

  it('keeps the reference schema snapshot aligned through migration 13', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-reference-schema-'));
    const file = path.join(dir, 'schema.db');
    const reference = createTestDatabase(file);

    try {
      reference.raw.exec(readFileSync(path.join(process.cwd(), 'core/db/schema.sql'), 'utf8'));

      const tables = reference.raw
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all() as { name: string }[];
      expect(tables.map((table) => table.name)).toEqual(expect.arrayContaining(EXPECTED_TABLES));

      const indexes = reference.raw
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
        .all() as { name: string }[];
      expect(indexes.map((index) => index.name)).toEqual(
        expect.arrayContaining(EXPECTED_NAMED_INDEXES),
      );

      const processedColumns = reference.raw
        .prepare('PRAGMA table_info(processed_notification_actions)')
        .all() as { name: string }[];
      expect(processedColumns.map((column) => column.name)).toEqual([
        'action_key',
        'kind',
        'action_name',
        'occurrence_id',
        'linked_event_id',
        'linked_action_required',
        'processed_at',
      ]);
    } finally {
      await reference.closeAsync();
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('re-running migrations on an existing v13 database is a no-op', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-integration-'));
    const file = path.join(dir, 'superhabits.db');

    try {
      // Session 1: a fresh empty file gets bootstrapped + migrated to v13.
      const session1 = await openDb({ filename: file });
      const v1 = await session1.getFirstAsync<{ value: string }>(
        'SELECT value FROM app_meta WHERE key = ?',
        ['db_schema_version'],
      );
      expect(v1?.value).toBe('13');
      await session1.closeAsync();

      // Session 2: reopen the SAME file. Bootstrap DDL (CREATE TABLE IF NOT
      // EXISTS) and version-gated migrations both run again and must be a
      // no-op — no version change, no new tables, no errors.
      const session2 = await openDb({ filename: file });
      const v2 = await session2.getFirstAsync<{ value: string }>(
        'SELECT value FROM app_meta WHERE key = ?',
        ['db_schema_version'],
      );
      expect(v2?.value).toBe('13');

      const sessions = await session2.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table'",
      );
      expect(sessions.map((t) => t.name)).toEqual(expect.arrayContaining(EXPECTED_TABLES));
      await session2.closeAsync();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('migrates a legacy habit to an every-day rule at its local creation date', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-legacy-'));
    const file = path.join(dir, 'superhabits.db');
    const createdAt = '2026-01-15T23:00:00.000Z';

    try {
      const legacy = (await import('./helpers/db')).createTestDatabase(file);
      legacy.raw.exec(`
        CREATE TABLE app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
        INSERT INTO app_meta (key, value) VALUES ('db_schema_version', '11');
        CREATE TABLE habits (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          target_per_day INTEGER NOT NULL DEFAULT 1,
          reminder_time TEXT,
          category TEXT NOT NULL DEFAULT 'anytime',
          icon TEXT NOT NULL DEFAULT 'check-circle',
          color TEXT NOT NULL DEFAULT '#64748b',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );
        INSERT INTO habits (
          id, name, target_per_day, reminder_time, category, icon, color,
          created_at, updated_at, deleted_at
        ) VALUES ('habit_legacy', 'Legacy', 3, NULL, 'anytime', 'check-circle', '#64748b', '${createdAt}', '${createdAt}', NULL);
      `);
      await legacy.closeAsync();

      const db = await openDb({ filename: file });
      const row = await db.getFirstAsync<{ target_per_day: number; rule_history: string }>(
        'SELECT target_per_day, rule_history FROM habits WHERE id = ?',
        ['habit_legacy'],
      );
      expect(row?.target_per_day).toBe(3);
      expect(JSON.parse(row?.rule_history ?? '[]')).toEqual([
        {
          effective_from_date: timestampToLocalDateKey(createdAt),
          weekdays: [1, 2, 3, 4, 5, 6, 7],
          target_per_day: 3,
        },
      ]);
      await db.closeAsync();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('a failing migration step rolls back and does not advance the schema version', async () => {
    // `getDatabase()` rejects before returning the database, so capture the
    // raw instance `openDatabaseAsync()` created and inspect it afterwards.
    let failedDb: TestDatabase | null = null;
    appMetaFailures.failVersionSevenBump = true;
    vi.resetModules();
    vi.doMock('expo-sqlite', async () => {
      const { createTestDatabase } = await import('./helpers/db');
      return {
        openDatabaseAsync: vi.fn(() => {
          const db = createTestDatabase();
          failedDb = db;
          return db;
        }),
      };
    });
    const { getDatabase } = await import('@/core/db/client');
    await expect(getDatabase()).rejects.toThrow('simulated migration failure');
    expect(failedDb).not.toBeNull();

    // Migrations 2–6 committed (their version bumps succeeded), so the schema
    // version is 6 — migration 7's bump never landed.
    const version = await failedDb!.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_meta WHERE key = ?',
      ['db_schema_version'],
    );
    expect(version?.value).toBe('6');

    // Migration 7's real work — the three CREATE TABLE statements — ran inside
    // the same transaction as the failed version bump and must have been
    // rolled back.
    const tables = await failedDb!.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    const tableNames = tables.map((t) => t.name);
    expect(tableNames).not.toContain('routine_exercises');
    expect(tableNames).not.toContain('routine_exercise_sets');
    expect(tableNames).not.toContain('workout_session_exercises');

    // Sanity: the bootstrap tables survive the rollback.
    expect(tableNames).toContain('todos');
    expect(tableNames).toContain('habits');
    await failedDb!.closeAsync();
  });
});
