## Purpose

Defines the safety contract for Focus session controls so a clearer screen cannot discard, double-log, or mis-time a session, and so cancel, completion, pause, and reload keep the existing persistence outcomes.

## ADDED Requirements

### Requirement: Ending an active session requires confirmation

Ending a running or paused focus or break session SHALL require confirmation before the session is stopped. The confirmation SHALL state that the unfinished session will not be logged. The safe action SHALL keep the current session. The destructive action SHALL end it. Cancelling or dismissing the confirmation SHALL preserve the running or paused session, its remaining time, its scheduled end notification, and its durable active-timer intent. An idle timer that has not been started SHALL NOT require that confirmation to remain at its selected duration.

#### Scenario: Cancel preserves a running focus session

- **WHEN** a focus countdown is running and the user opens the end confirmation and then cancels or dismisses it
- **THEN** the session remains running from the same deadline
- **AND** the scheduled end notification and durable active-timer intent are unchanged
- **AND** no completed focus session is written

#### Scenario: Confirmed end does not log the session

- **WHEN** the user confirms ending a running or paused focus session
- **THEN** the countdown stops and returns to an idle selected duration
- **AND** no completed focus session row is written
- **AND** the durable active-timer intent and scheduled end notification are cleared

#### Scenario: Paused cancel keeps the frozen clock

- **WHEN** a paused session's end confirmation is cancelled
- **THEN** the session remains paused at the same remaining time
- **AND** it is not logged as completed

### Requirement: Natural completion logs focus once

A focus countdown that reaches zero SHALL record exactly one completed focus session. That session's end time SHALL equal its start time plus its duration in seconds. A repeated completion signal for the same start SHALL NOT insert another row and SHALL NOT award another reward. A break countdown that reaches zero SHALL NOT be recorded as a focus session. Pause time SHALL NOT be added to the logged focus duration.

#### Scenario: Completed focus uses active time only

- **WHEN** a focus session starts, is paused, is resumed, and then reaches zero
- **THEN** exactly one focus session is recorded
- **AND** its end time is its start time plus the original duration in seconds
- **AND** the paused interval is not added to that duration

#### Scenario: Break completion writes no focus row

- **WHEN** a short or long break countdown reaches zero
- **THEN** no focus session row is written for that break

### Requirement: Automatic progression starts the next session once

When the active preset is configured to start the next session automatically, that next session SHALL start once after the existing short completion beat. When it is not configured to start automatically, the completed state SHALL remain until the user starts the next session or dismisses the summary. Completion and automatic start SHALL NOT create two overlapping sessions. The completion acknowledgment SHALL remain visible through the beat unless the next session has actually started.

#### Scenario: Auto-start does not double-start

- **WHEN** a focus session completes under a preset that automatically starts the following break
- **THEN** one break session starts
- **AND** a second session is not started by the completion itself

#### Scenario: Manual progression waits

- **WHEN** a focus session completes under a preset that does not automatically start the next session
- **THEN** the completed state remains visible
- **AND** the next session starts only after the user chooses it

### Requirement: Linked tasks and notes still attach

A task linked before a focus session starts SHALL be stored on the completed focus session when that session is logged. The optional note entry SHALL remain available after that logged completion. Abandoning an unfinished session SHALL NOT attach that task to a new completed row.

#### Scenario: Linked task is stored on the logged session

- **WHEN** the user links a task, completes a focus session, and the session is saved
- **THEN** the stored session carries that task association
- **AND** the note entry is available for that saved session

#### Scenario: Abandoned session does not keep the link as a completion

- **WHEN** the user links a task and then confirms ending the unfinished focus session
- **THEN** no completed session carries that task association

### Requirement: Active configuration cannot discard a session

While a session is running or paused, the Focus surface SHALL NOT offer timer-mode changes, preset application, or duration editing that alter or discard that session. A request to start another focus session while one is running or paused SHALL leave the current session in place. A change to saved default durations SHALL NOT change the remaining time or running or paused status of an in-flight session and SHALL NOT log a session.

#### Scenario: Mode and duration controls are absent while paused

- **WHEN** a focus session is paused
- **THEN** mode switching and duration editing are not available
- **AND** the paused remaining time is unchanged

#### Scenario: Another start does not replace the active session

- **WHEN** a focus session is running or paused and a command requests a new focus session
- **THEN** the current session remains running or paused
- **AND** no additional session is started or logged

#### Scenario: Settings defaults do not move a paused clock

- **WHEN** a focus session is paused and the saved default focus duration changes
- **THEN** the paused session still shows its original remaining time
- **AND** no focus session row is logged

### Requirement: Reload reconciliation outcomes stay the same

Reconciling a durable active timer after reload SHALL keep the existing outcomes. A session that is already logged SHALL NOT be logged again. A timer that was paused when the process died SHALL be treated as interrupted and SHALL NOT be logged as completed. A focus timer whose deadline has passed and that has no logged row SHALL be logged once as completed. Any other unfinished timer SHALL be treated as interrupted and SHALL NOT be presented as successfully completed. An orphaned end notification for an interrupted timer SHALL be cancelled.

#### Scenario: Paused reload is not a completed focus

- **WHEN** a paused focus timer is reconciled after reload
- **THEN** it is reported as interrupted
- **AND** no completed focus row is written for it

#### Scenario: Elapsed unlogged focus is completed once

- **WHEN** a running focus timer is reconciled after its deadline and no row exists for that start
- **THEN** exactly one completed focus session is written
- **AND** a later reconciliation of the same start does not write a second row

### Requirement: Confirmation is keyboard reachable on web

On web, the end confirmation SHALL keep keyboard focus inside the confirmation until it is confirmed or dismissed, and cancelling SHALL return focus to the end control. Confirm and cancel SHALL be activatable with the keyboard.

#### Scenario: Cancel returns to the end control

- **WHEN** a keyboard user opens the end confirmation and dismisses it
- **THEN** focus returns to the end control
- **AND** the session is unchanged
