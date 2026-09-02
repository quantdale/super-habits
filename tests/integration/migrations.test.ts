import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
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

/** All tables the app creates (bootstrap DDL + append-only migrations). */
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
  'sync_outbox',
  'custom_exercises',
  'workout_weekly_plan',
  'workout_schedule_overrides',
  'body_weight_entries',
];

/** Named indexes the app creates across the runtime schema. */
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
  'idx_sync_outbox_revision',
  'idx_custom_exercises_active_name',
  'idx_custom_exercises_active_search',
  'uq_workout_weekly_plan_active_weekday',
  'uq_workout_schedule_overrides_active_date',
  'idx_workout_schedule_overrides_date',
  'idx_body_weight_entries_measured_at',
  'idx_pomodoro_sessions_started_at',
  'idx_workout_logs_completed_at',
  'idx_habit_completions_date_key',
  'idx_todos_pending_sort',
];

const EXPECTED_REFERENCE_NAMED_INDEXES = EXPECTED_NAMED_INDEXES.filter(
  (index) =>
    ![
      'idx_custom_exercises_active_name',
      'idx_custom_exercises_active_search',
      'uq_workout_weekly_plan_active_weekday',
      'uq_workout_schedule_overrides_active_date',
      'idx_workout_schedule_overrides_date',
      'idx_body_weight_entries_measured_at',
      // Migration 24 hot-path indexes are runtime-only (post-reference snapshot).
      'idx_pomodoro_sessions_started_at',
      'idx_workout_logs_completed_at',
      'idx_habit_completions_date_key',
      'idx_todos_pending_sort',
    ].includes(index),
);

