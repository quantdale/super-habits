-- F4: enforce backup publication provenance at the trusted server boundary.
--
-- WHY: the previous protocol validated generation structure and sequence CAS but
-- did not establish that a generation was based on the current recovery head.
-- A client (including an older installed client) could read the head immediately
-- before publishing and advance it with stale local bytes. The client fix in
-- `supabase.adapter.ts` distinguishes an OBSERVED head from a VERIFIED local
-- baseline; this migration makes that distinction enforceable by the server.
--
-- ROLLOUT:
--   1. Apply this migration to an isolated project and run the PostgreSQL
--      qualification script (`npm run backup:provenance:qualify`).
--   2. Deploy the matching client, which advertises capability version 2.
--   3. Only then apply the migration to production. Old clients fail the
--      capability check or the RPC signature and cannot advance the head.
--
-- Existing generations/heads are untouched. They remain restorable; this
-- migration only gates NEW publications. No production migration is applied by
-- this repository change.

BEGIN;

-- ---------------------------------------------------------------------------
-- Provenance columns
-- ---------------------------------------------------------------------------
ALTER TABLE public.backup_generation
  ADD COLUMN base_head_snapshot_id TEXT,
  ADD COLUMN base_head_sequence BIGINT,
  ADD COLUMN publication_provenance_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.backup_generation
  ADD CONSTRAINT backup_generation_base_head_pair
  CHECK ((base_head_snapshot_id IS NULL) = (base_head_sequence IS NULL)),
  ADD CONSTRAINT backup_generation_provenance_version_non_negative
  CHECK (publication_provenance_version >= 0);

ALTER TABLE public.backup_generation_sequence_reservation
  ADD COLUMN base_head_snapshot_id TEXT,
  ADD COLUMN base_head_sequence BIGINT,
  ADD COLUMN provenance_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.backup_generation_sequence_reservation
  ADD CONSTRAINT backup_generation_reservation_base_head_pair
  CHECK ((base_head_snapshot_id IS NULL) = (base_head_sequence IS NULL)),
  ADD CONSTRAINT backup_generation_reservation_provenance_version_non_negative
  CHECK (provenance_version >= 0);

-- Never let a pre-migration reservation/staged generation wedge the upgraded
-- client: the old RPC cannot publish it, and the new RPC correctly refuses to
-- adopt its provenance. These rows were never restorable. Published/head rows
-- are preserved; only provenance-0 unpublished staging is removed.
DELETE FROM public.backup_generation_sequence_reservation WHERE provenance_version = 0;
DELETE FROM public.backup_generation g
 WHERE g.publication_provenance_version = 0
   AND NOT EXISTS (
     SELECT 1 FROM public.backup_generation_publication p
      WHERE p.user_id = g.user_id AND p.snapshot_id = g.snapshot_id
   )
   AND NOT EXISTS (
     SELECT 1 FROM public.backup_generation_head h
      WHERE h.user_id = g.user_id AND h.snapshot_id = g.snapshot_id
   );

-- Supabase projects default-grant ALL on new public tables. Remove destructive
-- maintenance privileges (notably TRUNCATE, which bypasses RLS) and re-grant the
-- exact DML the owner-scoped client paths need.
REVOKE ALL PRIVILEGES ON TABLE
  public.backup_generation,
  public.backup_generation_chunk,
  public.backup_generation_head,
  public.backup_generation_sequence_reservation,
  public.backup_generation_publication
  FROM authenticated, anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE public.backup_generation TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.backup_generation_chunk TO authenticated;
GRANT SELECT ON TABLE public.backup_generation_head TO authenticated;
GRANT SELECT ON TABLE public.backup_generation_sequence_reservation TO authenticated;
GRANT SELECT ON TABLE public.backup_generation_publication TO authenticated;

-- ---------------------------------------------------------------------------
-- Capability fence: old clients expect protocol_version 1 and pause before
-- mutable writes when the remote advertises a different protocol.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.backup_generation_capabilities()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog
AS $$ SELECT jsonb_build_object(
  'protocol_version', 2,
  'publication_provenance_version', 1,
  'content_verification_version', 1,
  'sequence_reservation_version', 1,
  'backup_schema_version', 2,
  'scope_version', 7,
  'settings_version', 5) $$;

-- ---------------------------------------------------------------------------
-- Reservation now records the base head and requires it to equal the live head.
-- Dropping the old one-argument signature is deliberate: an older client cannot
-- reserve a sequence without supplying provenance.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.reserve_backup_generation_sequence(text);

