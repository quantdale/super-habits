-- Repository-managed additive baseline for the four backup entities.
--
-- The historical project created these tables/policies in the dashboard. This
-- migration does not drop or rewrite them; it creates missing objects and adds
-- columns introduced by the client contract when they are absent. The remote
-- project must still be inspected before deployment for policy/type drift.

CREATE TABLE IF NOT EXISTS public.todos (
  id            TEXT PRIMARY KEY NOT NULL,
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
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);

-- Additive columns required by rows selected with SELECT * by the sync adapter.
ALTER TABLE public.todos
  ADD COLUMN IF NOT EXISTS due_date TEXT,
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recurrence TEXT,
  ADD COLUMN IF NOT EXISTS recurrence_id TEXT;

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'anytime',
  ADD COLUMN IF NOT EXISTS icon TEXT NOT NULL DEFAULT 'check-circle',
  ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#64748b',
  ADD COLUMN IF NOT EXISTS rule_history TEXT NOT NULL DEFAULT '[]';

ALTER TABLE public.calorie_entries
  ADD COLUMN IF NOT EXISTS fiber DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_todos_updated_at ON public.todos (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_habits_updated_at ON public.habits (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_calorie_entries_updated_at
  ON public.calorie_entries (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_routines_updated_at
  ON public.workout_routines (updated_at DESC);

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calorie_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_routines ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'todos' AND policyname = 'anon_todos_all'
  ) THEN
    CREATE POLICY anon_todos_all ON public.todos
      FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'habits' AND policyname = 'anon_habits_all'
  ) THEN
    CREATE POLICY anon_habits_all ON public.habits
      FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calorie_entries'
      AND policyname = 'anon_calorie_entries_all'
  ) THEN
    CREATE POLICY anon_calorie_entries_all ON public.calorie_entries
      FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workout_routines'
      AND policyname = 'anon_workout_routines_all'
  ) THEN
    CREATE POLICY anon_workout_routines_all ON public.workout_routines
      FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'todos'
      AND policyname = 'authenticated_todos_all'
  ) THEN
    CREATE POLICY authenticated_todos_all ON public.todos
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'habits'
      AND policyname = 'authenticated_habits_all'
  ) THEN
    CREATE POLICY authenticated_habits_all ON public.habits
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'calorie_entries'
      AND policyname = 'authenticated_calorie_entries_all'
  ) THEN
    CREATE POLICY authenticated_calorie_entries_all ON public.calorie_entries
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'workout_routines'
      AND policyname = 'authenticated_workout_routines_all'
  ) THEN
    CREATE POLICY authenticated_workout_routines_all ON public.workout_routines
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.todos TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habits TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calorie_entries TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_routines TO anon, authenticated;
