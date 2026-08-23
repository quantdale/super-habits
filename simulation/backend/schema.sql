-- ============================================================================
-- COMPATIBILITY SCHEMA — DISPOSABLE-BACKEND LANE
-- ============================================================================
-- This is a standalone, throwaway-backend fixture for the repository-managed
-- Supabase contract. It is never a runtime authority and is never applied to
-- production; simulation/backend/guard.ts must approve its target first.
--
-- The app uses anonymous Supabase Auth sessions. A signed-in anonymous user
-- is evaluated as `authenticated` and owns rows through auth.uid(). The
-- unauthenticated `anon` role has no backup CRUD access.
--
-- The sync adapter selects full local rows and upserts by the globally unique
-- app-generated text id. The four tables below therefore list every local
-- column written by the synchronized entity data layers.

CREATE TABLE IF NOT EXISTS public.todos (
  id            TEXT PRIMARY KEY NOT NULL,
  user_id       UUID NOT NULL DEFAULT auth.uid(),
  title         TEXT NOT NULL,
  notes         TEXT,
  completed     INTEGER NOT NULL DEFAULT 0,
  due_date      TEXT,
  priority      TEXT NOT NULL DEFAULT 'normal',
  sort_order    INTEGER NOT NULL DEFAULT 0,
  recurrence    TEXT,
  recurrence_id TEXT,
  project_id    TEXT,
  goal_id       TEXT,
  completed_at  TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT
);

CREATE TABLE IF NOT EXISTS public.habits (
  id               TEXT PRIMARY KEY NOT NULL,
  user_id          UUID NOT NULL DEFAULT auth.uid(),
  name             TEXT NOT NULL,
  target_per_day   INTEGER NOT NULL DEFAULT 1,
  reminder_time    TEXT,
  category         TEXT NOT NULL DEFAULT 'anytime',
  icon             TEXT NOT NULL DEFAULT 'check-circle',
  color            TEXT NOT NULL DEFAULT '#64748b',
  rule_history     TEXT NOT NULL DEFAULT '[]',
  project_id       TEXT,
  goal_id          TEXT,
  status           TEXT NOT NULL DEFAULT 'active',
  lifecycle_history TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  deleted_at       TEXT
);

CREATE TABLE IF NOT EXISTS public.calorie_entries (
  id           TEXT PRIMARY KEY NOT NULL,
  user_id      UUID NOT NULL DEFAULT auth.uid(),
  food_name    TEXT NOT NULL,
  calories     INTEGER NOT NULL,
  protein      DOUBLE PRECISION NOT NULL DEFAULT 0,
  carbs        DOUBLE PRECISION NOT NULL DEFAULT 0,
  fats         DOUBLE PRECISION NOT NULL DEFAULT 0,
  fiber        DOUBLE PRECISION NOT NULL DEFAULT 0,
  meal_type    TEXT NOT NULL,
  consumed_on  TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);

