-- Review finding 7 corrections to the published-generation publication contract.
--
-- An independent review tested the previous migration against an isolated
-- PostgreSQL 17 instance and confirmed three implementation defects:
--
--   1. An owner could SELECT its own generation, yet `publish_backup_generation`
--      reported "generation g1 does not exist for this owner." Cause: the RPC
--      read `backup_generation ... FOR UPDATE`, and under row-level security a
--      `FOR UPDATE` read is subject to the UPDATE policy. There was NO UPDATE
--      policy on `backup_generation`, so the row became invisible to the lock —
--      an owner could not publish its own generation at all.
--
--   2. An identical metadata upsert retry failed RLS. Cause: `upsert` with
--      `ON CONFLICT DO UPDATE` performs an UPDATE, and the missing UPDATE policy
--      rejected it. A lost-response retry — which must be idempotent — instead
--      failed.
--
--   3. Direct head insertion succeeded for a generation with no chunks. Cause:
--      `backup_generation_head` was directly writable, so a client could advance
--      the pointer past the RPC and bypass the completeness/manifest checks the
--      RPC exists to enforce.
--
-- The three corrections below fix each defect and keep the contract's intent:
-- immutable content, atomic idempotent publication, owner isolation.
--
-- This migration is applied by the Supabase CLI against an ISOLATED project when
-- the owner authorizes disposable-backend qualification. It is not pushed to
-- production from this campaign.

BEGIN;

-- ---------------------------------------------------------------------------
-- (2) Generation metadata is append-only for its certified content, but the SAME
-- owner may retry the identical row. Add an owner-scoped UPDATE policy so the
-- idempotent upsert retry is legal, and a trigger that forbids changing the
-- certified fields — a retry can only touch bookkeeping, never rewrite a
-- published manifest.
-- ---------------------------------------------------------------------------
ALTER TABLE public.backup_generation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS backup_generation_update_owner ON public.backup_generation;
CREATE POLICY backup_generation_update_owner ON public.backup_generation
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE OR REPLACE FUNCTION public.backup_generation_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only bookkeeping columns may differ on an update; the certified identity and
  -- manifest bytes are frozen once written.
  IF NEW.snapshot_id IS DISTINCT FROM OLD.snapshot_id
     OR NEW.manifest IS DISTINCT FROM OLD.manifest
     OR NEW.manifest_checksum IS DISTINCT FROM OLD.manifest_checksum
     OR NEW.sequence IS DISTINCT FROM OLD.sequence
     OR NEW.protocol_version IS DISTINCT FROM OLD.protocol_version
     OR NEW.backup_schema_version IS DISTINCT FROM OLD.backup_schema_version
     OR NEW.scope_version IS DISTINCT FROM OLD.scope_version
     OR NEW.settings_version IS DISTINCT FROM OLD.settings_version THEN
    RAISE EXCEPTION 'backup_generation certified content is immutable'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS backup_generation_immutable_update ON public.backup_generation;
CREATE TRIGGER backup_generation_immutable_update
  BEFORE UPDATE ON public.backup_generation
  FOR EACH ROW EXECUTE FUNCTION public.backup_generation_immutable();

-- ---------------------------------------------------------------------------
-- (3) The head pointer may only move through the publication RPC. Remove direct
-- client INSERT/UPDATE so no write can bypass the completeness and manifest
-- verification the RPC performs. `service_role` keeps direct access for
-- operational recovery; the app never uses it.
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON TABLE public.backup_generation_head FROM authenticated;
GRANT SELECT ON TABLE public.backup_generation_head TO authenticated;

-- ---------------------------------------------------------------------------
-- (1) + atomic publication.
--
-- SECURITY DEFINER is required here, not optional: the function must both READ
-- the caller's rows under the lock and WRITE the head, and a caller that cannot
-- INSERT the head directly must still be able to advance it through this
-- function. `search_path` is pinned and the owner is taken from `auth.uid()`, so
-- the elevated privilege cannot be aimed at another account: every statement is
-- scoped to the caller's own user_id and no parameter can name an owner.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.publish_backup_generation(TEXT, BIGINT, INTEGER, TEXT);

