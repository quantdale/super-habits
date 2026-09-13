## Why

Backup Completeness V2 shipped, but an independent post-delivery review found
three correctness defects that keep V2 from being a production-ready recovery
target:

1. Remote `saved_meals` uniqueness is incorrectly GLOBAL on `food_name`
   (`UNIQUE (food_name)` in the V2 migration). RLS is owner-scoped but the
   uniqueness constraint is not, so user A saving "Chicken Breast" collides
   with user B saving "Chicken Breast" — a cross-user unique violation that
   RLS cannot prevent.
2. Manifest publication still has a coherence race. The cycle flushes, then
   rechecks the queue, computes the snapshot, rechecks the queue once more,
   and only then opens the manifest publication transaction. A real local
   mutation can commit BETWEEN the final queue check and that transaction:
   its row changes, its data record is enqueued, and `backup.dirty` is set —
   then the manifest transaction stores the OLD snapshot, clears `dirty`, and
   enqueues an OLD manifest. Restore detects the mismatch, but the checkpoint
   can no longer be called a known-good restorable checkpoint.
3. Recoverable settings are not part of the prevalidated atomic restore. The
   restore SQLite transaction performs a live Supabase network request for
   `user_backup_settings`, ignores `{ error }` responses (silently skipping
   settings), and the manifest only records `settings_version` — the settings
   payload itself is not integrity-bound to the manifest.

## What Changes

- `saved_meals` remote uniqueness becomes owner-scoped and matches the local
  case-insensitive semantic: `UNIQUE (user_id, lower(food_name))`, replacing
  the global `UNIQUE (food_name)`, via a NEW additive remedial migration (the
  already-applied V2 migration is not rewritten).
- The checkpoint becomes one atomic local coherence boundary: queue recheck,
  dirty verification, snapshot computation, settings capture, manifest intent
  durable record, and dirty-clear all happen INSIDE a single SQLite
  transaction. No mutation can commit between "snapshot is certified" and
  "manifest publication intent is durably recorded". No network I/O happens
  inside that transaction.
- Settings become generation-bound and integrity-certified: the settings
  payload snapshot is captured with the manifest generation, hashed with a
  deterministic canonicalization, recorded in the manifest
  (`settings_metadata {version, checksum}`), uploaded BEFORE the manifest for
  that generation, and verified at restore time.
- Restore V2 fetches and validates `user_backup_settings` (row presence,
  owner, version, runtime shape, canonical checksum vs manifest) BEFORE any
  local write; every Supabase `{ error }` is a restore failure; no network
  request occurs inside the local import transaction. Theme (AsyncStorage)
  settings are staged durably inside the transaction and applied after commit
  with restart reconciliation, so a settings failure can never silently
  produce a partial "successful" recovery.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `backup-completeness-v2`: owner-scoped saved-meal uniqueness, transactional
  checkpoint coherence, and settings-integrity-bound, prefetch-before-write,
  no-network-in-transaction Restore V2 with durable cross-store settings
  recovery.

## Impact

- `supabase/migrations/` (new additive remediation migration),
  `core/backup/` (types, checkpoint, restore, settings, validators),
  `core/sync/` (adapter settings/manifest push ordering),
  `core/db/appMeta.ts` (new backup keys), `lib/checksum.ts` (settings
  canonicalization), `features/calories/calories.data.ts` (no semantic
  change; sync upsert verified against owner-scoped uniqueness),
  `scripts/validate-supabase-schema.mjs`, `simulation/backend/schema.sql`,
  tests (unit + integration + E2E), docs.
- No destructive changes; no V1 behavior change; no RLS change; no new client
  dependencies.
