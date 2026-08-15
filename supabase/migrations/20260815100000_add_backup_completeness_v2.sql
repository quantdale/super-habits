-- Backup Completeness V2: owner-scoped remote backup for the full
-- recoverable user-state scope.
--
-- This migration is append-only and additive. It creates the remote
-- representation for the local tables that were previously local-only:
--
--   habit_completions, pomodoro_sessions, routine_exercises,
--   routine_exercise_sets, workout_logs, workout_session_exercises,
--   saved_meals, linked_action_rules
--
-- plus the two backup-metadata tables:
--
--   user_backup_settings  (allowlisted recoverable settings snapshot)
--   backup_manifest       (versioned completeness checkpoint)
--
-- Every table follows the hardened ownership contract established by
-- 20260814160000_secure_sync_row_ownership.sql:
--   - user_id UUID NOT NULL DEFAULT auth.uid(), FK -> auth.users(id)
--   - RLS enabled, no anon/PUBLIC table privileges
--   - exactly four authenticated owner policies per table using
--     ((select auth.uid()) = user_id), UPDATE with USING + WITH CHECK
--   - owner-scoped index
--
-- Data timestamps are TEXT in the local ISO format so manifest checksums
-- computed on the client survive remote round-trips. Workout child rows
-- declare composite (parent_id, user_id) FKs with NO ACTION: soft-deleted
-- routines remain as rows, so historical logs stay valid and no cascade can
-- destroy workout history.

