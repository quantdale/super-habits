## ADDED Requirements

### Requirement: Recurring-todo expansion is idempotent per activation

Activating the Todos section SHALL create at most one today-instance per uncovered daily-recurring series, no matter how many times the section is activated in rapid succession. A second activation that runs before the previous activation's inserts have committed SHALL NOT create an additional today-instance for the same series. The guard MAY be implemented at the insert site (re-query for an existing `(recurrence_id, today)` row before inserting), as a data-layer upsert keyed on `(recurrence_id, due_date)`, or by serializing activations — any mechanism that closes the race is acceptable.

#### Scenario: Rapid re-activation creates exactly one today-instance

- **WHEN** the Todos section is activated repeatedly in quick succession (for example a fast switch away and back) and a daily-recurring series has no today-instance
- **THEN** exactly one today-instance row exists for that series after all activations settle, not one per activation.

#### Scenario: Normal single activation is unchanged

- **WHEN** the Todos section is activated once and a daily-recurring series has no today-instance
- **THEN** exactly one today-instance is created for that series, with the same fields as today.

### Requirement: Sync outbox stays consistent with inserted instances

The sync outbox SHALL contain no `create` record for a recurring instance that was not inserted, and SHALL NOT contain duplicate `create` records for the same (series, day) pair. Row growth and outbox `create` growth SHALL match exactly.

#### Scenario: Outbox create count matches row growth after rapid re-activation

- **WHEN** rapid section re-activation triggers the recurring-expansion path for an already-covered series
- **THEN** no additional `create` record is enqueued for that (series, day) pair, and the outbox `create` count equals the actual number of new rows inserted.
