# Calorie Entry Day Correction Specification

## ADDED Requirements

### Requirement: An entry can move to another day without losing identity

Editing a calorie entry SHALL allow changing its consumed day while preserving the row identity (same id, single update outbox intent); the operation SHALL NOT be implemented as delete plus create.

#### Scenario: Move yesterday to today

Given an entry logged on yesterday with 400 kcal,
When the user edits it to today and saves,
Then the diary shows the entry under today and not yesterday,
And yesterday's and today's aggregates both reflect the move,
And exactly one calorie_entries update intent exists in the outbox.

#### Scenario: Move across a month boundary

Given an entry on the last day of a month,
When the user moves it to the first day of the next month,
Then both day totals update correctly and no duplicate entry exists after restart.

### Requirement: Simultaneous field and date edits apply atomically

An edit that changes date plus calories/macros/meal type in one save SHALL persist all fields or none; a failed save SHALL leave the original entry unchanged.

#### Scenario: Failed save keeps the old entry

Given an open entry edit sheet,
When a save fails (validation or storage error),
Then the stored entry keeps its previous day and values,
And retrying after correction succeeds without creating a second row.

### Requirement: Day-move respects repeated saves and legacy date keys

Saving the same values repeatedly SHALL be idempotent; entries whose stored day predates the date-key cutover SHALL be movable to a correct modern date key without rewriting any other legacy rows.

#### Scenario: Repeated identical saves

Given an entry edited to day X,
When the user saves the same edit again,
Then the row still exists exactly once with the same values.
