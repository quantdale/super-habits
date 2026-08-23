# gym-training-system Specification

## Purpose

Make the existing Workout section a capable offline-first gym/training system
for strength, bodyweight, timed, and basic cardio work without invalidating
legacy routine or session history.

## ADDED Requirements

### Requirement: Stable exercise identity and legacy compatibility

The system SHALL provide built-in exercise identities with modality, body-area,
equipment, and optional unilateral metadata, plus user-created custom
exercises. Routine configuration SHALL be able to reference a built-in or
custom identity while retaining an immutable display-name snapshot. Existing
free-text routine and historical rows with no identity SHALL remain usable as
legacy exercises and SHALL NOT be fuzzy-remapped.

#### Scenario: User selects a built-in exercise

- **GIVEN** the exercise picker is open
- **WHEN** the user searches for Bench Press and selects the built-in result
- **THEN** the routine stores its stable identity and weighted-strength modality
- **AND** the routine still stores the selected display name for compatibility

#### Scenario: User creates a custom exercise

- **GIVEN** no suitable catalog result exists
- **WHEN** the user creates a custom Push Press exercise with metadata
- **THEN** it appears in future picker searches and can be added to routines
- **AND** it is included in account ownership and backup boundaries

#### Scenario: Legacy names remain readable

- **GIVEN** a legacy routine or historical session contains only a free-text name
- **WHEN** the catalog or custom exercise list changes
- **THEN** the row remains loadable and its original name is shown
- **AND** no guessed identity is written into historical evidence

### Requirement: Type-aware routine construction

The system SHALL let a user search/filter exercises by name, body area,
equipment, and modality; reorder routine exercises; configure realistic
prescriptions; add routine-specific notes; and optionally assign a simple
superset group. Weighted/bodyweight prescriptions SHALL support sets, rep
ranges, optional load, and rest. Timed prescriptions SHALL support duration,
optional load, and rest. Cardio prescriptions SHALL support duration and
optional distance/pace. Existing active/rest timing fields SHALL continue to
work for legacy routines.

#### Scenario: Routine has mixed modalities

- **GIVEN** a routine contains a weighted bench press, bodyweight push-up,
  timed plank, and cardio row
- **WHEN** the user saves the routine
- **THEN** each exercise keeps its modality-specific prescription
- **AND** the routine can be started without coercing cardio or timed work into
  weight-times-reps volume

#### Scenario: Reordering is persisted

- **GIVEN** a routine has three exercises
- **WHEN** the user drags the third exercise before the first and reloads
- **THEN** the stored order and guided sequence use the new order atomically

### Requirement: Weekly plan and date overrides

The system SHALL support a local-calendar weekly plan with explicit workout or
rest entries for weekdays. It SHALL resolve today's scheduled routine, preserve
the recurring template across restart, and support bounded date-specific
overrides for changing today's routine, marking rest, rescheduling, or moving a
missed routine without mutating the weekly template.

#### Scenario: Today resolves the weekly template

- **GIVEN** Monday is assigned to Push and Tuesday is explicit rest
- **WHEN** the user opens Workout on Monday or Tuesday
- **THEN** Today shows Push with a start action on Monday
- **AND** Today shows a rest-day state on Tuesday

#### Scenario: A date override does not rewrite the week

- **GIVEN** Thursday normally maps to Legs
- **WHEN** the user changes this Thursday to Pull
- **THEN** this Thursday resolves to Pull
- **AND** the recurring Thursday entry remains Legs for future weeks

### Requirement: Modality-aware guided sessions and durable recovery

The guided session SHALL show exercise, set, target, previous performance, and
current inputs. Strength sets SHALL accept weight/reps; bodyweight sets SHALL
accept reps with optional additional load and SHALL not fabricate bodyweight
volume; timed sets SHALL time and store actual duration; cardio SHALL accept
time with optional distance/pace. Optional RIR or RPE SHALL be stored with its
scale. Rest defaults and skip semantics SHALL remain useful. The active draft
SHALL persist cursor, measurements, dispositions, effort, modality inputs, and
timer/elapsed state and normalize older draft shapes safely.

#### Scenario: Previous performance explains the target

- **GIVEN** the previous Bench Press set was 80 kg for 8 reps and today's
  prescription is 6–10 reps
