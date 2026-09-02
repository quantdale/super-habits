# ui-ux-interaction-density-a11y Specification

## Purpose

Define the Warm Momentum 2.2 contract: shared segmented-selection
interaction, tablet/dense composition for Calories Diary and Workout
history, and screen-reader/keyboard/large-text accessibility order — all
presentation-layer only, preserving Warm Momentum 2.0/2.1 product
contracts and all domain/data/sync behavior.

## ADDED Requirements

### Requirement: Shared SegmentedControl primitive for exactly-one-of-N selection

The repository SHALL provide a shared `SegmentedControl` component
(`core/ui/SegmentedControl.tsx`) for mutually exclusive view/mode
selection with typed option values, visible labels, a selected state, a
disabled state, accessible role/state semantics, keyboard navigation on
web, a visible focus ring, touch targets of at least `size.touchTargetMin`
(48) except the documented `size.touchTargetMin - 4` compact chip rule,
theme-aware tokens, and deliberate wrap or horizontal-scroll behavior at
constrained widths. Filter chips (zero/one/many), status badges
(informational), and action chips (trigger an operation) SHALL NOT be
rendered with segmented-control semantics.

#### Scenario: A single-select group announces selection and moves by keyboard

- **GIVEN** a `SegmentedControl` with three options where the first is selected
- **WHEN** it renders on web and a keyboard user presses the Right arrow on the focused option
- **THEN** the second option becomes selected, the group announces the option name and selected state, and the visible focus ring remains on the active option

#### Scenario: Filter chips stay distinct from segmented selection

- **GIVEN** a surface with a status filter that allows more than one active filter
- **WHEN** the filter is rendered
- **THEN** it uses the filter-chip treatment (`PillChip`) with its own semantics and is not presented as a segmented single-select control

### Requirement: Planning Hub tabs use the shared control

The Planning Hub tab row (Today, Projects, Goals, Progress, Timeline)
SHALL use the shared segmented control with a clear selected state,
keyboard navigation, screen-reader selected semantics, and large-text
resilience (no label clipping, no horizontal overlap). The underlying
tab state model SHALL remain unchanged.

#### Scenario: Planning Hub tab switch with accessible selected state

- **GIVEN** the Planning Hub with the Today tab selected
- **WHEN** a user activates the Projects tab
- **THEN** the Projects tab renders with the selected visual state and `accessibilityState.selected`, the Today tab renders unselected, and the Planning Hub shows the Projects view

#### Scenario: Large-text Planning labels wrap instead of clipping

- **GIVEN** device large-text scaling active on a 360px viewport
- **WHEN** the Planning Hub renders
- **THEN** every tab label is fully visible (wrapped or scrolled deliberately), with no label clipped and no font-size reduction to make it fit

### Requirement: Habits selection controls are semantically clarified

Habits SHALL distinguish current filter, management action, date
selection, and habit state visually. A single-select status view SHALL
use the shared segmented treatment; multi-select filters, management
actions, the day strip, and status badges SHALL remain visually distinct
treatments.

#### Scenario: Habits status filter and management action look different

- **GIVEN** the Habits screen with a status selector and a sort/manage control
- **WHEN** the screen renders
- **THEN** the status selector and the management action use different visual treatments so a user can tell the current filter from a management action

### Requirement: Calories Diary dense and tablet composition

The Calories Diary SHALL present dense multi-meal days with compact,
readable rows (same touch accessibility, no information loss). At
tablet-plus widths (≥ ~600px) it SHALL compose a summary/context pane
beside the diary content pane with each control appearing exactly once,
and SHALL rebalance or collapse when one pane has no data. Form/Diary
state, selected date, meal grouping, calorie/macro calculations,
persistence, edit/delete, copy-day, and date-key behavior SHALL be
unchanged.

#### Scenario: Tablet diary shows summary beside content without duplicated controls

- **GIVEN** a tablet-width viewport with a heavy multi-meal diary day
- **WHEN** the Calories Diary renders
- **THEN** the daily summary/context pane and the diary content pane render side by side, the date navigation and view switch appear once, and all entries remain readable and actionable

#### Scenario: Empty diary day does not leave a dead pane

- **GIVEN** a tablet-width viewport with an empty diary day
- **WHEN** the Calories Diary renders
- **THEN** the layout rebalances (collapses the empty pane) instead of showing a large empty half

### Requirement: Workout surface keeps start/resume primary and composes history at tablet widths

The Workout surface SHALL lead with the active/start/resume job at every
viewport. At tablet-plus widths, history/analytics (recent sessions,
totals, progress, exercise history, PRs, charts) SHALL compose into
secondary panes or grids without moving analytics ahead of today's
workout and without altering Gym V2 persistence or progression
semantics.

#### Scenario: Workout tablet layout starts with today's job

- **GIVEN** a tablet-width viewport with an active or ready-to-start workout and a long history
- **WHEN** the Workout surface renders
- **THEN** the start/resume job appears before the history/analytics panes in visual and reading order

### Requirement: Screen-reader order matches product hierarchy

For touched surfaces, the UI tree order SHALL match the visible/product
hierarchy (shell Today → To Do → Habits → Focus → Workout → Calories;
primary action before history; timer and primary controls before
statistics; start/resume before analysis; logging/current diary before
tertiary analytics; Add title/field/primary capture/disclosure/Describe
it/close). Fixes SHALL use tree order only, with no invisible
accessibility-only duplicates.

#### Scenario: Focus surface reads timer before statistics

- **GIVEN** the Focus (Pomodoro) surface with an active timer and historical statistics
- **WHEN** a screen-reader user traverses the surface
- **THEN** the timer and primary controls are announced before historical statistics

### Requirement: Keyboard traversal is verified on web

On web, touched surfaces SHALL support Tab and Shift+Tab traversal,
Enter/Space activation, arrow keys for segmented controls, visible focus
indicators, sensible modal focus, and reachable close controls.

#### Scenario: Keyboard user reaches and activates the global Add

- **GIVEN** the app shell on web
- **WHEN** a keyboard user presses Tab repeatedly from the top
- **THEN** focus reaches the global Add control with a visible focus ring, and pressing Enter activates it

### Requirement: Large text never clips important controls

Segmented labels, navigation, Habits statuses, Planning Hub tabs,
Calories view selector, and Workout modes/filters SHALL remain fully
visible under large-text scaling using deliberate wrap, horizontal
scroll, or responsive composition — never font-size reduction to fit.

#### Scenario: Large-text view selector remains readable

- **GIVEN** device large-text scaling active
- **WHEN** the Calories Form/Diary view selector renders
- **THEN** both option labels are fully visible and selectable with no clipping

### Requirement: No domain, data, sync, or persistence regression

The campaign SHALL be presentation-layer-only: no domain, data, sync,
backup, account, or migration changes. Existing product-facing labels,
one global Add, `Add → Describe it`, and the six primary navigation
labels SHALL remain. The final gate set (typecheck, lint, vitest,
`openspec:validate`, `qa:impact:validate`, `validate:themes`, web build,
`web:verify`, applicable Playwright suites) SHALL pass.

#### Scenario: Post-campaign gates stay green

- **GIVEN** the completed Warm Momentum 2.2 campaign
- **WHEN** the full QA gate set runs
- **THEN** all gates pass and the six primary navigation labels (Today, To Do, Habits, Focus, Workout, Calories) are unchanged

#### Scenario: Tablet composition avoids duplicate expensive reads

- **GIVEN** a tablet-width viewport on Calories Diary or Workout history
- **WHEN** the surface renders with data
- **THEN** each SQLite-backed list/read model is loaded once and off-screen panes do not perform eager heavy work
