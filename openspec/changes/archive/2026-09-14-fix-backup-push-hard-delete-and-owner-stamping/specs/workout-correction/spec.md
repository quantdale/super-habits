## MODIFIED Requirements

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