CREATE FUNCTION public.reserve_backup_generation_sequence(
  p_snapshot_id text,
  p_base_head_snapshot_id text,
  p_base_head_sequence bigint,
  p_provenance_version integer
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_owner uuid := (SELECT auth.uid());
  v_sequence bigint;
  v_head_snapshot_id text;
  v_head_sequence bigint;
  v_existing_sequence bigint;
  v_existing_base_snapshot_id text;
  v_existing_base_sequence bigint;
  v_existing_provenance_version integer;
BEGIN
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'sequence reservation requires an authenticated owner'
      USING ERRCODE = '42501';
  END IF;
  IF p_provenance_version IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'unsupported publication provenance version'
      USING ERRCODE = '23514';
  END IF;
  IF p_snapshot_id IS NULL OR length(p_snapshot_id) NOT BETWEEN 1 AND 256 THEN
    RAISE EXCEPTION 'invalid snapshot identity' USING ERRCODE = '23514';
  END IF;
  IF (p_base_head_snapshot_id IS NULL) <> (p_base_head_sequence IS NULL) THEN
    RAISE EXCEPTION 'base head snapshot and sequence must both be present or absent'
      USING ERRCODE = '23514';
  END IF;
  IF p_base_head_sequence IS NOT NULL AND p_base_head_sequence < 1 THEN
    RAISE EXCEPTION 'invalid base head sequence' USING ERRCODE = '23514';
  END IF;

  -- One lock namespace for reservation and publication. This serializes FIRST
  -- publication, when there is no head row to lock yet, with later publishers.
  PERFORM pg_advisory_xact_lock(hashtextextended('superhabits.backup:' || v_owner::text, 0));

  -- Idempotent retry of an already reserved/staged snapshot. Its provenance must
  -- match; a different base under the same snapshot identity is a conflict, not
  -- a retry.
  SELECT sequence, base_head_snapshot_id, base_head_sequence, publication_provenance_version
    INTO v_existing_sequence, v_existing_base_snapshot_id, v_existing_base_sequence,
      v_existing_provenance_version
    FROM public.backup_generation
   WHERE user_id = v_owner AND snapshot_id = p_snapshot_id;
  IF FOUND THEN
    IF v_existing_provenance_version = 1
      AND v_existing_base_snapshot_id IS NOT DISTINCT FROM p_base_head_snapshot_id
      AND v_existing_base_sequence IS NOT DISTINCT FROM p_base_head_sequence THEN
      RETURN v_existing_sequence;
    END IF;
    RAISE EXCEPTION 'snapshot already exists with different publication provenance'
      USING ERRCODE = '23514';
  END IF;

  SELECT sequence, base_head_snapshot_id, base_head_sequence, provenance_version
    INTO v_existing_sequence, v_existing_base_snapshot_id, v_existing_base_sequence,
      v_existing_provenance_version
    FROM public.backup_generation_sequence_reservation
   WHERE user_id = v_owner AND snapshot_id = p_snapshot_id;
  IF FOUND THEN
    IF v_existing_provenance_version = 1
      AND v_existing_base_snapshot_id IS NOT DISTINCT FROM p_base_head_snapshot_id
      AND v_existing_base_sequence IS NOT DISTINCT FROM p_base_head_sequence THEN
      RETURN v_existing_sequence;
    END IF;
    RAISE EXCEPTION 'snapshot reservation has different publication provenance'
      USING ERRCODE = '23514';
  END IF;

  SELECT snapshot_id, sequence INTO v_head_snapshot_id, v_head_sequence
    FROM public.backup_generation_head
   WHERE user_id = v_owner
   FOR UPDATE;
  IF FOUND THEN
    IF p_base_head_snapshot_id IS DISTINCT FROM v_head_snapshot_id
      OR p_base_head_sequence IS DISTINCT FROM v_head_sequence THEN
      RAISE EXCEPTION 'capture base head is not the current recovery head'
        USING ERRCODE = '40001';
    END IF;
  ELSE
    IF p_base_head_snapshot_id IS NOT NULL OR p_base_head_sequence IS NOT NULL THEN
      RAISE EXCEPTION 'capture claims a base head but the remote has no head'
        USING ERRCODE = '40001';
    END IF;
  END IF;

  SELECT COALESCE(max(sequence), 0) + 1 INTO v_sequence
    FROM (
      SELECT sequence FROM public.backup_generation WHERE user_id = v_owner
      UNION ALL
      SELECT sequence FROM public.backup_generation_sequence_reservation WHERE user_id = v_owner
    ) AS existing;

  INSERT INTO public.backup_generation_sequence_reservation(
    user_id, snapshot_id, sequence, base_head_snapshot_id, base_head_sequence, provenance_version
  ) VALUES (
    v_owner, p_snapshot_id, v_sequence, p_base_head_snapshot_id, p_base_head_sequence, 1
  );
  RETURN v_sequence;
END $$;

REVOKE ALL ON FUNCTION public.reserve_backup_generation_sequence(text, text, bigint, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_backup_generation_sequence(text, text, bigint, integer)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- EVERY generation insert must match an authenticated reservation on sequence,
-- provenance version AND base pair (`W-1`). The previous legacy branch admitted
-- a provenance-0 row at a reserved identity, which could occupy the primary key
-- and permanently wedge the legitimate publisher (its upsert would take the
-- UPDATE path and hit the immutability guard forever). Post-cleanup no
-- legitimate provenance-0 insert exists — the reserve RPC only issues
-- provenance-1 reservations and all provenance-0 reservations are retired
-- above — so requiring an exact reservation match is safe for every supported
-- client while raw or buggy writers fail closed. Pre-existing published v1 rows
-- remain readable and restorable; they are simply never re-inserted.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.backup_generation_require_reservation()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('superhabits.backup:' || NEW.user_id::text, 0));
  IF NOT EXISTS (
    SELECT 1 FROM public.backup_generation_sequence_reservation r
     WHERE r.user_id = NEW.user_id
       AND r.snapshot_id = NEW.snapshot_id
       AND r.sequence = NEW.sequence
       AND r.provenance_version = NEW.publication_provenance_version
       AND r.base_head_snapshot_id IS NOT DISTINCT FROM NEW.base_head_snapshot_id
       AND r.base_head_sequence IS NOT DISTINCT FROM NEW.base_head_sequence
  ) THEN
    RAISE EXCEPTION 'generation provenance must match its authenticated reservation'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

-- The certified generation row now includes its provenance record.
CREATE OR REPLACE FUNCTION public.backup_generation_immutable()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog
AS $$
BEGIN
  IF ROW(
    NEW.user_id, NEW.snapshot_id, NEW.sequence, NEW.protocol_version,
    NEW.backup_schema_version, NEW.scope_version, NEW.settings_version,
    NEW.manifest, NEW.manifest_checksum, NEW.captured_at,
    NEW.base_head_snapshot_id, NEW.base_head_sequence, NEW.publication_provenance_version
  ) IS DISTINCT FROM ROW(
    OLD.user_id, OLD.snapshot_id, OLD.sequence, OLD.protocol_version,
    OLD.backup_schema_version, OLD.scope_version, OLD.settings_version,
    OLD.manifest, OLD.manifest_checksum, OLD.captured_at,
    OLD.base_head_snapshot_id, OLD.base_head_sequence, OLD.publication_provenance_version
  ) THEN
    RAISE EXCEPTION 'backup_generation certified content is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END $$;

-- ---------------------------------------------------------------------------
-- Publication wrapper. The old four-argument function remains as an internal
-- verified implementation, but is no longer executable by clients. The wrapper
-- verifies provenance against the live head under the same advisory lock before
-- delegating to the existing content/manifest/sequence verifier.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.publish_backup_generation(text, bigint, integer, text)
  RENAME TO backup_generation_publish_v1;

REVOKE ALL ON FUNCTION public.backup_generation_publish_v1(text, bigint, integer, text)
  FROM PUBLIC, anon, authenticated, service_role;
ALTER FUNCTION public.backup_generation_publish_v1(text, bigint, integer, text)
  SET search_path = pg_catalog;

CREATE FUNCTION public.publish_backup_generation(
  p_snapshot_id text,
  p_expected_previous_sequence bigint,
  p_expected_chunk_count integer,
  p_manifest_checksum text,
  p_provenance_version integer
)
RETURNS public.backup_generation_head
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  v_owner uuid := (SELECT auth.uid());
  v_generation public.backup_generation;
  v_head public.backup_generation_head;
BEGIN
  IF p_provenance_version IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'unsupported publication provenance version'
      USING ERRCODE = '23514';
  END IF;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'publication requires an authenticated owner'
      USING ERRCODE = '42501';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('superhabits.backup:' || v_owner::text, 0));

  SELECT * INTO v_generation
    FROM public.backup_generation
   WHERE user_id = v_owner AND snapshot_id = p_snapshot_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'generation does not exist for this owner'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_generation.publication_provenance_version IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'generation was not reserved with publication provenance'
      USING ERRCODE = '23514';
  END IF;
  IF (v_generation.base_head_snapshot_id IS NULL)
      <> (v_generation.base_head_sequence IS NULL) THEN
    RAISE EXCEPTION 'generation base head is malformed' USING ERRCODE = '23514';
  END IF;

  SELECT * INTO v_head
    FROM public.backup_generation_head
   WHERE user_id = v_owner
   FOR UPDATE;
  IF FOUND THEN
    -- Idempotent retry of the currently visible generation.
    IF v_generation.sequence = v_head.sequence
      AND v_head.snapshot_id = p_snapshot_id THEN
      RETURN v_head;
    END IF;
    IF v_generation.base_head_snapshot_id IS DISTINCT FROM v_head.snapshot_id
      OR v_generation.base_head_sequence IS DISTINCT FROM v_head.sequence THEN
      RAISE EXCEPTION 'generation base head is not the current recovery head'
        USING ERRCODE = '40001';
    END IF;
  ELSE
    IF v_generation.base_head_snapshot_id IS NOT NULL
      OR v_generation.base_head_sequence IS NOT NULL THEN
      RAISE EXCEPTION 'generation claims a base head but the remote has no head'
        USING ERRCODE = '40001';
    END IF;
  END IF;

  RETURN public.backup_generation_publish_v1(
    p_snapshot_id,
    p_expected_previous_sequence,
    p_expected_chunk_count,
    p_manifest_checksum
  );
END $$;

REVOKE ALL ON FUNCTION public.publish_backup_generation(text, bigint, integer, text, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_backup_generation(text, bigint, integer, text, integer)
  TO authenticated;

COMMIT;
