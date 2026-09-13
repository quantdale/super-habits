# Backup Completeness V2 — spec delta

## Purpose

Define the recoverable state contract, versioned backup integrity
checkpoint, dependency-safe atomic restore, and side-effect suppression for
Backup Completeness V2, building on Recoverable Account V1 ownership and the
existing owner-scoped outbox.

## ADDED Requirements

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
identically across runs and runtimes. Restore MUST verify per-entity counts
and checksums against the manifest before importing and MUST refuse
mismatches.

#### Scenario: Corrupted backup is blocked

- **WHEN** a fetched row fails validation, counts or checksums mismatch, a parent is missing, or a duplicate key exists
- **THEN** restore is blocked with a clear failure and diagnostics
- **AND** the local database is unchanged

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
`user_id UUID NOT NULL DEFAULT auth.uid()` referencing `auth.users(id)`
(no cascade on data relationships), RLS enabled, and exactly four
authenticated owner policies per table using
`((select auth.uid()) = user_id)` including UPDATE USING + WITH CHECK. Anon
and PUBLIC MUST have no table privileges, and no `USING (true)` policy MUST
be introduced after the ownership fence. Client restore MUST treat remote
rows as untrusted and MUST ignore any row whose ownership contract is
invalid. The settings payload MUST be bounded and MUST NOT allow `user_id`
changes; the manifest MUST belong to the owner. No service role key MUST
appear in the app.

#### Scenario: Cross-user isolation holds

- **WHEN** owner A and owner B both have backups
- **THEN** neither can read, insert, update, delete, or upsert the other's rows
- **AND** anonymous clients cannot access any backup table
- **AND** a restore never imports rows outside the verified owner
