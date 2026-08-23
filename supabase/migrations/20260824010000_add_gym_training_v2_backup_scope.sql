-- Gym / Training V2 backup scope.
--
-- This migration is strictly additive. It mirrors local migration 22 and
-- advances the recoverable scope from V5 to V6. Legacy rows remain valid:
-- legacy routine exercises keep a NULL catalog id and legacy session rows
-- retain their original free-text snapshots.

ALTER TABLE public.workout_routines
  ADD COLUMN IF NOT EXISTS goal_tag TEXT;

ALTER TABLE public.routine_exercises
  ADD COLUMN IF NOT EXISTS catalog_exercise_id TEXT,
  ADD COLUMN IF NOT EXISTS modality TEXT NOT NULL DEFAULT 'timed',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS superset_group TEXT,
  ADD COLUMN IF NOT EXISTS progression_mode TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS progression_increment REAL,
  ADD COLUMN IF NOT EXISTS progression_min_reps INTEGER,
  ADD COLUMN IF NOT EXISTS progression_max_reps INTEGER;

ALTER TABLE public.routine_exercise_sets
  ADD COLUMN IF NOT EXISTS target_reps_min INTEGER,
  ADD COLUMN IF NOT EXISTS target_reps_max INTEGER,
  ADD COLUMN IF NOT EXISTS target_load REAL,
  ADD COLUMN IF NOT EXISTS target_duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS target_distance REAL,
  ADD COLUMN IF NOT EXISTS target_pace REAL;

ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS routine_name TEXT;

ALTER TABLE public.workout_session_exercises
  ADD COLUMN IF NOT EXISTS catalog_exercise_id TEXT,
  ADD COLUMN IF NOT EXISTS modality TEXT NOT NULL DEFAULT 'timed';

ALTER TABLE public.workout_session_sets
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS distance REAL,
  ADD COLUMN IF NOT EXISTS pace REAL,
  ADD COLUMN IF NOT EXISTS effort_value REAL,
  ADD COLUMN IF NOT EXISTS effort_scale TEXT;

CREATE TABLE public.custom_exercises (
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
  deleted_at TEXT,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_custom_exercises_user_id
  ON public.custom_exercises (user_id, updated_at, id);

CREATE TABLE public.workout_weekly_plan (
  id TEXT PRIMARY KEY NOT NULL,
  weekday INTEGER NOT NULL,
  routine_id TEXT,
  plan_kind TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT workout_weekly_plan_routine_owner_fkey
    FOREIGN KEY (routine_id, user_id) REFERENCES public.workout_routines (id, user_id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS idx_workout_weekly_plan_user_id
  ON public.workout_weekly_plan (user_id, weekday, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_workout_weekly_plan_owner_weekday
  ON public.workout_weekly_plan (user_id, weekday) WHERE deleted_at IS NULL;

CREATE TABLE public.workout_schedule_overrides (
  id TEXT PRIMARY KEY NOT NULL,
  date_key TEXT NOT NULL,
  override_kind TEXT NOT NULL,
  routine_id TEXT,
  moved_from_date_key TEXT,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT workout_schedule_overrides_routine_owner_fkey
    FOREIGN KEY (routine_id, user_id) REFERENCES public.workout_routines (id, user_id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS idx_workout_schedule_overrides_user_date
  ON public.workout_schedule_overrides (user_id, date_key, id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_workout_schedule_overrides_owner_date
  ON public.workout_schedule_overrides (user_id, date_key) WHERE deleted_at IS NULL;

CREATE TABLE public.body_weight_entries (
  id TEXT PRIMARY KEY NOT NULL,
  measured_on TEXT NOT NULL,
  measured_at TEXT NOT NULL,
  weight REAL NOT NULL,
  unit TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_body_weight_entries_user_measured_at
  ON public.body_weight_entries (user_id, measured_at DESC, id);

ALTER TABLE public.custom_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_weekly_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_schedule_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.body_weight_entries ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY sync_custom_exercises_select_owner ON public.custom_exercises
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY sync_custom_exercises_insert_owner ON public.custom_exercises
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_custom_exercises_update_owner ON public.custom_exercises
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_custom_exercises_delete_owner ON public.custom_exercises
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY sync_workout_weekly_plan_select_owner ON public.workout_weekly_plan
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY sync_workout_weekly_plan_insert_owner ON public.workout_weekly_plan
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_workout_weekly_plan_update_owner ON public.workout_weekly_plan
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_workout_weekly_plan_delete_owner ON public.workout_weekly_plan
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY sync_workout_schedule_overrides_select_owner ON public.workout_schedule_overrides
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY sync_workout_schedule_overrides_insert_owner ON public.workout_schedule_overrides
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_workout_schedule_overrides_update_owner ON public.workout_schedule_overrides
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_workout_schedule_overrides_delete_owner ON public.workout_schedule_overrides
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY sync_body_weight_entries_select_owner ON public.body_weight_entries
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY sync_body_weight_entries_insert_owner ON public.body_weight_entries
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_body_weight_entries_update_owner ON public.body_weight_entries
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_body_weight_entries_delete_owner ON public.body_weight_entries
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);
