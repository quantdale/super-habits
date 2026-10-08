## Purpose

Defines the daily Habits check-in experience: one obvious action per scheduled habit, a date-scoped summary, quantitative increment and decrement that stay distinct from a boolean toggle, and analytics that do not compete with the check-in.

## ADDED Requirements

### Requirement: Daily check-in list anatomy

The Habits section SHALL present scheduled habits for the selected date as a flat list, not a circular grid. A typical actionable row SHALL expose one primary completion control and the habit name as the primary hierarchy, at most one secondary progress or current-streak fact, and schedule or reminder text only as tertiary metadata. The row SHALL NOT simultaneously show a progress ring, a duplicate count, a persistent stepper, a separate name button, a streak chip, and a Progress pill for the same state.

#### Scenario: Binary habit has one check-in control

- **WHEN** an actionable habit whose selected-date target is 1 is shown
- **THEN** the row exposes one completion control whose incomplete and complete states are distinguishable without color alone
- **AND** activating it writes through the existing completion increment or decrement path rather than a separate boolean store

#### Scenario: Long names wrap without clipping the control

- **WHEN** a habit name is longer than the row width
- **THEN** the name wraps or remains readable
- **AND** the completion control stays at least 44pt in its hit target

### Requirement: Quantitative increment and decrement

A habit whose selected-date target is greater than 1 SHALL show the current count and that date's target. Increment SHALL remain a direct row action. Decrement SHALL remain discoverable and accessible, including when the count is already above zero, and SHALL call the existing decrement path. A quantitative control SHALL NOT use a boolean checkbox role.

#### Scenario: Partial quantitative progress

- **WHEN** a habit has a selected-date target of 8 and a count of 5
- **THEN** the row shows 5 of 8
- **AND** increment increases the stored completion count by 1
- **AND** decrement remains available and decreases that count by 1

#### Scenario: Large untouched target is not a failure

- **WHEN** a habit has a selected-date target of 99 and a count of 0
- **THEN** the count is presented in a neutral not-started treatment
- **AND** danger styling is not used for that incomplete value

### Requirement: Non-actionable dates stay closed

A row SHALL NOT accept a normal check-in write when the selected date is unscheduled, before the habit's creation boundary, or inside a paused or archived lifecycle interval. The disabled control SHALL explain why it is not actionable. Edit and lifecycle management SHALL remain reachable for that habit.

#### Scenario: Rest day row

- **WHEN** the selected date is outside the habit's effective weekday rule
- **THEN** the completion control is disabled
- **AND** its accessible name states that the habit is not scheduled on that date

#### Scenario: Paused interval

- **WHEN** the selected date falls inside a paused or archived lifecycle interval
- **THEN** a check-in write is not offered as an enabled action
- **AND** pause, archive, or restore remains available from the habit detail surface

### Requirement: Date-scoped daily summary

The visible completion summary SHALL name the date it describes. Today's summary SHALL count only habits scheduled for today. A non-today selection SHALL NOT present today's completed count as that historical day's result, and SHALL NOT mix today's numerator with the selected date's denominator. A date with no scheduled habits SHALL use a neutral rest or nothing-scheduled label rather than a 0% failure.

#### Scenario: Historical day does not reuse today

- **WHEN** today has 1 of 4 scheduled habits complete and the user selects yesterday, which has 0 of 2 scheduled
- **THEN** the summary for the selected day describes yesterday's 0 of 2
- **AND** it does not read as 1 of 2 or 0 of 4

#### Scenario: Current streak is not a selected-date score

- **WHEN** a habit row shows a streak while a past day is selected
- **THEN** the streak is identified as the current streak
- **AND** it is not labeled as that past day's result

### Requirement: Quiet grouping and collapsed filters

Default Habits SHALL show the day selector, one concise date summary, and the check-in list before infrequent controls. Status and sort options SHALL remain available from one compact filter control rather than as permanently expanded rows. Time-of-day groups SHALL use quiet textual labels. An empty time-of-day group SHALL NOT render as a large empty block.

#### Scenario: Filters are not stacked ahead of habits

- **WHEN** the default Habits screen renders with at least one habit
- **THEN** status and sort choices are not all permanently expanded above the list
- **AND** those choices remain reachable from one filter control

#### Scenario: Empty group is omitted

- **WHEN** no displayed habit belongs to Evening
- **THEN** the screen does not render an empty Evening container

### Requirement: Analytics do not compete with check-in

The daily screen SHALL NOT keep a large screen-wide analytics wall under the check-in list. Aggregate trends and per-habit history SHALL remain available from a secondary entry and the habit detail surface. The detail surface SHALL still expose completion history, current streak, longest streak, consistency, schedule, reminder, edit, pause or resume, archive or restore, and delete.

#### Scenario: Daily screen is check-in first

- **WHEN** a populated Habits screen renders
- **THEN** the first habitual task is a check-in row
- **AND** the previous screen-wide rhythm dashboard is not shown beneath the list

#### Scenario: Detail keeps lifecycle actions

- **WHEN** the user opens a habit from its row
- **THEN** edit, pause or resume, archive or restore, and delete are reachable without a global edit mode
