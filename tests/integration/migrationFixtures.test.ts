import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createTestDatabase, type TestDatabase } from './helpers/db';

/**
 * Historical SQLite migration fixture laboratory (synthetic).
 *
 * Each test hand-builds an era-shaped database at a meaningful historical
 * boundary and upgrades it through the REAL runtime migration chain to the
 * current head, asserting version advancement, row survival, default/backfill
 * semantics, soft-delete persistence, and initialization idempotency.
 *
 * These fixtures are SYNTHETIC (repository-safe shapes derived from the
 * migration blocks themselves), not captured real-user corpora: the
 * known-gap register keeps real-corpus coverage (#5/#6) explicitly open.
 */

/** Opens a hand-shaped database file through the real bootstrap+migrations. */
async function upgradeFixture(filename: string): Promise<TestDatabase> {
  vi.resetModules();
  vi.doMock('expo-sqlite', () => ({
    openDatabaseAsync: vi.fn(() => createTestDatabase(filename)),
  }));
  const { getDatabase } = await import('@/core/db/client');
  return (await getDatabase()) as unknown as TestDatabase;
}

async function buildLegacyFile(setupSql: string): Promise<string> {
  const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-fixture-'));
  const file = path.join(dir, 'superhabits.db');
  const legacy = createTestDatabase(file);
  legacy.raw.exec(setupSql);
  await legacy.closeAsync();
  return dir;
}

/**
 * Tables created by migration blocks ≤ 13 that later blocks ALTER or
 * otherwise reference. A fixture stamped at v13+ skips those early blocks,
 * so the era shapes must be provided verbatim.
 */
const PRE_V14_TABLES = `
  CREATE TABLE IF NOT EXISTS routine_exercises (
    id TEXT PRIMARY KEY NOT NULL,
    routine_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    active_seconds INTEGER NOT NULL DEFAULT 40,
    rest_seconds INTEGER NOT NULL DEFAULT 20,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE IF NOT EXISTS routine_exercise_sets (
    id TEXT PRIMARY KEY NOT NULL,
    exercise_id TEXT NOT NULL,
    set_number INTEGER NOT NULL,
    active_seconds INTEGER NOT NULL DEFAULT 40,
    rest_seconds INTEGER NOT NULL DEFAULT 20,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE IF NOT EXISTS workout_session_exercises (
    id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE IF NOT EXISTS saved_meals (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS linked_action_rules (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    source_feature TEXT NOT NULL,
    target_feature TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE IF NOT EXISTS linked_action_events (
    id TEXT PRIMARY KEY NOT NULL,
    rule_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS linked_action_executions (
    id TEXT PRIMARY KEY NOT NULL,
    rule_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS processed_notification_actions (
    action_key TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,
    action_name TEXT NOT NULL,
    occurrence_id TEXT NOT NULL,
    linked_event_id TEXT NOT NULL,
    linked_action_required INTEGER NOT NULL DEFAULT 0,
    processed_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#64748b',
    status TEXT NOT NULL DEFAULT 'active',
    target_date TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY NOT NULL,
    project_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    horizon TEXT NOT NULL DEFAULT 'quarter',
    target_date TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    progress_percent INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
`;

