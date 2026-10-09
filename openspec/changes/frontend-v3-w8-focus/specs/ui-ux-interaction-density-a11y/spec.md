## MODIFIED Requirements

### Requirement: Screen-reader order matches product hierarchy

For touched surfaces, the UI tree order SHALL match the visible/product
hierarchy (shell Today → To Do → Habits → Focus → Workout → Calories;
primary action before history; timer and primary controls before
statistics; start/resume before analysis; logging/current diary before
tertiary analytics; Add title/field/primary capture/disclosure/Describe
it/close). Fixes SHALL use tree order only, with no invisible
accessibility-only duplicates. An active Focus countdown SHALL NOT include
historical statistics in that traversal. Idle Focus SHALL still announce
the timer and primary start action before any history.

#### Scenario: Focus surface reads timer before statistics

- **GIVEN** the Focus surface with a running or paused timer
- **WHEN** a screen-reader user traverses the surface
- **THEN** the countdown and primary session controls are present
- **AND** historical statistics are not in the traversal

#### Scenario: Idle Focus reads the timer before history

- **GIVEN** the idle Focus surface with historical statistics available
- **WHEN** a screen-reader user traverses the surface
- **THEN** the timer and primary start action are announced before historical statistics

### Requirement: Large text never clips important controls

Segmented labels, navigation, Habits statuses, Planning Hub tabs,
Calories view selector, Workout modes/filters, and Focus pause, resume,
and end actions SHALL remain fully visible under large-text scaling and
at a 360px-wide layout using deliberate wrap, horizontal scroll, or
responsive composition — never font-size reduction to fit.

#### Scenario: Large-text view selector remains readable

- **GIVEN** device large-text scaling active
- **WHEN** the Calories Form/Diary view selector renders
- **THEN** both option labels are fully visible and selectable with no clipping

#### Scenario: Focus end action does not clip

- **GIVEN** a 360px-wide viewport, including under large-text scaling
- **WHEN** a running or paused Focus session shows its end action beside pause or resume
- **THEN** the end label is fully visible
- **AND** the control remains at least 44pt in its hit target

## ADDED Requirements

### Requirement: Focus identity is not documentation copy

The Focus section SHALL expose an accessible timer region that remains available in idle, running, paused, break, completed, and interrupted states. The section SHALL NOT use the documentation sentence "Classic sequence: focus → short breaks → long break — durations saved on device." as its identity or as a subtitle. The six primary navigation labels SHALL remain Today, To Do, Habits, Focus, Workout, and Calories.

#### Scenario: Documentation subtitle is absent

- **WHEN** the Focus section is shown in any timer state
- **THEN** the documentation sentence "Classic sequence: focus → short breaks → long break — durations saved on device." is not displayed
- **AND** the accessible timer region is present
