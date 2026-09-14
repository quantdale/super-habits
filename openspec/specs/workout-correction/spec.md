# workout-correction Specification

## Purpose

TBD - created by archiving change complete-product-correction-flows-v1. Update Purpose after archive.

## Requirements

### Requirement: Workout routines are editable after creation

The user SHALL be able to rename a routine and change its description/goal tag from the routine surface; template edits SHALL NOT alter any existing logged workout.

#### Scenario: Rename does not touch history

Given a routine with completed logged sessions,
When the user renames the routine,
Then the routine title changes going forward,
And previously logged sessions keep their recorded history.

### Requirement: Custom exercises support edit, archive, and restore

Custom exercises SHALL be renamable/editable, archivable, and restorable through the UI, with archived exercises excluded from selection for new routine editing while historical session references remain intact.

#### Scenario: Archive hides from pickers but history survives

Given a custom exercise used in past logged sessions,
When the user archives it,
Then it no longer appears for new routine configuration,
And historical logs referencing it remain unchanged,
And restoring it makes it selectable again.

### Requirement: An accidentally logged workout can be deleted, not silently rewritten

A completed workout log that was created by mistake SHALL be deletable through an explicit, confirmed action that cascades to its nested session rows and records durable delete intents; those intents MUST be classified as hard-delete backup operations so a successful flush removes the matching owner-scoped remote rows; completed numeric performance data (reps, load, duration, RPE) SHALL remain immutable after completion.

#### Scenario: Delete accidental quick-complete

- **WHEN** the user confirms deletion of a workout completed by mistake today
- **THEN** the log and its session exercise/set rows are gone from history and progress rollups
- **AND** durable delete intents exist for each removed row
- **AND** the routine template itself is untouched

#### Scenario: Completed sets are not editable

- **WHEN** the user opens a completed logged session
- **THEN** no control offers to rewrite completed reps/load/duration values

#### Scenario: Flushed delete does not resurrect on restore

- **WHEN** the accidental-log delete intents flush successfully and a later Restore V2 runs on an empty device against that backup
- **THEN** the deleted log and nested session rows are absent from the restored dataset
- **AND** the outbox is not left holding an illegal append-only delete error for those entities
