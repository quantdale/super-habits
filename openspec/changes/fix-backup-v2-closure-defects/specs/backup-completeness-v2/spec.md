# Backup Completeness V2 — closure spec delta

## Purpose

Close the three post-delivery correctness defects in Backup Completeness V2:
owner-scoped saved-meal uniqueness, transactional checkpoint coherence, and a
settings-integrity-bound, prefetch-before-write, no-network-in-transaction
Restore V2 with durable cross-store settings recovery.

## ADDED Requirements

### Requirement: Saved-meal uniqueness is scoped to the authenticated owner

The remote `saved_meals` table MUST NOT carry global `food_name` uniqueness.
It MUST enforce per-owner uniqueness matching the local product semantic
(case-insensitive food name): exactly one row per
`(user_id, lower(food_name))`. The already-applied V2 migration MUST NOT be
rewritten; a new additive migration MUST drop the global constraint and
create the owner-scoped unique index. RLS remains the security boundary and
the uniqueness constraint MUST NOT provide cross-user interference.

#### Scenario: Two owners may save the same food name

- **WHEN** owner A saves a meal named "Chicken Breast" and owner B saves a
  meal named "Chicken Breast"
- **THEN** both inserts succeed
- **AND** neither owner can read, update, delete, or upsert the other's row

#### Scenario: A single owner keeps local case-insensitive uniqueness

- **WHEN** an owner saves "Chicken Breast" and then "chicken breast"
- **THEN** the second save is a duplicate under the owner-scoped contract
  and is handled the same way the local product handles it (upsert), never a
  remote cross-row duplicate

### Requirement: Checkpoint publication is race-free and locally atomic

A completeness manifest MUST be published only from a snapshot captured and
certified inside ONE SQLite transaction that also durably records the
publication intent. Inside that transaction the cycle MUST re-check the
durable outbox (empty required), verify the dirty flag, compute the canonical
snapshot, re-check the outbox, capture the settings snapshot, persist the
pending manifest and pending settings, enqueue the settings and manifest
outbox records, and clear the dirty flag — all before commit. A mutation
committing at any point before that commit MUST either be included in the
snapshot or leave the checkpoint unpublished with `backup.dirty` intact. No
Supabase or network I/O MUST occur inside the checkpoint transaction. The
previous known-good remote manifest MUST remain intact until a replacement is
successfully uploaded, and a failed newer publication MUST be retryable
without an infinite loop.

#### Scenario: A mutation lands between the queue check and the publication transaction

- **WHEN** a real mutation commits after the cycle's queue checks but before
  the manifest publication transaction commits
- **THEN** the manifest is NOT published for the stale snapshot
- **AND** the mutation's rows remain dirty/queued
- **AND** the previous known-good checkpoint stays restorable

#### Scenario: Crash between manifest intent commit and remote push

- **WHEN** the manifest outbox record committed but the remote push never
  completed
- **THEN** on restart the manifest record is still queued and is pushed
  without a new snapshot
- **AND** the previous remote manifest remains usable until then

### Requirement: Settings are fetched and validated before local restore writes begin

Restore V2 MUST fetch exactly one owner-scoped `user_backup_settings` row
BEFORE any local write, together with the manifest and all entity rows. Every
Supabase `{ error }` (including `{ data: null, error: {...} }`) MUST be
treated as a restore failure. A missing settings row when the manifest
declares a settings snapshot MUST block restore as an incomplete backup.
Legacy V1 backups without settings MUST continue through the legacy path
unchanged; unsupported future settings versions MUST be rejected.

#### Scenario: Settings fetch fails

- **WHEN** the `user_backup_settings` query returns `{ data: null, error: {...} }`
- **THEN** restore is blocked with a fetch failure
- **AND** zero local rows are imported or changed

#### Scenario: Settings row is missing despite the manifest

- **WHEN** the manifest declares a settings snapshot but no settings row
  exists for the owner
- **THEN** restore is blocked as an incomplete backup
- **AND** the local database is unchanged

