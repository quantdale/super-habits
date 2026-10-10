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
the timer and primary start action before any history. The Workout landing
SHALL announce the training state and quick-start actions before routine
management and the History & insights disclosure, and the live session SHALL
announce the session progress, current exercise, and set-entry controls
before any rest or summary content.

#### Scenario: Focus surface reads timer before statistics

- **GIVEN** the Focus surface with a running or paused timer
- **WHEN** a screen-reader user traverses the surface
- **THEN** the countdown and primary session controls are present
- **AND** historical statistics are not in the traversal

#### Scenario: Idle Focus reads the timer before history

- **GIVEN** the idle Focus surface with historical statistics available
- **WHEN** a screen-reader user traverses the surface
- **THEN** the timer and primary start action are announced before historical statistics

#### Scenario: Workout landing reads quick start before analytics

- **GIVEN** the Workout landing with routines, a weekly strip, and history available
- **WHEN** a screen-reader user traverses the surface
- **THEN** the training state, resume/start action, and quick-start rows are announced before routine management and history content

#### Scenario: Live workout reads the actionable set first

- **GIVEN** an active workout session
- **WHEN** a screen-reader user traverses the surface
- **THEN** the routine, set progress, current exercise, and the current set's inputs and done control are announced before rest or upcoming-set context

### Requirement: Large text never clips important controls

Segmented labels, navigation, Habits statuses, Planning Hub tabs,
Calories view selector, Workout modes/filters, and Focus pause, resume,
and end actions SHALL remain fully visible under large-text scaling and
at a 360px-wide layout using deliberate wrap, horizontal scroll, or
responsive composition — never font-size reduction to fit. Workout
quick-start rows, weekly strip assignments, set-table inputs and done
controls, the rest dock, and the finish summary action SHALL also remain
fully visible and operable at 360px under large-text scaling.

#### Scenario: Large-text view selector remains readable

- **GIVEN** device large-text scaling active
- **WHEN** the Calories Form/Diary view selector renders
- **THEN** both option labels are fully visible and selectable with no clipping

#### Scenario: Focus end action does not clip

- **GIVEN** a 360px-wide viewport, including under large-text scaling
- **WHEN** a running or paused Focus session shows its end action beside pause or resume
- **THEN** the end label is fully visible
- **AND** the control remains at least 44pt in its hit target

#### Scenario: Workout set rows wrap instead of clipping

- **GIVEN** a 360px-wide viewport under large-text scaling
- **WHEN** the live workout session renders its set table and rest dock
- **THEN** set inputs, done controls, skip, and the rest readout remain fully visible and operable with no clipping
- **AND** hit targets remain at least 44pt
