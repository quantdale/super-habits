# release-contract-convergence Specification

## Purpose

Keep current runtime metadata, frozen recovery compatibility, ownership
protections, and release evidence aligned across source, documentation,
portable files, and optional Supabase backup.

## Requirements

### Requirement: Current runtime metadata is canonical

The release candidate SHALL describe local schema version 24 and next append-
only migration slot 25, current Backup Scope 7, and the independently
versioned backup schema consistently anywhere current behavior is documented or
validated.

#### Scenario: Current contract is audited

- **WHEN** a release audit searches runtime maps, QA guidance, backup
  validators, and commonly-read documentation
- **THEN** current-runtime statements identify schema 24, migration 25 as the
  next slot, and Scope 7 without rewriting historical compatibility records

### Requirement: Frozen Scope-6 compatibility remains available

The release candidate MUST continue to validate and import the frozen Scope-6
portable/backup compatibility format where the existing recovery contract
requires it. Scope-6 records MUST remain distinguishable from current Scope-7
records and MUST NOT be relabeled as current data solely by documentation
cleanup.

#### Scenario: Legacy Scope-6 payload is recognized

- **WHEN** a valid frozen Scope-6 backup or portable fixture is presented to
  the corresponding compatibility path
- **THEN** validation accepts it under its historical format, labels it as
  legacy/partial where the UI contract requires, and does not require Scope 7
  fields that did not exist in Scope 6

### Requirement: Recovery boundaries remain fail-closed

Current Scope-7 cloud restore and portable import MUST preserve owner-binding
checks, complete-device emptiness checks, integrity manifest/settings checksums,
atomic application, and the rule that imported or historical records do not
replay side effects. Supabase remains an optional one-way backup boundary; this
capability MUST NOT introduce implicit full two-way synchronization.

#### Scenario: Non-empty or mismatched device is offered a restore

- **WHEN** a restore/import candidate has a local account row, tombstone,
  durable outbox row, or incompatible owner binding
- **THEN** the candidate is rejected before mutation and the local dataset is
  unchanged

#### Scenario: Complete current backup round trip is verified

- **WHEN** a Scope-7 dataset includes Gym routines, custom exercise metadata,
  planned overrides, body weight, performed session sets, settings, and a
  manifest
- **THEN** export/validation/import preserves the dependency graph and checksums
  without replaying notifications, linked actions, or other historical effects

### Requirement: Convergence evidence is reproducible

The repository SHALL record the exact source SHA, branch/ref relationship,
validation command and outcome, and any native, iOS, remote Supabase, CI, or
timing limitation. A passing retry MUST NOT erase the original failure or be
used to claim a blocked lane passed.

#### Scenario: A timing-sensitive gate misses once

- **WHEN** a browser or sync gate fails and a focused rerun passes
- **THEN** the original artifact and exact rerun are retained, the result is
  classified using the repository QA vocabulary, and the performance or
  synchronization assertion remains unchanged
