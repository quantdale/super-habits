## ADDED Requirements

### Requirement: The add/edit-todo modal submit is re-entrant-safe
`onSave()` in `features/todos/TodosScreen.tsx` SHALL be guarded against re-entry: an in-flight flag (or equivalent) SHALL be set before the async save begins, checked at the top of `onSave()` and on the submit button's press, and cleared only after the save completes or the modal closes. While a save is in flight, a second submit SHALL be ignored (or the submit control disabled), so two rapid presses in the same tick produce exactly one todo row.

#### Scenario: Double-submit in the same tick creates exactly one row
- **WHEN** the user fires two complete presses of the Add-task submit in the same tick
- **THEN** exactly one todo row with that title is persisted, and the second press starts no write.

#### Scenario: Single submit behaves as before
- **WHEN** the user presses the Add-task submit once with valid input
- **THEN** the todo is created exactly as today, with validation running before the write.

### Requirement: The guard covers both create and edit paths
The re-entry guard SHALL apply to both save paths the modal exposes. An edit submitted twice in rapid succession SHALL also never write twice, and the validation-before-write ordering SHALL be preserved on both paths.

#### Scenario: Double-submitted edit writes once
- **WHEN** the user edits a todo and presses Save twice in rapid succession
- **THEN** the update is applied exactly once and the second press is ignored while the first save is in flight.
