import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { TestDatabase } from './helpers/db';

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

/** All tables the app creates (bootstrap DDL + migrations 2–11). */
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
  it('bootstraps from zero and reaches stored schema version 11', async () => {
    const db = await openDb();

    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_meta WHERE key = ?',
      ['db_schema_version'],
    );
    expect(row?.value).toBe('11');

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
    await db.closeAsync();
  });

  it('re-running migrations on an existing v11 database is a no-op', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-integration-'));
    const file = path.join(dir, 'superhabits.db');

    try {
      // Session 1: a fresh empty file gets bootstrapped + migrated to v11.
      const session1 = await openDb({ filename: file });
      const v1 = await session1.getFirstAsync<{ value: string }>(
        'SELECT value FROM app_meta WHERE key = ?',
        ['db_schema_version'],
      );
      expect(v1?.value).toBe('11');
      await session1.closeAsync();

      // Session 2: reopen the SAME file. Bootstrap DDL (CREATE TABLE IF NOT
      // EXISTS) and version-gated migrations both run again and must be a
      // no-op — no version change, no new tables, no errors.
      const session2 = await openDb({ filename: file });
      const v2 = await session2.getFirstAsync<{ value: string }>(
        'SELECT value FROM app_meta WHERE key = ?',
        ['db_schema_version'],
      );
      expect(v2?.value).toBe('11');

      const sessions = await session2.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table'",
      );
      expect(sessions.map((t) => t.name)).toEqual(expect.arrayContaining(EXPECTED_TABLES));
      await session2.closeAsync();
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