### Requirement: Settings payload is integrity-bound to the backup manifest

The manifest MUST carry settings integrity metadata
(`settings_metadata = { version, checksum }`) in addition to
`settings_version`. The checksum MUST be a deterministic SHA-256 over a
canonicalized allowlisted settings payload (fixed shape, sorted keys,
`undefined` normalized to `null`) that is identical across web, Android, and
the Node test harness, and MUST NOT include `user_id`, remote `updated_at`,
auth, or sync data. Restore MUST verify the fetched settings row against this
metadata — checksum mismatch, malformed payload, or unsupported version MUST
block restore with the local database unchanged. A v2 manifest without
settings integrity metadata MUST be treated as incomplete.

#### Scenario: Settings checksum mismatch

- **WHEN** the remote settings payload's canonical checksum differs from the
  manifest's certified checksum
- **THEN** restore is blocked with an integrity failure
- **AND** the local database is unchanged

#### Scenario: Settings snapshot is generation-bound

- **WHEN** a settings change occurs around a checkpoint capture
- **THEN** the manifest certifies exactly the settings snapshot that was
  uploaded for that generation
- **AND** the settings payload for generation G is uploaded before manifest G
  becomes authoritative

### Requirement: No network request occurs inside the local Restore V2 import transaction

Once the Restore V2 SQLite import transaction begins, the mutation callback
MUST NOT issue any Supabase query, `fetch`, or other network client call. All
remote material — manifest, every entity page, and `user_backup_settings` —
MUST already be fetched and validated. Identity MUST be reverified
immediately before the transaction, and the existing in-transaction owner and
emptiness rechecks MUST remain.

#### Scenario: Restore completes with settings included

- **WHEN** a V2 backup with settings is restored on an empty device
- **THEN** domain data and recoverable settings are both imported in the
  single transaction
- **AND** the restore transaction performs zero network calls

### Requirement: Any settings failure leaves the complete local database unchanged and theme recovery is durable

Any settings fetch, validation, version, or integrity failure MUST abort
restore BEFORE the import transaction, leaving every local table unchanged.
Theme settings stored in AsyncStorage MUST be staged durably inside the
import transaction and applied after commit; a failure to apply MUST leave a
durable pending-application marker that is retried on restart until
successful, and MUST never be reported as a successful full recovery while
pending. SQLite-backed settings (calorie goal, pomodoro defaults) MUST
participate directly in the import transaction.

#### Scenario: Theme application fails after the database commit

- **WHEN** the domain import committed but AsyncStorage theme application
  fails
- **THEN** a durable pending theme-application record exists
- **AND** after a restart the theme application retries and succeeds
- **AND** the recovery is only then considered complete

## MODIFIED Requirements

### Requirement: Backup integrity is verified by deterministic checksums

The existing checksum requirement is extended to the recoverable settings
payload: the settings snapshot captured with a manifest generation MUST be
canonicalized and hashed with the same deterministic SHA-256 primitive, its
checksum MUST be certified in the manifest, and restore MUST verify it before
importing anything.

#### Scenario: Settings integrity is verified like entity integrity

- **WHEN** a restore candidate carries a settings payload whose canonical
  checksum matches the manifest's certified checksum
- **THEN** the settings snapshot is verified as part of the backup integrity
  verification
- **AND** a mismatch blocks the restore with the local database unchanged

### Requirement: Ownership and RLS remain hardened for every new table

The `saved_meals` global uniqueness constraint is removed and replaced by an
owner-scoped index; the ownership/RLS contract (four authenticated owner
policies per table, `((select auth.uid()) = user_id)`, no anon/PUBLIC, no
`USING (true)`) is unchanged, and the schema validator MUST fail if any later
migration reintroduces global `saved_meals` food-name uniqueness.

#### Scenario: Uniqueness never becomes a cross-user channel

- **WHEN** owner A and owner B both store the same food name
- **THEN** the owner-scoped uniqueness index allows both rows
- **AND** each owner's RLS policies still isolate all reads, writes, and
  deletes to that owner's own rows
