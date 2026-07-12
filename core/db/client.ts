import { Platform } from "react-native";
import * as SQLite from "expo-sqlite";
import { appMetaKeys, getAppMetaText, setAppMetaText } from "@/core/db/appMeta";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const bootstrapStatements = [
  ...(Platform.OS === "web" ? [] : ["PRAGMA journal_mode = WAL;"]),
  `CREATE TABLE IF NOT EXISTS todos (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    notes TEXT,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS habits (
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
  );`,
  `CREATE TABLE IF NOT EXISTS habit_completions (
    id TEXT PRIMARY KEY NOT NULL,
    habit_id TEXT NOT NULL,
    date_key TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(habit_id, date_key)
  );`,
  `CREATE TABLE IF NOT EXISTS pomodoro_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT NOT NULL,
    duration_seconds INTEGER NOT NULL,
    session_type TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS workout_routines (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS workout_logs (
    id TEXT PRIMARY KEY NOT NULL,
    routine_id TEXT NOT NULL,
    notes TEXT,
    completed_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS calorie_entries (
    id TEXT PRIMARY KEY NOT NULL,
    food_name TEXT NOT NULL,
    calories INTEGER NOT NULL,
    protein REAL NOT NULL DEFAULT 0,
    carbs REAL NOT NULL DEFAULT 0,
    fats REAL NOT NULL DEFAULT 0,
    fiber REAL NOT NULL DEFAULT 0,
    meal_type TEXT NOT NULL,
    consumed_on TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );`,
];

/**
 * True when `column` already exists on `table`. Fresh installs create some
 * columns via bootstrap DDL that older databases add via migration, so ALTERs
 * are gated on this instead of swallowing every error with a broad catch
 * (which also hid disk-full/locked/corruption failures and then recorded the
 * migration as applied).
 */
async function hasColumn(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
): Promise<boolean> {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return columns.some((c) => c.name === column);
}

