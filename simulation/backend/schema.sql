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
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT
);

CREATE TABLE IF NOT EXISTS public.habits (
  id             TEXT PRIMARY KEY NOT NULL,
  user_id        UUID NOT NULL DEFAULT auth.uid(),
  name           TEXT NOT NULL,
  target_per_day INTEGER NOT NULL DEFAULT 1,
  reminder_time  TEXT,
  category       TEXT NOT NULL DEFAULT 'anytime',
  icon           TEXT NOT NULL DEFAULT 'check-circle',
  color          TEXT NOT NULL DEFAULT '#64748b',
  rule_history   TEXT NOT NULL DEFAULT '[]',
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  deleted_at     TEXT
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
  id               TEXT PRIMARY KEY NOT NULL,
  user_id          UUID NOT NULL DEFAULT auth.uid(),
  started_at       TEXT NOT NULL,
  ended_at         TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  session_type     TEXT NOT NULL,
  created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.routine_exercises (
  id         TEXT PRIMARY KEY NOT NULL,
  user_id    UUID NOT NULL DEFAULT auth.uid(),
  routine_id TEXT NOT NULL,
  name       TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
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
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  deleted_at     TEXT
);

CREATE TABLE IF NOT EXISTS public.workout_logs (
  id           TEXT PRIMARY KEY NOT NULL,
  user_id      UUID NOT NULL DEFAULT auth.uid(),
  routine_id   TEXT NOT NULL,
  notes        TEXT,
  completed_at TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.workout_session_exercises (
  id              TEXT PRIMARY KEY NOT NULL,
  user_id         UUID NOT NULL DEFAULT auth.uid(),
  log_id          TEXT NOT NULL,
  exercise_name   TEXT NOT NULL,
  sets_completed  INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS public.saved_meals (
  id           TEXT PRIMARY KEY NOT NULL,
  user_id      UUID NOT NULL DEFAULT auth.uid(),
  food_name    TEXT NOT NULL,
  calories     INTEGER NOT NULL,
  protein      DOUBLE PRECISION NOT NULL DEFAULT 0,
  carbs        DOUBLE PRECISION NOT NULL DEFAULT 0,
  fats         DOUBLE PRECISION NOT NULL DEFAULT 0,
  fiber        DOUBLE PRECISION NOT NULL DEFAULT 0,
  meal_type    TEXT NOT NULL DEFAULT 'breakfast',
  use_count    INTEGER NOT NULL DEFAULT 1,
  last_used_at TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  CONSTRAINT saved_meals_food_name_unique UNIQUE (food_name)
);

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
