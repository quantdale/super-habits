-- ============================================================
-- REFERENCE SNAPSHOT ONLY — NOT EXECUTED AT RUNTIME
-- ============================================================
-- The authoritative schema is the bootstrapStatements array
-- in core/db/client.ts, plus the runMigrations() cases.
-- Current stored schema version: 24 (this file is a partial reference snapshot and may lag the runtime DDL in core/db/client.ts, which is authoritative).
-- This file is hand-maintained from core/db/client.ts — copy
-- the bootstrap DDL and every `if (version < N)` block through
-- v15. It is a documentation snapshot, not runtime migration code;
-- do not rely on it for migrations or type generation.
-- ============================================================

PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  due_date TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  sort_order INTEGER NOT NULL DEFAULT 0,
  recurrence TEXT,
  recurrence_id TEXT
);

CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  target_per_day INTEGER NOT NULL DEFAULT 1,
  reminder_time TEXT,
  category TEXT NOT NULL DEFAULT 'anytime',
  icon TEXT NOT NULL DEFAULT 'check-circle',
  color TEXT NOT NULL DEFAULT '#64748b',
  rule_history TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS habit_completions (
  id TEXT PRIMARY KEY NOT NULL,
  habit_id TEXT NOT NULL,
  date_key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(habit_id, date_key)
);

CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  session_type TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workout_routines (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS workout_logs (
  id TEXT PRIMARY KEY NOT NULL,
  routine_id TEXT NOT NULL,
  notes TEXT,
  completed_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calorie_entries (
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
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS routine_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  routine_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
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
  log_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  sets_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_meals (
  id TEXT PRIMARY KEY NOT NULL,
  food_name TEXT NOT NULL,
  calories INTEGER NOT NULL,
  protein REAL NOT NULL DEFAULT 0,
  carbs REAL NOT NULL DEFAULT 0,
  fats REAL NOT NULL DEFAULT 0,
  fiber REAL NOT NULL DEFAULT 0,
  meal_type TEXT NOT NULL DEFAULT 'breakfast',
  use_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_saved_meals_food_name
  ON saved_meals (food_name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS linked_action_rules (
  id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL,
  direction_policy TEXT NOT NULL,
  bidirectional_group_id TEXT,
  source_feature TEXT NOT NULL,
  source_entity_type TEXT NOT NULL,
  source_entity_id TEXT,
  trigger_type TEXT NOT NULL,
  target_feature TEXT NOT NULL,
  target_entity_type TEXT NOT NULL,
  target_entity_id TEXT,
  effect_type TEXT NOT NULL,
  effect_payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_linked_action_rules_source_lookup
  ON linked_action_rules (
    status,
    source_feature,
    source_entity_type,
    source_entity_id,
    trigger_type
  );

CREATE INDEX IF NOT EXISTS idx_linked_action_rules_bidirectional_group
  ON linked_action_rules (bidirectional_group_id);

CREATE TABLE IF NOT EXISTS linked_action_events (
  id TEXT PRIMARY KEY NOT NULL,
  chain_id TEXT NOT NULL,
  root_event_id TEXT NOT NULL,
  parent_event_id TEXT,
  chain_depth INTEGER NOT NULL DEFAULT 0,
  origin_kind TEXT NOT NULL,
  origin_rule_id TEXT,
  origin_event_id TEXT,
  source_feature TEXT NOT NULL,
  source_entity_type TEXT NOT NULL,
  source_entity_id TEXT,
  trigger_type TEXT NOT NULL,
  source_record_id TEXT,
  source_date_key TEXT,
  source_label TEXT,
  occurred_at TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_linked_action_events_chain
  ON linked_action_events (chain_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_linked_action_events_source_lookup
  ON linked_action_events (
    source_feature,
    source_entity_type,
    source_entity_id,
    trigger_type,
    occurred_at DESC
  );

CREATE TABLE IF NOT EXISTS linked_action_executions (
  id TEXT PRIMARY KEY NOT NULL,
  rule_id TEXT NOT NULL,
  source_event_id TEXT NOT NULL,
  chain_id TEXT NOT NULL,
  root_event_id TEXT NOT NULL,
  origin_rule_id TEXT,
  effect_type TEXT NOT NULL,
  effect_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL,
  target_feature TEXT NOT NULL,
  target_entity_type TEXT NOT NULL,
  target_entity_id TEXT,
  produced_entity_type TEXT,
  produced_entity_id TEXT,
  notice_payload TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_linked_action_executions_source_rule
  ON linked_action_executions (rule_id, source_event_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_linked_action_executions_chain_guard
  ON linked_action_executions (chain_id, rule_id, effect_fingerprint);

CREATE INDEX IF NOT EXISTS idx_linked_action_executions_chain
  ON linked_action_executions (chain_id, created_at DESC);

CREATE TABLE IF NOT EXISTS processed_notification_actions (
  action_key              TEXT PRIMARY KEY NOT NULL,
  kind                    TEXT NOT NULL,
  action_name             TEXT NOT NULL,
  occurrence_id           TEXT NOT NULL,
  linked_event_id         TEXT NOT NULL,
  linked_action_required  INTEGER NOT NULL DEFAULT 0,
  processed_at            TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_processed_notification_actions_processed_at
  ON processed_notification_actions (processed_at);

-- Durable sync outbox (runtime migrations 14–15). The app_meta JSON key is a
-- legacy upgrade source only; this table is authoritative for pending pushes.
CREATE TABLE IF NOT EXISTS sync_outbox (
  entity      TEXT NOT NULL,
  id          TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  operation   TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  owner_user_id TEXT,
  revision    INTEGER NOT NULL,
  PRIMARY KEY (entity, id)
);

CREATE INDEX IF NOT EXISTS idx_sync_outbox_revision
  ON sync_outbox (revision ASC);

-- v16: Weekly Reviews
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