- **WHEN** the set opens
- **THEN** the UI shows the previous result and today's target separately
- **AND** any progression recommendation includes a reason

#### Scenario: Interrupted session resumes

- **GIVEN** a guided session has entered a cardio distance and an RPE value
- **WHEN** the app reloads before completion
- **THEN** the same exercise/set, inputs, effort, disposition, and elapsed state
  are restored

### Requirement: Deterministic progression and records

The domain SHALL provide manual/none, linear, and double-progression modes. A
successful qualifying completion MAY advance a recommendation; incomplete,
skipped, or unknown work SHALL hold it. Each result SHALL include a reason code
and human-readable explanation. Progression SHALL be deterministic, use
immutable history, and never silently modify a routine. PRs SHALL include
guarded estimated 1RM and heaviest successful set for eligible strength work;
timed/cardio/bodyweight-without-load work SHALL not receive deceptive 1RM or
load volume.

#### Scenario: Linear progression explains a successful increase

- **GIVEN** a linear exercise completes all prescribed work and has a 2.5 kg
  increment
- **WHEN** the next recommendation is calculated
- **THEN** the proposed load is increased by exactly 2.5 kg
- **AND** the explanation states that prescribed work was completed

#### Scenario: Double progression holds on an incomplete set

- **GIVEN** one set in a double-progression range is skipped
- **WHEN** progression is calculated
- **THEN** the recommendation does not advance
- **AND** the explanation identifies skipped/incomplete work as the reason

### Requirement: Body weight and progress intelligence

The system SHALL provide durable body-weight entry, edit, delete, local date/
time, entered unit, note, current value, trend, optional goal, and recent
history. It SHALL provide exercise history/trends, personal records, weekly
training totals, and a basic body-area distribution derived from exercise
metadata. Unit changes SHALL convert only for display and SHALL not rewrite
stored measurements.

#### Scenario: Weight history keeps entered units

- **GIVEN** the user records 80 kg and later changes the display preference to
  pounds
- **WHEN** history and trend are opened
- **THEN** the original entry remains stored as kg
- **AND** the displayed conversion is deterministic and reversible

#### Scenario: Progress excludes invalid modality metrics

- **GIVEN** a session contains timed plank, cardio row, and weighted squat work
- **WHEN** progress is calculated
- **THEN** only the weighted squat contributes to estimated 1RM
- **AND** time/distance remain available in their appropriate summaries

### Requirement: Ownership-safe recovery and portable round trip

All new authoritative Gym rows and recoverable Gym preferences SHALL participate
in local owner binding, emptiness inspection, durable outbox/sync, Backup
Completeness / Restore V2, and Portable Backup. Restore SHALL require an empty
device, validate exact scope, row shape, references, and checksums before one
transaction, preserve historical snapshots, and never replay workout side
effects. Existing scope-5 manifests/files SHALL remain restorable.

#### Scenario: Scope-6 round trip preserves training meaning

- **GIVEN** a dataset contains custom exercises, a weekly plan, an override,
  body-weight history, mixed-modality routine rows, and session sets
- **WHEN** it is exported and imported onto an empty device
- **THEN** the plan, custom identity, body-weight history, modality data, PRs,
  and progression facts remain equivalent
- **AND** no linked action or notification side effect is replayed

#### Scenario: Invalid references are rejected before writes

- **GIVEN** a portable or cloud backup override references a nonexistent
  routine
- **WHEN** validation runs
- **THEN** import is rejected with diagnostics
- **AND** the local database remains unchanged

### Requirement: Workout accessibility and platform honesty

The Workout UI SHALL use large primary controls, numeric inputs, semantic labels,
keyboard-safe layouts, visible focus, minimum touch targets, readable timer
states, and text equivalents for color/status cues. Native rest-complete and
workout-day notifications and screen wake behavior SHALL be opt-in/best-effort
where platform support exists. Web SHALL use honest in-app fallbacks and SHALL
not claim native delivery or wake behavior.

#### Scenario: Rest notification respects platform

- **GIVEN** a native guided session enters rest and the app backgrounds
- **WHEN** the configured rest interval completes
- **THEN** an opt-in native notification may be delivered once
- **AND** on web the app presents an in-app fallback without pretending a native
  notification was scheduled
