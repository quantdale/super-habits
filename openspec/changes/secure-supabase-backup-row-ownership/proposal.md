## Why

The Supabase backup contract currently permits backup-table CRUD to the
unauthenticated database role and does not make the authenticated owner an
explicit, durable part of every synchronized row and local sync intent. The
linked project is already used by many anonymous Auth identities, so this is
the right time to turn backup access into a real per-user authorization
boundary without changing the local-first product model.

## What Changes

- **BREAKING** Add durable `user_id` ownership to `todos`, `habits`,
  `calorie_entries`, and `workout_routines` in the repository-owned Supabase
  contract.
- **BREAKING** Replace global/public backup policies with explicit
  `authenticated` owner-scoped SELECT, INSERT, UPDATE, and DELETE policies;
  revoke backup CRUD from `anon`.
- Derive remote ownership from the current Supabase Auth identity, reject
  caller-supplied owner overrides, and retain soft-delete tombstone syncing.
- Persist the owner identity with each durable local outbox intent so logout or
  account switching cannot push one identity's local mutation under another.
- Scope restore metadata and row reads to the current owner and preserve safe
  empty-device, transaction, and malformed-data behavior.
- Keep unresolved legacy/unowned rows quarantined rather than guessing an
  owner or exposing an IDOR-style claim endpoint.
- Extend the repository schema validator and adversarial tests to cover RLS,
  grants, two-user isolation, anonymous-role denial, signed-in anonymous
  ownership, outbox/session boundaries, restore filtering, and AI security
  regressions.
- Document that this is owner isolation for backup/push/restore, not full
  symmetric multi-device synchronization or conflict resolution.

## Capabilities

### New Capabilities

- `supabase-backup-ownership`: Per-user ownership, RLS, grants, sync identity,
  durable outbox boundaries, and owner-scoped restore for Supabase backups.

### Modified Capabilities

- `user-simulation-testing`: Replace the obsolete “no authorization test
  surface” statement with repository/disposable coverage for Supabase
  owner-isolation and session-boundary behavior.

## Impact

The change affects the append-only Supabase migration series and schema
validator, `lib/supabase.ts`, the sync engine/persistence and restore
coordinator, SQLite migration 15, unit/integration/security tests, and
Supabase/backup documentation. It does not add a network requirement to local
writes, change local entity schemas, expose service-role credentials, or
introduce a new runtime dependency.
