-- Preserve SQLite numeric values across Supabase backup and Restore V2.
-- PostgreSQL REAL rounds valid app values before the canonical checksum is
-- recomputed. Unconstrained NUMERIC preserves the decimal sent by PostgREST.
-- This follows both Gym V2 migrations; historical precision already lost in
-- remote REAL columns cannot be recovered by this conversion.

ALTER TABLE public.calorie_entries
  ALTER COLUMN protein TYPE NUMERIC USING (protein::text)::numeric,
  ALTER COLUMN carbs TYPE NUMERIC USING (carbs::text)::numeric,
  ALTER COLUMN fats TYPE NUMERIC USING (fats::text)::numeric,
  ALTER COLUMN fiber TYPE NUMERIC USING (fiber::text)::numeric;

ALTER TABLE public.saved_meals
  ALTER COLUMN protein TYPE NUMERIC USING (protein::text)::numeric,
  ALTER COLUMN carbs TYPE NUMERIC USING (carbs::text)::numeric,
  ALTER COLUMN fats TYPE NUMERIC USING (fats::text)::numeric,
  ALTER COLUMN fiber TYPE NUMERIC USING (fiber::text)::numeric;

ALTER TABLE public.routine_exercises
  ALTER COLUMN progression_increment TYPE NUMERIC USING (progression_increment::text)::numeric;

ALTER TABLE public.routine_exercise_sets
  ALTER COLUMN target_load TYPE NUMERIC USING (target_load::text)::numeric,
  ALTER COLUMN target_distance TYPE NUMERIC USING (target_distance::text)::numeric,
  ALTER COLUMN target_pace TYPE NUMERIC USING (target_pace::text)::numeric;

ALTER TABLE public.workout_session_sets
  ALTER COLUMN weight TYPE NUMERIC USING (weight::text)::numeric,
  ALTER COLUMN distance TYPE NUMERIC USING (distance::text)::numeric,
  ALTER COLUMN pace TYPE NUMERIC USING (pace::text)::numeric,
  ALTER COLUMN effort_value TYPE NUMERIC USING (effort_value::text)::numeric;

ALTER TABLE public.body_weight_entries
  ALTER COLUMN weight TYPE NUMERIC USING (weight::text)::numeric;