-- Owner-scoped uniqueness so composite (parent_id, user_id) FKs can enforce
-- same-owner parent/child relationships without rewriting primary keys. These
-- must exist BEFORE the child tables declare their composite FKs.
CREATE UNIQUE INDEX IF NOT EXISTS uq_habits_id_user ON public.habits (id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_workout_routines_id_user
  ON public.workout_routines (id, user_id);

CREATE TABLE public.habit_completions (
  id TEXT PRIMARY KEY NOT NULL,
  habit_id TEXT NOT NULL,
  date_key TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT habit_completions_habit_date_unique UNIQUE (habit_id, date_key),
  CONSTRAINT habit_completions_habit_owner_fkey
    FOREIGN KEY (habit_id, user_id) REFERENCES public.habits (id, user_id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS idx_habit_completions_user_id
  ON public.habit_completions (user_id, created_at, id);

CREATE TABLE public.pomodoro_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  session_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user_id
  ON public.pomodoro_sessions (user_id, created_at, id);

CREATE TABLE public.routine_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  routine_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT routine_exercises_routine_owner_fkey
    FOREIGN KEY (routine_id, user_id) REFERENCES public.workout_routines (id, user_id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS idx_routine_exercises_user_id
  ON public.routine_exercises (user_id, created_at, id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_routine_exercises_id_user
  ON public.routine_exercises (id, user_id);

CREATE TABLE public.routine_exercise_sets (
  id TEXT PRIMARY KEY NOT NULL,
  exercise_id TEXT NOT NULL,
  set_number INTEGER NOT NULL,
  active_seconds INTEGER NOT NULL DEFAULT 40,
  rest_seconds INTEGER NOT NULL DEFAULT 20,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT routine_exercise_sets_exercise_owner_fkey
    FOREIGN KEY (exercise_id, user_id) REFERENCES public.routine_exercises (id, user_id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS idx_routine_exercise_sets_user_id
  ON public.routine_exercise_sets (user_id, created_at, id);

CREATE TABLE public.workout_logs (
  id TEXT PRIMARY KEY NOT NULL,
  routine_id TEXT NOT NULL,
  notes TEXT,
  completed_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT workout_logs_routine_owner_fkey
    FOREIGN KEY (routine_id, user_id) REFERENCES public.workout_routines (id, user_id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS idx_workout_logs_user_id
  ON public.workout_logs (user_id, created_at, id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_workout_logs_id_user ON public.workout_logs (id, user_id);

CREATE TABLE public.workout_session_exercises (
  id TEXT PRIMARY KEY NOT NULL,
  log_id TEXT NOT NULL,
  exercise_name TEXT NOT NULL,
  sets_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT workout_session_exercises_log_owner_fkey
    FOREIGN KEY (log_id, user_id) REFERENCES public.workout_logs (id, user_id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS idx_workout_session_exercises_user_id
  ON public.workout_session_exercises (user_id, created_at, id);

CREATE TABLE public.saved_meals (
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
  created_at TEXT NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT saved_meals_food_name_unique UNIQUE (food_name)
);
CREATE INDEX IF NOT EXISTS idx_saved_meals_user_id
  ON public.saved_meals (user_id, created_at, id);

CREATE TABLE public.linked_action_rules (
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
  deleted_at TEXT,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_linked_action_rules_user_id
  ON public.linked_action_rules (user_id, created_at, id);

CREATE TABLE public.user_backup_settings (
  user_id UUID PRIMARY KEY NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  settings_version INTEGER NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.backup_manifest (
  user_id UUID PRIMARY KEY NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  backup_schema_version INTEGER NOT NULL,
  generation INTEGER NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  entity_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  settings_version INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

GRANT USAGE ON SCHEMA public TO authenticated, service_role;

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

-- habit_completions
CREATE POLICY sync_habit_completions_select_owner ON public.habit_completions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY sync_habit_completions_insert_owner ON public.habit_completions
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_habit_completions_update_owner ON public.habit_completions
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_habit_completions_delete_owner ON public.habit_completions
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- pomodoro_sessions
CREATE POLICY sync_pomodoro_sessions_select_owner ON public.pomodoro_sessions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY sync_pomodoro_sessions_insert_owner ON public.pomodoro_sessions
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_pomodoro_sessions_update_owner ON public.pomodoro_sessions
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_pomodoro_sessions_delete_owner ON public.pomodoro_sessions
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- routine_exercises
CREATE POLICY sync_routine_exercises_select_owner ON public.routine_exercises
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY sync_routine_exercises_insert_owner ON public.routine_exercises
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_routine_exercises_update_owner ON public.routine_exercises
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_routine_exercises_delete_owner ON public.routine_exercises
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- routine_exercise_sets
CREATE POLICY sync_routine_exercise_sets_select_owner ON public.routine_exercise_sets
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY sync_routine_exercise_sets_insert_owner ON public.routine_exercise_sets
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_routine_exercise_sets_update_owner ON public.routine_exercise_sets
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_routine_exercise_sets_delete_owner ON public.routine_exercise_sets
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- workout_logs
CREATE POLICY sync_workout_logs_select_owner ON public.workout_logs
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY sync_workout_logs_insert_owner ON public.workout_logs
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_workout_logs_update_owner ON public.workout_logs
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_workout_logs_delete_owner ON public.workout_logs
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- workout_session_exercises
CREATE POLICY sync_workout_session_exercises_select_owner ON public.workout_session_exercises
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY sync_workout_session_exercises_insert_owner ON public.workout_session_exercises
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_workout_session_exercises_update_owner ON public.workout_session_exercises
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_workout_session_exercises_delete_owner ON public.workout_session_exercises
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- saved_meals
CREATE POLICY sync_saved_meals_select_owner ON public.saved_meals
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY sync_saved_meals_insert_owner ON public.saved_meals
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_saved_meals_update_owner ON public.saved_meals
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_saved_meals_delete_owner ON public.saved_meals
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- linked_action_rules
CREATE POLICY sync_linked_action_rules_select_owner ON public.linked_action_rules
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY sync_linked_action_rules_insert_owner ON public.linked_action_rules
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_linked_action_rules_update_owner ON public.linked_action_rules
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_linked_action_rules_delete_owner ON public.linked_action_rules
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- user_backup_settings
CREATE POLICY sync_user_backup_settings_select_owner ON public.user_backup_settings
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY sync_user_backup_settings_insert_owner ON public.user_backup_settings
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_user_backup_settings_update_owner ON public.user_backup_settings
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_user_backup_settings_delete_owner ON public.user_backup_settings
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- backup_manifest
CREATE POLICY sync_backup_manifest_select_owner ON public.backup_manifest
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY sync_backup_manifest_insert_owner ON public.backup_manifest
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_backup_manifest_update_owner ON public.backup_manifest
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_backup_manifest_delete_owner ON public.backup_manifest
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);
