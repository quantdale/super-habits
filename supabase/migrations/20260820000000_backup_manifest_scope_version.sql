-- Additive: persist an explicit recoverable scope version on the backup
-- manifest. The scope version records the exact set of entities a manifest
-- certifies; it lets a future app unambiguously match a manifest against a
-- known scope epoch (historical manifests that predate scope versioning are
-- instead identified by their exact entity set).
--
-- This is a non-destructive column addition: existing rows get NULL, which the
-- app interprets as "resolve scope by entity set" for backward compatibility.

ALTER TABLE public.backup_manifest
  ADD COLUMN IF NOT EXISTS backup_scope_version INTEGER;

COMMENT ON COLUMN public.backup_manifest.backup_scope_version IS
  'Recoverable scope version (exact entity set) this manifest certifies. NULL means the manifest predates scope versioning and is identified by its exact entity set.';