// `schema.sql` is intentionally a partial reference snapshot. It predates the
// runtime-only Gym V2 migration, so its alignment check covers the stable
// shared subset while the real bootstrap check above covers the full head.
const EXPECTED_REFERENCE_TABLES = EXPECTED_TABLES.filter(
  (table) =>
    ![
      'custom_exercises',
      'workout_weekly_plan',
      'workout_schedule_overrides',
      'body_weight_entries',
    ].includes(table),
);

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
  it('bootstraps from zero and reaches stored schema version 24', async () => {
    const db = await openDb();

    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_meta WHERE key = ?',
      ['db_schema_version'],
    );
    expect(row?.value).toBe('24');

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

  it('adds the v20 habit lifecycle columns append-only with an active default', async () => {
    const db = await openDb();

    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(habits)');
    const names = columns.map((column) => column.name);
    expect(names).toContain('status');
    expect(names).toContain('lifecycle_history');

    // The legacy insert path (no lifecycle columns) still lands as active.
    await db.runAsync(
      `INSERT INTO habits (
         id, name, target_per_day, reminder_time, category, icon, color,
         rule_history, project_id, goal_id, created_at, updated_at, deleted_at
       ) VALUES (
         'habit_default', 'Default', 1, NULL, 'anytime', 'check-circle', '#64748b',
         '[]', NULL, NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', NULL
       )`,
    );
    const row = await db.getFirstAsync<{ status: string; lifecycle_history: string | null }>(
      'SELECT status, lifecycle_history FROM habits WHERE id = ?',
      ['habit_default'],
    );
    expect(row?.status).toBe('active');
    expect(row?.lifecycle_history).toBeNull();
    await db.closeAsync();
  });

  it('adds the Gym V2 tables and columns in migrations 22 and 23', async () => {
    const db = await openDb();
    const routineColumns = await db.getAllAsync<{ name: string }>(
      'PRAGMA table_info(workout_routines)',
    );
    const exerciseColumns = await db.getAllAsync<{ name: string }>(
      'PRAGMA table_info(routine_exercises)',
    );
    const setColumns = await db.getAllAsync<{ name: string }>(
      'PRAGMA table_info(routine_exercise_sets)',
    );
    const sessionSetColumns = await db.getAllAsync<{ name: string }>(
      'PRAGMA table_info(workout_session_sets)',
    );
    expect(routineColumns.map((column) => column.name)).toContain('goal_tag');
    expect(exerciseColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'catalog_exercise_id',
        'modality',
        'unilateral',
        'supports_external_load',
        'superset_group',
        'progression_mode',
      ]),
    );
    expect(setColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'target_reps_min',
        'target_reps_max',
        'target_load',
        'target_duration_seconds',
      ]),
    );
    expect(sessionSetColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'duration_seconds',
        'distance',
        'pace',
        'effort_value',
        'effort_scale',
      ]),
    );
    const customColumns = await db.getAllAsync<{ name: string }>(
      'PRAGMA table_info(custom_exercises)',
    );
    expect(customColumns.map((column) => column.name)).toEqual(
      expect.arrayContaining(['aliases', 'instructions', 'supports_external_load']),
    );

    await db.runAsync(
      `INSERT INTO workout_routines (id, name, description, created_at, updated_at, deleted_at)
       VALUES ('routine_legacy', 'Legacy routine', NULL, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', NULL)`,
    );
    await db.runAsync(
      `INSERT INTO routine_exercises
       (id, routine_id, name, sort_order, catalog_exercise_id, modality, notes,
        superset_group, progression_mode, progression_increment, progression_min_reps,
        progression_max_reps, created_at, updated_at, deleted_at)
       VALUES ('exercise_legacy', 'routine_legacy', 'Old bench', 0, NULL, 'timed', NULL,
        NULL, 'none', NULL, NULL, NULL, '2026-01-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z', NULL)`,
    );
    const legacyExercise = await db.getFirstAsync<{
      name: string;
      catalog_exercise_id: string | null;
      unilateral: number;
      supports_external_load: number;
    }>('SELECT * FROM routine_exercises WHERE id = ?', ['exercise_legacy']);
    expect(legacyExercise).toMatchObject({
      name: 'Old bench',
      catalog_exercise_id: null,
      unilateral: 0,
      supports_external_load: 1,
    });
    await db.closeAsync();
  });

  it('keeps the reference schema snapshot aligned through migration 15', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-reference-schema-'));
    const file = path.join(dir, 'schema.db');
    const reference = createTestDatabase(file);

    try {
      reference.raw.exec(readFileSync(path.join(process.cwd(), 'core/db/schema.sql'), 'utf8'));

      const tables = reference.raw
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all() as { name: string }[];
      expect(tables.map((table) => table.name)).toEqual(
        expect.arrayContaining(EXPECTED_REFERENCE_TABLES),
      );

      const indexes = reference.raw
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
        .all() as { name: string }[];
      expect(indexes.map((index) => index.name)).toEqual(
        expect.arrayContaining(EXPECTED_REFERENCE_NAMED_INDEXES),
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

      const outboxColumns = reference.raw.prepare('PRAGMA table_info(sync_outbox)').all() as {
        name: string;
      }[];
      expect(outboxColumns.map((column) => column.name)).toContain('owner_user_id');
    } finally {
      await reference.closeAsync();
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it('re-running migrations on an existing v13 database is a no-op', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-integration-'));
    const file = path.join(dir, 'superhabits.db');

    try {
      // Session 1: a fresh empty file gets bootstrapped + migrated to head.
      const session1 = await openDb({ filename: file });
      const v1 = await session1.getFirstAsync<{ value: string }>(
        'SELECT value FROM app_meta WHERE key = ?',
        ['db_schema_version'],
      );
      expect(v1?.value).toBe('24');
      await session1.closeAsync();

      // Session 2: reopen the SAME file. Bootstrap DDL (CREATE TABLE IF NOT
      // EXISTS) and version-gated migrations both run again and must be a
      // no-op — no version change, no new tables, no errors.
      const session2 = await openDb({ filename: file });
      const v2 = await session2.getFirstAsync<{ value: string }>(
        'SELECT value FROM app_meta WHERE key = ?',
        ['db_schema_version'],
      );
      expect(v2?.value).toBe('24');

      const sessions = await session2.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table'",
      );
      expect(sessions.map((t) => t.name)).toEqual(expect.arrayContaining(EXPECTED_TABLES));
      await session2.closeAsync();
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
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
        INSERT INTO app_meta (key, value) VALUES ('db_schema_version', '6');
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
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it('repairs a skipped-block-6 todos shape during migration 24 and restores ordering intent', async () => {
    // A database stamped at version 23 whose todos table predates migration
    // 6's ordering columns (the historical swallowed-error cohort) must still
    // upgrade cleanly: block 24's defensive repair adds the columns, reruns
    // the block-6 sort_order backfill, and creates the partial pending index.
    const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-m24-repair-'));
    const file = path.join(dir, 'superhabits.db');

    try {
      const { createTestDatabase } = await import('./helpers/db');
      const legacy = createTestDatabase(file);
      legacy.raw.exec(`
        CREATE TABLE app_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
        INSERT INTO app_meta (key, value) VALUES ('db_schema_version', '23');
        CREATE TABLE todos (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          completed INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );
        CREATE TABLE pomodoro_sessions (
          id TEXT PRIMARY KEY NOT NULL,
          started_at TEXT
        );
        CREATE TABLE workout_logs (
          id TEXT PRIMARY KEY NOT NULL,
          completed_at TEXT
        );
        CREATE TABLE habit_completions (
          id TEXT PRIMARY KEY NOT NULL,
          date_key TEXT
        );
        -- Insert out of creation order on purpose: backfill must restore
        -- created_at order, not rowid order.
        INSERT INTO todos (id, title, completed, created_at, updated_at, deleted_at)
          VALUES ('todo_b', 'B', 0, '2026-01-02T10:00:00.000Z', '2026-01-02T10:00:00.000Z', NULL);
        INSERT INTO todos (id, title, completed, created_at, updated_at, deleted_at)
          VALUES ('todo_a', 'A', 0, '2026-01-01T10:00:00.000Z', '2026-01-01T10:00:00.000Z', NULL);
        INSERT INTO todos (id, title, completed, created_at, updated_at, deleted_at)
          VALUES ('todo_dead', 'D', 0, '2026-01-03T10:00:00.000Z', '2026-01-03T10:00:00.000Z', '2026-01-04T00:00:00.000Z');
      `);
      await legacy.closeAsync();

      const db = await openDb({ filename: file });

      const version = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM app_meta WHERE key = ?',
        ['db_schema_version'],
      );
      expect(version?.value).toBe('24');

      const index = await db.getFirstAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_todos_pending_sort'",
      );
      expect(index?.name).toBe('idx_todos_pending_sort');

      // Block-6 backfill semantics: creation-order ranks among non-deleted
      // rows; tombstones are excluded from ranking and stay unranked.
      const orders = await db.getAllAsync<{ id: string; sort_order: number; priority: string }>(
        'SELECT id, sort_order, priority FROM todos ORDER BY id',
      );
      expect(orders).toEqual([
        { id: 'todo_a', sort_order: 1, priority: 'normal' },
        { id: 'todo_b', sort_order: 2, priority: 'normal' },
        { id: 'todo_dead', sort_order: 0, priority: 'normal' },
      ]);

      // The partial index serves the pending list; a pending read plans
      // through it instead of a table scan.
      const plan = await db.getAllAsync<{ detail: string }>(
        'EXPLAIN QUERY PLAN SELECT id FROM todos WHERE deleted_at IS NULL AND completed = 0 ORDER BY sort_order ASC, created_at DESC',
      );
      expect(plan.some((p) => p.detail.includes('idx_todos_pending_sort'))).toBe(true);

      await db.closeAsync();
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it('a failing migration step rolls back, closes the handle, and does not advance the schema version', async () => {
    // `getDatabase()` rejects before returning the database, so capture the
    // raw instance `openDatabaseAsync()` created. Bootstrap now CLOSES that
    // handle on failure (a retry must not stack connections), so the
    // post-failure state is inspected through a fresh raw connection to a
    // file-backed fixture.
    const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-rollback-'));
    const file = path.join(dir, 'superhabits.db');
    let failedDb: TestDatabase | null = null;
    appMetaFailures.failVersionSevenBump = true;
    try {
      vi.resetModules();
      vi.doMock('expo-sqlite', async () => {
        const { createTestDatabase } = await import('./helpers/db');
        return {
          openDatabaseAsync: vi.fn(() => {
            const db = createTestDatabase(file);
            failedDb = db;
            return db;
          }),
        };
      });
      const { getDatabase } = await import('@/core/db/client');
      await expect(getDatabase()).rejects.toThrow('simulated migration failure');
      expect(failedDb).not.toBeNull();

      // The failed bootstrap released its handle.
      await expect(failedDb!.getFirstAsync('SELECT 1')).rejects.toThrow(
        'database connection is not open',
      );

      // Inspect the persisted state through an independent connection:
      // migrations 2–6 committed (their version bumps succeeded), so the
      // schema version is 6 — migration 7's bump never landed.
      const inspector = new Database(file);
      try {
        const version = inspector
          .prepare("SELECT value FROM app_meta WHERE key = 'db_schema_version'")
          .get() as { value: string };
        expect(version.value).toBe('6');

        // Migration 7's real work — the three CREATE TABLE statements — ran
        // inside the same transaction as the failed version bump and must
        // have been rolled back.
        const tableNames = (
          inspector.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as {
            name: string;
          }[]
        ).map((t) => t.name);
        expect(tableNames).not.toContain('routine_exercises');
        expect(tableNames).not.toContain('routine_exercise_sets');
        expect(tableNames).not.toContain('workout_session_exercises');

        // Sanity: the bootstrap tables survive the rollback.
        expect(tableNames).toContain('todos');
        expect(tableNames).toContain('habits');
      } finally {
        inspector.close();
      }
    } finally {
      appMetaFailures.failVersionSevenBump = false;
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it('recovers after a failed migration: clearing the fault and reopening the same file completes the chain with prior rows preserved', async () => {
    // Spec scenario: initialization rejects, the stored version is unchanged,
    // and retrying with the failure removed completes the chain to the
    // current version with prior rows preserved.
    const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-retry-'));
    const file = path.join(dir, 'superhabits.db');
    appMetaFailures.failVersionSevenBump = true;
    try {
      // Session 1 fails at the migration-7 version bump (version stays 6).
      vi.resetModules();
      vi.doMock('expo-sqlite', async () => {
        const { createTestDatabase } = await import('./helpers/db');
        return {
          openDatabaseAsync: vi.fn(() => createTestDatabase(file)),
        };
      });
      const { getDatabase } = await import('@/core/db/client');
      await expect(getDatabase()).rejects.toThrow('simulated migration failure');

      // A row written after the failure: blocks 2-6 committed, so the live
      // schema already serves user writes before the retry.
      const interim = new Database(file);
      try {
        interim
          .prepare(
            `INSERT INTO todos (id, title, completed, created_at, updated_at)
             VALUES ('todo_retry', 'Survives retry', 0, '2026-04-01T10:00:00.000Z', '2026-04-01T10:00:00.000Z')`,
          )
          .run();
      } finally {
        interim.close();
      }

      // Session 2: fault cleared, SAME file. The chain resumes at block 7.
      appMetaFailures.failVersionSevenBump = false;
      const db = await openDb({ filename: file });
      const version = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM app_meta WHERE key = ?',
        ['db_schema_version'],
      );
      expect(version?.value).toBe('24');

      const todo = await db.getFirstAsync<{ title: string }>(
        'SELECT title FROM todos WHERE id = ?',
        ['todo_retry'],
      );
      expect(todo?.title).toBe('Survives retry');

      const tables = await db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type = 'table'",
      );
      expect(tables.map((t) => t.name)).toContain('routine_exercises');
      await db.closeAsync();
    } finally {
      appMetaFailures.failVersionSevenBump = false;
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});
