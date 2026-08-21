-- Hardening wave v2 (openspec/changes/harden-parallel-completion-wave-v2):
-- Backup Scope V5 durable columns + per-set workout load table.
--
-- Strictly additive; preserves all existing rows and owner assignments.
-- Local counterpart: migration 20 in core/db/client.ts. The sync adapter
-- projects local rows onto the canonical column lists, so an app updated
-- before this migration degrades safely (new columns are simply not sent)
-- instead of failing push with unknown-column errors.
--
-- Provenance contract (mirrors the local schema):
--   - habits.lifecycle_history records {status, from_date_key, to_date_key}
--     intervals so paused spans never create false missed occurrences.
--   - pomodoro session metadata columns are nullable snapshots; legacy remote
--     rows stay valid with NULL.
--   - workout_logs timing columns are NULL for untimed quick-completes and
--     legacy rows — unknown, never a fabricated zero-length session.
--   - workout_session_sets.weight/reps are NULL when not recorded; a recorded
--     zero is a measured zero. completed = 0 marks a skipped set.

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS lifecycle_history TEXT;

ALTER TABLE public.pomodoro_sessions
  ADD COLUMN IF NOT EXISTS linked_todo_id TEXT,
  ADD COLUMN IF NOT EXISTS linked_todo_title TEXT,
  ADD COLUMN IF NOT EXISTS note TEXT;

ALTER TABLE public.workout_logs
  ADD COLUMN IF NOT EXISTS started_at TEXT,
  ADD COLUMN IF NOT EXISTS ended_at TEXT,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- Owner-scoped uniqueness so the composite (session_exercise_id, user_id) FK
-- can enforce same-owner parent/child relationships.
CREATE UNIQUE INDEX IF NOT EXISTS uq_workout_session_exercises_id_user
  ON public.workout_session_exercises (id, user_id);

CREATE TABLE public.workout_session_sets (
  id TEXT PRIMARY KEY NOT NULL,
  session_exercise_id TEXT NOT NULL,
  set_number INTEGER NOT NULL,
  weight REAL,
  reps INTEGER,
  weight_unit TEXT,
  completed INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT workout_session_sets_exercise_owner_fkey
    FOREIGN KEY (session_exercise_id, user_id) REFERENCES public.workout_session_exercises (id, user_id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS idx_workout_session_sets_user_id
  ON public.workout_session_sets (user_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_workout_session_sets_owner_exercise
  ON public.workout_session_sets (user_id, session_exercise_id);

ALTER TABLE public.workout_session_sets ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.workout_session_sets FROM anon, PUBLIC;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.workout_session_sets TO authenticated, service_role;
CREATE POLICY sync_workout_session_sets_select_owner ON public.workout_session_sets
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY sync_workout_session_sets_insert_owner ON public.workout_session_sets
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_workout_session_sets_update_owner ON public.workout_session_sets
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_workout_session_sets_delete_owner ON public.workout_session_sets
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);
