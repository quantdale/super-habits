# Proposal: Warm Momentum 2.3 — Data-Entry Ergonomics, Shared Input Primitives, and Modal-State Determinism

**Status:** Proposed
**Author:** Verboo Code
**Date:** 2026-09-02

## Why

Warm Momentum 2.1 normalized the visual system; 2.2 normalized exactly-one
selection, tablet density, and accessibility order. The remaining friction
lives in **the moment the user enters data**:

- numeric parsing is duplicated per-surface (`replace(/[^0-9.]/g, '')`
  variants in Workout session, RoutineExerciseCard, Quick Capture) with
  inconsistent blank/zero/decimal rules;
- text inputs mix the shared `TextField` with bespoke `TextInput` blocks
  (Workout session, RoutineExerciseCard, Quick Capture, Todo quick add);
- submit ownership is uneven: Todos has a double-submit guard
  (`createSubmitGuard`), Workout and Quick Capture have ad-hoc `isSaving` /
  `submitting` state, and Calories has **no guard at all** (double-tap on
  "Add entry" creates duplicate rows);
- validation surfaces are inconsistent: inline `ValidationError` in some
  forms, `Alert.alert` in others, generic error strings elsewhere;
- modal transitions have a non-deterministic window: the quick-capture →
  command modal transition mounts both layers for one tick, and the Phase A
  P0 flake reproduced the exact user-visible consequence (a forced tap
  landing on a not-yet-enabled primary action during that window).

The campaign consolidates input behavior into shared primitives, makes
submit/loading/disabled deterministic everywhere, and formalizes the modal
transition contract. It is presentation-layer only — no domain, data, sync,
or Gym V2 semantic changes.

## What Changes

### 1. Shared numeric-input model (`lib/numericInput.ts` + `core/ui`)

One pure parsing/canonicalization module for every numeric entry field:

- `parseNumericInput(raw)`: blank → null (distinct from 0), decimal-aware,
  partial states (`"12."`, `"."`) preserved while typing, no mid-typing
  coercion, no cursor jumps;
- submit-time canonicalization (`canonicalizeNumericValue`) with explicit
  blank/zero/min/max semantics per field;
- adopted by Workout session set entry (weight/distance/pace), progression
  fields, Calories macros, habit target, focus duration, body weight.

### 2. Generalized submit guard (`lib/submitGuard.ts`)

`createSubmitGuard()` moves from `features/todos/todos.domain.ts` to
`lib/` and is adopted by every async create/edit flow: Calories
entry/edit, Quick Capture (replacing the bespoke `submitting` state),
Habits save, Workout save/finish, Command confirm. Disabled + loading
submit buttons reflect the guard state.

### 3. TextField completion (`core/ui/TextField.tsx`)

The existing shared TextField gains the missing ergonomic contract:
`error` state styling, `helperText`, `multiline`, numeric keyboard
propagation, accessible helper/error association — so surfaces stop
wrapping bespoke `TextInput` blocks.

### 4. Modal transition contract (`core/ui/Modal.tsx` + overlay hosts)

Formalize the transition model (CLOSED/OPENING/OPEN/CLOSING-equivalent)
that already implicitly exists: during the closing phase the outgoing
modal is non-interactive (pointer-events disabled), the incoming modal
mounts only after the outgoing layer reports closed, and focus/Escape
ownership follows the single interactive layer. One deterministic answer
to "which modal is currently interactive".

### 5. Entry-surface application

Quick Capture, Todo quick add/editor, Habit editor, Calories entry/edit,
Workout set logging adopt the shared pieces above. Focus lands in the
primary field on open; Enter submits quick-add paths once; repeated
entries stay fast; numeric keyboards are requested on mobile.

## Out of Scope

- No navigation/route changes, no new global launcher, no domain or sync
  changes, no Gym V2 semantic changes, no theme-catalog changes, no
  broad state-management rewrite, no new AI features.

## Capabilities

### New: `ui-ux-data-entry-determinism`

- Shared numeric-input parsing/canonicalization contract.
- Shared submit-guard contract (single owner per form, duplicate-tap
  prevention, loading/disabled reflection).
- TextField error/helper/multiline/keyboard contract.
- Modal transition determinism contract (one interactive layer,
  non-interactive closing layer, focus ownership).
- Per-surface entry ergonomics (Quick Capture, Todos, Habits, Calories,
  Workout) built on the shared pieces.

## Impact

- `core/ui/TextField.tsx`, `core/ui/Modal.tsx`, `lib/` (new
  `numericInput.ts`, `submitGuard.ts`), `features/todos/todos.domain.ts`
  (re-export removal after adoption), Quick Capture, Todos, Habits,
  Calories, Workout entry components.
- Tests: new Vitest suites for numeric parsing, submit guard, TextField
  states; E2E coverage for double-submit prevention and the
  quick-capture → command transition determinism.
- Docs: `docs/ui-ux/10-warm-momentum-2-3.md` + visual evidence manifest.
