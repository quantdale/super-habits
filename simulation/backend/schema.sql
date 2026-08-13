-- ============================================================================
-- COMPATIBILITY SCHEMA — DISPOSABLE-BACKEND LANE
-- ============================================================================
-- Compatibility fixture for the repository-managed Supabase contract in
-- supabase/migrations/20260814140000_sync_schema_baseline.sql. The four
-- synced tables are intentionally kept here as a standalone SQL payload for
-- the guarded disposable-backend provisioning lane.
--
-- It is applied ONLY to throwaway projects behind the guard
-- (simulation/backend/guard.ts); it is never a runtime authority the app
-- reads. The repository-managed remote authority is the ordered migration
-- series under supabase/migrations; the authoritative local shape is
-- core/db/client.ts (bootstrapStatements + runMigrations) and the entity
-- types in core/db/types.ts.
--
-- DRIFT PROCEDURE: see simulation/backend/DRIFT.md. Any live-project
-- discrepancy from the migration contract is filed as a finding; it is never
-- silently absorbed here.
--
-- COMPATIBILITY (future local lane): written as plain Postgres/Supabase SQL
-- so it can also be applied to a local `supabase start` stack or via the
-- Supabase Management API ("database/query") for a cloud disposable project.
-- It must stay free of SQLite-only syntax (no PRAGMA, no AUTOINCREMENT
-- needed — ids are app-generated text keys via lib/id.ts).
--
-- DATA MODEL NOTES (mirroring the app's local shapes exactly):
--   * Every column the app writes locally is listed here because the sync
--     adapter (core/sync/supabase.adapter.ts) selects the full local row
--     (`SELECT *`) and upserts it keyed on `id`; a missing remote column is a
--     schema-drift failure the lane exists to catch.
--   * id is TEXT: app ids look like `todo_<ts>_<8ch>` (createId in lib/id.ts),
--     NOT UUIDs.
--   * created_at / updated_at / deleted_at are TEXT: the app always supplies
--     ISO-8601 strings (nowIso in lib/time.ts). TEXT is byte-compatible with
--     the SQLite source and sorts lexicographically = chronologically for the
--     restore coordinator's `.order('updated_at')` / `latestUpdatedAt` reads.
--     The dashboard may use timestamptz instead; either accepts the app's
--     strings — if the dashboard is changed either way, that is a DRIFT item.
--   * The app is single-user and anonymous: RLS is enabled permissive for the
--     `anon` role (and `authenticated`, which anonymous sign-in does not use).
--     There is deliberately NO user_id scoping — the app has none (design D8;
--     the isolation comes from the disposable project + production guard).
--
-- NON-SYNCED TABLES (habit_completions, pomodoro_sessions, saved_meals,
-- workout_logs, routine_exercises, routine_exercise_sets,
-- workout_session_exercises, linked_action_*) intentionally have NO remote
-- counterpart: the sync engine only enqueues the four entities below.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- todos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.todos (
  id            TEXT PRIMARY KEY NOT NULL,
  title         TEXT NOT NULL,
  notes         TEXT,
  completed     INTEGER NOT NULL DEFAULT 0,
  due_date      TEXT,
  priority      TEXT NOT NULL DEFAULT 'normal',   -- urgent | normal | low
  sort_order    INTEGER NOT NULL DEFAULT 0,
  recurrence    TEXT,                             -- 'daily' | NULL
  recurrence_id TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT
);

-- ---------------------------------------------------------------------------
-- habits
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.habits (
  id             TEXT PRIMARY KEY NOT NULL,
  name           TEXT NOT NULL,
  target_per_day INTEGER NOT NULL DEFAULT 1,
  reminder_time  TEXT,
  category       TEXT NOT NULL DEFAULT 'anytime', -- anytime | morning | afternoon | evening
  icon           TEXT NOT NULL DEFAULT 'check-circle',
  color          TEXT NOT NULL DEFAULT '#64748b',
  rule_history   TEXT NOT NULL DEFAULT '[]',       -- JSON effective-dated ISO-weekday rules
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  deleted_at     TEXT
);

-- ---------------------------------------------------------------------------
-- calorie_entries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calorie_entries (
  id           TEXT PRIMARY KEY NOT NULL,
  food_name    TEXT NOT NULL,
  calories     INTEGER NOT NULL,
  protein      DOUBLE PRECISION NOT NULL DEFAULT 0,
  carbs        DOUBLE PRECISION NOT NULL DEFAULT 0,
  fats         DOUBLE PRECISION NOT NULL DEFAULT 0,
  fiber        DOUBLE PRECISION NOT NULL DEFAULT 0,
  meal_type    TEXT NOT NULL,                     -- breakfast | lunch | dinner | snack
  consumed_on  TEXT NOT NULL,                     -- YYYY-MM-DD local date key
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  deleted_at   TEXT
);

-- ---------------------------------------------------------------------------
-- workout_routines
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workout_routines (
  id          TEXT PRIMARY KEY NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
-- Enabled permissive for anon: the app's sync/restore run under the anon key
-- (lib/supabase.ts), with optional anonymous sign-in that still maps to the
-- `anon` role in PostgREST. `USING (true) WITH CHECK (true)` reproduces the
-- dashboard's "no client-side ownership" security model — the isolation of the
-- lane comes from the disposable project + guard, never from RLS grants.
-- ============================================================================

ALTER TABLE public.todos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calorie_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_todos_all"            ON public.todos
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_habits_all"           ON public.habits
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_calorie_entries_all"  ON public.calorie_entries
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_workout_routines_all" ON public.workout_routines
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- Everything is unauthenticated in this product; seed the same grants for
-- `authenticated` so a future auth feature does not surprise the lane.

CREATE POLICY "authenticated_todos_all"            ON public.todos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_habits_all"           ON public.habits
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_calorie_entries_all"  ON public.calorie_entries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_workout_routines_all" ON public.workout_routines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================================
-- GRANTS
-- ============================================================================
-- Supabase's default privileges grant anon/authenticated table access to
-- dashboard-created tables; when this file is applied raw (Management API
-- query, or a future local stack) those defaults do not apply, so state the
-- grants explicitly. Idempotent — safe to re-run over dashboard-created
-- tables.
-- ============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.todos            TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.habits           TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calorie_entries  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_routines TO anon, authenticated;