describe('historical SQLite upgrade fixtures (synthetic)', () => {
  it('upgrades a v13 database: legacy JSON outbox imports once, malformed entries are skipped, and the queue key resets', async () => {
    const legacyOutbox =
      '[' +
      '{"entity":"todos","id":"todo_1","updatedAt":"2026-01-01T00:00:00.000Z","operation":"create"},' +
      '{"entity":"habits","id":"habit_1","updatedAt":"2026-01-02T00:00:00.000Z","operation":"update"},' +
      '"garbage",' +
      '{"entity":"todos","id":"todo_1","updatedAt":"2026-01-03T00:00:00.000Z","operation":"delete"}' +
      ']';
    const dir = await buildLegacyFile(`
        ${PRE_V14_TABLES}
        CREATE TABLE app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
        INSERT INTO app_meta (key, value) VALUES ('db_schema_version', '13');
        INSERT INTO app_meta (key, value) VALUES ('sync_outbox', '${legacyOutbox}');
        -- Era-shaped todos (pre-ordering-columns cohort); later repairs apply.
        CREATE TABLE todos (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          completed INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );
        INSERT INTO todos (id, title, completed, created_at, updated_at)
          VALUES ('todo_1', 'Survives upgrade', 0, '2026-01-01T09:00:00.000Z', '2026-01-01T09:00:00.000Z');
      `);
    try {
      const db = await upgradeFixture(path.join(dir, 'superhabits.db'));

      const version = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM app_meta WHERE key = 'db_schema_version'",
      );
      expect(version?.value).toBe('24');

      // Valid legacy rows imported; 'garbage' skipped; the newer duplicate
      // intent won (latest-wins by revision order).
      const queued = await db.getAllAsync<{
        entity: string;
        id: string;
        operation: string;
        revision: number;
      }>('SELECT entity, id, operation, revision FROM sync_outbox ORDER BY revision ASC');
      expect(queued).toEqual([
        { entity: 'habits', id: 'habit_1', operation: 'update', revision: 2 },
        { entity: 'todos', id: 'todo_1', operation: 'delete', revision: 3 },
      ]);

      // Migration 15's ownership column landed on the imported table.
      const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(sync_outbox)');
      expect(columns.map((c) => c.name)).toContain('owner_user_id');

      // The legacy JSON snapshot is retired so it can never re-import.
      const retiredKey = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM app_meta WHERE key = 'sync_outbox'",
      );
      expect(retiredKey?.value).toBe('[]');

      // Pre-existing user data survived the whole chain.
      const todo = await db.getFirstAsync<{ title: string }>(
        'SELECT title FROM todos WHERE id = ?',
        ['todo_1'],
      );
      expect(todo?.title).toBe('Survives upgrade');

      await db.closeAsync();

      // Re-running initialization against the upgraded file is a no-op.
      const reopened = await upgradeFixture(path.join(dir, 'superhabits.db'));
      const reopenedVersion = await reopened.getFirstAsync<{ value: string }>(
        "SELECT value FROM app_meta WHERE key = 'db_schema_version'",
      );
      expect(reopenedVersion?.value).toBe('24');
      await reopened.closeAsync();
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }, 30_000);

  it('upgrades a v17 planning-era database: daily_plans rebuild preserves rows/tombstones and completed_at is backfilled', async () => {
    const dir = await buildLegacyFile(`
        ${PRE_V14_TABLES}
        CREATE TABLE app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
        INSERT INTO app_meta (key, value) VALUES ('db_schema_version', '17');
        -- The original m17 shape carried an inline UNIQUE(date_key) that m18
        -- rebuilds into a partial active-only index.
        CREATE TABLE daily_plans (
          id TEXT PRIMARY KEY NOT NULL,
          date_key TEXT NOT NULL UNIQUE,
          intention TEXT NOT NULL DEFAULT '',
          top_todo_ids TEXT NOT NULL DEFAULT '[]',
          focus_target_minutes INTEGER NOT NULL DEFAULT 0,
          notes TEXT NOT NULL DEFAULT '',
          reflection TEXT NOT NULL DEFAULT '',
          energy_score INTEGER,
          status TEXT NOT NULL DEFAULT 'draft',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );
        INSERT INTO daily_plans (id, date_key, intention, created_at, updated_at)
          VALUES ('plan_live', '2026-03-01', 'Deep work', '2026-03-01T08:00:00.000Z', '2026-03-01T08:00:00.000Z');
        INSERT INTO daily_plans (id, date_key, intention, created_at, updated_at, deleted_at)
          VALUES ('plan_dead', '2026-03-02', 'Gone', '2026-03-02T08:00:00.000Z', '2026-03-02T09:00:00.000Z', '2026-03-02T10:00:00.000Z');
        -- Era todos without completed_at: m19 backfills it from updated_at.
        CREATE TABLE todos (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          completed INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );
        INSERT INTO todos (id, title, completed, created_at, updated_at)
          VALUES ('todo_done', 'Done long ago', 1, '2026-01-05T09:00:00.000Z', '2026-01-05T11:30:00.000Z');
      `);
    try {
      const db = await upgradeFixture(path.join(dir, 'superhabits.db'));

      const version = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM app_meta WHERE key = 'db_schema_version'",
      );
      expect(version?.value).toBe('24');

      // Both plans survived the table rebuild, including the tombstone.
      const live = await db.getFirstAsync<{ intention: string }>(
        'SELECT intention FROM daily_plans WHERE id = ?',
        ['plan_live'],
      );
      expect(live?.intention).toBe('Deep work');
      const dead = await db.getFirstAsync<{ deleted_at: string | null }>(
        'SELECT deleted_at FROM daily_plans WHERE id = ?',
        ['plan_dead'],
      );
      expect(dead?.deleted_at).toBe('2026-03-02T10:00:00.000Z');

      // The inline global UNIQUE is gone; a second ACTIVE row on the same
      // local day violates only the partial active-only index, while a
      // tombstoned same-day row remains legal.
      await expect(
        db.runAsync(
          `INSERT INTO daily_plans (id, date_key, created_at, updated_at)
             VALUES ('plan_dup_active', '2026-03-01', '2026-03-05T08:00:00.000Z', '2026-03-05T08:00:00.000Z')`,
        ),
      ).rejects.toThrow();
      await db.runAsync(
        `INSERT INTO daily_plans (id, date_key, created_at, updated_at, deleted_at)
           VALUES ('plan_dup_deleted', '2026-03-01', '2026-03-05T08:00:00.000Z', '2026-03-05T08:00:00.000Z', '2026-03-05T09:00:00.000Z')`,
      );

      // m21's nullable snapshot column exists; pre-v21 rows stay NULL.
      const titles = await db.getFirstAsync<{ top_todo_titles: string | null }>(
        'SELECT top_todo_titles FROM daily_plans WHERE id = ?',
        ['plan_live'],
      );
      expect(titles?.top_todo_titles).toBeNull();

      // Legacy completed todos received completed_at = updated_at (H5/H7).
      const done = await db.getFirstAsync<{ completed_at: string | null }>(
        'SELECT completed_at FROM todos WHERE id = ?',
        ['todo_done'],
      );
      expect(done?.completed_at).toBe('2026-01-05T11:30:00.000Z');

      await db.closeAsync();
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }, 30_000);

  it('upgrades a v19 database: durable-state promotion adds lifecycle/timing metadata as explicit NULLs, never fabricated zeros', async () => {
    const dir = await buildLegacyFile(`
        ${PRE_V14_TABLES}
        CREATE TABLE app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
        INSERT INTO app_meta (key, value) VALUES ('db_schema_version', '19');
        -- Era pomodoro sessions: no linked-todo snapshot or note columns yet.
        CREATE TABLE pomodoro_sessions (
          id TEXT PRIMARY KEY NOT NULL,
          started_at TEXT,
          ended_at TEXT,
          duration_seconds INTEGER,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );
        INSERT INTO pomodoro_sessions (id, started_at, ended_at, duration_seconds, created_at, updated_at)
          VALUES ('pom_legacy', '2026-02-01T10:00:00.000Z', '2026-02-01T10:25:00.000Z', 1500, '2026-02-01T10:25:00.000Z', '2026-02-01T10:25:00.000Z');
        -- Era workout logs: untimed quick-completes (no wall-clock columns).
        CREATE TABLE workout_logs (
          id TEXT PRIMARY KEY NOT NULL,
          routine_id TEXT NOT NULL,
          notes TEXT,
          completed_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );
        INSERT INTO workout_logs (id, routine_id, completed_at, created_at, updated_at)
          VALUES ('wrk_legacy', 'wrk_routine', '2026-02-02T18:00:00.000Z', '2026-02-02T18:00:00.000Z', '2026-02-02T18:00:00.000Z');
        -- Planning-era tables already existed at v19 (m17 ran historically);
        -- m19 ALTERs them, so their shapes must be provided.
        CREATE TABLE daily_plans (
          id TEXT PRIMARY KEY NOT NULL,
          date_key TEXT NOT NULL,
          intention TEXT NOT NULL DEFAULT '',
          top_todo_ids TEXT NOT NULL DEFAULT '[]',
          focus_target_minutes INTEGER NOT NULL DEFAULT 0,
          notes TEXT NOT NULL DEFAULT '',
          reflection TEXT NOT NULL DEFAULT '',
          energy_score INTEGER,
          status TEXT NOT NULL DEFAULT 'draft',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );
      `);
    try {
      const db = await upgradeFixture(path.join(dir, 'superhabits.db'));

      const version = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM app_meta WHERE key = 'db_schema_version'",
      );
      expect(version?.value).toBe('24');

      // Promotion columns exist and legacy rows read as explicit unknowns.
      const session = await db.getFirstAsync<{
        linked_todo_id: string | null;
        note: string | null;
        duration_seconds: number;
      }>('SELECT linked_todo_id, note, duration_seconds FROM pomodoro_sessions WHERE id = ?', [
        'pom_legacy',
      ]);
      expect(session?.linked_todo_id).toBeNull();
      expect(session?.note).toBeNull();
      expect(session?.duration_seconds).toBe(1500);

      const log = await db.getFirstAsync<{
        started_at: string | null;
        ended_at: string | null;
        duration_seconds: number | null;
      }>('SELECT started_at, ended_at, duration_seconds FROM workout_logs WHERE id = ?', [
        'wrk_legacy',
      ]);
      // NULL means untimed legacy quick-complete — never a measured zero.
      expect(log?.started_at).toBeNull();
      expect(log?.ended_at).toBeNull();
      expect(log?.duration_seconds).toBeNull();

      // Per-set provenance table arrived empty for legacy sessions.
      const setCount = await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM workout_session_sets',
      );
      expect(Number(setCount?.count)).toBe(0);

      await db.closeAsync();
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }, 30_000);
});
