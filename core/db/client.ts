import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { appMetaKeys, getAppMetaText, setAppMetaText } from '@/core/db/appMeta';
import { timestampToLocalDateKey, toDateKey } from '@/lib/time';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const bootstrapStatements = [
  ...(Platform.OS === 'web' ? [] : ['PRAGMA journal_mode = WAL;']),
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
  assertSafeSqlIdentifier(table);
  assertSafeSqlIdentifier(column);
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  return columns.some((c) => c.name === column);
}

function assertSafeSqlIdentifier(value: string): void {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Unsafe SQLite identifier: ${value}`);
  }
}

async function addColumnIfMissing(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  assertSafeSqlIdentifier(table);
  assertSafeSqlIdentifier(column);
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
      await addColumnIfMissing(db, 'habits', 'category', "TEXT NOT NULL DEFAULT 'anytime'");
    });
  }
  if (version < 3) {
    await applyMigration(db, 3, async () => {
      await addColumnIfMissing(db, 'habits', 'icon', "TEXT NOT NULL DEFAULT 'check-circle'");
      await addColumnIfMissing(db, 'habits', 'color', "TEXT NOT NULL DEFAULT '#64748b'");
    });
  }
  if (version < 4) {
    await applyMigration(db, 4, async () => {
      await addColumnIfMissing(db, 'calorie_entries', 'fiber', 'REAL NOT NULL DEFAULT 0');
    });
  }
  if (version < 5) {
    // Record the UTC→local date key cutover in app_meta.
    // Rows written before this migration used UTC date keys (toISOString().slice(0, 10)).
    // Rows written after use local calendar keys via toDateKey() in lib/time.ts.
    // No backfill — rationale is documented in the unified knowledge base.
    await applyMigration(db, 5, async () => {
      const cutoverIso = new Date().toISOString();
      await setAppMetaText(db, appMetaKeys.dateKeyFormat, 'local');
      await setAppMetaText(db, appMetaKeys.dateKeyCutover, cutoverIso);
    });
  }
  if (version < 6) {
    await applyMigration(db, 6, async () => {
      await addColumnIfMissing(db, 'todos', 'due_date', 'TEXT');
      await addColumnIfMissing(db, 'todos', 'priority', "TEXT NOT NULL DEFAULT 'normal'");
      await addColumnIfMissing(db, 'todos', 'sort_order', 'INTEGER NOT NULL DEFAULT 0');
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
      await addColumnIfMissing(db, 'todos', 'recurrence', 'TEXT');
      await addColumnIfMissing(db, 'todos', 'recurrence_id', 'TEXT');
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
  if (version < 12) {
    await applyMigration(db, 12, async () => {
      await addColumnIfMissing(db, 'habits', 'rule_history', "TEXT NOT NULL DEFAULT '[]'");

      const habits = await db.getAllAsync<{
        id: string;
        target_per_day: number;
        created_at: string;
        rule_history: string | null;
      }>('SELECT id, target_per_day, created_at, rule_history FROM habits');

      for (const habit of habits) {
        if (habit.rule_history && habit.rule_history.trim() !== '[]') continue;

        const createdAt = new Date(habit.created_at);
        const effectiveFromDate = Number.isNaN(createdAt.getTime())
          ? toDateKey()
          : timestampToLocalDateKey(habit.created_at);
        const targetPerDay =
          Number.isInteger(habit.target_per_day) && habit.target_per_day > 0
            ? habit.target_per_day
            : 1;
        await db.runAsync('UPDATE habits SET rule_history = ? WHERE id = ?', [
          JSON.stringify([
            {
              effective_from_date: effectiveFromDate,
              weekdays: [1, 2, 3, 4, 5, 6, 7],
              target_per_day: targetPerDay,
            },
          ]),
          habit.id,
        ]);
      }
    });
  }
  if (version < 13) {
    await applyMigration(db, 13, async () => {
      await db.execAsync(`
      CREATE TABLE IF NOT EXISTS processed_notification_actions (
        action_key              TEXT PRIMARY KEY NOT NULL,
        kind                    TEXT NOT NULL,
        action_name             TEXT NOT NULL,
        occurrence_id           TEXT NOT NULL,
        linked_event_id         TEXT NOT NULL,
        linked_action_required  INTEGER NOT NULL DEFAULT 0,
        processed_at            TEXT NOT NULL
      );
    `);

      await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_processed_notification_actions_processed_at
      ON processed_notification_actions (processed_at);
      `);
    });
  }
  if (version < 14) {
    await applyMigration(db, 14, async () => {
      await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_outbox (
        entity      TEXT NOT NULL,
        id          TEXT NOT NULL,
        updated_at  TEXT NOT NULL,
        operation   TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
        revision    INTEGER NOT NULL,
        PRIMARY KEY (entity, id)
      );
    `);

      await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_sync_outbox_revision
      ON sync_outbox (revision ASC);
    `);

      // v13 and earlier stored the queue as an app_meta JSON snapshot. Import
      // valid legacy rows once so an upgrade cannot strand a pending backup
      // mutation when the new table becomes authoritative.
      const legacyValue = await getAppMetaText(db, appMetaKeys.syncOutbox);
      if (legacyValue) {
        try {
          const legacyRows: unknown = JSON.parse(legacyValue);
          if (Array.isArray(legacyRows)) {
            let revision = 0;
            for (const row of legacyRows) {
              if (!row || typeof row !== 'object') continue;
              const candidate = row as Record<string, unknown>;
              if (
                typeof candidate.entity !== 'string' ||
                typeof candidate.id !== 'string' ||
                typeof candidate.updatedAt !== 'string' ||
                !['create', 'update', 'delete'].includes(String(candidate.operation))
              ) {
                continue;
              }
              revision += 1;
              await db.runAsync(
                `INSERT INTO sync_outbox (entity, id, updated_at, operation, revision)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(entity, id) DO UPDATE SET
                   updated_at = excluded.updated_at,
                   operation = excluded.operation,
                   revision = excluded.revision
                 WHERE excluded.revision > sync_outbox.revision`,
                [
                  String(candidate.entity),
                  String(candidate.id),
                  String(candidate.updatedAt),
                  String(candidate.operation),
                  revision,
                ],
              );
            }
          }
        } catch {
          // Invalid legacy JSON is already treated as an empty queue by the
          // old persistence reader; the authoritative table remains valid.
        }
      }
      await setAppMetaText(db, appMetaKeys.syncOutbox, '[]');
    });
  }
  if (version < 15) {
    await applyMigration(db, 15, async () => {
      const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(sync_outbox)');
      if (!columns.some((column) => column.name === 'owner_user_id')) {
        await db.runAsync('ALTER TABLE sync_outbox ADD COLUMN owner_user_id TEXT');
      }
    });
  }

  // Migration 16: Weekly Reviews
  if (version < 16) {
    await applyMigration(db, 16, async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS weekly_reviews (
          id TEXT PRIMARY KEY,
          week_key TEXT NOT NULL,
          week_start_date TEXT NOT NULL,
          week_end_date TEXT NOT NULL,
          next_week_start_date TEXT NOT NULL,
          completed_at TEXT,
          status TEXT NOT NULL DEFAULT 'draft',
          summary_payload TEXT NOT NULL DEFAULT '{}',
          plan_payload TEXT NOT NULL DEFAULT '{}',
          reflection TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_reviews_week_key
          ON weekly_reviews (week_key) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_weekly_reviews_created_at
          ON weekly_reviews (created_at);
      `);
    });
  }

  // Migration 17: Productivity Expansion Wave V1 — planning entities.
  // Projects, Goals, and Daily Plans later joined Backup Scope V4 (see
  // core/backup/backup.types.ts); this block only establishes local schema.
  // They DO participate in account local-data ownership/emptiness safety
  // (account.types.ts ACCOUNT_USER_TABLES).
  if (version < 17) {
    await applyMigration(db, 17, async () => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          color TEXT NOT NULL,
          status TEXT NOT NULL,
          target_date TEXT,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_projects_status_order
          ON projects (status, sort_order) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_projects_target_date
          ON projects (target_date) WHERE deleted_at IS NULL;
      `);

      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS goals (
          id TEXT PRIMARY KEY NOT NULL,
          project_id TEXT,
          title TEXT NOT NULL,
          description TEXT,
          horizon TEXT NOT NULL,
          target_date TEXT,
          status TEXT NOT NULL,
          progress_percent INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_goals_project_id ON goals (project_id);
        CREATE INDEX IF NOT EXISTS idx_goals_status ON goals (status) WHERE deleted_at IS NULL;
      `);

      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS daily_plans (
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
        CREATE INDEX IF NOT EXISTS idx_daily_plans_date_key
          ON daily_plans (date_key) WHERE deleted_at IS NULL;
      `);

      await addColumnIfMissing(db, 'todos', 'project_id', 'TEXT');
      await addColumnIfMissing(db, 'todos', 'goal_id', 'TEXT');
      await addColumnIfMissing(db, 'habits', 'project_id', 'TEXT');
      await addColumnIfMissing(db, 'habits', 'goal_id', 'TEXT');
    });
  }

  // Migration 18: Harden daily_plans active-only date uniqueness (H2) and
  // ensure partial unique index matches soft-delete semantics.
  if (version < 18) {
    await applyMigration(db, 18, async () => {
      // Detect whether the global UNIQUE(date_key) constraint is present on the
      // table DDL (migration 17) vs already migrated to partial index only.
      // Rebuild only if the table SQL still declares UNIQUE on date_key.
      const tableInfo = await db.getAllAsync<{ sql: string | null }>(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name='daily_plans'`,
      );
      const tableSql = tableInfo[0]?.sql ?? '';
      const hasGlobalUnique = /date_key\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i.test(tableSql);
      if (!hasGlobalUnique) return;

      // Table-rebuild to drop the inline UNIQUE constraint while preserving all rows/tombstones.
      await db.execAsync(`
        CREATE TABLE daily_plans_new (
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
      await db.execAsync(`
        INSERT INTO daily_plans_new (id, date_key, intention, top_todo_ids, focus_target_minutes, notes, reflection, energy_score, status, created_at, updated_at, deleted_at)
        SELECT id, date_key, intention, top_todo_ids, focus_target_minutes, notes, reflection, energy_score, status, created_at, updated_at, deleted_at FROM daily_plans;
      `);
      // Verify row counts match before swapping.
      const before = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) as c FROM daily_plans');
      const after = await db.getFirstAsync<{ c: number }>(
        'SELECT COUNT(*) as c FROM daily_plans_new',
      );
      if ((before?.c ?? 0) !== (after?.c ?? 0)) {
        throw new Error('daily_plans migration row count mismatch');
      }
      // Verify active uniqueness would hold (no duplicate active date_key).
      const dup = await db.getFirstAsync<{ dup: number }>(
        `SELECT COUNT(*) as dup FROM (
           SELECT date_key FROM daily_plans_new WHERE deleted_at IS NULL GROUP BY date_key HAVING COUNT(*) > 1
         )`,
      );
      if ((dup?.dup ?? 0) > 0) {
        throw new Error('daily_plans active duplicate date_key detected during migration');
      }
      await db.execAsync('DROP TABLE daily_plans;');
      await db.execAsync('ALTER TABLE daily_plans_new RENAME TO daily_plans;');
      await db.execAsync(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_plans_date_key_active ON daily_plans(date_key) WHERE deleted_at IS NULL;`,
      );
      // Recreate compat index name for legacy queries (optional; keep both unique names)
      await db.execAsync(
        `CREATE INDEX IF NOT EXISTS idx_daily_plans_date_key ON daily_plans(date_key) WHERE deleted_at IS NULL;`,
      );
    });
  }

  // Migration 19: Stable completion timestamps (H5/H7) + calendar-safe date keys (H8).
  if (version < 19) {
    await applyMigration(db, 19, async () => {
      await addColumnIfMissing(db, 'todos', 'completed_at', 'TEXT');
      await addColumnIfMissing(db, 'projects', 'completed_at', 'TEXT');
      await addColumnIfMissing(db, 'goals', 'completed_at', 'TEXT');
      await addColumnIfMissing(db, 'daily_plans', 'completed_at', 'TEXT');
      // Backfill: legacy completed rows get best-effort completed_at = updated_at.
      // Spec requires documented value; pending rows remain NULL.
      await db.runAsync(
        `UPDATE todos SET completed_at = updated_at WHERE completed = 1 AND (completed_at IS NULL OR completed_at = '')`,
      );
      await db.runAsync(
        `UPDATE projects SET completed_at = updated_at WHERE status = 'completed' AND (completed_at IS NULL OR completed_at = '')`,
      );
      await db.runAsync(
        `UPDATE goals SET completed_at = updated_at WHERE status = 'completed' AND (completed_at IS NULL OR completed_at = '')`,
      );
      await db.runAsync(
        `UPDATE daily_plans SET completed_at = updated_at WHERE status = 'completed' AND (completed_at IS NULL OR completed_at = '')`,
      );
    });
  }

  // Migration 20: Hardening wave v2 durable-state promotion
  // (openspec/changes/harden-parallel-completion-wave-v2).
  // - habits.status / habits.lifecycle_history: durable pause/archive lifecycle
  //   (previously AsyncStorage-only and lost on restore/reinstall). The history
  //   JSON records {status, from_date_key, to_date_key|null} intervals so paused
  //   spans never create false missed occurrences in streak/consistency math.
  // - pomodoro_sessions linked-todo snapshot + note (previously AsyncStorage-only).
  // - workout_session_sets: per-set load/reps provenance for PR/volume features.
  //   NULL weight/reps means "not recorded" (unknown), never a measured zero;
  //   legacy sessions simply have no child rows.
  // - workout_logs started/ended/duration: real wall-clock session timing.
  //   NULL = untimed quick-complete or legacy row — never fabricated values.
  // - calorie_entries consumed_on index for hot range/list queries.
  if (version < 20) {
    await applyMigration(db, 20, async () => {
      await addColumnIfMissing(db, 'habits', 'status', "TEXT NOT NULL DEFAULT 'active'");
      await addColumnIfMissing(db, 'habits', 'lifecycle_history', 'TEXT');
      await addColumnIfMissing(db, 'pomodoro_sessions', 'linked_todo_id', 'TEXT');
      await addColumnIfMissing(db, 'pomodoro_sessions', 'linked_todo_title', 'TEXT');
      await addColumnIfMissing(db, 'pomodoro_sessions', 'note', 'TEXT');
      await db.execAsync(`
      CREATE TABLE IF NOT EXISTS workout_session_sets (
        id                   TEXT PRIMARY KEY NOT NULL,
        session_exercise_id  TEXT NOT NULL,
        set_number           INTEGER NOT NULL,
        weight               REAL,
        reps                 INTEGER,
        weight_unit          TEXT,
        completed            INTEGER NOT NULL DEFAULT 1,
        created_at           TEXT NOT NULL
      );
    `);
      await db.execAsync(
        `CREATE INDEX IF NOT EXISTS idx_workout_session_sets_exercise
         ON workout_session_sets (session_exercise_id);`,
      );
      await addColumnIfMissing(db, 'workout_logs', 'started_at', 'TEXT');
      await addColumnIfMissing(db, 'workout_logs', 'ended_at', 'TEXT');
      await addColumnIfMissing(db, 'workout_logs', 'duration_seconds', 'INTEGER');
      await db.execAsync(
        `CREATE INDEX IF NOT EXISTS idx_calorie_entries_consumed_on
         ON calorie_entries (consumed_on);`,
      );
    });
  }

  // Migration 21: Daily-plan priority title snapshots.
  // daily_plans.top_todo_titles stores a nullable JSON string[] aligned
  // index-wise with top_todo_ids at save time, so plan views keep showing a
  // priority's historical title after the todo is renamed or deleted.
  // NULL on pre-v21 rows until their next save re-snapshots; readers fall back
  // to a live todo lookup, then '(unavailable)'/'(removed)'.
  if (version < 21) {
    await applyMigration(db, 21, async () => {
      await addColumnIfMissing(db, 'daily_plans', 'top_todo_titles', 'TEXT');
    });
  }

  // Migration 22: Gym / Training V2 durable model.
  // Existing workout rows remain valid: missing catalog identity/modality is
  // interpreted by the feature as legacy free-text/timed configuration. New
  // user-owned tables are soft-deletable and enter the normal backup outbox.
  if (version < 22) {
    await applyMigration(db, 22, async () => {
      await addColumnIfMissing(db, 'workout_routines', 'goal_tag', 'TEXT');

      await addColumnIfMissing(db, 'routine_exercises', 'catalog_exercise_id', 'TEXT');
      await addColumnIfMissing(
        db,
        'routine_exercises',
        'modality',
        "TEXT NOT NULL DEFAULT 'timed'",
      );
      await addColumnIfMissing(db, 'routine_exercises', 'notes', 'TEXT');
      await addColumnIfMissing(db, 'routine_exercises', 'superset_group', 'TEXT');
      await addColumnIfMissing(
        db,
        'routine_exercises',
        'progression_mode',
        "TEXT NOT NULL DEFAULT 'none'",
      );
      await addColumnIfMissing(db, 'routine_exercises', 'progression_increment', 'REAL');
      await addColumnIfMissing(db, 'routine_exercises', 'progression_min_reps', 'INTEGER');
      await addColumnIfMissing(db, 'routine_exercises', 'progression_max_reps', 'INTEGER');

      await addColumnIfMissing(db, 'routine_exercise_sets', 'target_reps_min', 'INTEGER');
      await addColumnIfMissing(db, 'routine_exercise_sets', 'target_reps_max', 'INTEGER');
      await addColumnIfMissing(db, 'routine_exercise_sets', 'target_load', 'REAL');
      await addColumnIfMissing(db, 'routine_exercise_sets', 'target_duration_seconds', 'INTEGER');
      await addColumnIfMissing(db, 'routine_exercise_sets', 'target_distance', 'REAL');
      await addColumnIfMissing(db, 'routine_exercise_sets', 'target_pace', 'REAL');

      await addColumnIfMissing(db, 'workout_logs', 'routine_name', 'TEXT');
      await addColumnIfMissing(db, 'workout_session_exercises', 'catalog_exercise_id', 'TEXT');
      await addColumnIfMissing(
        db,
        'workout_session_exercises',
        'modality',
        "TEXT NOT NULL DEFAULT 'timed'",
      );
      await addColumnIfMissing(db, 'workout_session_sets', 'duration_seconds', 'INTEGER');
      await addColumnIfMissing(db, 'workout_session_sets', 'distance', 'REAL');
      await addColumnIfMissing(db, 'workout_session_sets', 'pace', 'REAL');
      await addColumnIfMissing(db, 'workout_session_sets', 'effort_value', 'REAL');
      await addColumnIfMissing(db, 'workout_session_sets', 'effort_scale', 'TEXT');

      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS custom_exercises (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          primary_area TEXT NOT NULL,
          secondary_areas TEXT NOT NULL DEFAULT '[]',
          equipment TEXT,
          modality TEXT NOT NULL,
          unilateral INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_custom_exercises_active_name
          ON custom_exercises (name, updated_at);

        CREATE TABLE IF NOT EXISTS workout_weekly_plan (
          id TEXT PRIMARY KEY NOT NULL,
          weekday INTEGER NOT NULL,
          routine_id TEXT,
          plan_kind TEXT NOT NULL DEFAULT 'rest',
          note TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uq_workout_weekly_plan_active_weekday
          ON workout_weekly_plan (weekday) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_workout_weekly_plan_routine
          ON workout_weekly_plan (routine_id, weekday);

        CREATE TABLE IF NOT EXISTS workout_schedule_overrides (
          id TEXT PRIMARY KEY NOT NULL,
          date_key TEXT NOT NULL,
          override_kind TEXT NOT NULL DEFAULT 'rest',
          routine_id TEXT,
          moved_from_date_key TEXT,
          note TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uq_workout_schedule_overrides_active_date
          ON workout_schedule_overrides (date_key) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_workout_schedule_overrides_date
          ON workout_schedule_overrides (date_key, updated_at);

        CREATE TABLE IF NOT EXISTS body_weight_entries (
          id TEXT PRIMARY KEY NOT NULL,
          measured_on TEXT NOT NULL,
          measured_at TEXT NOT NULL,
          weight REAL NOT NULL,
          unit TEXT NOT NULL,
          note TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_body_weight_entries_measured_at
          ON body_weight_entries (measured_at, id);
        CREATE INDEX IF NOT EXISTS idx_body_weight_entries_measured_on
          ON body_weight_entries (measured_on, id);
      `);
    });
  }
}

async function openAndBootstrap(): Promise<SQLite.SQLiteDatabase> {
  const database = await SQLite.openDatabaseAsync('superhabits.db');
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
