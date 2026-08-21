-- Hardening wave v2 (openspec/changes/harden-parallel-completion-wave-v2):
-- create the owner-scoped remote table for weekly_reviews.
--
-- weekly_reviews has been a local BACKUP_ENTITIES member since Scope V3 and is
-- included in SYNCABLE_ENTITIES, but no remote table existed — outbox pushes
-- targeted a nonexistent relation, breaking sync flush, the account
-- coordinator fingerprint, and cloud restore prefetch for every device with
-- at least one saved review. This migration is append-only and strictly
-- additive; it preserves all existing rows and owner assignments.

CREATE TABLE public.weekly_reviews (
  id TEXT PRIMARY KEY NOT NULL,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  week_key TEXT NOT NULL,
  week_start_date TEXT NOT NULL,
  week_end_date TEXT NOT NULL,
  next_week_start_date TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  summary_payload TEXT NOT NULL,
  plan_payload TEXT NOT NULL,
  reflection TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

-- Owner-scoped active-week uniqueness mirrors the local partial unique index:
-- one active review per owner per week key; soft-deleting frees the key.
CREATE UNIQUE INDEX IF NOT EXISTS uq_weekly_reviews_owner_week_active
  ON public.weekly_reviews (user_id, week_key) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_weekly_reviews_user_id
  ON public.weekly_reviews (user_id, created_at, id);

ALTER TABLE public.weekly_reviews ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.weekly_reviews FROM anon, PUBLIC;

GRANT USAGE ON SCHEMA public TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.weekly_reviews
  TO authenticated, service_role;

CREATE POLICY sync_weekly_reviews_select_owner ON public.weekly_reviews
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY sync_weekly_reviews_insert_owner ON public.weekly_reviews
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_weekly_reviews_update_owner ON public.weekly_reviews
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY sync_weekly_reviews_delete_owner ON public.weekly_reviews
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);
