# gym-workout-deep-expansion Specification

## Purpose

Define the additive Gym V2 semantic expansion: searchable exercise metadata,
durable unilateral meaning, modality-aware progression and records,
exercise-level history, cross-feature planning visibility, reminders, and
recoverable interruption-safe sessions.

## Requirements

### Requirement: Exercise definitions expose stable training semantics

The system SHALL represent each bundled or custom exercise with a stable
identity, display name, searchable aliases, movement/tracking modality,
primary and secondary muscle areas, equipment, optional instructions, and
explicit flags for unilateral work and external-load support. The bundled
catalog SHALL remain packaged application data and SHALL NOT require network
access or be copied into user backup records.

#### Scenario: Offline catalog search

- **WHEN** a user searches by an exercise alias, equipment, or muscle area while offline
- **THEN** the matching bundled and local custom definitions are available without a network request

#### Scenario: Custom exercise provenance

- **WHEN** a user creates a custom exercise with instructions and unilateral semantics
- **THEN** the definition is stored as user-owned recoverable data and is distinguishable from bundled catalog data

### Requirement: Legacy exercise rows remain meaningful

The system SHALL preserve every legacy routine and historical display name. A
legacy row without a stable exercise identity SHALL resolve as compatible
free-text/timed data, and the system MUST NOT silently fuzzy-map it to a
different catalog exercise or rewrite performed historical measurements.

#### Scenario: Legacy routine upgrade

- **WHEN** a device upgrades from the prior workout schema
- **THEN** the legacy exercise name, set timing, routine ordering, and historical session detail remain readable

### Requirement: Unilateral intent is durable and understandable

The system SHALL preserve unilateral/per-side intent from exercise definition
through routine prescription, active draft, performed set, duplication, and
history. The UI SHALL explain whether a target is per side or total and SHALL
NOT silently double or halve recorded repetitions.

#### Scenario: Per-side set logging

- **WHEN** a user logs 8 reps per side for a unilateral exercise
- **THEN** the saved set records 8 as the entered per-side reps and history labels it as per-side without converting it to 16

#### Scenario: Draft restart preserves side semantics

- **WHEN** an active unilateral set is interrupted and the app restarts
- **THEN** the resumed draft shows the same side intent and entered values at the same set cursor

### Requirement: Prescriptions are modality-aware

The system SHALL provide valid targets for weighted repetitions, bodyweight
repetitions, optional added load, timed/static duration, and cardio duration
with distance or pace where applicable. It MUST reject negative, non-finite, or
modality-incompatible measurements and MUST treat omitted values as unknown,
not zero.

#### Scenario: Bodyweight without invented load

- **WHEN** a user completes an unloaded bodyweight set
- **THEN** the persisted result contains repetitions without fabricating external weight or volume

#### Scenario: Cardio measurement validation

- **WHEN** a cardio set contains duration and distance but an invalid negative pace
- **THEN** the invalid pace is rejected while valid measurements remain eligible for saving

### Requirement: Progression returns explainable modality-aware recommendations

The progression engine SHALL be deterministic and pure. It SHALL support
linear load increments, double progression over a configured rep range,
timed-duration progression, and bodyweight repetition progression. It MUST use
explicit prior-session evidence, exclude skipped/incomplete/invalid work,
return a stable reason and human-readable explanation, and permit manual
override without confusing a recommendation with performed data.

#### Scenario: Double progression reaches the ceiling

- **WHEN** all required prior sets meet the configured rep ceiling
- **THEN** the next recommendation advances load by the configured increment and explains the reset toward the lower rep bound

#### Scenario: Skipped work holds progression

- **WHEN** any required prior set is skipped or has an unknown measurement
- **THEN** the recommendation holds with an incomplete-evidence reason and does not advance the target

#### Scenario: Timed and bodyweight progression

- **WHEN** a timed set reaches its target duration or an unloaded bodyweight set reaches its rep ceiling
- **THEN** the recommendation advances the corresponding duration or repetition target without treating body weight as external load

### Requirement: Strength PR calculations are truthful

The system SHALL cap estimated-1RM eligibility at 12 repetitions, exclude
timed/cardio/bodyweight-only sets from weighted 1RM calculations, and
distinguish at least estimated-1RM, load, rep-at-load, timed-duration, and
cardio-distance PRs. PR feedback SHALL be brief and non-blocking.

#### Scenario: High-repetition set is not an estimated-1RM PR

- **WHEN** a completed weighted set contains 13 or more repetitions
- **THEN** it may contribute to valid load/rep history but SHALL NOT create an estimated-1RM record

#### Scenario: Timed record classification

- **WHEN** a timed exercise exceeds its prior completed duration
- **THEN** history reports a timed-duration PR rather than a weighted 1RM PR

### Requirement: Exercise history provides meaningful trends

The system SHALL provide an exercise-level read model that can show performed
sessions, load/reps or duration trends, best eligible top set, estimated-1RM
trend where eligible, completed set count, and mathematically meaningful
volume. It MUST omit weight-times-reps volume for timed/cardio work and for
bodyweight work without additional load.

#### Scenario: Mixed-modality history

- **WHEN** an exercise has weighted, timed, and skipped historical sets
- **THEN** history shows each modality's own measurements, excludes skipped sets, and does not combine incompatible volume units

### Requirement: Workout planning states integrate with SuperHabits

The system SHALL expose planned, active/resumable, completed-today, and
rest/unplanned states to the existing Today/Overview surface and SHALL provide
a deterministic weekly-review workout summary such as scheduled versus
completed sessions. Missed plans MUST use neutral language and MUST NOT create
a punitive score.

#### Scenario: Planned workout today

- **WHEN** today's weekly plan assigns a routine and no session has started
- **THEN** Today identifies the planned workout and offers a direct start action

#### Scenario: Completed workout today

- **WHEN** a planned workout is completed today
- **THEN** Today shows the completed state and does not continue presenting it as an unstarted action

#### Scenario: Rest or unplanned day

- **WHEN** no workout is scheduled or the user selects a rest override
- **THEN** Today presents a neutral rest/unplanned state without a missed-workout warning

### Requirement: Workout-day reminders are optional and platform-safe

The system SHALL allow an opt-in workout-day reminder tied to the resolved
weekly/date schedule, reuse existing native permission conventions, avoid web
notification assumptions, and avoid duplicate scheduling for the same local
day. Turning the preference off SHALL prevent future workout reminders.

#### Scenario: Native scheduled reminder

- **WHEN** an Android or iOS user enables reminders and grants notification permission for a planned workout day
- **THEN** one local reminder is scheduled for that day using the existing notification infrastructure

#### Scenario: Web or denied permission fallback

- **WHEN** the user is on web or denies native notification permission
- **THEN** the schedule remains usable in-app and no unsupported notification error blocks workout use

### Requirement: Active sessions remain fast and recoverable

The system SHALL persist enough draft state to restore routine identity, start
time, active-time accounting, set cursor, values, disposition, effort, rest
deadline/skip state, modality inputs, unilateral intent, and superset position.
Resume SHALL exclude app-closed wall-clock time from active duration, SHALL NOT
resurrect skipped sets, and SHALL allow correction of the most recently entered
set before finishing.

#### Scenario: Resume after process death

- **WHEN** the app is killed after a set has entered weight/reps and before the workout finishes
- **THEN** the next launch restores those values and cursor state without counting the closed interval as active workout time

#### Scenario: Finish early

- **WHEN** the user finishes a session before reaching later planned sets
- **THEN** only explicitly completed or skipped sets are persisted and no unperformed work is fabricated
