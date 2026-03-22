import { Platform } from "react-native";
import * as SQLite from "expo-sqlite";

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

async function runMigrations(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_meta WHERE key = 'db_schema_version'",
  );
  const version = row?.value ? parseInt(row.value, 10) : 0;
  if (version < 2) {
    try {
      await db.execAsync("ALTER TABLE habits ADD COLUMN category TEXT NOT NULL DEFAULT 'anytime'");
    } catch {
      // Column may already exist from CREATE TABLE
    }
    await db.runAsync(
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('db_schema_version', '2')",
    );
  }
  if (version < 3) {
    try {
      await db.execAsync("ALTER TABLE habits ADD COLUMN icon TEXT NOT NULL DEFAULT 'check-circle'");
    } catch {
      // Column may already exist from CREATE TABLE
    }
    try {
      await db.execAsync("ALTER TABLE habits ADD COLUMN color TEXT NOT NULL DEFAULT '#64748b'");
    } catch {
      // Column may already exist from CREATE TABLE
    }
    await db.runAsync(
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('db_schema_version', '3')",
    );
  }
  if (version < 4) {
    try {
      await db.execAsync(
        "ALTER TABLE calorie_entries ADD COLUMN fiber REAL NOT NULL DEFAULT 0",
      );
    } catch {
      // Column may already exist from CREATE TABLE
    }
    await db.runAsync(
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('db_schema_version', '4')",
    );
  }
  if (version < 5) {
    // Record the UTC→local date key cutover in app_meta.
    // Rows written before this migration used UTC date keys (toISOString().slice(0, 10)).
    // Rows written after use local calendar keys via toDateKey() in lib/time.ts.
    // No backfill — rationale in docs/knowledge-base/03_LIB_SHARED.md.
    const cutoverIso = new Date().toISOString();
    await db.runAsync(
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('date_key_format', 'local')",
    );
    await db.runAsync(
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('date_key_cutover', ?)",
      [cutoverIso],
    );
    await db.runAsync(
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('db_schema_version', '5')",
    );
  }
  if (version < 6) {
    try {
      await db.runAsync(`ALTER TABLE todos ADD COLUMN due_date TEXT`);
    } catch {
      // Column may already exist
    }
    try {
      await db.runAsync(
        `ALTER TABLE todos ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'`,
      );
    } catch {
      // Column may already exist
    }
    try {
      await db.runAsync(
        `ALTER TABLE todos ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0`,
      );
    } catch {
      // Column may already exist
    }
    await db.runAsync(
      `UPDATE todos SET sort_order = (
         SELECT COUNT(*) FROM todos t2
         WHERE t2.created_at <= todos.created_at
           AND t2.deleted_at IS NULL
       ) WHERE deleted_at IS NULL`,
    );
    await db.runAsync(
      `INSERT OR REPLACE INTO app_meta (key, value)
       VALUES ('db_schema_version', '6')`,
    );
  }
  if (version < 7) {
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

    await db.runAsync(
      `INSERT OR REPLACE INTO app_meta (key, value)
       VALUES ('db_schema_version', '7')`,
    );
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
