## Purpose

Keep every synchronized local mutation and its remote intent durable, ordered,
restartable, and safe against stale cleanup during an in-flight push.

## ADDED Requirements

### Requirement: Local mutation and sync intent commit atomically

For every synchronized create, update, or soft delete, the authoritative local
SQLite mutation and its corresponding sync-outbox intent MUST commit in one
local transaction. If either operation fails, neither the local mutation nor
the outbox intent may be committed.

#### Scenario: Synced tombstone commits successfully

- **WHEN** a synced entity is soft-deleted and its required local dependent
  cleanup succeeds
- **THEN** the tombstone, cleanup, and remote delete intent are visible after
  the same commit and survive process restart

#### Scenario: Cleanup fails before commit

- **WHEN** required linked-action or dependent cleanup throws during a synced
  delete
- **THEN** the transaction rolls back so the entity remains active and no
  delete intent is visible

#### Scenario: Outbox write fails before commit

- **WHEN** the durable outbox write fails after the local SQL mutation has been
  attempted
- **THEN** the local transaction rolls back and the caller does not observe a
  committed local state without its remote intent

### Requirement: Outbox persistence is ordered and restartable

The durable outbox MUST preserve monotonically newer revisions for each
entity/id. An older logical queue snapshot MUST NOT overwrite a newer revision,
and hydration after process death MUST recover every pending latest mutation.

#### Scenario: Delayed saves complete out of order

- **WHEN** persistence of an older queue state is delayed while a newer state is
  committed
- **THEN** the final durable outbox contains the newer state and never regresses
  to the older snapshot

#### Scenario: Restart before remote delivery

- **WHEN** the process stops after a local transaction commits but before the
  remote adapter accepts the mutation
- **THEN** a new process hydrates the pending outbox record and can retry it

#### Scenario: Older flush cleanup follows a newer enqueue

- **WHEN** a batch containing revision N is being pushed and revision N+1 for
  the same entity is enqueued before the push completes
- **THEN** successful cleanup of revision N does not remove revision N+1

### Requirement: Flush retries preserve latest-operation semantics

The sync engine MUST deduplicate pending records by entity/id, preserve the
latest operation, retry failed records, retain records added during an
in-flight flush, and remove only records whose exact pushed revision succeeded.

#### Scenario: Partial push failure

- **WHEN** a remote adapter reports only a subset of a batch as failed
- **THEN** successful records are removed durably, failed records remain
  pending, and a later flush retries only the failed revisions unless a newer
  mutation supersedes them

#### Scenario: Enqueue during flush

- **WHEN** a new mutation is enqueued after a flush selects its batch but before
  the adapter returns
- **THEN** the new mutation remains pending for a subsequent flush and is not
  lost or merged into stale cleanup

### Requirement: Stale feature mutations are no-ops

An update or delete that affects no active authoritative row MUST return or
surface a not-found/no-op result and MUST NOT enqueue a normal sync mutation or
change secondary/cache state unless an explicitly documented reconciliation
operation requires it.

#### Scenario: Stale update arrives after soft delete

- **WHEN** a delayed UI update targets an entity whose active row no longer
  exists
- **THEN** the primary data remains unchanged, no new outbox record is created,
  and secondary state is not updated as if the mutation succeeded
