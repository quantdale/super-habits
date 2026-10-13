## Purpose

Defines the W12 visual and interaction contract for the Weekly Review, Progress
Insights and Activity Timeline surfaces under Frontend V3 Calm Momentum.
Existing persistence, review-idempotency, next-week application, aggregation and
bounded-query contracts remain normative. This slice is presentation,
disclosure structure and narrative wording only.

## ADDED Requirements

### Requirement: Weekly Review leads with the week's factual story

The Weekly Review SHALL render the reviewed week's dates, its review status, and
a short factual narrative of what happened before any statistics grid, and SHALL
keep every existing domain count reachable through one labelled disclosure whose
expanded state is exposed accessibly.

#### Scenario: Orientation and narrative precede the numbers

- **WHEN** the review opens for a week
- **THEN** the week range and whether the week is already reviewed are visible in the first content block
- **AND** between two and four factual observations about the week render before any statistic group
- **AND** one control labelled to reveal all numbers expands to show the Todos, Habits, Focus, Workouts and Calories counts
- **AND** the control exposes `expanded` state to assistive technology

#### Scenario: A rest week is not admonishing

- **GIVEN** a week with nothing scheduled and no completions
- **WHEN** the review opens
- **THEN** habit consistency renders as not tracked rather than as zero percent
- **AND** no observation praises or criticizes the week

### Requirement: Weekly Review steps follow Review, Decide, Plan, Reflect, Confirm

The guided review SHALL present exactly the steps Review, Decide, Plan, Reflect
and Confirm in that order, SHALL show the current position and total, and SHALL
preserve every entered draft value when moving backwards or forwards.

#### Scenario: Step position is readable and drafts survive navigation

- **GIVEN** the review is open on any step
- **WHEN** the user moves forward and then back
- **THEN** a labelled position indicator names the current step and the total
- **AND** previously entered priorities, commitments, decisions and reflection text are unchanged

#### Scenario: Plan step collects priorities and commitments without duplicate affordances

- **GIVEN** the user is on the Plan step
- **WHEN** the step renders
- **THEN** next-week priorities are entered first with one obvious add affordance bounded by the existing minimum and maximum
- **AND** new commitments are entered after priorities with exactly one add affordance
- **AND** commitment notes remain reachable behind a per-row disclosure

### Requirement: Review confirmation reports the exact durable outcome

The Confirm step SHALL list the mutations it will apply, SHALL prevent duplicate
submission while a save is in flight, and SHALL NOT report success when the
review row or any commitment failed to persist.

#### Scenario: Confirm is idempotent and truthful

- **GIVEN** a valid draft on the Confirm step
- **WHEN** the user confirms twice in quick succession
- **THEN** exactly one review row is persisted and the confirm action is disabled while saving
- **AND** a partial commitment failure is named per commitment with its retry path
- **AND** success is shown only after the review row is durably saved

#### Scenario: A rejected review write does not report completion

- **GIVEN** the review save is rejected by the database
- **WHEN** the user confirms the review
- **THEN** the surface reports that the review was not saved
- **AND** no completion state is rendered

### Requirement: Progress leads with truthful headline observations

Progress Insights SHALL render the period with explicit dates and the comparison
window, SHALL present a small ordered set of narrative-backed headline
comparisons before any further metric rows, and SHALL place the remaining
metrics behind one accessible details disclosure.

#### Scenario: Headlines carry units and no invented percentage

- **GIVEN** no activity in the prior window and activity in the current window
- **WHEN** Progress renders
- **THEN** the affected metric states the new value without a percentage change
- **AND** no metric renders a percentage derived from a zero prior window
- **AND** distinct units such as focus minutes and focus sessions are labelled separately

#### Scenario: Detail metrics remain reachable

- **WHEN** the details disclosure is collapsed
- **THEN** the headline comparisons alone render
- **AND** expanding it reveals the remaining metric values and the planning group
- **AND** the disclosure exposes its expanded state

#### Scenario: A downward change is not presented as failure

- **GIVEN** a metric that decreased against a valid prior value
- **WHEN** Progress renders that metric
- **THEN** the decrease is stated numerically without a danger or error colour

### Requirement: Activity shows events before filter chrome

The Activity Timeline SHALL render actual events before a collapsed filter
control, SHALL keep every existing source, range and day selection reachable
inside that control, and SHALL persist the selection while the control is
closed.

#### Scenario: Filters are collapsed but truthful

- **WHEN** the Timeline renders with default filters
- **THEN** event rows render before a single Filters control
- **AND** the control summarises the active source and range selection
- **AND** opening it reveals the source, range and day controls with their current selection
- **AND** the control exposes its expanded state

#### Scenario: Closing filters preserves selection and signals non-default state

- **GIVEN** the user selects a single source and a 7-day range
- **WHEN** the filter control is closed and reopened
- **THEN** the selected source and range are still selected
- **AND** a reset action returns every filter to its default
- **AND** the closed control indicates that a non-default filter is active

#### Scenario: Filtering to zero is distinguishable from no data

- **GIVEN** activity exists but no event matches the selected filters
- **WHEN** the Timeline renders those results
- **THEN** the surface states that no activity matched rather than that nothing was logged
- **AND** a reset action is offered

### Requirement: Timeline events render as flat chronological rows

The Timeline SHALL render each event as a flat row carrying its title, its
category or source label, and a short time or day context within a
most-recent-first day grouping.

#### Scenario: Rows expose category and day context

- **WHEN** events render
- **THEN** each row shows the event title and one short metadata line naming the category and the day
- **AND** rows are ordered most recent first within each day group
- **AND** day group headers label today and yesterday in browser-local terms
