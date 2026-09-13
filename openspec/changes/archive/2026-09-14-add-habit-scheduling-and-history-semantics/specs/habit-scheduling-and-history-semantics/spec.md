## Purpose

Give habits weekly expectations and historically stable progress semantics so rest days are neutral and edits never rewrite the meaning of prior completion data.

## ADDED Requirements

### Requirement: Weekly schedule selection

Every habit MUST have a non-empty weekly schedule represented by local-calendar weekdays. The product MUST offer Every day, Weekdays, Weekends, and Custom selections, with Custom allowing any non-empty subset of Monday through Sunday.

#### Scenario: Existing habit defaults to every day

- **WHEN** a device upgrades with a habit that has no schedule data
- **THEN** the habit has an effective every-day rule and its current target and completion rows remain unchanged

#### Scenario: Custom schedule is saved

- **WHEN** a user creates or edits a habit with Monday, Wednesday, and Friday selected
- **THEN** the saved habit reports those three weekdays as its schedule after reload

### Requirement: Effective-dated rules

The system MUST resolve a habit's schedule and target using the rule effective on the requested local date. A rule change made on a date MUST apply from that date forward and MUST NOT reinterpret earlier dates.

#### Scenario: Schedule change preserves old meaning

- **WHEN** a daily habit changes to Monday/Wednesday/Friday on March 11
- **THEN** dates before March 11 use the daily rule and March 11 onward uses the new rule

#### Scenario: Target change preserves completion

- **WHEN** a habit completed its target of 1 on Wednesday and its target changes to 2 on Thursday
- **THEN** Wednesday remains complete and Thursday is evaluated against target 2

### Requirement: Local scheduled-day status

The domain MUST distinguish scheduled, unscheduled, ineligible-before-creation, and future dates. An unscheduled date MUST be neutral rather than incomplete or missed, and a date before the habit's local creation boundary MUST be excluded from eligibility.

#### Scenario: Weekday rest day

- **WHEN** a habit is scheduled Monday/Wednesday/Friday and the requested date is Tuesday
- **THEN** the domain returns NOT SCHEDULED and does not return a missed occurrence

#### Scenario: Midweek creation boundary

- **WHEN** a habit is created on Wednesday
- **THEN** Monday and Tuesday are excluded from its eligible history and cannot lower consistency or break a streak

### Requirement: Schedule-aware streaks

Current and longest streaks MUST count consecutive completed scheduled occurrences, ignore unscheduled dates, exclude future dates, and evaluate the full available completion history without an arbitrary lookback cap. A scheduled current day that is not complete MUST receive grace while that local calendar day is active; a prior scheduled miss MUST break the current streak.

#### Scenario: M/W/F streak ignores rest days

- **WHEN** all four successive Monday/Wednesday/Friday occurrences are complete and intervening Tuesday/Thursday/weekend dates are unscheduled
- **THEN** the current streak is 4

#### Scenario: Past scheduled miss breaks streak

- **WHEN** Monday is complete, Wednesday is missed, and Friday is completed
- **THEN** the current streak after Friday is 1

#### Scenario: Today grace

- **WHEN** Wednesday is complete, Friday is scheduled but incomplete, and Friday has not ended locally
- **THEN** the current streak remains the completed streak through Wednesday until Friday is completed or the day expires

#### Scenario: Long streak is not capped

- **WHEN** more than 30 consecutive eligible scheduled occurrences are complete
- **THEN** the current streak is greater than 30

### Requirement: Schedule-aware consistency and heatmap

Consistency MUST be completed eligible scheduled occurrences divided by eligible scheduled occurrences in the existing reporting window. The habit heatmap MUST use completed scheduled habits divided by habits scheduled on each date; dates with no scheduled habits MUST be neutral and unscheduled habits MUST not lower intensity. Future dates MUST be excluded from denominators. The existing fixed 52-column heatmap contract MUST remain intact.

#### Scenario: Custom schedule denominator

- **WHEN** a Monday/Wednesday/Friday habit has 5 completed occurrences out of 6 eligible occurrences
- **THEN** consistency is 5/6 and Tuesday, Thursday, Saturday, and Sunday do not enter the denominator

#### Scenario: No scheduled heatmap obligations

- **WHEN** no habit is scheduled on a date in the heatmap window
- **THEN** that date renders as neutral rather than as a failed day

#### Scenario: Unscheduled habit does not dilute heatmap

- **WHEN** one of two habits is scheduled and completed on a date while the other is unscheduled
- **THEN** the date is evaluated against one scheduled habit and renders as complete intensity

### Requirement: Today progress and off-day experience

Today progress MUST use only habits scheduled for today. If none are scheduled, the summary MUST communicate a neutral rest/no-scheduled-habits state rather than 0% failure. A habit card on an unscheduled day MUST be visually neutral and non-actionable for normal progress taps while retaining edit/management access.

#### Scenario: Today denominator excludes off-day habit

- **WHEN** a daily habit is incomplete, a Monday/Wednesday/Friday habit is not scheduled on Tuesday, and no other habit is scheduled
- **THEN** today's denominator is 1 and the off-day habit does not reduce today's progress

#### Scenario: Rest day summary

- **WHEN** all habits are scheduled for other weekdays
- **THEN** the habit summary shows a neutral rest/no-scheduled state

### Requirement: Compatible completion and linked actions

Completion rows MAY exist for an unscheduled date when produced by an existing compatible pathway, but such a row MUST NOT create an expected occurrence, affect streak or consistency, or change that date's schedule. Linked Actions MUST preserve dedupe, loop prevention, and atomic habit count updates.

#### Scenario: Linked action increments an off-day

- **WHEN** a linked action increments a target habit on a date outside that habit's schedule
- **THEN** the count is preserved, the date remains unscheduled, and scheduled statistics are unchanged

### Requirement: Sync, restore, and migration compatibility

The current schedule and effective rule history MUST be included in the synced habit representation and restored without silent loss. Older remote rows without rule history MUST be interpreted as an every-day rule beginning at their local creation date. Completion history remains local-only as in restore v1.

#### Scenario: Restore older habit row

- **WHEN** restore imports a habit row from a backup created before scheduling existed
- **THEN** the restored habit is every day with its existing target and its existing completion rows are not rewritten

#### Scenario: Restore scheduled habit

- **WHEN** restore imports a scheduled habit with rule history
- **THEN** future and historical domain calculations use the imported rules after local reload

### Requirement: Local-calendar boundary behavior

Rule weekdays and effective dates MUST use the device's local calendar date, not UTC date extraction. Schedule edits at a local midnight boundary MUST become effective on the new local date, and a mounted habits view MUST refresh eligibility after the existing day-rollover signal without an app reload.

#### Scenario: Timezone weekday resolution

- **WHEN** the same instant is evaluated under Asia/Manila, UTC, America/New_York, Pacific/Honolulu, and Pacific/Kiritimati
- **THEN** the schedule uses the local date and local weekday for each timezone

#### Scenario: Midnight schedule edit

- **WHEN** a rule is edited at Monday 23:59 and the local clock advances to Tuesday 00:01
- **THEN** the Tuesday evaluation uses the new effective rule and the mounted view refreshes automatically
