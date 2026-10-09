## Purpose

Defines the timer-startup authority so a session that has been accepted for start is protected before its asynchronous startup operations complete, and so a rejected startup leaves no session, intent, or orphan behind.

## ADDED Requirements

### Requirement: Starting is an active session

A start that has been accepted SHALL claim its session before its end-notification scheduling resolves, and that claim SHALL be visible to every part of the surface. While the claim is held the Focus section SHALL present a starting state that is distinct from running: the selected duration SHALL be shown but SHALL NOT be counted down, the phase copy SHALL identify starting rather than running, and exactly one primary start action SHALL be available, disabled and labelled for the pending startup.

#### Scenario: Configuration is withdrawn the moment a start is accepted

- **WHEN** the user presses Start and end-notification scheduling has not resolved yet
- **THEN** the mode selector, preset selection, duration editing, task association, and history entry are not offered
- **AND** the timer shows the selected duration without counting down

#### Scenario: A second start conflicts with the in-flight startup

- **WHEN** a start has been accepted and has not resolved, and a second Start is requested
- **THEN** the second request is refused
- **AND** exactly one session exists once the first request resolves

### Requirement: Configuration callbacks are safe independent of rendering

Every configuration callback — mode selection, preset selection, duration editing, and task association — SHALL check the live session authority synchronously before mutating any timer reference. The check SHALL read the live authority rather than the rendering closure, so it holds when the callback is invoked from a stale render, a queued press, a keyboard event, or a callback captured before the start. Hiding a control SHALL NOT be the only protection.

#### Scenario: A queued mode change cannot reset a starting session

- **WHEN** a mode change is requested while a start is in flight
- **THEN** the accepted session keeps its mode, duration, and start timestamp
- **AND** the remaining time and total duration are unchanged
- **AND** no second session is created

#### Scenario: A queued duration save cannot rewrite a starting session

- **WHEN** saved default durations change while a start is in flight
- **THEN** the accepted session keeps its remaining time and its running or pending status
- **AND** no focus session row is written by the change

### Requirement: The governing preset is frozen with a session

The preset that governs automatic progression for a session SHALL be resolved when that session is accepted and SHALL NOT change while the session is in flight. A preset selected while a session — including an in-flight startup — is active SHALL govern the next timer only.

#### Scenario: A preset chosen mid-start governs the next timer

- **WHEN** a different preset is selected while a start is in flight
- **THEN** the accepted session's automatic progression still follows the preset it started with
- **AND** the stored selection applies to the next idle timer

### Requirement: End-notification results are classified before deciding the session's fate

A missing notification identifier SHALL NOT by itself fail a session. A timer on a platform without native notification scheduling SHALL start normally. A timer whose notification permission was refused SHALL start normally and SHALL report that the end alert will not fire. A rejected scheduling operation SHALL return the timer to idle with no session, no durable active-timer intent, no orphaned notification, an unchanged selected duration, and a timer that can be started again.

#### Scenario: Permission refusal keeps the countdown valid

- **WHEN** a start is accepted and notification permission is refused
- **THEN** the countdown starts
- **AND** a visible notice states the end alert will not fire
- **AND** no completed focus session row is written by the notice

#### Scenario: A rejected scheduling call leaves nothing behind

- **WHEN** a start is accepted and scheduling the end notification fails
- **THEN** the timer returns to its selected duration without counting down
- **AND** no durable active-timer intent remains
- **AND** any notification that was partially scheduled is cancelled
- **AND** the timer can be started again

#### Scenario: A failed startup is reported without a lost failure

- **WHEN** a startup is rejected
- **THEN** a concise notice explains that the timer did not start and that nothing was recorded
- **AND** a command that requested the start receives a failed result rather than a success
