# ExecPlan: Warm Momentum 2.3 — Data-Entry Ergonomics, Shared Input Primitives, Modal-State Determinism

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Entering a Todo, Habit, calorie item, or workout set becomes immediate and
predictable: one numeric parsing model, one submit-guard model (no
double-writes), a completed shared TextField (label/helper/error/keyboard),
and a modal transition contract where exactly one layer is ever
interactive. Presentation-layer only — no domain/data/sync/Gym V2 changes.

## Context

- Predecessors: WM2.0/2.1/2.2 complete; Phase A of this campaign closed the
  last P0 journey flake (`e2e/helpers/commandObservation.ts` semantic-state
  sync; 3 consecutive 25/25 P0 passes) — the flake was a forced click
  landing on a still-disabled primary action during the quick-capture →
  command modal transition window (probe: 3/12 reproduction, 0/12 after).
- Baseline: `main` @ Phase A commit (9719587), ports 8081/8082 free.
- Existing primitives: `core/ui/TextField.tsx` (label/value/placeholder/
  nativeID/unsignedInteger), `NumberStepperField`, `ValidationError`,
  `Modal` (RNModal fade), `Button` (disabled/loading).
- Guard landscape: `createSubmitGuard()` feature-local in
  `features/todos/todos.domain.ts` (TodosScreen only); Workout ad-hoc
  `isSaving`; Quick Capture ad-hoc `submitting`; Calories **unguarded**.
- Numeric parsing landscape: `replace(/[^0-9.]/g, '')` (weight/distance/
  pace/progression increment), `replace(/\D/g, '')` (progression reps),
  `unsignedInteger` prop (macros), `Number(x) || 0` submit coercions.

## Scope

- New `lib/numericInput.ts`, `lib/submitGuard.ts` (+ tests).
- `core/ui/TextField.tsx` contract completion (+ pure a11y model + tests).
- `core/ui/Modal.tsx` closing-phase non-interactivity.
- Adoption: Calories entry/edit, Quick Capture, Habits editor, Workout
  session + RoutineDetail/RoutineExerciseCard, Todos (re-point guard).
- Focused E2E (`e2e/determinism.spec.ts`); docs
  `docs/ui-ux/10-warm-momentum-2-3.md`.

## Non-Goals

- No navigation/route changes, no new global launcher, no domain or sync
  changes, no Gym V2 semantic changes, no theme-catalog changes, no broad
  state-management rewrite, no new AI features, no global modal
  coordinator, no form-state-management library, no locale separator
  localization, no native iOS certification (Windows environment).

## Current Checkpoint

- Current milestone: Campaign closed — all gates green (full Chromium
  116 passed / 0 failed; 3 consecutive P0 25/25; web:verify exit 0;
  hygiene PASS 8081/8082 free).
- Completed: Phase A pushed (9719587); OpenSpec artifacts validated 48/48;
  `lib/numericInput.ts` + 17 unit tests; `lib/submitGuard.ts` moved from
  todos.domain + 3 tests; TextField contract (error/helperText/multiline/
  keyboard pass-through/disabled) + `core/ui/textFieldA11y.ts` pure model
  - 5 tests; Modal closing-phase contract (pointerEvents none +
    accessibilityElementsHidden + importantForAccessibility while closing);
    adoption: Calories (guard+numeric+loading), Quick Capture (guard+numeric),
    Habits (guard+numeric+loading), Workout session (decimal sanitize),
    RoutineDetail+RoutineExerciseCard (submit parse), WorkoutScreen body
    weight (decimal sanitize), Todos re-pointed to shared guard; determinism
    E2E (double-submit + modal swap) 3× green; three pre-existing E2E
    failures fixed (boundary Task-11 anchor → Task-1; workout chip 44 →
    documented 40 compact rule; P2 journey 'Overview' → 'Today' label,
    journey now 7/7, maxSwitch 704ms); docs 10-warm-momentum-2-3.md written.