async function addColumnIfMissing(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  if (await hasColumn(db, table, column)) return;
  await db.runAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

/**
 * Runs one migration step and its schema-version bump atomically. A failed
 * step rolls back and aborts bootstrap (surfaced by the dbError UX) instead
 * of being recorded as applied.
 */
async function applyMigration(
  db: SQLite.SQLiteDatabase,
  targetVersion: number,
  apply: () => Promise<void>,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await apply();
    await setAppMetaText(db, appMetaKeys.dbSchemaVersion, String(targetVersion));
  });
}

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const schemaVersion = await getAppMetaText(db, appMetaKeys.dbSchemaVersion);
  const version = schemaVersion ? parseInt(schemaVersion, 10) : 0;
  if (version < 2) {
    await applyMigration(db, 2, async () => {
      await addColumnIfMissing(db, "habits", "category", "TEXT NOT NULL DEFAULT 'anytime'");
    });
  }
  if (version < 3) {
    await applyMigration(db, 3, async () => {
      await addColumnIfMissing(db, "habits", "icon", "TEXT NOT NULL DEFAULT 'check-circle'");
      await addColumnIfMissing(db, "habits", "color", "TEXT NOT NULL DEFAULT '#64748b'");
    });
  }
  if (version < 4) {
    await applyMigration(db, 4, async () => {
      await addColumnIfMissing(db, "calorie_entries", "fiber", "REAL NOT NULL DEFAULT 0");
    });
  }
  if (version < 5) {
    // Record the UTC→local date key cutover in app_meta.
    // Rows written before this migration used UTC date keys (toISOString().slice(0, 10)).
    // Rows written after use local calendar keys via toDateKey() in lib/time.ts.
    // No backfill — rationale is documented in the unified knowledge base.
    await applyMigration(db, 5, async () => {
      const cutoverIso = new Date().toISOString();
      await setAppMetaText(db, appMetaKeys.dateKeyFormat, "local");
      await setAppMetaText(db, appMetaKeys.dateKeyCutover, cutoverIso);
    });
  }
  if (version < 6) {
    await applyMigration(db, 6, async () => {
      await addColumnIfMissing(db, "todos", "due_date", "TEXT");
      await addColumnIfMissing(db, "todos", "priority", "TEXT NOT NULL DEFAULT 'normal'");
      await addColumnIfMissing(db, "todos", "sort_order", "INTEGER NOT NULL DEFAULT 0");
      await db.runAsync(
        `UPDATE todos SET sort_order = (
           SELECT COUNT(*) FROM todos t2
           WHERE t2.created_at <= todos.created_at
             AND t2.deleted_at IS NULL
         ) WHERE deleted_at IS NULL`,
      );
    });
  }
  if (version < 7) {
    await applyMigration(db, 7, async () => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS routine_exercises (
        id          TEXT PRIMARY KEY NOT NULL,
        routine_id  TEXT NOT NULL,
        name        TEXT NOT NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        deleted_at  TEXT
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS routine_exercise_sets (
        id              TEXT PRIMARY KEY NOT NULL,
        exercise_id     TEXT NOT NULL,
        set_number      INTEGER NOT NULL,
        active_seconds  INTEGER NOT NULL DEFAULT 40,
        rest_seconds    INTEGER NOT NULL DEFAULT 20,
        created_at      TEXT NOT NULL,
        updated_at      TEXT NOT NULL,
        deleted_at      TEXT
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS workout_session_exercises (
        id              TEXT PRIMARY KEY NOT NULL,
        log_id          TEXT NOT NULL,
        exercise_name   TEXT NOT NULL,
        sets_completed  INTEGER NOT NULL DEFAULT 0,
        created_at      TEXT NOT NULL
      );
    `);
    });
  }
  if (version < 8) {
    await applyMigration(db, 8, async () => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS saved_meals (
        id          TEXT PRIMARY KEY NOT NULL,
        food_name   TEXT NOT NULL,
        calories    INTEGER NOT NULL,
        protein     REAL NOT NULL DEFAULT 0,
        carbs       REAL NOT NULL DEFAULT 0,
        fats        REAL NOT NULL DEFAULT 0,
        fiber       REAL NOT NULL DEFAULT 0,
        meal_type   TEXT NOT NULL DEFAULT 'breakfast',
        use_count   INTEGER NOT NULL DEFAULT 1,
        last_used_at TEXT NOT NULL,
        created_at  TEXT NOT NULL
      );
    `);

    await db.execAsync(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_meals_food_name
      ON saved_meals (food_name COLLATE NOCASE);
    `);
    });
  }
  if (version < 9) {
    await applyMigration(db, 9, async () => {
      await addColumnIfMissing(db, "todos", "recurrence", "TEXT");
      await addColumnIfMissing(db, "todos", "recurrence_id", "TEXT");
    });
  }
  if (version < 10) {
    await applyMigration(db, 10, async () => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS linked_action_rules (
        id                      TEXT PRIMARY KEY NOT NULL,
        status                  TEXT NOT NULL,
        direction_policy        TEXT NOT NULL,
        bidirectional_group_id  TEXT,
        source_feature          TEXT NOT NULL,
        source_entity_type      TEXT NOT NULL,
        source_entity_id        TEXT,
        trigger_type            TEXT NOT NULL,
        target_feature          TEXT NOT NULL,
        target_entity_type      TEXT NOT NULL,
        target_entity_id        TEXT,
        effect_type             TEXT NOT NULL,
        effect_payload          TEXT NOT NULL,
        created_at              TEXT NOT NULL,
        updated_at              TEXT NOT NULL,
        deleted_at              TEXT
      );
    `);

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_linked_action_rules_source_lookup
      ON linked_action_rules (
        status,
        source_feature,
        source_entity_type,
        source_entity_id,
        trigger_type
      );
    `);

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_linked_action_rules_bidirectional_group
      ON linked_action_rules (bidirectional_group_id);
    `);
    });
  }
  if (version < 11) {
    await applyMigration(db, 11, async () => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS linked_action_events (
        id                  TEXT PRIMARY KEY NOT NULL,
        chain_id            TEXT NOT NULL,
        root_event_id       TEXT NOT NULL,
        parent_event_id     TEXT,
        chain_depth         INTEGER NOT NULL DEFAULT 0,
        origin_kind         TEXT NOT NULL,
        origin_rule_id      TEXT,
        origin_event_id     TEXT,
        source_feature      TEXT NOT NULL,
        source_entity_type  TEXT NOT NULL,
        source_entity_id    TEXT,
        trigger_type        TEXT NOT NULL,
        source_record_id    TEXT,
        source_date_key     TEXT,
        source_label        TEXT,
        occurred_at         TEXT NOT NULL,
        payload             TEXT NOT NULL,
        created_at          TEXT NOT NULL
      );
    `);

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_linked_action_events_chain
      ON linked_action_events (chain_id, created_at DESC);
    `);

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_linked_action_events_source_lookup
      ON linked_action_events (
        source_feature,
        source_entity_type,
        source_entity_id,
        trigger_type,
        occurred_at DESC
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS linked_action_executions (
        id                    TEXT PRIMARY KEY NOT NULL,
        rule_id               TEXT NOT NULL,
        source_event_id       TEXT NOT NULL,
        chain_id              TEXT NOT NULL,
        root_event_id         TEXT NOT NULL,
        origin_rule_id        TEXT,
        effect_type           TEXT NOT NULL,
        effect_fingerprint    TEXT NOT NULL,
        status                TEXT NOT NULL,
        target_feature        TEXT NOT NULL,
        target_entity_type    TEXT NOT NULL,
        target_entity_id      TEXT,
        produced_entity_type  TEXT,
        produced_entity_id    TEXT,
        notice_payload        TEXT,
        error_message         TEXT,
        created_at            TEXT NOT NULL,
        updated_at            TEXT NOT NULL
      );
    `);

    await db.execAsync(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_linked_action_executions_source_rule
      ON linked_action_executions (rule_id, source_event_id);
    `);

    await db.execAsync(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_linked_action_executions_chain_guard
      ON linked_action_executions (chain_id, rule_id, effect_fingerprint);
    `);

    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_linked_action_executions_chain
      ON linked_action_executions (chain_id, created_at DESC);
    `);
    });
  }
}

async function openAndBootstrap(): Promise<SQLite.SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync("superhabits.db");
  for (const statement of bootstrapStatements) {
    await database.execAsync(statement);
  }
  await runMigrations(database);
  return database;
}

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndBootstrap().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

export async function initializeDatabase(): Promise<void> {
  await getDatabase();
}
