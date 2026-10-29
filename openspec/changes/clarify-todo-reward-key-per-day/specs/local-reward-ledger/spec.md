## Purpose

Clarifies what identifies one real action when the same durable entity can be completed more than
once, and requires upgrade compatibility for awards recorded under an earlier key shape. The rest of
`local-reward-ledger` (local-only derived state, bounded lookback, silent backfill) is unchanged.

## ADDED Requirements

### Requirement: A repeated completion is one action per local day

For an entity that can be completed repeatedly (a todo), the action is identified by the entity id
**together with the local calendar day of the completion**. Completing the same todo on a new local
day SHALL be a new action that awards XP and makes that day active in the reward ledger. Completing
the same todo twice within one local day SHALL remain one action, so an uncheck-then-recheck toggle
can never pay twice.

This satisfies the existing "awards are idempotent per action and day" requirement: it defines which
events are the same action, and does not exempt any action from the at-most-once rule.

Entities whose durable row is itself the action — focus sessions, workout logs, daily plans, weekly
reviews — SHALL keep their entity id as the complete key, because one row is one action. Habits keep
their per-habit-per-day key and nutrition its per-day key.

#### Scenario: A reopened todo completed on a later day pays again

- **GIVEN** a todo that was completed and awarded on an earlier local day
- **WHEN** the todo is reopened and completed again on a later local day
- **THEN** exactly one XP event exists for the earlier day and one for the later day
- **AND** the later day counts as active in the reward streak
- **AND** repeating the reconcile pass creates no further event

#### Scenario: A same-day toggle still pays once

- **WHEN** a todo is completed, reopened, and completed again within one local day
- **THEN** exactly one XP event exists for that todo and that day

### Requirement: Awards recorded under a legacy key shape are never re-paid

An award recorded by an earlier build under a superseded key shape SHALL be treated as covering the
local day stored on that row. The first earning pass after an update MUST NOT award the current key
shape for a completion that a legacy row already paid for on that day. Legacy rows SHALL be read for
this check and MUST NOT be rewritten, migrated, or deleted.

A legacy row SHALL suppress only its own recorded day: a genuine re-completion of the same entity on
a later day still earns under the current key shape.

#### Scenario: Upgrading with a bare-id todo award already in the ledger

- **GIVEN** a ledger holding a `todo` award keyed by the bare todo id for today, written by an earlier build
- **WHEN** the app updates and housekeeping or the screen fast path runs for today
- **THEN** no new XP event is created for that todo and day
- **AND** the legacy row is left unchanged
- **AND** today still counts as an active reward day

#### Scenario: A legacy row from an earlier day does not block today

- **GIVEN** the same bare-id legacy row dated yesterday
- **WHEN** the todo is completed again today
- **THEN** exactly one new event is created for today under the current key shape
- **AND** the legacy row for yesterday remains
