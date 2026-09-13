# Legacy Pomodoro Session Metadata Promotion Specification

## ADDED Requirements

### Requirement: Legacy session metadata is promoted into durable columns on bootstrap

The application SHALL, during local bootstrap, promote legacy device-local Pomodoro session association and note maps into the durable `pomodoro_sessions` columns (`linked_todo_id`, `linked_todo_title`, `note`) by exact session-id match, filling only currently-NULL cells, and SHALL retire the legacy storage keys after all matching updates succeed. The promotion SHALL be best-effort: a failure SHALL NOT block app startup, and the pass SHALL retry on the next launch.

#### Scenario: Legacy entries are applied exactly once

Given a focus session row whose association and note columns are NULL,
And legacy device-local maps contain that session id with a valid association and note,
When the app boots,
Then the row's association, title, and note columns are filled with the legacy values,
And the legacy keys are removed,
And a second boot performs no further writes.

#### Scenario: Newer durable metadata is never clobbered

Given a focus session row whose note is already set,
And a legacy note map contains a different note for that session id,
When the app boots,
Then the durable note is unchanged,
And the other NULL legacy cells (if any) are still filled.

#### Scenario: Orphan entries are dropped without creating rows

Given legacy maps contain session ids with no matching local row,
When the app boots,
Then no `pomodoro_sessions` row is created for them,
And the legacy keys are retired.

#### Scenario: A promotion failure leaves the app usable and retries later

Given the promotion cannot read storage or apply the backfill,
When the app boots,
Then the app continues into normal local use,
And the legacy keys remain so the next launch retries the idempotent pass.
