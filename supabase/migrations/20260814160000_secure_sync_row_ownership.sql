-- Secure the repository-owned backup tables with durable Auth ownership.
--
-- This migration is append-only. The prior baseline may have created global
-- policies and grants; the final state below deliberately removes every policy
-- on these repository-owned tables before recreating the owner contract.
-- Existing NULL owners are never guessed or claimed: they remain quarantined
-- because the owner predicates below do not match NULL.

DO $$
DECLARE
  table_name TEXT;
  owner_type TEXT;
  is_not_null BOOLEAN;
  has_unowned BOOLEAN;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'todos', 'habits', 'calorie_entries', 'workout_routines'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      RAISE EXCEPTION 'Expected sync table public.% is missing', table_name;
    END IF;

    SELECT format_type(a.atttypid, a.atttypmod), a.attnotnull
      INTO owner_type, is_not_null
    FROM pg_attribute AS a
    WHERE a.attrelid = format('public.%I', table_name)::regclass
      AND a.attname = 'user_id'
      AND a.attnum > 0
      AND NOT a.attisdropped;

    IF owner_type IS NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN user_id UUID',
        table_name
      );
      owner_type := 'uuid';
      is_not_null := FALSE;
    ELSIF lower(owner_type) <> 'uuid' THEN
      RAISE EXCEPTION
        'public.% user_id has incompatible type %, expected uuid',
        table_name,
        owner_type;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN user_id SET DEFAULT auth.uid()',
      table_name
    );

    IF NOT is_not_null THEN
      -- A NOT NULL constraint is safe only when every existing row is owned.
      -- Leave a table nullable when an operator must resolve legacy NULLs.
      EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM public.%I WHERE user_id IS NULL)',
        table_name
      ) INTO has_unowned;
      IF NOT has_unowned THEN
        EXECUTE format(
          'ALTER TABLE public.%I ALTER COLUMN user_id SET NOT NULL',
          table_name
        );
      END IF;
    END IF;
  END LOOP;
END
$$;

DO $$
DECLARE
  table_name TEXT;
  constraint_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'todos', 'habits', 'calorie_entries', 'workout_routines'
  ] LOOP
    constraint_name := format('%s_user_id_fkey', table_name);
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = format('public.%I', table_name)::regclass
        AND conname = constraint_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE',
        table_name,
        constraint_name
      );
    END IF;
  END LOOP;
END
$$;

CREATE INDEX IF NOT EXISTS idx_todos_user_id ON public.todos (user_id);
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON public.habits (user_id);
CREATE INDEX IF NOT EXISTS idx_calorie_entries_user_id
  ON public.calorie_entries (user_id);
CREATE INDEX IF NOT EXISTS idx_workout_routines_user_id
  ON public.workout_routines (user_id);

DO $$
DECLARE
  table_name TEXT;
  policy_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'todos', 'habits', 'calorie_entries', 'workout_routines'
  ] LOOP
    FOR policy_name IN
      SELECT pol.polname::TEXT
      FROM pg_policy AS pol
      JOIN pg_class AS rel ON rel.oid = pol.polrelid
      JOIN pg_namespace AS nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = table_name
    LOOP
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON public.%I',
        policy_name,
        table_name
      );
    END LOOP;
  END LOOP;
END
$$;

ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calorie_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_routines ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  public.todos,
  public.habits,
  public.calorie_entries,
  public.workout_routines
  FROM anon, PUBLIC;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.todos,
  public.habits,
  public.calorie_entries,
  public.workout_routines
  TO authenticated, service_role;

CREATE POLICY sync_todos_select_owner ON public.todos
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY sync_todos_insert_owner ON public.todos
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_todos_update_owner ON public.todos
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_todos_delete_owner ON public.todos
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY sync_habits_select_owner ON public.habits
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY sync_habits_insert_owner ON public.habits
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_habits_update_owner ON public.habits
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_habits_delete_owner ON public.habits
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY sync_calorie_entries_select_owner ON public.calorie_entries
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY sync_calorie_entries_insert_owner ON public.calorie_entries
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_calorie_entries_update_owner ON public.calorie_entries
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_calorie_entries_delete_owner ON public.calorie_entries
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY sync_workout_routines_select_owner ON public.workout_routines
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY sync_workout_routines_insert_owner ON public.workout_routines
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_workout_routines_update_owner ON public.workout_routines
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_workout_routines_delete_owner ON public.workout_routines
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);