CREATE TABLE IF NOT EXISTS public.workout_routines (
  id          TEXT PRIMARY KEY NOT NULL,
  user_id     UUID NOT NULL DEFAULT auth.uid(),
  name        TEXT NOT NULL,
  description TEXT,
  goal_tag    TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_todos_user_id ON public.todos (user_id);
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON public.habits (user_id);
CREATE INDEX IF NOT EXISTS idx_calorie_entries_user_id
  ON public.calorie_entries (user_id);
CREATE INDEX IF NOT EXISTS idx_workout_routines_user_id
  ON public.workout_routines (user_id);

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calorie_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_todos_select_owner" ON public.todos
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_todos_insert_owner" ON public.todos
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_todos_update_owner" ON public.todos
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_todos_delete_owner" ON public.todos
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY "sync_habits_select_owner" ON public.habits
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_habits_insert_owner" ON public.habits
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_habits_update_owner" ON public.habits
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_habits_delete_owner" ON public.habits
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY "sync_calorie_entries_select_owner" ON public.calorie_entries
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_calorie_entries_insert_owner" ON public.calorie_entries
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_calorie_entries_update_owner" ON public.calorie_entries
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_calorie_entries_delete_owner" ON public.calorie_entries
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY "sync_workout_routines_select_owner" ON public.workout_routines
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_workout_routines_insert_owner" ON public.workout_routines
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_workout_routines_update_owner" ON public.workout_routines
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_workout_routines_delete_owner" ON public.workout_routines
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

REVOKE ALL PRIVILEGES ON TABLE
  public.todos,
  public.habits,
  public.calorie_entries,
  public.workout_routines
  FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.todos,
  public.habits,
  public.calorie_entries,
  public.workout_routines
  TO authenticated, service_role;
-- ============================================================================
-- BACKUP COMPLETENESS V2 TABLES
-- ============================================================================
-- Mirror of the repository-owned remote schema added by the V2 migration.
-- Every table is owner-scoped with the same hardened policy contract.

CREATE TABLE IF NOT EXISTS public.habit_completions (
  id         TEXT PRIMARY KEY NOT NULL,
  user_id    UUID NOT NULL DEFAULT auth.uid(),
  habit_id   TEXT NOT NULL,
  date_key   TEXT NOT NULL,
  count      INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT habit_completions_habit_date_unique UNIQUE (habit_id, date_key)
);

CREATE TABLE IF NOT EXISTS public.pomodoro_sessions (
  id                TEXT PRIMARY KEY NOT NULL,
  user_id           UUID NOT NULL DEFAULT auth.uid(),
  started_at        TEXT NOT NULL,
  ended_at          TEXT NOT NULL,
  duration_seconds  INTEGER NOT NULL,
  session_type      TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  linked_todo_id    TEXT,
  linked_todo_title TEXT,
  note              TEXT
);

CREATE TABLE IF NOT EXISTS public.routine_exercises (
  id         TEXT PRIMARY KEY NOT NULL,
  user_id    UUID NOT NULL DEFAULT auth.uid(),
  routine_id TEXT NOT NULL,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  catalog_exercise_id TEXT,
  modality   TEXT NOT NULL DEFAULT 'timed',
  notes      TEXT,
  superset_group TEXT,
  progression_mode TEXT NOT NULL DEFAULT 'none',
  progression_increment REAL,
  progression_min_reps INTEGER,
  progression_max_reps INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS public.routine_exercise_sets (
  id             TEXT PRIMARY KEY NOT NULL,
  user_id        UUID NOT NULL DEFAULT auth.uid(),
  exercise_id    TEXT NOT NULL,
  set_number     INTEGER NOT NULL,
  active_seconds INTEGER NOT NULL DEFAULT 40,
  rest_seconds   INTEGER NOT NULL DEFAULT 20,
  target_reps_min INTEGER,
  target_reps_max INTEGER,
  target_load REAL,
  target_duration_seconds INTEGER,
  target_distance REAL,
  target_pace REAL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  deleted_at     TEXT
);

CREATE TABLE IF NOT EXISTS public.workout_logs (
  id               TEXT PRIMARY KEY NOT NULL,
  user_id          UUID NOT NULL DEFAULT auth.uid(),
  routine_id       TEXT NOT NULL,
  notes            TEXT,
  completed_at     TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  started_at       TEXT,
  ended_at         TEXT,
  duration_seconds INTEGER,
  routine_name     TEXT
);

CREATE TABLE IF NOT EXISTS public.workout_session_exercises (
  id              TEXT PRIMARY KEY NOT NULL,
  user_id         UUID NOT NULL DEFAULT auth.uid(),
  log_id          TEXT NOT NULL,
  exercise_name   TEXT NOT NULL,
  sets_completed  INTEGER NOT NULL DEFAULT 0,
  catalog_exercise_id TEXT,
  modality        TEXT NOT NULL DEFAULT 'timed',
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.saved_meals (
  id           TEXT PRIMARY KEY NOT NULL,
  user_id      UUID NOT NULL DEFAULT auth.uid(),
  food_name    TEXT NOT NULL,
  calories     INTEGER NOT NULL,
  protein      REAL NOT NULL DEFAULT 0,
  carbs        REAL NOT NULL DEFAULT 0,
  fats         REAL NOT NULL DEFAULT 0,
  fiber        REAL NOT NULL DEFAULT 0,
  meal_type    TEXT NOT NULL DEFAULT 'breakfast',
  use_count    INTEGER NOT NULL DEFAULT 1,
  last_used_at TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

-- Owner-scoped, case-insensitive saved-meal uniqueness (closure contract):
-- different owners may store the same food name; one owner may not.
CREATE UNIQUE INDEX IF NOT EXISTS uq_saved_meals_owner_food_name
  ON public.saved_meals (user_id, lower(food_name));

CREATE TABLE IF NOT EXISTS public.linked_action_rules (
  id                      TEXT PRIMARY KEY NOT NULL,
  user_id                 UUID NOT NULL DEFAULT auth.uid(),
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

CREATE TABLE IF NOT EXISTS public.user_backup_settings (
  user_id           UUID PRIMARY KEY NOT NULL DEFAULT auth.uid(),
  settings_version  INTEGER NOT NULL,
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.backup_manifest (
  user_id                UUID PRIMARY KEY NOT NULL DEFAULT auth.uid(),
  backup_schema_version  INTEGER NOT NULL,
  generation             INTEGER NOT NULL,
  completed_at           TIMESTAMPTZ NOT NULL,
  entity_metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings_version       INTEGER NOT NULL DEFAULT 0,
  backup_scope_version   INTEGER,
  settings_metadata      JSONB,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_habit_completions_user_id
  ON public.habit_completions (user_id);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user_id
  ON public.pomodoro_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_routine_exercises_user_id
  ON public.routine_exercises (user_id);
CREATE INDEX IF NOT EXISTS idx_routine_exercise_sets_user_id
  ON public.routine_exercise_sets (user_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_id
  ON public.workout_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_workout_session_exercises_user_id
  ON public.workout_session_exercises (user_id);
CREATE INDEX IF NOT EXISTS idx_saved_meals_user_id
  ON public.saved_meals (user_id);
CREATE INDEX IF NOT EXISTS idx_linked_action_rules_user_id
  ON public.linked_action_rules (user_id);

ALTER TABLE public.habit_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pomodoro_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_exercise_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.linked_action_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_backup_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_manifest ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_habit_completions_select_owner" ON public.habit_completions
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_habit_completions_insert_owner" ON public.habit_completions
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_habit_completions_update_owner" ON public.habit_completions
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_habit_completions_delete_owner" ON public.habit_completions
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY "sync_pomodoro_sessions_select_owner" ON public.pomodoro_sessions
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_pomodoro_sessions_insert_owner" ON public.pomodoro_sessions
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_pomodoro_sessions_update_owner" ON public.pomodoro_sessions
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_pomodoro_sessions_delete_owner" ON public.pomodoro_sessions
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY "sync_routine_exercises_select_owner" ON public.routine_exercises
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_routine_exercises_insert_owner" ON public.routine_exercises
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_routine_exercises_update_owner" ON public.routine_exercises
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_routine_exercises_delete_owner" ON public.routine_exercises
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY "sync_routine_exercise_sets_select_owner" ON public.routine_exercise_sets
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_routine_exercise_sets_insert_owner" ON public.routine_exercise_sets
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_routine_exercise_sets_update_owner" ON public.routine_exercise_sets
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_routine_exercise_sets_delete_owner" ON public.routine_exercise_sets
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY "sync_workout_logs_select_owner" ON public.workout_logs
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_workout_logs_insert_owner" ON public.workout_logs
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_workout_logs_update_owner" ON public.workout_logs
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_workout_logs_delete_owner" ON public.workout_logs
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY "sync_workout_session_exercises_select_owner" ON public.workout_session_exercises
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_workout_session_exercises_insert_owner" ON public.workout_session_exercises
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_workout_session_exercises_update_owner" ON public.workout_session_exercises
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_workout_session_exercises_delete_owner" ON public.workout_session_exercises
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY "sync_saved_meals_select_owner" ON public.saved_meals
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_saved_meals_insert_owner" ON public.saved_meals
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_saved_meals_update_owner" ON public.saved_meals
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_saved_meals_delete_owner" ON public.saved_meals
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY "sync_linked_action_rules_select_owner" ON public.linked_action_rules
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_linked_action_rules_insert_owner" ON public.linked_action_rules
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_linked_action_rules_update_owner" ON public.linked_action_rules
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_linked_action_rules_delete_owner" ON public.linked_action_rules
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY "sync_user_backup_settings_select_owner" ON public.user_backup_settings
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_user_backup_settings_insert_owner" ON public.user_backup_settings
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_user_backup_settings_update_owner" ON public.user_backup_settings
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_user_backup_settings_delete_owner" ON public.user_backup_settings
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY "sync_backup_manifest_select_owner" ON public.backup_manifest
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_backup_manifest_insert_owner" ON public.backup_manifest
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_backup_manifest_update_owner" ON public.backup_manifest
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_backup_manifest_delete_owner" ON public.backup_manifest
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

REVOKE ALL PRIVILEGES ON TABLE
  public.habit_completions,
  public.pomodoro_sessions,
  public.routine_exercises,
  public.routine_exercise_sets,
  public.workout_logs,
  public.workout_session_exercises,
  public.saved_meals,
  public.linked_action_rules,
  public.user_backup_settings,
  public.backup_manifest
  FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.habit_completions,
  public.pomodoro_sessions,
  public.routine_exercises,
  public.routine_exercise_sets,
  public.workout_logs,
  public.workout_session_exercises,
  public.saved_meals,
  public.linked_action_rules,
  public.user_backup_settings,
  public.backup_manifest
  TO authenticated, service_role;

-- ============================================================================
-- PLANNING SCHEMA CONVERGENCE TABLES
-- ============================================================================
-- Owner-scoped planning tables the hardened client now backs up as part of
-- Backup Scope V4 (projects, goals, daily_plans). Same hardened policy model.

CREATE TABLE IF NOT EXISTS public.projects (
  id           TEXT PRIMARY KEY NOT NULL,
  user_id      UUID NOT NULL DEFAULT auth.uid(),
  name         TEXT NOT NULL,
  description  TEXT,
  color        TEXT NOT NULL,
  status       TEXT NOT NULL,
  target_date  TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS public.goals (
  id           TEXT PRIMARY KEY NOT NULL,
  user_id      UUID NOT NULL DEFAULT auth.uid(),
  project_id   TEXT,
  title        TEXT NOT NULL,
  description  TEXT,
  horizon      TEXT NOT NULL,
  target_date  TEXT,
  status       TEXT NOT NULL,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS public.daily_plans (
  id                    TEXT PRIMARY KEY NOT NULL,
  user_id               UUID NOT NULL DEFAULT auth.uid(),
  date_key              TEXT NOT NULL,
  intention             TEXT NOT NULL DEFAULT '',
  top_todo_ids          TEXT NOT NULL DEFAULT '[]',
  top_todo_titles       TEXT,
  focus_target_minutes  INTEGER NOT NULL DEFAULT 0,
  notes                 TEXT NOT NULL DEFAULT '',
  reflection            TEXT NOT NULL DEFAULT '',
  energy_score          INTEGER,
  status                TEXT NOT NULL DEFAULT 'draft',
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL,
  deleted_at            TEXT,
  completed_at          TEXT
);

-- Owner-scoped active Daily Plan uniqueness (NOT global UNIQUE(date_key)).
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_plans_owner_date_active
  ON public.daily_plans (user_id, date_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_daily_plans_owner_date
  ON public.daily_plans (user_id, date_key);
CREATE INDEX IF NOT EXISTS idx_projects_owner_status_order
  ON public.projects (user_id, status, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_owner_target_date
  ON public.projects (user_id, target_date);
CREATE INDEX IF NOT EXISTS idx_goals_owner_project_id
  ON public.goals (user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_goals_owner_status
  ON public.goals (user_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_todos_owner_project_id
  ON public.todos (user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_todos_owner_goal_id
  ON public.todos (user_id, goal_id);
CREATE INDEX IF NOT EXISTS idx_habits_owner_project_id
  ON public.habits (user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_habits_owner_goal_id
  ON public.habits (user_id, goal_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_projects_select_owner" ON public.projects
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_projects_insert_owner" ON public.projects
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_projects_update_owner" ON public.projects
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_projects_delete_owner" ON public.projects
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY "sync_goals_select_owner" ON public.goals
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_goals_insert_owner" ON public.goals
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_goals_update_owner" ON public.goals
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_goals_delete_owner" ON public.goals
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY "sync_daily_plans_select_owner" ON public.daily_plans
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_daily_plans_insert_owner" ON public.daily_plans
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_daily_plans_update_owner" ON public.daily_plans
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_daily_plans_delete_owner" ON public.daily_plans
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

REVOKE ALL PRIVILEGES ON TABLE
  public.projects,
  public.goals,
  public.daily_plans
  FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.projects,
  public.goals,
  public.daily_plans
  TO authenticated, service_role;

-- ============================================================================
-- HARDENING WAVE V2: SCOPE V5 TABLES + PRODUCTION PARITY CONSTRAINTS
-- ============================================================================
-- Brings the disposable-lane fixture to parity with supabase/migrations/*:
-- the weekly_reviews remote table, the workout_session_sets per-set load
-- table, Scope V5 durable columns (added inline to the table definitions
-- above), owner-pair uniqueness indexes, and composite (parent_id, user_id)
-- foreign keys matching production constraint strictness.

CREATE TABLE IF NOT EXISTS public.weekly_reviews (
  id                   TEXT PRIMARY KEY NOT NULL,
  user_id              UUID NOT NULL DEFAULT auth.uid(),
  week_key             TEXT NOT NULL,
  week_start_date      TEXT NOT NULL,
  week_end_date        TEXT NOT NULL,
  next_week_start_date TEXT NOT NULL,
  completed_at         TEXT,
  status               TEXT NOT NULL,
  summary_payload      TEXT NOT NULL,
  plan_payload         TEXT NOT NULL,
  reflection           TEXT NOT NULL,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  deleted_at           TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_weekly_reviews_owner_week_active
  ON public.weekly_reviews (user_id, week_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_user_id
  ON public.weekly_reviews (user_id, created_at, id);

ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_weekly_reviews_select_owner" ON public.weekly_reviews
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_weekly_reviews_insert_owner" ON public.weekly_reviews
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_weekly_reviews_update_owner" ON public.weekly_reviews
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_weekly_reviews_delete_owner" ON public.weekly_reviews
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

REVOKE ALL PRIVILEGES ON TABLE public.weekly_reviews FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.weekly_reviews
  TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.workout_session_sets (
  id                  TEXT PRIMARY KEY NOT NULL,
  user_id             UUID NOT NULL DEFAULT auth.uid(),
  session_exercise_id TEXT NOT NULL,
  set_number          INTEGER NOT NULL,
  weight              REAL,
  reps                INTEGER,
  weight_unit         TEXT,
  completed           INTEGER NOT NULL DEFAULT 1,
  duration_seconds   INTEGER,
  distance           REAL,
  pace               REAL,
  effort_value       REAL,
  effort_scale       TEXT,
  created_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workout_session_sets_user_id
  ON public.workout_session_sets (user_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_workout_session_sets_owner_exercise
  ON public.workout_session_sets (user_id, session_exercise_id);

ALTER TABLE public.workout_session_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_workout_session_sets_select_owner" ON public.workout_session_sets
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_workout_session_sets_insert_owner" ON public.workout_session_sets
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_workout_session_sets_update_owner" ON public.workout_session_sets
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_workout_session_sets_delete_owner" ON public.workout_session_sets
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

REVOKE ALL PRIVILEGES ON TABLE public.workout_session_sets FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workout_session_sets
  TO authenticated, service_role;

-- ============================================================================
-- GYM / TRAINING V2 TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.custom_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid(),
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

CREATE TABLE IF NOT EXISTS public.workout_weekly_plan (
  id TEXT PRIMARY KEY NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  weekday INTEGER NOT NULL,
  routine_id TEXT,
  plan_kind TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS public.workout_schedule_overrides (
  id TEXT PRIMARY KEY NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  date_key TEXT NOT NULL,
  override_kind TEXT NOT NULL,
  routine_id TEXT,
  moved_from_date_key TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS public.body_weight_entries (
  id TEXT PRIMARY KEY NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  measured_on TEXT NOT NULL,
  measured_at TEXT NOT NULL,
  weight REAL NOT NULL,
  unit TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_custom_exercises_user_id
  ON public.custom_exercises (user_id, updated_at, id);
CREATE INDEX IF NOT EXISTS idx_workout_weekly_plan_user_id
  ON public.workout_weekly_plan (user_id, weekday, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_workout_weekly_plan_owner_weekday
  ON public.workout_weekly_plan (user_id, weekday) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_workout_schedule_overrides_user_date
  ON public.workout_schedule_overrides (user_id, date_key, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_workout_schedule_overrides_owner_date
  ON public.workout_schedule_overrides (user_id, date_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_body_weight_entries_user_measured_at
  ON public.body_weight_entries (user_id, measured_at, id);

ALTER TABLE public.custom_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_weekly_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_schedule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_weight_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_custom_exercises_select_owner" ON public.custom_exercises
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_custom_exercises_insert_owner" ON public.custom_exercises
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_custom_exercises_update_owner" ON public.custom_exercises
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_custom_exercises_delete_owner" ON public.custom_exercises
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY "sync_workout_weekly_plan_select_owner" ON public.workout_weekly_plan
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_workout_weekly_plan_insert_owner" ON public.workout_weekly_plan
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_workout_weekly_plan_update_owner" ON public.workout_weekly_plan
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_workout_weekly_plan_delete_owner" ON public.workout_weekly_plan
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY "sync_workout_schedule_overrides_select_owner" ON public.workout_schedule_overrides
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_workout_schedule_overrides_insert_owner" ON public.workout_schedule_overrides
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_workout_schedule_overrides_update_owner" ON public.workout_schedule_overrides
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_workout_schedule_overrides_delete_owner" ON public.workout_schedule_overrides
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY "sync_body_weight_entries_select_owner" ON public.body_weight_entries
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "sync_body_weight_entries_insert_owner" ON public.body_weight_entries
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_body_weight_entries_update_owner" ON public.body_weight_entries
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "sync_body_weight_entries_delete_owner" ON public.body_weight_entries
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

REVOKE ALL PRIVILEGES ON TABLE
  public.custom_exercises,
  public.workout_weekly_plan,
  public.workout_schedule_overrides,
  public.body_weight_entries
  FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.custom_exercises,
  public.workout_weekly_plan,
  public.workout_schedule_overrides,
  public.body_weight_entries
  TO authenticated, service_role;

-- Owner-pair uniqueness indexes required by composite (parent_id, user_id)
-- foreign keys (production parity; see migrations 20260815100000 / 20260820010000).
CREATE UNIQUE INDEX IF NOT EXISTS uq_habits_id_user ON public.habits (id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_workout_routines_id_user
  ON public.workout_routines (id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_routine_exercises_id_user
  ON public.routine_exercises (id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_workout_logs_id_user
  ON public.workout_logs (id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_workout_session_exercises_id_user
  ON public.workout_session_exercises (id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_id_user ON public.projects (id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_goals_id_user ON public.goals (id, user_id);

-- Composite owner FKs (parent association id + owner must agree).
ALTER TABLE public.habit_completions
  ADD CONSTRAINT habit_completions_habit_owner_fkey
    FOREIGN KEY (habit_id, user_id) REFERENCES public.habits (id, user_id) ON DELETE NO ACTION;
ALTER TABLE public.routine_exercises
  ADD CONSTRAINT routine_exercises_routine_owner_fkey
    FOREIGN KEY (routine_id, user_id) REFERENCES public.workout_routines (id, user_id) ON DELETE NO ACTION;
ALTER TABLE public.routine_exercise_sets
  ADD CONSTRAINT routine_exercise_sets_exercise_owner_fkey
    FOREIGN KEY (exercise_id, user_id) REFERENCES public.routine_exercises (id, user_id) ON DELETE NO ACTION;
ALTER TABLE public.workout_logs
  ADD CONSTRAINT workout_logs_routine_owner_fkey
    FOREIGN KEY (routine_id, user_id) REFERENCES public.workout_routines (id, user_id) ON DELETE NO ACTION;
ALTER TABLE public.workout_session_exercises
  ADD CONSTRAINT workout_session_exercises_log_owner_fkey
    FOREIGN KEY (log_id, user_id) REFERENCES public.workout_logs (id, user_id) ON DELETE NO ACTION;
ALTER TABLE public.workout_session_sets
  ADD CONSTRAINT workout_session_sets_exercise_owner_fkey
    FOREIGN KEY (session_exercise_id, user_id) REFERENCES public.workout_session_exercises (id, user_id) ON DELETE NO ACTION;

ALTER TABLE public.goals
  ADD CONSTRAINT goals_project_owner_fkey
    FOREIGN KEY (project_id, user_id) REFERENCES public.projects (id, user_id) ON DELETE NO ACTION;
ALTER TABLE public.todos
  ADD CONSTRAINT todos_project_owner_fkey
    FOREIGN KEY (project_id, user_id) REFERENCES public.projects (id, user_id) ON DELETE NO ACTION,
  ADD CONSTRAINT todos_goal_owner_fkey
    FOREIGN KEY (goal_id, user_id) REFERENCES public.goals (id, user_id) ON DELETE NO ACTION;
ALTER TABLE public.habits
  ADD CONSTRAINT habits_project_owner_fkey
    FOREIGN KEY (project_id, user_id) REFERENCES public.projects (id, user_id) ON DELETE NO ACTION,
  ADD CONSTRAINT habits_goal_owner_fkey
    FOREIGN KEY (goal_id, user_id) REFERENCES public.goals (id, user_id) ON DELETE NO ACTION;
