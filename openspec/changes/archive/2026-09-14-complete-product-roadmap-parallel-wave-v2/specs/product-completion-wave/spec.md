## ADDED Requirements

### Requirement: The application SHALL surface computed project progress from linked entities

The Projects feature SHALL compute a progress percentage for each active
project from its linked todos (completion ratio), goals (progress_percent
average), and habits (7-day completion ratio), using bounded local queries and
pure domain functions.

#### Scenario: Project with mixed linked entities

- **GIVEN** a project linked to 4 todos (2 completed), 2 goals at 50% and 30%,
  and no habits
- **WHEN** the project progress rollup is computed
- **THEN** the displayed progress SHALL be derived only from local authoritative
  rows via the project domain layer
- **AND** SHALL NOT mutate any entity to store the derived value

### Requirement: The application SHALL support carry-forward in the Daily Plan

The Daily Plan SHALL let the user carry unfinished priority items forward from
the previous plan into today's plan without duplicating existing entries.

#### Scenario: Carry forward an unfinished priority

- **GIVEN** yesterday's plan contains an unfinished priority item
- **WHEN** the user invokes carry-forward on today's plan
- **THEN** the item SHALL appear in today's plan exactly once
- **AND** repeating the invocation SHALL NOT create duplicates

### Requirement: The Overview dashboard SHALL provide customizable summary cards

The Overview SHALL render summary cards drawn from existing local domains
(todos, habits, focus, workout, calories, projects/goals/daily plan) whose set
and order the user can customize, with the customization persisted locally.

#### Scenario: User reorders dashboard cards

- **WHEN** the user changes card order in Overview customization
- **THEN** the order SHALL persist across reload
- **AND** SHALL NOT require network access

### Requirement: The Command Center SHALL cover planning entities through the canonical action pipeline

The Command Center SHALL support creating projects, updating goal progress,
and inserting todos into the Daily Plan only through parse → preview/review →
explicit confirm → canonical executor, with no direct model-driven database
mutation.

#### Scenario: Create a project by command

- **WHEN** the user issues a natural-language project creation request that
  parses successfully
- **THEN** a reviewable draft SHALL be shown before execution
- **AND** execution SHALL go through the same canonical data-layer functions as
  the Projects UI

### Requirement: The application SHALL provide personal-record detection for strength exercises

The Workout feature SHALL compute personal records (best estimated 1RM or best
top-set per exercise) from `workout_logs` history via pure domain functions and
surface them in the workout UI.

#### Scenario: New best lift is highlighted

- **GIVEN** historical sessions for an exercise
- **WHEN** a session logs a heavier top set than any prior session
- **THEN** the history/detail surface SHALL identify that set as a personal
  record computed from local data

### Requirement: The application SHALL offer local reminders beyond habits within platform capability

The application SHALL optionally schedule local reminders for todo due dates
and the daily plan, guarded so that unsupported platforms degrade gracefully
without error.

#### Scenario: Due-date reminder on an unsupported platform

- **GIVEN** notifications are unavailable (web without support)
- **WHEN** a todo with a due date is saved
- **THEN** the app SHALL remain fully functional
- **AND** SHALL NOT schedule a notification or surface an error

### Requirement: The PWA shell SHALL communicate offline and update states

The web PWA SHALL surface offline readiness and service-worker update
availability through non-blocking UI indicators.

#### Scenario: Update available while user works

- **WHEN** a new service worker version finishes installing
- **THEN** the app SHALL show a non-blocking update affordance
- **AND** SHALL NOT interrupt active timers or sessions

### Requirement: Calories SHALL present trend and target context

The Calories feature SHALL present rolling macro trends and daily target
progress computed from local entries via pure domain functions.

#### Scenario: Weekly macro trend

- **GIVEN** seven days of calorie entries
- **WHEN** the user opens the trends surface
- **THEN** per-day and weekly averages SHALL be computed from local data
- **AND** SHALL NOT make medical claims

### Requirement: Focus sessions SHALL record optional task association and notes where the schema allows

Pomodoro SHALL let the user associate a session with an existing todo/project/
goal reference already representable in the current schema and add free-text
notes, preserving canonical session logging semantics.

#### Scenario: Associate a todo with a focus session

- **GIVEN** an existing todo
- **WHEN** the user starts a focus session associated with it
- **THEN** the completed session record SHALL retain the association using
  existing columns or documented local preferences
- **AND** historical session logging semantics SHALL be unchanged

### Requirement: Activity Timeline and Progress Insights SHALL support bounded filtering and comparisons

Activity Timeline SHALL filter by entity type and date range; Progress
Insights SHALL present 7/30/90-day comparisons per domain computed by pure
domain functions from bounded queries.

#### Scenario: Ninety-day comparison

- **WHEN** the user selects the 90-day window in Progress Insights
- **THEN** each domain comparison SHALL be computed from local rows limited to
  the window
- **AND** SHALL complete without full-table scans of unbounded history
