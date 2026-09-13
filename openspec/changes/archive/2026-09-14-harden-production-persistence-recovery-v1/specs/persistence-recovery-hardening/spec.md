# Persistence & Recovery Hardening Specification

## Purpose

Define the Production Hardening V1 contract: migration failure-path safety,
duplicate-write safety across write families, restore disaster-recovery
guarantees (malformed payload rejection, import atomicity, owner safety), and
offline/reconnect outbox durability — the guarantees that make the app safe
for years of real user data.

## ADDED Requirements

### Requirement: Migration failure must not advance schema version

When a migration block throws (malformed pre-existing data, constraint
violation, injected failure), the stored `app_meta.db_schema_version` SHALL
remain at its pre-migration value, the error SHALL be surfaced to the
initializer (not swallowed), and a subsequent successful open SHALL advance
the version through the normal chain without data loss from previously
committed blocks.

#### Scenario: Injected migration failure leaves version unchanged

- **GIVEN** a database at a stored schema version whose next migration block fails
- **WHEN** `initializeDatabase()` runs
- **THEN** initialization rejects with the migration error, the stored version is unchanged, and retrying with the failure removed completes the chain to the current version with prior rows preserved

### Requirement: Historical upgrade preserves data

Upgrading a representative database from an older stored schema version
(pre-planning era, pre-Gym V2 version 21, and version 23) SHALL preserve
existing row ids, timestamps, and user data; create the expected current
indexes; apply correct defaults to new columns; and land exactly on the
current schema version.

#### Scenario: Pre-Gym database upgrades cleanly

- **GIVEN** a valid version-21 database with representative todos, habits, completions, sessions, and planning rows
- **WHEN** the full migration chain runs
- **THEN** all rows retain their ids and timestamps, Gym V2 tables exist empty with correct defaults, hot-path range indexes exist, and the stored version is the current version

### Requirement: Duplicate-write safety on rapid repeated invocation

Core write functions (todo add/complete, habit completion increment, calorie
entry add, saved meal create, pomodoro session complete, workout set log,
project/goal create) SHALL behave under rapid repeated invocation in one of
three documented ways: intentionally repeatable (each call is a new user
intent), idempotent (repeated call with the same identity mutates once), or
guarded (a second in-flight invocation is rejected). Unbounded duplicate row
creation from a single user intent SHALL NOT occur.

#### Scenario: Habit increment remains count-accurate under concurrent taps

- **GIVEN** a habit with target per day
- **WHEN** `incrementHabitCompletion` is invoked twice concurrently for the same date key
- **THEN** the completion row count increases by exactly 2 total (one per intentional tap) with a single row for that (habit, date) — no duplicate rows, no lost increments

### Requirement: Restore rejects malformed payloads before mutation

Restore V2 SHALL validate the full backup payload (manifest presence, scope
version, canonical checksums, required entities, row shapes, owner binding)
before importing any row; a payload failing validation SHALL be rejected with
a classified error and the local database SHALL be unchanged.

#### Scenario: Tampered checksum is rejected pre-import

- **GIVEN** a valid backup payload with one entity's rows mutated after checksum computation
- **WHEN** restore preview/import runs against an empty device
- **THEN** restore fails with a checksum-integrity classification and zero rows are written

### Requirement: Restore import is atomic under mid-import failure

If any importer fails mid-import (e.g., injected failure on the Nth row of
the Mth entity), the restore transaction SHALL roll back completely: the
local database SHALL be byte-identical to its pre-restore state, no outbox
rows SHALL be added, and the schema version SHALL be untouched.

#### Scenario: Injected importer failure leaves no partial dataset

- **GIVEN** an otherwise-valid backup where one importer throws mid-import
- **WHEN** restore runs against an empty device
- **THEN** the error propagates, and every previously-empty synced table remains empty with no manifest or settings residue

### Requirement: Outbox survives restart and reconnect cycles

Sync outbox rows SHALL survive process restart (durable SQLite), hydrate
into the engine queue on startup, and flush exactly once per successful push
across repeated offline→online cycles; concurrent flush triggers (interval,
visibility, reconnect) SHALL share one in-flight push without duplicating or
losing records, and retry metadata (consecutive failures, nextRetryAt
backoff) SHALL remain coherent.

#### Scenario: Offline writes survive restart and flush once on reconnect

- **GIVEN** several local mutations enqueued while the adapter fails
- **WHEN** the process restarts (persistence reloaded) and the adapter recovers
- **THEN** all queued records push exactly once, successful revisions are removed from the durable outbox, and no record is lost or duplicated across the cycle

### Requirement: Native validation reflects real environment state

Native gates (provision, smoke, targeted persistence) SHALL report actual
environment capability; an unavailable emulator/device/tool SHALL be
classified as an `ENVIRONMENT` blocker and never counted as a pass. When the
API-36 emulator path is available, provisioning SHALL record APK provenance
that ties the installed build to the current source state.

#### Scenario: Provisioned APK matches current source

- **GIVEN** the API-36 x86_64 emulator path is available
- **WHEN** `qa:native:provision` runs
- **THEN** the report records package and source provenance that corresponds to the working tree state used to build the APK
