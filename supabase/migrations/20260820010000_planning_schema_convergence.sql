-- Planning schema convergence: make the live Supabase project support the
-- current owner-scoped Backup Scope V4 planning contract (Productivity
-- Expansion Wave V1 hardening).
--
-- This migration is append-only and strictly additive. It does not rewrite any
-- historical migration and does not drop or alter existing columns. Every new
-- table/column preserves existing production rows and owner assignments.
--
-- It creates the three owner-scoped planning tables that the hardened client
-- now treats as BACKUP_ENTITIES (projects, goals, daily_plans), adds the
-- current planning/completion columns to the existing todos/habits tables,
-- and enforces owner-safe planning relationships through composite
-- (parent_id, user_id) foreign keys — the same mechanism the V2 migration
-- uses for workout parent/child integrity.
--
-- Habit contract note: habits are ongoing scheduled entities with no terminal
-- completion state, so the local/authoritative Habit schema does NOT carry a
-- `completed_at` column (only Todos/Projects/Goals/Daily Plans do). This
-- migration therefore deliberately adds `completed_at` only to `todos`, never
-- to `habits`, keeping the remote Habit contract exactly aligned with the
-- authoritative local schema.

-- ---------------------------------------------------------------------------
-- Owner-scoped planning tables
-- ---------------------------------------------------------------------------

CREATE TABLE public.projects (
  id TEXT PRIMARY KEY NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL,
  status TEXT NOT NULL,
  target_date TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_projects_owner_status_order
  ON public.projects (user_id, status, sort_order) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_projects_owner_target_date
  ON public.projects (user_id, target_date);
-- Owner-scoped uniqueness so the composite (project_id, user_id) FK on goals
-- and todos/habits can enforce same-owner parent/child relationships.
CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_id_user ON public.projects (id, user_id);

CREATE TABLE public.goals (
  id TEXT PRIMARY KEY NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  horizon TEXT NOT NULL,
  target_date TEXT,
  status TEXT NOT NULL,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  completed_at TEXT,
  CONSTRAINT goals_project_owner_fkey
    FOREIGN KEY (project_id, user_id) REFERENCES public.projects (id, user_id) ON DELETE NO ACTION
);
CREATE INDEX IF NOT EXISTS idx_goals_owner_project_id
  ON public.goals (user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_goals_owner_status
  ON public.goals (user_id, status) WHERE deleted_at IS NULL;
-- Owner-scoped uniqueness so the composite (goal_id, user_id) FK on
-- todos/habits can enforce same-owner parent/child relationships.
CREATE UNIQUE INDEX IF NOT EXISTS uq_goals_id_user ON public.goals (id, user_id);

CREATE TABLE public.daily_plans (
  id TEXT PRIMARY KEY NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  date_key TEXT NOT NULL,
  intention TEXT NOT NULL DEFAULT '',
  top_todo_ids TEXT NOT NULL DEFAULT '[]',
  focus_target_minutes INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  reflection TEXT NOT NULL DEFAULT '',
  energy_score INTEGER,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  completed_at TEXT
);
-- Owner-scoped active Daily Plan uniqueness: different owners MAY each have an
-- active plan for the same date, but the same owner SHALL NOT have two active
-- plans for one date, and soft-deleting the active plan frees the date for
-- recreation. Deliberately NOT a global UNIQUE(date_key).
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_plans_owner_date_active
  ON public.daily_plans (user_id, date_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_daily_plans_owner_date
  ON public.daily_plans (user_id, date_key);

-- ---------------------------------------------------------------------------
-- Current planning/completion columns on existing sync tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.todos
  ADD COLUMN IF NOT EXISTS project_id TEXT,
  ADD COLUMN IF NOT EXISTS goal_id TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TEXT;

ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS project_id TEXT,
  ADD COLUMN IF NOT EXISTS goal_id TEXT;

-- Owner-safe planning relationships for todos/habits. The composite FK pairs
-- the association id with the row owner, so a Todo/Habit owned by user B
-- cannot reference a Project/Goal owned by user A. When the association id is
-- NULL the FK is not enforced (a nullable association is legal).
ALTER TABLE public.todos
  ADD CONSTRAINT todos_project_owner_fkey
    FOREIGN KEY (project_id, user_id) REFERENCES public.projects (id, user_id) ON DELETE NO ACTION,
  ADD CONSTRAINT todos_goal_owner_fkey
    FOREIGN KEY (goal_id, user_id) REFERENCES public.goals (id, user_id) ON DELETE NO ACTION;

ALTER TABLE public.habits
  ADD CONSTRAINT habits_project_owner_fkey
    FOREIGN KEY (project_id, user_id) REFERENCES public.projects (id, user_id) ON DELETE NO ACTION,
  ADD CONSTRAINT habits_goal_owner_fkey
    FOREIGN KEY (goal_id, user_id) REFERENCES public.goals (id, user_id) ON DELETE NO ACTION;

CREATE INDEX IF NOT EXISTS idx_todos_owner_project_id
  ON public.todos (user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_todos_owner_goal_id
  ON public.todos (user_id, goal_id);
CREATE INDEX IF NOT EXISTS idx_habits_owner_project_id
  ON public.habits (user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_habits_owner_goal_id
  ON public.habits (user_id, goal_id);

-- ---------------------------------------------------------------------------
-- Row Level Security, owner policies, and grants (hardened convergence model)
-- ---------------------------------------------------------------------------

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_plans ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  public.projects,
  public.goals,
  public.daily_plans
  FROM anon, PUBLIC;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.projects,
  public.goals,
  public.daily_plans
  TO authenticated, service_role;

-- projects
CREATE POLICY sync_projects_select_owner ON public.projects
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY sync_projects_insert_owner ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_projects_update_owner ON public.projects
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_projects_delete_owner ON public.projects
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- goals
CREATE POLICY sync_goals_select_owner ON public.goals
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY sync_goals_insert_owner ON public.goals
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_goals_update_owner ON public.goals
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_goals_delete_owner ON public.goals
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- daily_plans
CREATE POLICY sync_daily_plans_select_owner ON public.daily_plans
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY sync_daily_plans_insert_owner ON public.daily_plans
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_daily_plans_update_owner ON public.daily_plans
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_daily_plans_delete_owner ON public.daily_plans
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);
