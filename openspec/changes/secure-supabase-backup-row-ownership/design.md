## Context

See `proposal.md` and the capability specs for the security contract. The
linked Supabase project already has compatible `user_id UUID NOT NULL DEFAULT
auth.uid()` columns and all observed rows are owned by one of nine anonymous
Auth users, but its migration history does not contain the repository baseline
or quota migration. The repository remains authoritative for reproducible
future setup, while the live schema must be treated as independently
provisioned drift until a supported deployment path is approved.

The app is local-first. SQLite rows and the durable outbox must remain usable
without network/auth availability; only the remote boundary fails closed.

## Goals / Non-Goals

**Goals:**

- Make the final Supabase contract owner-scoped for all four synchronized
  entities, with explicit grants and operation-specific RLS.
- Bind every remote push to a trusted current Auth UID and every pending local
  intent to the owner known when that intent was created.
- Scope restore metadata and row fetches, retain tombstones and retry behavior,
  and keep malformed/failed restore operations transaction-safe.
- Make the migration/validator/test contract reproducible and auditable.

**Non-Goals:**

- Full pull synchronization, real-time collaboration, or multi-device merge
  conflict resolution.
- A public legacy-row claim RPC, automatic owner guessing, or destructive
  production backfill.
- Adding `user_id` to local domain entity tables or making local writes require
  remote authentication.

## Decisions

### 1. Use a new append-only ownership migration

The repository's migration invariant is append-only. A CLI-generated migration
will add/validate UUID owner columns, add a foreign key where compatible, add
owner indexes, remove all existing policies on the four repository-owned
tables, install explicit owner policies, and revoke backup CRUD from `anon`.
It will leave NULL legacy rows nullable and inaccessible rather than assigning
them. Empty fresh tables can become NOT NULL; an existing table with unresolved
NULLs stays in the quarantine state until operator resolution.

The migration retains `id` as the global primary key and the client's
`onConflict: 'id'`. IDs are generated globally and RLS prevents a different
owner from updating a conflicting row; changing the primary key would add
unnecessary destructive complexity.

### 2. Bind the SQLite outbox to the enqueue-time owner

SQLite migration 15 adds nullable `owner_user_id TEXT` to `sync_outbox` only;
local entity schemas remain unchanged. The mutation helper captures the
current cached session UID when available and stores it with the prepared
record. Existing owner bindings cannot be changed by a different UID, and an
unknown pending binding cannot be rebound by a newly logged-in user. A
temporarily unavailable auth session may preserve an existing known owner, but
an unowned intent is quarantined and is never silently assigned at flush.

At flush the adapter calls the supported current-user API, requires a UID, and
checks every record's durable owner. It strips any local `user_id` field and
adds the verified UID to the payload. Missing/mismatched ownership produces a
partial retryable failure before any unauthorized upsert. This preserves
revision ordering, partial entity failure, tombstones, and enqueue-during-flush
semantics.

### 3. Use defense-in-depth restore filters

Restore obtains one verified owner UID for the operation, adds `.eq('user_id',
uid)` to every metadata and row query, and rechecks that the session has not
changed before import. RLS remains authoritative. A missing or changing
session produces an unavailable/failed restore result and does not write local
rows or restore metadata.

### 4. Treat anonymous Auth as authenticated ownership

The client continues to use anonymous sign-in. The database policy target is
`authenticated`, with `((select auth.uid()) = user_id)` predicates. The
PostgreSQL `anon` role receives no backup CRUD. No policy uses editable
`user_metadata` or a client-provided owner value.

### 5. Keep AI security as a separate invariant

The repository quota migration and shared Edge Function security module remain
unchanged except for regression checks. The live inspection found deployed
function versions and schema objects behind the repository; no live AI claim
will be made until the deployed functions/quota are verified or safely
deployed through an approved path.

### 6. Test with a repository/disposable boundary, never production writes

Static SQL validation and client tests run in the repository. If Docker/local
Supabase or an explicitly disposable project is available, the security matrix
uses two identities and the `anon` role. The linked production project is
inspected read-only only; it is not used for adversarial inserts or collision
tests.

## Risks / Trade-offs

- [Legacy rows without proven owners] → leave them nullable and invisible to
  normal clients; require an operator-controlled evidence-backed resolution.
- [Pending outbox from an old app version has no owner] → quarantine it rather
  than risk cross-user backup; surface retry/failure status and document the
  explicit-resolution requirement.
- [Migration history drift between repository and live project] → do not
  pretend parity; review the generated migration against the observed live
  schema and classify remote deployment separately.
- [Owner check adds an auth call before remote push] → it is limited to the
  remote boundary; local writes and durable outbox commits remain offline-first.
- [No local Docker/Podman] → run the repository security harness/static
  validation and preserve the exact environment limitation; never label it a
  disposable Postgres pass.

## Migration Plan

1. Generate the migration with the pinned Supabase CLI and review it against
   both the repository baseline and the discovered live schema.
2. Run repository validation, TypeScript/lint/unit/integration tests, and the
   adversarial SQL harness if a disposable target is available.
3. Run security/performance advisors on the safe target. Do not apply to the
   linked project while migration-history drift or deployment credentials make
   the sequence ambiguous.
4. If the full remote safety gate is satisfied, capture schema/policy/grant/
   row-count evidence, apply through the current supported workflow, and repeat
   those read-only checks. Otherwise ship the reproducible repository change
   and report live deployment as blocked/credential-required.

Rollback is policy/data-safe only: stop using the new remote path and restore
the previous application version. Do not roll back by reintroducing global
policies or dropping owner columns. Any correction uses a new append-only
migration.

## Open Questions

None. Live deployment remains a gated outcome, not an unresolved design choice.
