# backup-completeness-v2 Specification

## Purpose

Define the recoverable state contract, versioned backup integrity
checkpoint, dependency-safe atomic restore, and side-effect suppression for
Backup Completeness V2, building on Recoverable Account V1 ownership and the
existing owner-scoped outbox.

## Requirements

### Requirement: The complete backup scope is explicit and bounded

The remote backup MUST cover, per owner: `todos`, `habits`,
`habit_completions`, `calorie_entries`, `saved_meals`,
`pomodoro_sessions`, `workout_routines`, `routine_exercises`,
`routine_exercise_sets`, `workout_logs`, `workout_session_exercises`,
`linked_action_rules`, and the recoverable settings allowlist. The
recoverable settings allowlist MUST contain exactly the calorie goal,
pomodoro defaults, and theme preference (mode + slots) and MUST NOT contain
auth, sync, system, or device-internal keys. Backup MUST NOT include
`linked_action_events`, `linked_action_executions`,
`processed_notification_actions`, `sync_outbox`, `sync_status`, restore
signatures, database schema version, date-key cutover, `account.*` state,
session material, calories view-mode, command-center preferences, or
internal rollout flags.

#### Scenario: Recovery scope is complete but bounded

- **WHEN** a user backs up a populated device
- **THEN** every row of every recoverable table (including soft-delete tombstones) and the settings snapshot are durably enqueued owner-scoped
- **AND** the execution ledgers and device/internal state are never uploaded

#### Scenario: Settings payload contains only allowlisted keys

- **WHEN** a settings snapshot is backed up
- **THEN** the payload contains only the calorie goal, pomodoro defaults, and theme mode/slots
- **AND** auth, sync, system, and device-internal keys are absent

### Requirement: Backup schema is versioned and future versions are refused

The backup schema version MUST be `2` and MUST be carried by the manifest.
Restore MUST reject manifests with a version greater than the supported
version and MUST NOT guess future schemas. Remote data tables MUST store
timestamps as TEXT in the local ISO format so checksum verification survives
round-trips.

#### Scenario: Future backup schema is refused

- **WHEN** a restore candidate carries `backup_schema_version > 2`
- **THEN** restore is blocked with an unsupported-version result
- **AND** local data is left unchanged

### Requirement: A complete backup is a published integrity-checked manifest

A complete backup MUST be represented by an owner-scoped `backup_manifest`
containing `backup_schema_version`, a generation, `completed_at`, per-entity
`{count, checksum}` metadata, and the settings version. The manifest MUST be
published only after V2 backfill has been enqueued, every relevant durable
outbox record has reached remote storage, no wrong-owner queue exists, the
remote schema is compatible, the settings snapshot is uploaded, and the
queue was rechecked empty after drain. A failed or newer incomplete
publication MUST NOT destroy the previous known-complete checkpoint. The UI
MUST distinguish `V2 COMPLETE`, `V1 LEGACY/PARTIAL`, `BACKUP IN PROGRESS`,
`BACKUP INVALID`, and `UNAVAILABLE`; new pending changes MUST NOT invalidate
the last complete checkpoint and the UI MUST show both the last complete
backup time and the pending change count.

#### Scenario: Incomplete backup is never labeled complete

- **WHEN** the outbox is non-empty or manifest publication fails
- **THEN** the backup state remains `BACKUP IN PROGRESS`
- **AND** a previously published complete manifest remains restorable

#### Scenario: Newer pending changes preserve the last complete checkpoint

- **WHEN** a V2 backup completed at 10:00 and a new todo is created at 10:05
- **THEN** the UI shows the last complete backup at 10:00 with one change pending
- **AND** the 10:00 checkpoint is not marked corrupt

### Requirement: Backup integrity is verified by deterministic checksums

The checksum MUST be a SHA-256 over canonicalized rows: fixed per-entity
column order, rows sorted by id, JSON serialization with sorted keys, nulls
preserved, joined with newlines. The same logical dataset MUST hash
identically across runs and runtimes. Restore MUST verify per-entity counts and
checksums against the manifest before importing and MUST refuse mismatches.
The requirement also covers the recoverable settings payload: the settings
snapshot captured with a manifest generation MUST be canonicalized and hashed
with the same deterministic SHA-256 primitive, its checksum MUST be certified
in the manifest, and restore MUST verify it before importing anything.

#### Scenario: Corrupted backup is blocked

- **WHEN** a fetched row fails validation, counts or checksums mismatch, a parent is missing, or a duplicate key exists
- **THEN** restore is blocked with a clear failure and diagnostics
- **AND** the local database is unchanged

#### Scenario: Settings integrity is verified like entity integrity

- **WHEN** a restore candidate carries a settings payload whose canonical
  checksum matches the manifest's certified checksum
- **THEN** the settings snapshot is verified as part of the backup integrity
  verification
- **AND** a mismatch blocks the restore with the local database unchanged

### Requirement: Existing local data is backfilled idempotently and owner-gated

