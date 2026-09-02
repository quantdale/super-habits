# ui-ux-visual-coherence Specification

## Purpose

Define the Warm Momentum 2.1 visual-system contract: SuperHabits surfaces use
one coherent tokenized visual language built on the existing `core/ui`
primitives and `core/theme/designTokens.ts` semantic tokens, without changing
product behavior, information architecture, or persistence contracts.

## ADDED Requirements

### Requirement: Shared primitives use semantic design tokens

The shared UI primitives (`Screen`, `Card`, `Modal`, `PillChip`) and the shell
navigation rail SHALL use the semantic tokens from `core/theme/designTokens.ts`
(`spacing`, `radius`, `size`, `layout`) instead of ad hoc per-component numbers
where a token exists. This SHALL NOT create a parallel design system.

#### Scenario: Screen padding follows the spacing token

- **GIVEN** a `Screen` with default padding
- **WHEN** it renders on any platform or viewport
- **THEN** its horizontal padding is `spacing.lg` and its bottom padding is
  `spacing.xxl`, matching the semantic token rather than a hard-coded number

#### Scenario: Interactive controls keep a ~48dp touch target

- **GIVEN** any interactive control (button, chip, tab, quick-add submit)
- **WHEN** it is rendered
- **THEN** its minimum height or width is at least `size.touchTargetMin` (48)
  or the surrounding container satisfies the 48dp contract

#### Scenario: Cards use the tokenized default padding

- **GIVEN** a `Card` without an explicit `innerClassName`
- **WHEN** it renders
- **THEN** its body padding is `spacing.lg`, and accent tint/bar geometry is
  unchanged

### Requirement: Modal layout variant prop is unambiguous

The `Modal` component SHALL expose its layout variant through a prop named
`modalLayout` (values `dialog`, `bottom-sheet`, `drawer`) so it cannot shadow
the `layout` design-token import. Every call site SHALL use the renamed prop.

#### Scenario: Bottom-sheet and drawer call sites compile and render

- **GIVEN** the Quick Capture modal (`app/index.tsx`) and the Command Center
  modal (`features/command/CommandCenterProvider.tsx`)
- **WHEN** the app type-checks and bundles
- **THEN** all call sites pass `modalLayout` with the correct variant and no
  stale `layout` prop remains

### Requirement: Section accents remain accents, not surface paint

Feature accent colors SHALL be used for selection, progress, small emphasis,
and key icons. The page surface, typography, cards, and default controls SHALL
use the neutral semantic tokens so no section reads as a separate mini-brand.

#### Scenario: Today cards keep neutral surfaces with accent details

- **GIVEN** the Today/Overview dashboard with multiple section cards
- **WHEN** it renders in light or dark theme
- **THEN** card surfaces use the neutral surface tokens and section colors
  appear only as accents (icon tile, top bar, progress)

### Requirement: Visual polish preserves behavior and contracts

The campaign SHALL be presentation-only: no domain, data, sync, backup,
account, or migration changes. Existing product-facing labels, one global Add
action, and `Add → Describe it` as the advanced Command path SHALL remain.

#### Scenario: Behavior and labels are unchanged

- **GIVEN** the completed Warm Momentum 2.1 campaign
- **WHEN** the full QA gate set runs (typecheck, lint, vitest, theme contrast)
- **THEN** all gates pass and the six primary navigation labels (Today, To Do,
  Habits, Focus, Workout, Calories) are unchanged

#### Scenario: Theme contrast coverage is not reduced

- **GIVEN** the 14-theme registry
- **WHEN** `npm run validate:themes` runs
- **THEN** all 140 contrast checks pass, matching or exceeding the Warm
  Momentum 2.0 baseline
