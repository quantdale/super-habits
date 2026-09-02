# Proposal: Warm Momentum 2.2 — Shared Interaction Primitives, Tablet Density, and Accessibility Order

**Status:** Proposed
**Author:** Verboo Code
**Date:** 2026-09-02

## Why

Warm Momentum 2.1 normalized the visual system (tokens, primitives, radius,
spacing, modal contract). Interaction consistency and information density
remain the product's next friction source. The 2.1 friction matrix explicitly
deferred:

- a shared `SegmentedControl` primitive (Planning Hub tab pills and Habits
  chips currently share tokens but live as separate implementations);
- tablet multi-column layouts for dense Calories Diary and Workout history;
- deeper composition passes for those two surfaces;
- a screen-reader/focus-order re-audit after tokenization.

On tablet widths, dense surfaces still render as stretched single columns,
and several controls implement "exactly-one selection" with bespoke repeated
`Pressable` rows rather than one shared semantic control.

## What Changes

### 1. Shared `SegmentedControl` primitive

A single `core/ui/SegmentedControl.tsx` for **exactly-one-of-N** view/mode
selection: typed option values, visible labels, selected/disabled states,
`accessibilityRole`/`accessibilityState.selected`, keyboard arrow
navigation + visible focus ring on web, ≥48dp touch targets, theme tokens,
and deliberate wrapping/scroll at constrained widths. Distinct semantics
stay distinct: filter chips (`PillChip`, zero/one/many), status badges
(informational), and action chips (trigger) are NOT converted into
segmented controls.

### 2. Planning Hub migration

Planning Hub tabs (Today, Projects, Goals, Progress, Timeline) migrate onto
the shared control with clear selected state, keyboard navigation,
screen-reader selected semantics, and large-text resilience. The
navigation/state model is unchanged.

### 3. Habits control clarification

Habits status selection (Active / Paused / Archived / All) is audited and
converted only where semantics are genuinely single-select; sort/manage
actions, day-strip date selection, and status badges stay visually
distinct. Users can always tell "current filter", "management action",
"date selection", and "habit state" apart.

### 4. Calories Diary dense / tablet composition

Dense multi-meal days, long food names, and macro metadata read better:
on tablet+ widths the diary gains a summary/context pane beside the diary
content pane, without duplicating controls or changing Form/Diary state,
date-key behavior, meal grouping, edit/delete, or persistence.

### 5. Workout history / progress dense / tablet composition

The surface still leads with today's start/resume job. On tablet+ widths,
history/analytics (recent sessions, totals, progress, exercise history,
PRs, charts) compose into secondary panes/grids without changing Gym V2
persistence or progression semantics.

### 6. Screen-reader order + keyboard re-audit

Re-audit the touched surfaces so UI tree order matches product hierarchy
(Today → To Do → Habits → Focus → Workout → Calories; primary action before
history; timer before statistics; start/resume before analysis; logging
before tertiary analytics), with working Tab/Shift+Tab/Enter/Space/arrow
traversal and visible focus.

### 7. Density composition without a new settings feature

Compact/comfortable spacing is an internal composition discipline on
touched surfaces — less vertical whitespace, same readability, same touch
accessibility, no information loss. No user-facing density setting.

## Impact

- **User Experience:** Consistent selection interactions, tablet layouts
  that no longer feel like stretched phones, and a screen-reader/keyboard
  order that matches visual hierarchy.
- **Engineering:** One shared segmented primitive replaces repeated bespoke
  implementations; responsive composition stays single-tree (no duplicated
  data reads).
- **Risk:** Presentation-layer-only changes; domain/data/sync/persistence
  contracts are untouched and the full QA gate set protects them.