CREATE FUNCTION public.publish_backup_generation(
  p_snapshot_id TEXT,
  p_expected_previous_sequence BIGINT,
  p_expected_chunk_count INTEGER,
  p_manifest_checksum TEXT
)
RETURNS public.backup_generation_head
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := (select auth.uid());
  v_generation public.backup_generation;
  v_head public.backup_generation_head;
  v_chunk_count INTEGER;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'publish_backup_generation requires an authenticated owner'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Plain SELECT, NOT `FOR UPDATE`: under RLS a `FOR UPDATE` read is subject to
  -- the UPDATE policy, and requiring that just to READ made an owner's own
  -- generation invisible to its publisher (review finding 7.1). The row is
  -- serialized against the head lock below, which is the actual contention point.
  SELECT * INTO v_generation
    FROM public.backup_generation
   WHERE user_id = v_user_id AND snapshot_id = p_snapshot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'generation % does not exist for this owner', p_snapshot_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_generation.manifest_checksum <> p_manifest_checksum THEN
    RAISE EXCEPTION 'generation % manifest checksum mismatch', p_snapshot_id
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COUNT(*) INTO v_chunk_count
    FROM public.backup_generation_chunk
   WHERE user_id = v_user_id AND snapshot_id = p_snapshot_id;
  IF v_chunk_count <> p_expected_chunk_count THEN
    RAISE EXCEPTION
      'generation % is incomplete: % of % chunk(s) staged',
      p_snapshot_id, v_chunk_count, p_expected_chunk_count
      USING ERRCODE = 'check_violation';
  END IF;

  -- Serialize same-owner publishers on the head row (this is the CAS).
  SELECT * INTO v_head
    FROM public.backup_generation_head
   WHERE user_id = v_user_id
   FOR UPDATE;

  IF FOUND THEN
    IF v_generation.sequence < v_head.sequence THEN
      RAISE EXCEPTION 'generation % is stale (sequence % < head %)',
        p_snapshot_id, v_generation.sequence, v_head.sequence
        USING ERRCODE = 'check_violation';
    ELSIF v_generation.sequence = v_head.sequence THEN
      -- Idempotent retry of the currently published generation.
      IF v_head.snapshot_id <> p_snapshot_id THEN
        RAISE EXCEPTION 'sequence % already published by another snapshot', v_head.sequence
          USING ERRCODE = 'unique_violation';
      END IF;
      RETURN v_head;
    END IF;
    IF v_head.sequence <> p_expected_previous_sequence THEN
      RAISE EXCEPTION 'head advanced concurrently (expected %, found %)',
        p_expected_previous_sequence, v_head.sequence
        USING ERRCODE = 'serialization_failure';
    END IF;
    UPDATE public.backup_generation_head
       SET snapshot_id = p_snapshot_id,\n           sequence = v_generation.sequence,\n           updated_at = now()\n     WHERE user_id = v_user_id\n     RETURNING * INTO v_head;
    RETURN v_head;
  END IF;

  IF p_expected_previous_sequence <> 0 THEN
    RAISE EXCEPTION 'expected previous sequence % but no head exists',
      p_expected_previous_sequence
      USING ERRCODE = 'serialization_failure';
  END IF;

  INSERT INTO public.backup_generation_head (user_id, snapshot_id, sequence)
  VALUES (v_user_id, p_snapshot_id, v_generation.sequence)
  RETURNING * INTO v_head;
  RETURN v_head;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_backup_generation(TEXT, BIGINT, INTEGER, TEXT)
  FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_backup_generation(TEXT, BIGINT, INTEGER, TEXT)
  TO authenticated;

COMMIT;
