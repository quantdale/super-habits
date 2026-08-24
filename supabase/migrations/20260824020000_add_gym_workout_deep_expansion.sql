-- Gym / Workout V2 deep expansion.
--
-- This migration is additive and mirrors local migration 23. The bundled
-- exercise catalog remains application-owned static data; only custom metadata
-- and the semantic snapshots attached to user-owned routine/history rows are
-- recoverable in Supabase.

ALTER TABLE public.routine_exercises
  ADD COLUMN IF NOT EXISTS unilateral INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supports_external_load INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.workout_session_exercises
  ADD COLUMN IF NOT EXISTS unilateral INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS supports_external_load INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.custom_exercises
  ADD COLUMN IF NOT EXISTS aliases TEXT NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS instructions TEXT,
  ADD COLUMN IF NOT EXISTS supports_external_load INTEGER NOT NULL DEFAULT 0;

