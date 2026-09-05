# Pomodoro Management and Session Correction Specification

## ADDED Requirements

### Requirement: Custom focus presets are authorable

The user SHALL be able to create, rename, adjust durations of, and delete custom Pomodoro presets; built-in presets SHALL remain protected; persistence SHALL go through the existing recoverable settings path so presets survive backup/restore.

#### Scenario: Create and use a custom preset

Given the preset selector,
When the user creates a 50/10 preset named "Deep work" and selects it,
Then new sessions use those durations,
And the preset survives an app restart and a backup/restore cycle.

#### Scenario: Built-ins cannot be corrupted

Given the preset management surface,
When the user attempts to edit a built-in preset,
Then built-ins are read-only (or explicitly resettable),
And custom presets remain fully editable.

### Requirement: Past focus sessions support metadata correction with immutable timing

From focus history the user SHALL be able to correct a completed session's note and link/unlink it to a todo using the existing session-metadata contract; session duration, type, and completion timestamps SHALL remain immutable, and no soft-delete path for sessions is introduced.

#### Scenario: Relink a completed session

Given a completed session with the wrong todo link,
When the user relinks it to the correct todo from history,
Then the stored session carries the new linked todo id and title snapshot,
And duration and timing are unchanged,
And exactly one pomodoro_sessions update intent is recorded.

#### Scenario: Unlink removes the association

Given a linked completed session,
When the user clears the link,
Then the stored session has no linked todo and the history view reflects it after restart.
