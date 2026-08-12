# habit-progress-insights Specification

## Purpose

Give a user an understandable historical view of one active habit without
changing the Habit Engine V2 schedule, target, streak, or local-date model.

## Requirements

### Requirement: Schedule-aware per-habit metrics

The system SHALL calculate insights for an active habit from its effective-dated
rule history, creation boundary, local calendar date, and completion rows. It
SHALL expose current streak and longest streak as counts of completed scheduled
occurrences, not raw calendar days. An incomplete scheduled occurrence for the
current local day SHALL receive the existing Habit Engine current-day grace for
current-streak calculation. Off-days and pre-creation dates SHALL not break a
streak or contribute to a scheduled-rate denominator.

#### Scenario: Daily habit exposes current and longest streaks

- **GIVEN** a daily habit has completed five consecutive eligible scheduled
  occurrences and today is incomplete
- **WHEN** progress insights are calculated
- **THEN** current streak is five because today has current-day grace
- **AND** longest streak is at least five

#### Scenario: Scheduled gaps and off-days have distinct meanings

- **GIVEN** an M/W/F habit completes Monday and Wednesday, has a completion row
  on Tuesday, and misses Friday
- **WHEN** progress insights are calculated
- **THEN** Tuesday is shown as an off-day with its actual count but is neutral
- **AND** Friday is an eligible scheduled miss that breaks a later streak

#### Scenario: Creation boundary is honored

- **GIVEN** a habit is created in the middle of a 30-day window
- **WHEN** the 30-day insight is calculated
- **THEN** dates before the habit’s effective creation/rule boundary are not
  eligible and are not included in the denominator

#### Scenario: Deleted habits have no user-facing insight surface

- **GIVEN** a habit has a non-null `deleted_at`
- **WHEN** the insight calculator receives it
- **THEN** it returns no insight result and the active Habits UI does not expose
  a progress entry for it

### Requirement: Scheduled completion rate windows

The system SHALL expose scheduled completion rates for the last 7, 30, and 90
local calendar days. Each rate SHALL be computed as completed eligible
scheduled occurrences divided by eligible scheduled occurrences in that window,
rounded to a whole percentage for presentation. The current local day remains
eligible according to the shared Habit Engine model; its incomplete state does
not receive a special rate exemption, while current-streak grace remains
separate and explicit. A window with zero eligible scheduled occurrences SHALL
return an empty rate rather than a misleading zero percent.

#### Scenario: Target completion drives the denominator result

- **GIVEN** a target-two habit has counts one and two on two eligible scheduled
  dates
- **WHEN** its rate is calculated
- **THEN** one of two eligible occurrences is complete and the rate is 50%
- **AND** the target and actual counts remain visible in history

#### Scenario: Sparse schedules use scheduled occurrences only

- **GIVEN** a weekend habit has one scheduled day in a seven-day window and no
  weekday schedule
- **WHEN** the seven-day rate is calculated
- **THEN** only that one eligible weekend occurrence is the denominator
- **AND** weekdays are neutral rather than missed occurrences

#### Scenario: No eligible occurrences are represented honestly

- **GIVEN** a new habit’s selected window contains no eligible scheduled date
- **WHEN** insights are calculated
- **THEN** the rate is empty and the UI explains that there is no scheduled
  history yet

### Requirement: Target-versus-actual history

The system SHALL expose recent local-calendar history rows covering the last 30
calendar days (or the full available history when shorter). Each row SHALL
include the date, scheduled/eligible state, historical target active on that
date, actual completion count, and whether the target was satisfied. Historical
target and schedule edits SHALL affect only dates on or after their effective
date. Off-day completion rows SHALL remain visible as actual activity but SHALL
not be marked satisfied or included in scheduled rates.

#### Scenario: Historical target edits remain date-correct

- **GIVEN** a habit used target one before a target-two rule became effective
- **WHEN** recent history is displayed
- **THEN** the earlier row uses target one and the later row uses target two
- **AND** satisfaction is evaluated with each row’s own target

#### Scenario: Off-day actual activity is neutral

- **GIVEN** a completion row exists on a date outside the habit’s schedule
- **WHEN** history is displayed
- **THEN** the row shows its actual count and is marked not scheduled/neutral
- **AND** it does not lower any scheduled completion rate

### Requirement: Explainable recent trend

The system SHALL compare the most recent seven calendar days with the preceding
seven calendar days using the same scheduled-occurrence rate calculation. It
SHALL report Improving when the recent rate is at least 10 percentage points
higher, Declining when it is at least 10 points lower, and Steady otherwise.
If either comparison window has fewer than two eligible scheduled occurrences,
the trend SHALL be `insufficient_data` and SHALL NOT imply direction.

#### Scenario: Trend requires enough evidence

- **GIVEN** a habit has at least two eligible scheduled occurrences in each
  comparison window and the recent rate improves by 10 points
- **WHEN** the trend is calculated
- **THEN** the result is Improving with both rates available for explanation

#### Scenario: Tiny samples do not claim improvement

- **GIVEN** one comparison window has fewer than two eligible occurrences
- **WHEN** the trend is calculated
- **THEN** the result is insufficient data rather than Improving, Steady, or
  Declining

### Requirement: Accessible Habits presentation

The Habits UI SHALL provide a clear progress entry for each active habit and
show the selected habit’s metrics in an existing modal/detail pattern. Every
metric SHALL have a textual label containing its value and denominator where
applicable. Visual bars, colors, icons, and trend styling SHALL be supplemental
only; assistive technology SHALL be able to understand scheduled state,
target, actual count, satisfaction, and trend without relying on color.

#### Scenario: User opens progress for one habit

- **GIVEN** an active habit is visible in the Habits section
- **WHEN** the user activates its progress control
- **THEN** a detail surface opens for that exact habit
- **AND** it announces current streak, longest streak, 7/30/90 rates, trend,
  and recent target-vs-actual rows

#### Scenario: Progress loading and empty history are understandable

- **GIVEN** progress data is loading or has no eligible history
- **WHEN** the detail surface is open
- **THEN** the user receives a visible and semantic loading/empty message
- **AND** no misleading 0% metric is presented for an empty denominator

### Requirement: Bounded, query-efficient local loading

The system SHALL obtain completion history for an opened habit with one local
SQLite read and calculate all displayed windows in memory. The active Habits
list SHALL not add one full-history query per habit when shared completion data
can produce its existing today counts and streaks. No implementation SHALL
perform one SQLite query per habit per date.

#### Scenario: Opening insights uses one history read

- **GIVEN** a habit has completion rows across its history
- **WHEN** progress is opened
- **THEN** the data layer performs one ordered completion-history read for that
  habit and the domain derives all metrics without further date queries

#### Scenario: Multiple visible habits share completion loading

- **GIVEN** the Habits list contains multiple active habits
- **WHEN** the list refreshes
- **THEN** today counts and current streaks can be derived from one shared
  completion read plus the existing bounded heatmap read
- **AND** the result remains equivalent to the prior per-habit calculation
