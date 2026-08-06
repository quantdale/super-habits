## ADDED Requirements

### Requirement: Stable re-entry identity for linked-action dedup guards
The linked-action engine's re-entry guards (`source_event_already_executed` and `chain_guard_duplicate`) SHALL be keyed on a stable semantic identity — the source entity, the trigger, and the local day key (or the source row's completion timestamp) — rather than the per-call regenerated `eventId` / `chainId`. A second completion of the same source on the same local day SHALL be recognized as a duplicate of the first, regardless of the fresh event/chain ids generated for each `processSourceAction` call.

#### Scenario: Second completion of the same source on the same day is deduplicated
- **WHEN** a todo that is the source of a `todo.completed → habit.increment` rule is completed twice on the same local day (two separate `processSourceAction` calls, each with a fresh `eventId` / `chainId`)
- **THEN** the second firing is recognized as a duplicate of the first and skipped, and the target habit is not incremented again.

#### Scenario: Distinct completions on different days still fire
- **WHEN** the same source todo is completed on two different local days
- **THEN** each day's completion is treated as a distinct sourced event and the linked effect fires once per day.

### Requirement: `habit.increment` effect is idempotent per sourced completion
The `habit.increment` effect SHALL apply at most one increment per (source, day) pair. If the same sourced completion re-fires — for example on untick → tick of the source — the increment path SHALL be a no-op (or apply exactly a single increment) instead of double-incrementing the target habit.

#### Scenario: Untick then re-tick does not double-increment
- **WHEN** a user ticks a source todo (increment applied once), unticks it, and ticks it again on the same local day
- **THEN** the row-level `habit_completions` count for the target habit reflects exactly one increment attributable to that sourced completion, not two.

### Requirement: `todo.complete` and existing skip behaviours are unchanged
The `todo.complete` effect SHALL remain idempotent (re-fire yields `applied` then `skipped` as asserted by J6), the `target_missing` skip SHALL be preserved, and every firing — applied or skipped — SHALL still record its execution row.

#### Scenario: Idempotent `todo.complete` re-fire still records and skips
- **WHEN** a `todo.completed → todo.complete` chain re-fires for an already-completed target todo
- **THEN** the effect is reported as `skipped`, an execution row is recorded, and the target todo's completion state is unchanged.

#### Scenario: Missing target still skips cleanly
- **WHEN** a chain fires whose target entity no longer exists
- **THEN** the effect is reported as `target_missing`, an execution row is recorded, and no error is surfaced to the user.
