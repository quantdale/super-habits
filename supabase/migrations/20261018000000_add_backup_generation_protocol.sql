-- Published recovery generations (AUD-SH02-A/B/C/D), protocol version 1.
--
-- WHY: the specification requires an earlier complete checkpoint to stay
-- restorable while newer changes are pending or their publication fails. The
-- mutable current-row store cannot do that: uploading a new generation rewrites
-- the very rows an older manifest certifies, so "keeping the old manifest"
-- preserves only its pointer. Measured on the audited revision: after one
-- successful update and an interrupted publication, a valid generation-1 manifest
-- remained but restore returned invalid/integrity_mismatch.
--
-- This migration adds an IMMUTABLE, owner-scoped generation namespace next to the
-- existing mutable staging tables. Nothing here mutates or removes the legacy
-- tables, so old clients and every supported legacy reader keep working.
--
-- Contract (see core/backup/generations/generationProtocol.ts):
--   * generation content is append-only: a chunk identity can be inserted once,
--     and re-inserting DIFFERENT bytes under it is refused by a trigger, so
--     published history can never be silently rewritten;
--   * only an atomic head advance in publish_backup_generation() makes a
--     generation restore-visible;
--   * every access path is owner-scoped through auth.uid(), never a
--     client-supplied owner field;
--   * retention keeps at least the current and previous complete generation;
--     automatic production cleanup is deliberately NOT implemented here.

BEGIN;

-- ---------------------------------------------------------------------------
-- Generation metadata
-- ---------------------------------------------------------------------------
CREATE TABLE public.backup_generation (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_id TEXT NOT NULL,
  -- Monotonic publication sequence per owner; the head advance is the only
  -- serialization point.
  sequence BIGINT NOT NULL,
  protocol_version INTEGER NOT NULL,
  backup_schema_version INTEGER NOT NULL,
  scope_version INTEGER NOT NULL,
  settings_version INTEGER NOT NULL,
  -- Canonical manifest and its checksum: exactly the content this generation
  -- certifies.
  manifest TEXT NOT NULL,
  manifest_checksum TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, snapshot_id),
  CONSTRAINT backup_generation_sequence_positive CHECK (sequence > 0),
  CONSTRAINT backup_generation_protocol_positive CHECK (protocol_version > 0),
  CONSTRAINT backup_generation_schema_positive CHECK (backup_schema_version > 0),
  CONSTRAINT backup_generation_checksum_shape CHECK (manifest_checksum ~ '^[0-9a-f]{64}$')
);

-- One sequence per owner: two different snapshots can never claim the same one.
CREATE UNIQUE INDEX backup_generation_owner_sequence_key
  ON public.backup_generation (user_id, sequence);

-- ---------------------------------------------------------------------------
-- Immutable chunk content
-- ---------------------------------------------------------------------------
CREATE TABLE public.backup_generation_chunk (
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_id TEXT NOT NULL,
  entity TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  payload TEXT NOT NULL,
  checksum TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, snapshot_id, entity, ordinal),
  -- Chunks cannot outlive their generation metadata.
  CONSTRAINT backup_generation_chunk_generation_fk
    FOREIGN KEY (user_id, snapshot_id)
    REFERENCES public.backup_generation (user_id, snapshot_id)
    ON DELETE CASCADE,
  CONSTRAINT backup_generation_chunk_ordinal_non_negative CHECK (ordinal >= 0),
  CONSTRAINT backup_generation_chunk_checksum_shape CHECK (checksum ~ '^[0-9a-f]{64}$')
);

CREATE INDEX backup_generation_chunk_lookup
  ON public.backup_generation_chunk (user_id, snapshot_id, entity, ordinal);