- In progress: none — closing.
- Modified files: lib/numericInput.ts, lib/submitGuard.ts,
  core/ui/TextField.tsx, core/ui/textFieldA11y.ts, core/ui/Modal.tsx,
  features/calories/CaloriesScreen.tsx,
  features/quick-capture/QuickCaptureOverlay.tsx,
  features/habits/HabitsScreen.tsx, features/workout/WorkoutSessionScreen.tsx,
  features/workout/RoutineDetailScreen.tsx,
  features/workout/RoutineExerciseCard.tsx, features/workout/WorkoutScreen.tsx,
  features/todos/TodosScreen.tsx, features/todos/todos.domain.ts,
  e2e/determinism.spec.ts, e2e/boundary.spec.ts, e2e/workout-gym-v2.spec.ts,
  e2e/journeys/three-months-in.spec.ts, tests/numericInput.test.ts,
  tests/submitGuard.test.ts, tests/textFieldA11y.test.ts,
  tests/todos.domain.test.ts, docs/ui-ux/10-warm-momentum-2-3.md,
  openspec/changes/polish-warm-momentum-2-3-data-entry-modal-determinism-v1/*.
- Last successful validation: typecheck 0 errors; lint clean
  (--max-warnings 0); Vitest 1889/1889 (165 files); openspec validate 48/48;
  qa impact map valid (13 rules); sim validate 23 scenarios; determinism
  specs 3× 2/2; P2 journey 7/7 (coldOverview=599ms, maxSwitch=704ms ≤ 800,
  diarySearch=329ms ≤ 500); build:web exit 0 (final code); full Chromium
  suite 116 passed / 0 failed / 7 skipped (10.0m); P0 journeys 25/25 three
  consecutive times; web:verify exit 0 (61.4s, crossOriginIsolated=true,
  port released); web:hygiene PASS (8081/8082 free).
- Current failures: none.
- Relevant quarantines: none.
- Blockers: none.
- Exact next action: none — campaign closed.
- Remaining definition of done: complete — commits pushed; `HEAD ==
origin/main`; ports clean; ExecPlan COMPLETED.

## Progress

- 2026-09-02: Phase A diagnosed (probe evidence), fixed, 3×P0 green,
  committed 9719587. WM2.3 OpenSpec change created and validated.
- 2026-09-03: WM2.3 implemented end-to-end (numeric model, submit guard,
  TextField contract, Modal determinism, surface adoption). Three
  pre-existing E2E failures diagnosed and fixed (virtualization anchor,
  compact-chip contract, Today-tab label). Determinism E2E added
  (double-submit + modal swap), 3× green. Docs written. Full gates run.

## Surprises & Discoveries

- Calories `handleSubmit` had no double-submit guard at all: a rapid
  second tap on "Add entry" created duplicate rows. Closed by the shared
  guard; pinned by `e2e/determinism.spec.ts`.
- Three E2E failures pre-existed at HEAD (none caused by this campaign):
  (1) boundary 30-todos test waited for 'Task 11' before scrolling, but
  WM2.2 density pushed it outside the DraggableFlatList mount window —
  re-anchored to 'Task 1'; (2) workout touch-target test asserted ≥44px
  against chips, but WM2.1/2.2 deliberately set chips to
  `touchTargetMin - 4` = 40 (documented compact chip rule) — test aligned
  to the documented contract; (3) P2 heavy journey clicked 'Overview' but
  the tab rail label has been 'Today' since WM2.0 (0ef426c) — the journeys
  project does not run on PRs, so the rot went unnoticed; after the label
  fix the journey is 7/7 with maxSwitch 704ms.
- workbox-window 7.3.0 `register()` race: when a reload lands during
  service-worker registration, `navigator.serviceWorker.register()` can
  resolve `undefined` and workbox's `this._registration.waiting` throws
  `TypeError: Cannot read properties of undefined (reading 'waiting')`
  (unhandled rejection; app survives). Handed to WM2.4 as a hardening item
  (guard the registration promise chain).
- The plan validator requires the exact WM2.2 ExecPlan section/field
  vocabulary; this plan was restructured to match.

## Decision Log

- D1: Numeric model is pure, lives in `lib/numericInput.ts`
  (`sanitizeNumericInput` onChange filter preserving partials;
  `parseNumericInput` submit parse where blank → null ≠ 0; decimals
  opt-in; integer default; en-US decimal point only).
- D2: `createSubmitGuard` moved verbatim to `lib/submitGuard.ts`
  (signature unchanged); process-memory on purpose — durable exactly-once
  is a sync/outbox concern; forms serialize in-flight activation only;
  submit buttons reflect `loading` state.
- D3: TextField completes its contract (error/helperText/multiline/
  keyboard pass-through/disabled) without becoming a mega-component;
  prefix/suffix slots deliberately not added (no current surface needs
  them); a11y association extracted to pure `core/ui/textFieldA11y.ts`
  with injected platform for unit testability.
- D4: Modal transition contract implemented inside `core/ui/Modal.tsx`:
  closing layer gets `pointerEvents: 'none'`,
  `accessibilityElementsHidden`, `importantForAccessibility:
'no-hide-descendants'`; no global coordinator for five hosts.
- D5: Adoption order dependency-ordered (lib → primitives → surfaces →
  E2E); compact workout grid inputs keep their compact form and adopt the
  numeric model only (force-migrating to the labeled TextField would break
  the grid and add no needed state).

## Validation Ledger

- `npm run typecheck` — 0 errors (final code).
- `npm run lint` — clean at `--max-warnings 0` (after moving
  resolveTextFieldA11y to its own file for react-refresh).
- `npm test` — 1889/1889 tests, 165 files (final code).
- `npx openspec validate --all` — 48/48 items.
- `npm run qa:impact:validate` — impact map valid (13 rules).
- `npm run sim:validate` — 23 scenarios valid, apiLeg guards clean.
- `npx playwright test e2e/determinism.spec.ts` — 2/2, three consecutive
  runs.
- `npx playwright test e2e/journeys/three-months-in.spec.ts` — 7/7
  (coldOverview=599ms ≤ 5000; maxSwitch=704ms ≤ 800; diarySearch=329ms;
  pickerSearch=118ms).
- `npm run build:web` — exit 0 against final code.
- Full Chromium suite — 116 passed / 0 failed / 7 skipped (10.0m).
- `npm run e2e:journeys:p0` — 25/25, three consecutive runs (1.1m each).
- `npm run web:verify` — exit 0 in 61.4s (app shell rendered,
  crossOriginIsolated=true, Add button present, owned server terminated,
  port 8081 released).
- `npm run web:hygiene` — PASS, 8081/8082 free.

## Changed Files / Areas

- New: `lib/numericInput.ts`, `lib/submitGuard.ts`,
  `core/ui/textFieldA11y.ts`, `tests/numericInput.test.ts`,
  `tests/submitGuard.test.ts`, `tests/textFieldA11y.test.ts`,
  `e2e/determinism.spec.ts`, `docs/ui-ux/10-warm-momentum-2-3.md`,
  `openspec/changes/polish-warm-momentum-2-3-data-entry-modal-determinism-v1/*`.
- Modified: `core/ui/TextField.tsx`, `core/ui/Modal.tsx`,
  `features/calories/CaloriesScreen.tsx`,
  `features/quick-capture/QuickCaptureOverlay.tsx`,
  `features/habits/HabitsScreen.tsx`,
  `features/workout/WorkoutSessionScreen.tsx`,
  `features/workout/RoutineDetailScreen.tsx`,
  `features/workout/RoutineExerciseCard.tsx`,
  `features/workout/WorkoutScreen.tsx`, `features/todos/TodosScreen.tsx`,
  `features/todos/todos.domain.ts`, `tests/todos.domain.test.ts`,
  `e2e/boundary.spec.ts`, `e2e/workout-gym-v2.spec.ts`,
  `e2e/journeys/three-months-in.spec.ts`.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this plan.
2. `git status --short` + `git log --oneline -5` — Phase A commit is
   9719587; WM2.3 implementation may be partially committed.
3. `npm run agent:resume -- --plan <this plan>` for orientation.
4. Resume from Current Checkpoint → "Exact next action".

## Outcomes & Retrospective

- WM2.3 shipped: one numeric-input model (blank≠zero, partial-preserving,
  opt-in decimals), one submit guard (Calories' duplicate-row gap closed),
  a completed TextField contract with a unit-tested a11y association model,
  and a modal closing-phase contract (one interactive layer, verified by
  E2E).
- Campaign also repaired three pre-existing E2E rots it inherited
  (virtualization anchor, compact-chip contract drift, Today-tab label) —
  the P2 heavy journey is measurable again (704ms max switch).
- Retrospective: tests that only run on main/nightly rot silently; the
  P2 'Overview' label lived 30 days because journeys skip PR lanes. WM2.4
  should consider a cheap label-parity lint between app constants and
  journey helpers.
