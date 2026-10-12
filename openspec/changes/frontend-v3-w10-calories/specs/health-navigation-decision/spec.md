## Purpose

Records the D3 navigation validation gate from the parent Frontend V3 design:
how the five-destination phone model (Health parenting Workout + Calories)
is compared against the six-tab fallback, which model ships, and the
contracts both the shipped model and the retired parent surface must keep.

## ADDED Requirements

### Requirement: The navigation model is chosen by measured evidence

The shipped phone navigation model SHALL be the one that completes "start a
workout", "log a meal" and "view remaining calories" from equivalent starting
states with the fewer taps, at equal or better task-completion and
section-switch success. The comparison, the measured numbers, and the
decision SHALL be recorded as evidence with the change.

#### Scenario: Five-destination model adds a tap to common health flows

- **GIVEN** the five-destination model is measured for starting a workout and logging a meal
- **WHEN** each flow requires an intermediate "Open <section>" tap that the six-tab model does not
- **THEN** the six-tab fallback ships with the V3 visual restyle
- **AND** the measurement evidence for both models is recorded

#### Scenario: Six-tab model keeps shallow flows

- **GIVEN** the six-tab model is shipped
- **WHEN** the user activates the Workout destination and the Calories destination
- **THEN** each destination's primary logging action is reachable in one further tap
- **AND** switching between sections preserves active-session state (running timer, workout draft, form input)

### Requirement: Navigation labels stay an observability contract

Whatever model ships, the rail labels SHALL come from the single `NAV_ITEMS`
source of truth, SHALL NOT truncate, SHALL render at ≥11px, and every e2e
label map and inline tab click SHALL agree with them in the same commit
(`journey-label-parity`). Labels SHALL NOT change without updating the
parity-guarded consumers.

#### Scenario: Six destinations render without truncation

- **WHEN** the phone bar renders six destinations plus the capture slot at 360px
- **THEN** every label renders in full at ≥11px
- **AND** every destination keeps a touch target of at least 44pt
- **AND** the active destination shows a tonal capsule, not an outline ring

### Requirement: The Health parent surface keeps working when retired from the bar

When the six-tab model ships, `health` SHALL remain a valid section: deep
links, linked-action targets and command-center routing that select it SHALL
still render the Health surface, and that surface SHALL still route to Workout
and Calories. Navigation contexts, active-session state, and command routing
for every section SHALL be preserved by the model change.

#### Scenario: A command that targets Health still routes

- **WHEN** a command or deep link activates the `health` section
- **THEN** the Health surface renders and its Workout and Calories entries navigate to those sections
- **AND** no URL route is introduced for it