-- Append-only enforcement: refuse a content change under an existing identity.
-- An identical re-insert (a retried upload whose response was lost) is a no-op
-- rather than an error, so publication retries stay idempotent.
CREATE OR REPLACE FUNCTION public.backup_generation_chunk_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.checksum = OLD.checksum AND NEW.payload IS NOT DISTINCT FROM OLD.payload THEN
    RETURN NULL; -- identical retry: keep the stored row untouched
  END IF;
  RAISE EXCEPTION
    'backup_generation_chunk is immutable: refusing to replace % / % / % with different bytes',
    OLD.snapshot_id, OLD.entity, OLD.ordinal
    USING ERRCODE = 'check_violation';
END;
$$;

CREATE TRIGGER backup_generation_chunk_immutable_update
  BEFORE UPDATE ON public.backup_generation_chunk
  FOR EACH ROW EXECUTE FUNCTION public.backup_generation_chunk_immutable();

-- ---------------------------------------------------------------------------
-- Owner head: the single restore-visible pointer
-- ---------------------------------------------------------------------------
CREATE TABLE public.backup_generation_head (
  user_id UUID PRIMARY KEY NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_id TEXT NOT NULL,
  sequence BIGINT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT backup_generation_head_sequence_positive CHECK (sequence > 0),
  CONSTRAINT backup_generation_head_generation_fk
    FOREIGN KEY (user_id, snapshot_id)
    REFERENCES public.backup_generation (user_id, snapshot_id)
    ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------------
-- Row level security: owner isolation comes from auth.uid(), never a client field
-- ---------------------------------------------------------------------------
ALTER TABLE public.backup_generation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_generation_chunk ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backup_generation_head ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
  public.backup_generation,
  public.backup_generation_chunk,
  public.backup_generation_head
  FROM anon, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.backup_generation,
  public.backup_generation_chunk,
  public.backup_generation_head
  TO authenticated, service_role;

-- backup_generation
CREATE POLICY backup_generation_select_owner ON public.backup_generation
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY backup_generation_insert_owner ON public.backup_generation
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
-- No UPDATE/DELETE policy: generation metadata is append-only for clients, so a
-- published manifest cannot be rewritten in place.

-- backup_generation_chunk
CREATE POLICY backup_generation_chunk_select_owner ON public.backup_generation_chunk
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY backup_generation_chunk_insert_owner ON public.backup_generation_chunk
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
-- No UPDATE/DELETE policy: content is immutable (the trigger above enforces the
-- same rule even for roles that bypass the policy).

-- backup_generation_head
CREATE POLICY backup_generation_head_select_owner ON public.backup_generation_head
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
CREATE POLICY backup_generation_head_insert_owner ON public.backup_generation_head
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY backup_generation_head_update_owner ON public.backup_generation_head
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Atomic publication
-- ---------------------------------------------------------------------------
-- Advance the owner head to a fully verified generation in ONE transaction.
--
-- Everything the caller could get wrong is re-verified here rather than trusted:
-- the generation belongs to the caller, every expected chunk is present, the
-- advertised checksum matches the stored manifest, and the advance is
-- compare-and-swap against the expected previous sequence. A stale retry of the
-- SAME snapshot is idempotent; any other non-advancing request is refused, so a
-- lost response can never regress a newer head.
--
-- SECURITY INVOKER (the default) is deliberate: the RLS policies above then apply
-- to these statements, so service_role bypass is the only elevated path and it is
-- never reachable from the client. search_path is pinned for the function body.
CREATE OR REPLACE FUNCTION public.publish_backup_generation(
  p_snapshot_id TEXT,
  p_expected_previous_sequence BIGINT,
  p_expected_chunk_count INTEGER,
  p_manifest_checksum TEXT
)
RETURNS public.backup_generation_head
LANGUAGE plpgsql
SECURITY INVOKER
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

  SELECT * INTO v_generation
    FROM public.backup_generation
   WHERE user_id = v_user_id AND snapshot_id = p_snapshot_id
   FOR UPDATE;
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

  -- Serialize same-owner publishers on the head row.
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
       SET snapshot_id = p_snapshot_id,
           sequence = v_generation.sequence,
           updated_at = now()
     WHERE user_id = v_user_id
     RETURNING * INTO v_head;
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
  TO authenticated, service_role;

COMMIT;
