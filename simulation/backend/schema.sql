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
