## Purpose

Defines the observable visual/UX contract introduced by the Frontend V3 "Calm
Momentum" reconstruction: canvas/surface hierarchy, typography scale, action
hierarchy, navigation model, overlay anatomy, state grammar, and the persistent
visual-regression guard that pins composition-critical surfaces.

## ADDED Requirements

### Requirement: Calm canvas with a bounded surface ladder

The app canvas SHALL be neutral (no page-level tint). Every grouping SHALL use
one of the semantic surfaces (surface, sunken, raised, inset, hero) where
`hero` — a section-tinted emphasis surface — appears at most once per screen,
and no card SHALL render a saturated colored header band.

#### Scenario: A populated screen renders without slab headers

- **GIVEN** any primary section with seeded data
- **WHEN** the screen renders
- **THEN** no card on it renders a full-width saturated header band, and at most one surface uses the section hero treatment

#### Scenario: Dark-theme hero contrast

- **GIVEN** any theme in dark appearance
- **WHEN** a hero surface renders
- **THEN** hero fill is a dark accent with light ink and text contrast is ≥ 4.5:1

### Requirement: Compact typography scale

Screen titles SHALL render at ≤ 22px weight ≤ 700; body text SHALL use 400–500
weights; 800–900 weights SHALL appear only on `display`/`metric` roles;
screens SHALL NOT carry explanatory subtitles that restate implementation
detail.

#### Scenario: Screen header height is bounded

- **WHEN** any primary section renders on a 390×844 viewport
- **THEN** its first content-carrying element begins within the first ~200 device-independent pixels below the safe area

### Requirement: Four-level action hierarchy

Interactive actions SHALL use the semantic levels primary (≤1 per view,
solid accent), secondary (tonal), tertiary (text), and celebrate (reserved
tactile treatment for gamification moments). The default button SHALL NOT use
a 3D lip or gradient face; celebrate MAY.

#### Scenario: A view exposes exactly one primary action

- **WHEN** any screen or overlay renders its action set
- **THEN** at most one control uses the primary treatment

### Requirement: Capture affordance without content collision

The quick-capture entry SHALL be an explicit affordance (phone nav-bar capture
slot or wide-layout header action) and SHALL NOT float over interactive
content; forms SHALL NOT be overlapped by a floating action button.

#### Scenario: Calorie form entry

- **WHEN** the calorie add form renders on a 390-wide viewport
- **THEN** no floating button overlaps any input field

### Requirement: Five-destination phone navigation (validated)

Phone navigation SHALL expose five primary destinations (Today, To Do,
Habits, Focus, Health) plus the capture slot, where Health parents Workout and
Calories — OR, if the W10 validation gate rejects the model on tap-depth or
task-switch evidence, the six-tab model with V3 styling. Either way: labels
SHALL NOT truncate, active state SHALL be a tonal capsule (no outline ring),
and section-switch observability labels SHALL stay consistent with the
journey-label-parity contract.

#### Scenario: Health flows stay shallow

- **WHEN** the adopted model is the five-destination navigation
- **THEN** starting a workout, logging a meal, and viewing calories-remaining each complete within one tap of the Health surface

### Requirement: Overlay anatomy is standardized

Every overlay (dialog, drawer, bottom sheet) SHALL present: scrim, close
treatment, title row, padded body, and keyboard/safe-area handling; bottom
sheets SHALL show a drag handle; each overlay SHALL expose at most one primary
action.

#### Scenario: Quick-capture sheet

- **WHEN** quick capture opens
- **THEN** it renders as a bottom sheet with handle, focused input, single primary save action, and no stacked duplicate exit buttons

### Requirement: State grammar

Empty states SHALL be one sentence plus at most one action; loading SHALL
preserve layout geometry; errors SHALL name the failure and one recovery
action; success SHALL acknowledge inline without blocking; celebration SHALL
appear only on milestone events.

#### Scenario: Empty todos

- **WHEN** the To Do section renders with zero todos
- **THEN** exactly one explanatory line and one create action render

### Requirement: Persistent curated visual regression baselines

Composition-critical surfaces (app shell, navigation, Today, To Do, Habits,
Focus, Workout session, Calories, Settings, Quick Capture, dark mode, one
tablet and one desktop width) SHALL have Playwright `toHaveScreenshot`
baselines that run in the standard E2E battery, with deterministic rendering;
thresholds SHALL NOT be loosened to pass a changed UI.

#### Scenario: An unintended layout shift

- **WHEN** a change alters the composition of a baselined surface without an intentional redesign
- **THEN** the visual regression spec fails and the change is either corrected or the baseline is deliberately updated with a ledger note
