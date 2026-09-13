## Purpose

This capability makes Supabase backup rows and the local sync intents that
publish them private to the authenticated owner while keeping local-first
operation available during network or authentication outages.

## ADDED Requirements

### Requirement: Every synchronized backup row has an authenticated owner

The repository-owned Supabase contract MUST associate each row in `todos`,
`habits`, `calorie_entries`, and `workout_routines` with a UUID
`user_id` referencing the Supabase Auth identity when the row is owned. Normal
application access MUST enforce `user_id = auth.uid()`; unresolved legacy rows
MUST remain inaccessible to normal clients rather than being assigned by guesswork.

#### Scenario: Owned rows are visible only to their owner

- **WHEN** an authenticated Supabase user reads any synchronized backup table
- **THEN** only rows whose `user_id` equals that user's Auth UID are returned,
  and rows with a NULL or different owner are not visible.

#### Scenario: Legacy ownership is ambiguous

- **WHEN** a migration encounters an existing synchronized row without a
  proven owner
- **THEN** the row remains quarantined from normal application access and no
  client-facing claim operation assigns it to the current user.

### Requirement: Backup RLS and grants deny unauthenticated CRUD

RLS MUST remain enabled on all four synchronized tables. The contract MUST
provide explicit owner-scoped authenticated SELECT, INSERT, UPDATE, and DELETE
authorization, including both owner-scoped `USING` and `WITH CHECK` predicates
for UPDATE. The `anon` database role MUST have no backup-table CRUD privilege
or policy.

#### Scenario: Authenticated owner performs CRUD

- **WHEN** an authenticated user inserts, selects, updates, or soft-deletes a
  row carrying that user's UID
- **THEN** the operation is authorized only for that user's row and succeeds
  when the table privilege is present.

#### Scenario: Authenticated user attempts an ownership change

- **WHEN** an authenticated user updates an owned row and changes `user_id` to
  another UID or NULL
- **THEN** RLS rejects the update and the original owner remains unchanged.

#### Scenario: Unauthenticated role accesses backup data

- **WHEN** a request uses the PostgreSQL `anon` role without a signed-in Auth
  session
- **THEN** SELECT, INSERT, UPDATE, and DELETE against all four backup tables
  are denied.

### Requirement: Signed-in anonymous Auth users are owner-scoped

An anonymous Supabase Auth session MUST use the same owner-scoped
`authenticated` backup contract as any other signed-in user. The application
MUST NOT treat the database `anon` role as the product's anonymous-user mode.

#### Scenario: Anonymous Auth user backs up its own data

- **WHEN** a user has signed in anonymously and the request is evaluated as
  `authenticated` with that user's `auth.uid()`
- **THEN** the user can CRUD only rows owned by that UID.

#### Scenario: Two anonymous Auth users are isolated

- **WHEN** anonymous Auth user A and anonymous Auth user B each own backup
  rows
- **THEN** A cannot read, update, delete, insert as, or upsert over B's rows,
  and B cannot perform the symmetric operations against A.

### Requirement: Sync derives and persists trusted ownership

Every remote sync mutation MUST derive `user_id` from the current authenticated
Supabase user rather than from local row data or caller input. The durable local
outbox MUST retain the owner UID captured when the sync intent is created, and
the flush MUST fail closed if the current authenticated UID is missing or does
not match that recorded owner. Local SQLite writes MUST continue to commit when
remote authentication or network access is unavailable.

#### Scenario: Normal authenticated push

- **WHEN** an owned local mutation is flushed with a current authenticated UID
- **THEN** the payload contains that UID, any local/caller `user_id` value is
  ignored, and the remote upsert is attempted only for that owner.

#### Scenario: Authentication is unavailable

- **WHEN** a local mutation is made or a pending outbox is flushed without a
  known authenticated UID
- **THEN** the local mutation remains durable, no remote push occurs, and the
  outbox record remains pending/quarantined for retry or explicit resolution.

#### Scenario: Auth session changes before flush

- **WHEN** an outbox record captured for user A is flushed while user B is the
  current session
- **THEN** the record is not pushed or rebound to B, remains pending, and the
  sync failure is retryable after a valid owner session is restored.

### Requirement: Restore is owner-scoped and failure-safe

Every remote restore metadata query and row query MUST include the current
authenticated owner's filter in addition to relying on RLS. Restore MUST
abort when the owner session is absent or changes during the operation, and
malformed or failed remote data MUST NOT destroy valid local state.

#### Scenario: Restore imports only the current owner's rows

- **WHEN** an empty device for user A previews and restores a backup while
  user A is authenticated
- **THEN** counts, freshness metadata, and imported rows contain only A's
  records; B's records are never passed to local import code.

#### Scenario: Restore session changes during fetch

- **WHEN** the authenticated owner changes after preview but before remote rows
  are fetched
- **THEN** restore aborts without importing rows or writing restore metadata.

#### Scenario: Remote restore fails

- **WHEN** a scoped remote query fails or returns malformed data
- **THEN** restore reports failure/blocking and preserves existing local data and
  its safety invariants.

### Requirement: Ownership migration is reproducible and non-destructive

The repository MUST contain an append-only migration that can reconcile both a
fresh repository baseline and an already-owned compatible remote schema. It
MUST add ownership indexes, remove unsafe policies/grants, retain the global
random `id` primary key/conflict contract, and MUST NOT perform an
evidence-free legacy backfill or destructive reset.

#### Scenario: Compatible existing rows are migrated

- **WHEN** the migration runs against rows whose UUID owners are all proven to
  exist in Supabase Auth
- **THEN** it preserves the rows, adds/retains the owner constraint/indexes,
  and installs the owner-scoped RLS/grant contract without changing IDs.

#### Scenario: Migration sees unowned legacy rows

- **WHEN** the migration runs with NULL-owner rows that cannot be mapped
- **THEN** it does not assign them to the current session; they remain
  quarantined until an operator resolves ownership explicitly.

### Requirement: Backup isolation is not full multi-device synchronization

The ownership change MUST preserve the product's push/backup/restore scope and
MUST NOT imply real-time pulls, conflict merging, or symmetric multi-device
reconciliation.

#### Scenario: Same-owner backup remains push/restore scoped

- **WHEN** two devices use the same Auth owner
- **THEN** the existing backup/push/restore behavior remains available, but no
  new real-time merge or conflict-resolution guarantee is claimed.
