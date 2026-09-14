## Purpose

Define the backup-push contract so every durable outbox intent is owner-stamped, visible to the in-memory flush queue after commit, and classified into a delete semantic the adapter actually implements.

## ADDED Requirements

### Requirement: Every backup entity has exactly one delete semantic the adapter implements

The recoverable backup inventory MUST partition every `BACKUP_ENTITIES` member into exactly one of: soft-delete (tombstone upsert), hard-delete (local row gone, owner-scoped remote DELETE), or never-deleted (product never locally deletes; a queued delete is refused and kept). The partition MUST match the product write path. Workout logs and their nested session exercise/set rows MUST be hard-delete entities because the product hard-deletes them. Pomodoro sessions MUST remain never-deleted. Inventory coherence tests MUST fail if the partition and the product disagree.

#### Scenario: Accidental workout-log delete is a hard-delete push

- **WHEN** the user confirms deletion of an accidental workout log that was previously backed up remotely
- **THEN** the local log and nested session rows are gone
- **AND** durable delete intents for those rows are classified as hard-delete
- **AND** a successful flush issues owner-scoped remote DELETEs for those ids
- **AND** the outbox drains those intents instead of throwing an illegal append-only delete error

#### Scenario: Pomodoro history stays never-deleted

- **WHEN** a pomodoro session row exists locally
- **THEN** the product has no delete path for that row
- **AND** a queued `operation: 'delete'` for `pomodoro_sessions` is refused and kept in the outbox

#### Scenario: Soft-delete entities still upsert tombstones

- **WHEN** the user soft-deletes a todo
- **THEN** the adapter upserts the tombstone row rather than issuing a remote DELETE
- **AND** restore emptiness continues to count that row

### Requirement: Durable backup intents stamp the dataset owner and join the flush queue

Every recoverable write that creates or updates a durable outbox row MUST stamp the current dataset owner the same way ordinary CRUD does when an owner is known, and MUST publish the prepared record into the in-memory flush queue after the SQLite transaction commits. Notification completions, linked-action habit increments, and any other non-`runBackupMutation` recoverable write MUST follow the same contract. On a bound device, flush MUST NOT see an unowned in-memory record for a write that just committed.

#### Scenario: Habit reminder mark-complete on a bound device is owner-stamped

- **WHEN** a protected dataset owner is bound and a habit reminder Mark complete action increments today's completion
- **THEN** the durable `habit_completions` intent carries that owner
- **AND** the in-memory flush queue contains the prepared record after commit
- **AND** a subsequent flush does not fail the habit-completions batch for a missing owner

#### Scenario: Todo reminder mark-done reaches the in-memory queue

- **WHEN** a todo reminder Mark done action completes a pending todo on a bound device
- **THEN** the durable `todos` update intent is owner-stamped
- **AND** the in-memory flush queue contains that intent without waiting for process restart or outbox hydrate

#### Scenario: Linked-action habit increment stamps the owner

- **WHEN** a linked-action effect increments a habit completion on a bound device
- **THEN** the durable `habit_completions` intent carries the dataset owner
- **AND** flush compares that owner to the verified UID and local binding without treating the record as unowned

#### Scenario: Unowned pristine device still allows the local write

- **WHEN** the dataset has no owner binding yet and a reminder completion writes a recoverable row
- **THEN** the local SQLite write still succeeds
- **AND** the outbox row may remain unowned until the owner is established, matching ordinary CRUD
