## Purpose

Defines the whole-app rendered-integrity contract for Frontend V3 W14: which
surface/state combinations are covered, how defects are classified, and what
convergence means. Existing behavioural capabilities keep their contracts; W14
changes presentation defects only.

## ADDED Requirements

### Requirement: Every primary destination is inspected in both themes

Each of the six primary destinations (Today, To Do, Habits, Focus, Workout,
Calories) SHALL be rendered and visually inspected on the integrated source at
a phone viewport in both light and dark themes, and at a wide viewport.

#### Scenario: Primary destinations are covered

- **WHEN** the W14 matrix is executed
- **THEN** every primary destination has at least one inspected capture in light and one in dark at a phone width
- **AND** at least one wide-viewport capture exists per destination
- **AND** any destination without a capture is recorded as not-run rather than assumed correct

### Requirement: Secondary surfaces are inspected

The W12 and W13 surfaces (Planning Hub views, Weekly Review, Progress,
Activity, Settings, Command Center, Achievements) and Quick Capture SHALL be
rendered and inspected on the integrated source.

#### Scenario: W12 and W13 surfaces are present in one build

- **WHEN** the integrated build is rendered
- **THEN** the W12 narrative-first review, Progress disclosure and Activity filter control are present
- **AND** the W13 grouped Settings rows, input-first Command Center and milestone-first Achievements are present
- **AND** the same build satisfies both waves' assertions

### Requirement: Defects carry a reproducible, severity-classified record

Every defect found in the sweep SHALL be recorded with an identifier, surface,
category, severity class, source SHA, viewport/theme/state, an exact
reproduction, a screenshot or trace reference, root cause, owner, fix and
verification status.

#### Scenario: Verified-fixed requires rendered confirmation

- **GIVEN** a recorded defect
- **WHEN** it is marked verified-fixed
- **THEN** a post-fix rendered capture exists for the same surface and state
- **AND** where the defect involved behaviour, an executable regression fails before the fix and passes after

### Requirement: No untriaged P0 or P1 defect remains at wave exit

The wave SHALL NOT conclude with an untriaged P0 or P1 defect. A genuine
external blocker SHALL be recorded explicitly with a concrete recovery path.

#### Scenario: A blocked P1 is explicit

- **GIVEN** a P1 defect that cannot be fixed in this wave
- **WHEN** the wave concludes
- **THEN** the defect names the blocker, the required condition and the exact resume action
- **AND** it is not reported as fixed

### Requirement: Error, offline, heavy and large-text states are covered

The sweep SHALL exercise at least one genuine error state, one offline or
rejected-write state, one HEAVY data set and one large-text state, and SHALL
record what could not be staged.

#### Scenario: States are distinguishable

- **WHEN** an empty result, a filtered-empty result and a load error are rendered for the same surface
- **THEN** each presents distinct, truthful copy
- **AND** no state renders a success or completion claim it did not earn
