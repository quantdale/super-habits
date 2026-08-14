-- Safe production convergence follow-up.
--
-- 20260814140000 contains historical permissive policies and is intentionally
-- never replayed against production. The missing structural indexes it
-- described are completed here idempotently so the history-only repair is
-- honest. The ACL reset is repeated after 160000 because the live project had
-- broad maintenance privileges that the ownership migration did not remove.

CREATE INDEX IF NOT EXISTS idx_todos_updated_at
  ON public.todos (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_habits_updated_at
  ON public.habits (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_calorie_entries_updated_at
  ON public.calorie_entries (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_routines_updated_at
  ON public.workout_routines (updated_at DESC);

REVOKE ALL PRIVILEGES ON TABLE
  public.todos,
  public.habits,
  public.calorie_entries,
  public.workout_routines
  FROM anon, PUBLIC;

REVOKE ALL PRIVILEGES ON TABLE
  public.todos,
  public.habits,
  public.calorie_entries,
  public.workout_routines
  FROM authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.todos,
  public.habits,
  public.calorie_entries,
  public.workout_routines
  TO authenticated;
