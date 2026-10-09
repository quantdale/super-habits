## Purpose

Defines the observable Focus screen so idle, running, paused, break, completed, and interrupted recovery each answer what the user should do now, without a settings dashboard competing with the countdown.

## ADDED Requirements

### Requirement: Distinct timer hierarchies

The Focus section SHALL present a distinct visible hierarchy for each of idle, running, paused, break, completed, and interrupted recovery. A running or paused session SHALL NOT show preset selection, duration editing, session history, the garden, or the activity heatmap. An idle timer SHALL show the selected duration, one primary start action, a compact preset and duration entry, optional task association, and a secondary history entry.

#### Scenario: Running hides configuration and history

- **WHEN** a focus countdown is running
- **THEN** the countdown and the pause and end actions are visible
- **AND** preset selection, duration editing, session history, the garden, and the heatmap are not visible

#### Scenario: Idle offers start without placeholder progress

- **WHEN** the timer is idle at its selected duration and no session in the current cycle has completed
- **THEN** one primary start action is available
- **AND** a compact preset and duration entry is available
- **AND** no placeholder session-dot row is shown

### Requirement: Countdown dominates an active session

While a session is running, paused, or on a break, the remaining time SHALL be the most prominent element. The phase, a linked task when one is attached, one cycle description when it is meaningful, and the primary session controls SHALL be secondary. Focus hue SHALL be a selective accent. The active timer SHALL NOT be presented as a saturated color slab, a nested documentation card, or a settings dashboard.

#### Scenario: Running focus leads with the countdown

- **WHEN** a focus session is running with a linked task
- **THEN** the remaining time is larger than the phase label, the linked task, and the controls
- **AND** the linked task is visible without opening settings
- **AND** no documentation subtitle is shown above the timer

### Requirement: Paused state is frozen and explicit

A paused session SHALL keep the remaining time frozen at the value it had when paused. The surface SHALL show a paused state that is not conveyed by color alone, SHALL present resume as the dominant action, and SHALL present end as secondary. It SHALL NOT imply that the countdown is still decreasing.

#### Scenario: Paused focus does not look like a running countdown

- **WHEN** the user pauses a running focus session
- **THEN** the remaining time stays at the paused value until resume or a confirmed end
- **AND** a visible paused label is shown
- **AND** resume is the dominant action and end is secondary

### Requirement: Break stays distinct and duration-correct

Short break and long break SHALL keep their configured durations and their existing progression into the next focus or long break. A break SHALL be visually distinguishable from focus without a full-screen hue. Break completion SHALL NOT be presented as a completed focus session.

#### Scenario: Short break is not a focus session

- **WHEN** a short break countdown is running
- **THEN** the phase is identified as a short break
- **AND** the remaining time matches the configured short-break duration at the start of that break
- **AND** the presentation is distinguishable from a running focus session without relying on color alone

### Requirement: Completion shows the finished duration

A naturally completed focus session SHALL show the completed duration, a success acknowledgment, the linked task when one was attached, the optional note entry, and one clear next action. Until the user advances or automatic progression starts the next session, the dominant time SHALL be that completed duration rather than the next session's full duration. An abandoned or interrupted unfinished session SHALL NOT use this success presentation.

#### Scenario: Completed focus does not paint the next duration first

- **WHEN** a focus countdown reaches zero and the next session has not started
- **THEN** the dominant time is the duration just completed
- **AND** the success acknowledgment is visible
- **AND** the next session's full duration is not shown as if that session were already the current countdown

#### Scenario: Abandon is not a success

- **WHEN** the user confirms ending an unfinished focus session
- **THEN** the completion success acknowledgment is not shown

### Requirement: Cycle progress is meaningful

The surface SHALL NOT show a row of session placeholders when the timer is idle and no session in the current cycle has completed. When cycle position changes what the user will do next, the surface SHALL show one textual description of that position, such as the current focus index within the cycle or that a long break is next. That description SHALL have an accessible name. The same count SHALL NOT be repeated in a second indicator.

#### Scenario: Idle cycle start has no decorative dots

- **WHEN** the timer is idle and the current cycle has no completed focus session
- **THEN** no session-dot row is rendered

#### Scenario: An in-cycle session has one description

- **WHEN** a focus session is running as the second session of a four-session cycle
- **THEN** one accessible description communicates that this is session 2 of 4
- **AND** a separate dot row does not repeat that count

### Requirement: Motion does not move the clock

Decorative growth SHALL NOT update on every countdown second. A decorative transition MAY occur only on a meaningful milestone or completion. Reduced Motion SHALL disable decorative transitions. No animation SHALL shift the countdown baseline or the primary controls.

#### Scenario: A running second does not animate decoration

- **WHEN** a focus countdown decreases by one second without crossing a milestone
- **THEN** no decorative growth element changes
- **AND** the countdown remains visually stable apart from the digit change

#### Scenario: Reduced Motion disables decorative transition

- **WHEN** Reduced Motion is enabled and a session completes
- **THEN** any completion acknowledgment does not play a decorative motion transition

### Requirement: Interruption copy is specific and true

The surface SHALL distinguish a temporary background or tab hide, a session interrupted before completion, a completed session recovered after reload, and a storage or notification failure. Temporary background SHALL NOT be described as destroying the session or a garden. A storage or notification failure SHALL remain visible until the user dismisses it. An interrupted unfinished session SHALL NOT be presented as successfully completed.

#### Scenario: Background warning does not claim the session died

- **WHEN** the app or tab is temporarily backgrounded during a running session and the session is still in progress
- **THEN** the warning says the session was backgrounded or kept running
- **AND** it does not say the session or a plant was lost

#### Scenario: Storage failure stays visible

- **WHEN** a completed focus session cannot be saved
- **THEN** a visible failure message remains until the user dismisses it
- **AND** the message does not claim the session was saved

### Requirement: Timer status does not flood announcements

The countdown SHALL have an accessible status that a user can request, including the current phase and remaining time. The countdown SHALL NOT be announced on every second. Pause, resume, and end actions SHALL have accessible names that match their visible labels. Phase changes SHALL be exposed to assistive technology without a per-second live update.

#### Scenario: A ticking second is not a live announcement

- **WHEN** a running countdown decreases by one second and the phase does not change
- **THEN** assistive technology is not given a live-region update for that second
- **AND** focusing or otherwise requesting the timer status reports the current phase and remaining time
