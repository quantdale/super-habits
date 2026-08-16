-- Backup Completeness V2 — closure remediation.
--
-- Independent post-delivery review found three correctness defects; this
-- additive migration closes the remote-schema parts of them:
--
--   1. saved_meals uniqueness was GLOBAL on food_name
--      (`saved_meals_food_name_unique UNIQUE (food_name)`). Two different
--      owners could not both save the same food name; RLS cannot make a
--      uniqueness constraint owner-scoped. The local product semantic is
--      case-insensitive uniqueness per device (`food_name COLLATE NOCASE`
--      unique index), so the remote contract becomes per-owner,
--      case-insensitive: UNIQUE (user_id, lower(food_name)).
--
--   2. backup_manifest carried only `settings_version`; the recoverable
--      settings payload was not integrity-bound to the manifest. The
--      manifest now also certifies `settings_metadata JSONB`
--      (`{ version, checksum }`), the canonical SHA-256 of the allowlisted
--      settings snapshot captured with the manifest generation.
--
-- The already-applied 20260815100000_add_backup_completeness_v2.sql is
-- historical input and is NOT rewritten. RLS, grants, and the ownership
-- contract are untouched. The table currently holds zero rows, so dropping
-- the global constraint cannot lose data; the new index is created after the
-- drop in the same transaction, so no window with an unguarded table exists
-- for writes that bypass RLS.

-- 1. Remove the global food-name uniqueness and replace it with the
--    owner-scoped, case-insensitive contract.
ALTER TABLE public.saved_meals
  DROP CONSTRAINT saved_meals_food_name_unique;

CREATE UNIQUE INDEX IF NOT EXISTS uq_saved_meals_owner_food_name
  ON public.saved_meals (user_id, lower(food_name));

-- 2. Extend the manifest with settings integrity metadata. Nullable: the
--    table is empty, and a NULL here would fail the schema validator and
--    client-side restore (v2 manifests must certify settings integrity).
ALTER TABLE public.backup_manifest
  ADD COLUMN IF NOT EXISTS settings_metadata JSONB;
