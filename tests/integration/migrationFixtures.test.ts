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

  it('upgrades a TRUE v21 database (frozen at the v22 bump): pre-Gym rows survive, Gym tables arrive empty with defaults, v24 indexes exist', async () => {
    // No hand-copied DDL and no product seam: a trigger aborts the version
    // bump to 22, so the frozen file holds EXACTLY blocks ≤ 21 as the runtime
    // built them (block 22's DDL rolls back with its bump). Rows are then
    // inserted into that true shape before the real upgrade runs.
    const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-fixture-'));
    const file = path.join(dir, 'superhabits.db');
    const seed = createTestDatabase(file);
    seed.raw.exec(`
      CREATE TABLE app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      CREATE TRIGGER freeze_v21 BEFORE INSERT ON app_meta
      WHEN NEW.key = 'db_schema_version' AND NEW.value = '22'
      BEGIN SELECT RAISE(ABORT, 'injected migration freeze at v21'); END;
    `);
    await seed.closeAsync();

    await expect(upgradeFixture(file)).rejects.toThrow('injected migration freeze at v21');

    const staging = createTestDatabase(file);
    const frozen = staging.raw
      .prepare("SELECT value FROM app_meta WHERE key = 'db_schema_version'")
      .get() as { value: string };
    expect(frozen.value).toBe('21');
    const frozenTables = (
      staging.raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
        name: string;
      }[]
    ).map((t) => t.name);
    expect(frozenTables).not.toContain('custom_exercises');
    expect(frozenTables).toContain('daily_plans');

    staging.raw.exec(`
      DROP TRIGGER freeze_v21;
      INSERT INTO todos (id, title, completed, created_at, updated_at)
        VALUES ('todo_v21', 'Pre-Gym todo', 0, '2026-02-01T09:00:00.000Z', '2026-02-01T09:00:00.000Z');
      INSERT INTO habits (id, name, target_per_day, created_at, updated_at)
        VALUES ('habit_v21', 'Pre-Gym habit', 2, '2026-02-01T09:00:00.000Z', '2026-02-01T09:00:00.000Z');
      INSERT INTO habits (id, name, target_per_day, created_at, updated_at, deleted_at)
        VALUES ('habit_tomb', 'Deleted habit', 1, '2026-02-01T09:00:00.000Z', '2026-02-02T09:00:00.000Z', '2026-02-03T09:00:00.000Z');
      INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
        VALUES ('hcmp_v21', 'habit_v21', '2026-02-10', 2, '2026-02-10T09:00:00.000Z', '2026-02-10T09:00:00.000Z');
      INSERT INTO pomodoro_sessions (id, started_at, ended_at, duration_seconds, session_type, created_at)
        VALUES ('pom_v21', '2026-02-11T10:00:00.000Z', '2026-02-11T10:25:00.000Z', 1500, 'focus', '2026-02-11T10:25:00.000Z');
      INSERT INTO calorie_entries (id, food_name, calories, meal_type, consumed_on, created_at, updated_at)
        VALUES ('cal_v21', 'Oats', 300, 'breakfast', '2026-02-11', '2026-02-11T08:00:00.000Z', '2026-02-11T08:00:00.000Z');
      INSERT INTO daily_plans (id, date_key, intention, created_at, updated_at)
        VALUES ('plan_v21', '2026-02-11', 'Ship it', '2026-02-11T08:00:00.000Z', '2026-02-11T08:00:00.000Z');
      INSERT INTO projects (id, name, color, status, created_at, updated_at)
        VALUES ('proj_v21', 'Pre-Gym project', '#0ea5e9', 'active', '2026-02-01T09:00:00.000Z', '2026-02-01T09:00:00.000Z');
      INSERT INTO goals (id, project_id, title, horizon, status, created_at, updated_at)
        VALUES ('goal_v21', 'proj_v21', 'Pre-Gym goal', 'quarter', 'active', '2026-02-01T09:00:00.000Z', '2026-02-01T09:00:00.000Z');
      INSERT INTO workout_routines (id, name, created_at, updated_at)
        VALUES ('wrk_v21', 'Legacy Push Day', '2026-02-01T09:00:00.000Z', '2026-02-01T09:00:00.000Z');
      INSERT INTO routine_exercises (id, routine_id, name, sort_order, created_at, updated_at)
        VALUES ('ex_v21', 'wrk_v21', 'Old bench', 0, '2026-02-01T09:00:00.000Z', '2026-02-01T09:00:00.000Z');
      INSERT INTO workout_logs (id, routine_id, completed_at, created_at)
        VALUES ('log_v21', 'wrk_v21', '2026-02-12T18:00:00.000Z', '2026-02-12T18:00:00.000Z');
    `);
    await staging.closeAsync();

    try {
      const db = await upgradeFixture(file);

      const version = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM app_meta WHERE key = 'db_schema_version'",
      );
      expect(version?.value).toBe('24');

      // Every pre-Gym row kept its id and user data, including the tombstone.
      const todo = await db.getFirstAsync<{ title: string; completed: number }>(
        'SELECT title, completed FROM todos WHERE id = ?',
        ['todo_v21'],
      );
      expect(todo).toMatchObject({ title: 'Pre-Gym todo', completed: 0 });
      const habit = await db.getFirstAsync<{ name: string; target_per_day: number }>(
        'SELECT name, target_per_day FROM habits WHERE id = ?',
        ['habit_v21'],
      );
      expect(habit).toMatchObject({ name: 'Pre-Gym habit', target_per_day: 2 });
      const tomb = await db.getFirstAsync<{ deleted_at: string | null }>(
        'SELECT deleted_at FROM habits WHERE id = ?',
        ['habit_tomb'],
      );
      expect(tomb?.deleted_at).toBe('2026-02-03T09:00:00.000Z');
      const completion = await db.getFirstAsync<{ count: number }>(
        'SELECT count FROM habit_completions WHERE id = ?',
        ['hcmp_v21'],
      );
      expect(completion?.count).toBe(2);
      const session = await db.getFirstAsync<{ duration_seconds: number }>(
        'SELECT duration_seconds FROM pomodoro_sessions WHERE id = ?',
        ['pom_v21'],
      );
      expect(session?.duration_seconds).toBe(1500);
      const entry = await db.getFirstAsync<{ calories: number }>(
        'SELECT calories FROM calorie_entries WHERE id = ?',
        ['cal_v21'],
      );
      expect(entry?.calories).toBe(300);
      const plan = await db.getFirstAsync<{ intention: string }>(
        'SELECT intention FROM daily_plans WHERE id = ?',
        ['plan_v21'],
      );
      expect(plan?.intention).toBe('Ship it');
      const goal = await db.getFirstAsync<{ title: string }>(
        'SELECT title FROM goals WHERE id = ?',
        ['goal_v21'],
      );
      expect(goal?.title).toBe('Pre-Gym goal');
      const log = await db.getFirstAsync<{ completed_at: string }>(
        'SELECT completed_at FROM workout_logs WHERE id = ?',
        ['log_v21'],
      );
      expect(log?.completed_at).toBe('2026-02-12T18:00:00.000Z');

      // Gym V2 tables arrived empty with correct defaults on legacy rows.
      for (const table of [
        'custom_exercises',
        'workout_weekly_plan',
        'workout_schedule_overrides',
        'body_weight_entries',
      ]) {
        const count = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) AS count FROM ${table}`,
        );
        expect(Number(count?.count)).toBe(0);
      }
      const legacyExercise = await db.getFirstAsync<{
        modality: string;
        unilateral: number;
        supports_external_load: number;
      }>(
        'SELECT modality, unilateral, supports_external_load FROM routine_exercises WHERE id = ?',
        ['ex_v21'],
      );
      expect(legacyExercise).toMatchObject({
        modality: 'timed',
        unilateral: 0,
        supports_external_load: 1,
      });

      // Hot-path range indexes from migration 24 exist.
      const indexes = (
        await db.getAllAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'index'",
        )
      ).map((i) => i.name);
      for (const index of [
        'idx_pomodoro_sessions_started_at',
        'idx_workout_logs_completed_at',
        'idx_habit_completions_date_key',
        'idx_todos_pending_sort',
        'uq_workout_weekly_plan_active_weekday',
        'idx_custom_exercises_active_search',
      ]) {
        expect(indexes).toContain(index);
      }

      await db.closeAsync();
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }, 30_000);

  it('upgrades a TRUE v23 database (frozen at the v24 bump): Gym rows survive with semantic snapshots defaulted, hot-path indexes land', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-fixture-'));
    const file = path.join(dir, 'superhabits.db');
    const seed = createTestDatabase(file);
    seed.raw.exec(`
      CREATE TABLE app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      CREATE TRIGGER freeze_v23 BEFORE INSERT ON app_meta
      WHEN NEW.key = 'db_schema_version' AND NEW.value = '24'
      BEGIN SELECT RAISE(ABORT, 'injected migration freeze at v23'); END;
    `);
    await seed.closeAsync();

    await expect(upgradeFixture(file)).rejects.toThrow('injected migration freeze at v23');

    const staging = createTestDatabase(file);
    const frozen = staging.raw
      .prepare("SELECT value FROM app_meta WHERE key = 'db_schema_version'")
      .get() as { value: string };
    expect(frozen.value).toBe('23');

    staging.raw.exec(`
      DROP TRIGGER freeze_v23;
      INSERT INTO custom_exercises (id, name, primary_area, modality, created_at, updated_at)
        VALUES ('cex_v23', 'Zercher Squat', 'legs', 'strength', '2026-03-01T09:00:00.000Z', '2026-03-01T09:00:00.000Z');
      INSERT INTO workout_weekly_plan (id, weekday, routine_id, plan_kind, created_at, updated_at)
        VALUES ('wplan_v23', 1, NULL, 'rest', '2026-03-01T09:00:00.000Z', '2026-03-01T09:00:00.000Z');
      INSERT INTO workout_schedule_overrides (id, date_key, override_kind, created_at, updated_at)
        VALUES ('ovr_v23', '2026-03-02', 'rest', '2026-03-01T09:00:00.000Z', '2026-03-01T09:00:00.000Z');
      INSERT INTO body_weight_entries (id, measured_on, measured_at, weight, unit, created_at, updated_at)
        VALUES ('bw_v23', '2026-03-01', '2026-03-01T07:00:00.000Z', 82.5, 'kg', '2026-03-01T07:00:00.000Z', '2026-03-01T07:00:00.000Z');
      INSERT INTO workout_routines (id, name, goal_tag, created_at, updated_at)
        VALUES ('wrk_v23', 'Pull Day', 'strength', '2026-03-01T09:00:00.000Z', '2026-03-01T09:00:00.000Z');
      INSERT INTO routine_exercises (id, routine_id, name, sort_order, modality, created_at, updated_at)
        VALUES ('ex_v23', 'wrk_v23', 'Pull-up', 0, 'strength', '2026-03-01T09:00:00.000Z', '2026-03-01T09:00:00.000Z');
      INSERT INTO workout_logs (id, routine_id, routine_name, completed_at, created_at)
        VALUES ('log_v23', 'wrk_v23', 'Pull Day', '2026-03-03T18:00:00.000Z', '2026-03-03T18:00:00.000Z');
      INSERT INTO todos (id, title, completed, created_at, updated_at)
        VALUES ('todo_v23', 'V23 todo', 0, '2026-03-01T09:00:00.000Z', '2026-03-01T09:00:00.000Z');
      INSERT INTO habit_completions (id, habit_id, date_key, count, created_at, updated_at)
        VALUES ('hcmp_v23', 'habit_missing', '2026-03-01', 1, '2026-03-01T09:00:00.000Z', '2026-03-01T09:00:00.000Z');
    `);
    await staging.closeAsync();

    try {
      const db = await upgradeFixture(file);

      const version = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM app_meta WHERE key = 'db_schema_version'",
      );
      expect(version?.value).toBe('24');

      // Gym rows kept ids, timestamps, and user data across the upgrade.
      const custom = await db.getFirstAsync<{
        name: string;
        aliases: string;
        supports_external_load: number;
      }>('SELECT name, aliases, supports_external_load FROM custom_exercises WHERE id = ?', [
        'cex_v23',
      ]);
      expect(custom).toMatchObject({
        name: 'Zercher Squat',
        aliases: '[]',
        supports_external_load: 0,
      });
      const weekly = await db.getFirstAsync<{ plan_kind: string }>(
        'SELECT plan_kind FROM workout_weekly_plan WHERE id = ?',
        ['wplan_v23'],
      );
      expect(weekly?.plan_kind).toBe('rest');
      const bodyWeight = await db.getFirstAsync<{ weight: number; unit: string }>(
        'SELECT weight, unit FROM body_weight_entries WHERE id = ?',
        ['bw_v23'],
      );
      expect(bodyWeight).toMatchObject({ weight: 82.5, unit: 'kg' });
      const exercise = await db.getFirstAsync<{ modality: string; unilateral: number }>(
        'SELECT modality, unilateral FROM routine_exercises WHERE id = ?',
        ['ex_v23'],
      );
      expect(exercise).toMatchObject({ modality: 'strength', unilateral: 0 });
      const completion = await db.getFirstAsync<{ count: number }>(
        'SELECT count FROM habit_completions WHERE id = ?',
        ['hcmp_v23'],
      );
      expect(completion?.count).toBe(1);

      // Migration-24 hot-path indexes serve the unbounded history tables.
      const indexes = (
        await db.getAllAsync<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'index'",
        )
      ).map((i) => i.name);
      for (const index of [
        'idx_pomodoro_sessions_started_at',
        'idx_workout_logs_completed_at',
        'idx_habit_completions_date_key',
        'idx_todos_pending_sort',
      ]) {
        expect(indexes).toContain(index);
      }

      await db.closeAsync();
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  }, 30_000);
});