Existing local data MUST be backfilled into the durable outbox when
`backup.scope_version < 2`, only when durable owner evidence exists
(verified Supabase UID equals the local dataset owner), in bounded batches,
idempotently per (entity, id), restart-safe via a durable progress marker,
and without blocking ordinary local use. Backfill MUST include active and
tombstoned rows for soft-delete tables and all rows for history tables.
Backfill MUST NOT run under a guessed identity and MUST wait when the owner
is unknown or conflicting.

#### Scenario: Upgrade backfills existing history

- **WHEN** an existing user upgrades with years of habit completions and no owner conflict
- **THEN** all completion rows are durably enqueued owner-scoped
- **AND** a restart mid-backfill resumes without duplicates or lost rows
- **AND** the app remains usable during backfill

#### Scenario: Backfill waits without owner evidence

- **WHEN** the local dataset owner is unknown or conflicts with the verified UID
- **THEN** no backfill records are enqueued under a guessed identity
- **AND** ordinary local use continues

### Requirement: Restore V2 validates everything before any local write

Restore MUST verify owner identity before and inside the import transaction,
prefetch the manifest and all rows before any local write, validate every
row at runtime, verify integrity and the dependency graph, require a
completely empty device (all user tables plus outbox, using
`inspectLocalAccountDataState`), and import everything in ONE SQLite
transaction. Import MUST run dedicated `applyRemote*` functions that
preserve IDs, timestamps, `deleted_at`, `use_count`, `last_used_at`,
`rule_history`, and `effect_payload` and MUST NOT run normal mutation side
effects. After commit, only current/future habit-reminder reconciliation and
UI refresh MUST run. Restore MUST NOT replay linked actions, recurring-todo
expansion, habit threshold events, historical reminders, workout automation,
pomodoro lifecycle events, or saved-meal use-count changes. Any failure —
network, pagination, checksum, malformed row, unsupported version, missing
parent, duplicate key, wrong owner, auth change, local content appearing
during the race, SQLite failure — MUST leave the original local state
unchanged. Restored habit completions MUST preserve local-calendar
`date_key` semantics and `UNIQUE(habit_id, date_key)`; restored habit
insights, focus summaries, workout summaries/history, calorie summaries, and
saved meals MUST match the source device. Restored linked-action rules MUST
function for future source events and MUST NOT fire for historical events.

#### Scenario: New phone recovers the full state without replay

- **WHEN** a protected account is recovered on a pristine device and a V2 backup is restored
- **THEN** todos, habits + history, calories + saved meals, pomodoro history, workout structure + history, linked-action rules, and settings match the source device semantically
- **AND** no historical linked action, reminder, or notification effect fires
- **AND** completing a new source action executes the restored rule exactly once

#### Scenario: Restore race with local content is blocked

- **WHEN** a restore preview shows an empty device but local content appears before the import transaction
- **THEN** the import aborts inside the transaction and reports blocked
- **AND** the local content is unchanged

#### Scenario: Failed restore leaves the device unchanged

- **WHEN** a checksum mismatch or malformed row is discovered during restore
- **THEN** no local rows are imported or cleared
- **AND** the failure is reported with human-readable and diagnostic detail

### Requirement: Legacy V1 backups remain understood

A backup with only V1 entities and no manifest MUST be recognized as
`V1 LEGACY/PARTIAL`, disclosed in the UI, and remain restorable through the
V1 path with its existing safety guarantees. A V2 manifest MUST NOT be
fabricated for V1-only data.

#### Scenario: V1 backup remains understood

- **WHEN** an account has remote todos/habits/calorie entries but no manifest
- **THEN** the UI states `V1 LEGACY/PARTIAL` and what is missing
- **AND** V1 restore keeps working without crashing

### Requirement: Ownership and RLS remain hardened for every new table

Every new remote table MUST be owner-scoped with
`user_id UUID NOT NULL DEFAULT auth.uid()` referencing `auth.users(id)` (no
cascade on data relationships), RLS enabled, and exactly four authenticated
owner policies per table using `((select auth.uid()) = user_id)` including
UPDATE USING + WITH CHECK. Anon and PUBLIC MUST have no table privileges, and
no `USING (true)` policy MUST be introduced after the ownership fence. Client
restore MUST treat remote rows as untrusted and MUST ignore any row whose
ownership contract is invalid. The settings payload MUST be bounded and MUST
NOT allow `user_id` changes; the manifest MUST belong to the owner. No service
role key MUST appear in the app. The `saved_meals` global uniqueness
constraint is removed and replaced by an owner-scoped index; the ownership/RLS
contract above is unchanged, and the schema validator MUST fail if any later
migration reintroduces global `saved_meals` food-name uniqueness.

#### Scenario: Cross-user isolation holds

- **WHEN** owner A and owner B both have backups
- **THEN** neither can read, insert, update, delete, or upsert the other's rows
- **AND** anonymous clients cannot access any backup table
- **AND** a restore never imports rows outside the verified owner

#### Scenario: Uniqueness never becomes a cross-user channel

- **WHEN** owner A and owner B both store the same food name
- **THEN** the owner-scoped uniqueness index allows both rows
- **AND** each owner's RLS policies still isolate all reads, writes, and
  deletes to that owner's own rows

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
