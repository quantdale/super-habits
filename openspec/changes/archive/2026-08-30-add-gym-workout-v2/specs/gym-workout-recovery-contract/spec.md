## Purpose

This capability keeps the expanded training state recoverable and compatible
across local upgrades, optional cloud backup, portable files, and restore.

## ADDED Requirements

### Requirement: New training data uses append-only migration contracts

The system SHALL add new local schema work only in the next sequential
append-only migration and SHALL preserve schema-v22 rows and behavior. New
recoverable fields MUST have typed row shapes, validation, and migration
coverage for clean install and upgrade paths.

#### Scenario: Upgrade from schema 22

- **WHEN** a representative v22 database containing legacy routines, nested sets, logs, and drafts is migrated
- **THEN** the migration completes idempotently and all prior records remain readable with compatible defaults

### Requirement: Every user-owned Gym V2 fact is classified for recovery

The system SHALL classify each new durable training entity or setting as
recoverable or explicitly local-operational. Recoverable writes MUST use the
existing durable outbox and soft-delete/tombstone rules, while bundled catalog
data MUST remain package-owned rather than uploaded as user rows.

#### Scenario: Custom definition write

- **WHEN** a custom exercise, unilateral routine setting, weekly override, or training preference is created or edited
- **THEN** the local write and its sync/outbox record are committed together and the record is included in the declared recoverable scope

#### Scenario: Live draft classification

- **WHEN** an in-progress draft is updated during a workout
- **THEN** it remains local operational state and is normalized for crash recovery without being mistaken for a completed remote workout

### Requirement: Backup scope and canonicalization evolve compatibly

The system SHALL append new recoverable columns/entities to the current backup
scope with deterministic canonical column order, validators, checksums, and
portable format handling. Frozen historical scope/portable formats MUST remain
verifiable and restorable; integrity checks MUST NOT be weakened or silently
reinterpret old rows.

#### Scenario: Expanded round trip

- **WHEN** a dataset contains custom metadata, unilateral fields, progression settings, schedule overrides, and modality-rich history
- **THEN** cloud/portable export and import reproduce the recoverable facts and canonical checksums match

#### Scenario: Legacy portable file

- **WHEN** a pre-expansion portable file is imported
- **THEN** it remains labeled and validated according to its historical format without requiring new columns

### Requirement: Restore validates graph, ownership, and emptiness before import

Restore SHALL validate every new row, dependency reference, modality,
measurement, setting, owner, and manifest checksum before any local write. It
MUST preserve the existing completely-empty-device guard and atomic import
ordering, and MUST NOT replay historical workout completion side effects or
notifications.

#### Scenario: Invalid unilateral reference

- **WHEN** a restore payload contains a session set referencing a missing session exercise or an invalid side flag
- **THEN** restore is rejected with local data unchanged and no partial outbox records

#### Scenario: Valid custom exercise recovery

- **WHEN** a validated empty device restores a dataset with custom exercises and routines that reference them
- **THEN** custom definitions are imported before dependent routines and the restored routine resolves without network access

### Requirement: Supabase schema mirrors the client recovery contract

The repository SHALL provide additive Supabase migrations and simulation
schema coverage for every new recoverable table/column, with owner-scoped RLS,
required grants/indexes, and validation fixtures. The change MUST NOT alter
account ownership semantics or turn backup push into full two-way sync.

#### Scenario: Schema validation

- **WHEN** the Supabase schema validator runs against the repository migration set
- **THEN** every expanded Gym entity has the expected owner column, RLS policies, grants, indexes, and compatible foreign-key behavior

### Requirement: Recovery evidence covers all high-risk paths

The system SHALL include focused domain, data, migration, backup/portable,
browser, simulation, and available native persistence evidence for the
expanded training contract. Existing meaningful tests MUST remain intact and
failures MUST be classified rather than hidden.

#### Scenario: Deterministic journey evidence

- **WHEN** the focused Workout journey runs from routine construction through logging, reload/resume, history, planning, and restore fixtures
- **THEN** each supported path produces deterministic assertions for data persistence and recovery semantics
