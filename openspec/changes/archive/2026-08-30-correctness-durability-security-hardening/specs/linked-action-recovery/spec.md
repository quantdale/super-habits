## Purpose

Provide durable linked-action execution semantics that recover interrupted
effects after restart without duplicating a committed effect.

## ADDED Requirements

### Requirement: Interrupted linked-action executions are recoverable

Every applied-mode linked action MUST persist an execution record that
distinguishes an unclaimed/planned execution, an actively claimed execution,
an applied or skipped terminal execution, and a failed execution eligible for
the configured retry policy. A planned or stale claimed execution MUST be
eligible for recovery; a fresh claimed execution MUST not be concurrently
re-entered.

#### Scenario: Process stops before the effect begins

- **WHEN** an execution is durably created and claimed but the process stops
  before its effect mutates the target
- **THEN** a later replay after the claim is stale reclaims the same execution
  and applies or explicitly skips the effect instead of treating the stale
  claim as a completed duplicate

#### Scenario: Process stops after the effect commits

- **WHEN** the target mutation commits and the process stops before the
  execution is finalized
- **THEN** replay either observes the durable effect receipt or the
  deterministic target identity, does not apply a non-idempotent effect twice,
  and finalizes the existing execution

#### Scenario: Terminal execution is replayed

- **WHEN** the same source event, stable source identity, or chain fingerprint
  is replayed after an execution is applied or skipped
- **THEN** the engine returns a duplicate result and does not execute the
  target effect again

#### Scenario: Failed execution is retried

- **WHEN** an effect returns a real failure and its execution is persisted as
  failed
- **THEN** a later permitted replay may reclaim and retry that execution, while
  the failure remains observable until a terminal result is recorded

### Requirement: Supported effects have an exactly-once recovery proof

Every supported linked-action effect MUST have either a durable receipt
committed atomically with its mutation or a deterministic produced identity and
idempotent mutation that proves replay cannot create a second effect. Habit
increments MUST use the atomic receipt path because a numeric increment is not
inherently idempotent.

#### Scenario: Habit increment crashes at the receipt boundary

- **WHEN** a linked habit increment is processed and the process is interrupted
  during effect execution
- **THEN** the completion increment and terminal execution receipt are either
  both absent or both committed, and replay produces exactly one increment

#### Scenario: Log effect is replayed after a crash

- **WHEN** calorie, workout, or Pomodoro logging commits a deterministic
  produced row before execution finalization and the source is replayed
- **THEN** the existing produced row is reused and the row count remains one

#### Scenario: Todo completion is replayed

- **WHEN** a linked todo completion is replayed after the todo was already
  completed
- **THEN** completion remains a no-op and no second completion mutation is
  created

### Requirement: Concurrent re-entry shares one durable execution

Concurrent processing of the same stable source identity MUST coalesce through
the durable event/execution identity. At most one claimant may run the effect;
other callers MUST observe an in-progress or terminal duplicate result.

#### Scenario: Two processes create one execution concurrently

- **WHEN** two independent engine instances process the same source event and
  rule at the same time
- **THEN** SQLite retains one execution record and the target effect is applied
  at most once

#### Scenario: Different chain fingerprints remain independent

- **WHEN** two valid source chains have different chain fingerprints
- **THEN** the chain guard does not suppress either independent execution
