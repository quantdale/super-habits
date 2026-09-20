# ExecPlan: Workout Name Data-Layer Write Validation V1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close the workout name write-contract hole: `addRoutine` / `addExercise`
accept ANY string at the data layer while the UI (`validateRoutineName` /
`validateExerciseName`) rejects empty and over-long (>100 char) names, and the
routine-rename path (`RoutineDetailScreen.handleRenameRoutine`) does not even
call the UI validator — so an over-long rename typed into the app itself lands
today, alongside any non-UI writer (portable/restore apply paths, future
command writers, tests/seeders). Observable success: invalid names throw with
the exact UI messages and persist nothing; valid writes (all existing UI
paths) behave unchanged; duplicating a long-named routine truncates the
` (copy)` name to fit instead of landing an over-long row.

## Context

- Single-page Expo app; SQLite is the source of truth (`core/db/client.ts`).
- Layering: `*.data.ts` owns writes + sync enqueue; `lib/validation.ts` is pure
  (no feature imports); UI calls `.data` / `.domain`.
- Precedent: todo/habit asserts (`0bee9ef`) and calorie-ledger asserts
  (`5e51a43`) — field validators with byte-identical messages + throwing
  asserts + unit and real-DB integration tests. HEAD is `5e51a43`.
- The calorie Run1 plan explicitly deferred workout names ("creation is
  UI-only, fewer bypass writers"). Re-survey overturns that: (1) the rename
  path has NO UI validation (reachable UI hole, not just non-UI writers);
  (2) `duplicateRoutine` bypasses `addRoutine` with direct SQL and appends
  ` (copy)`, so duplicating a 94+ char routine lands a >100 char row;
  (3) `updateRoutine` / `updateExercise` / `updateCustomExercise` silently
  swallow empty names via `|| current.name` instead of rejecting;
  (4) custom-exercise create/edit check only non-empty, no length cap.
- `handleRenameRoutine` and `CustomExerciseManager.handleSaveEdit` have no
  try/catch, so data-layer throws there need UI pre-validation (Run1
  quick-add precedent: pre-validate with a notice instead of throwing into a
  slot-less submit). `handleCreateCustomExercise` already catches into
  `setWorkoutError`, so the data throw surfaces inline with no UI change.

## Scope

- `lib/validation.ts`: add throwing `assertRoutineWrite({ name })` and
  `assertExerciseWrite({ name })` reusing `validateRoutineName` /
  `validateExerciseName` (byte-identical messages, single source of truth).
- `features/workout/workout.data.ts`: assert in `addRoutine`,
  `updateRoutine` (when `updates.name !== undefined`), `addExercise`,
  `updateExercise` (when `updates.name !== undefined`),
  `createCustomExercise` (replaces the hand-rolled empty check; empty
  message identical, adds the >100 reject), `updateCustomExercise` (when
  `updates.name !== undefined`); truncate `duplicateRoutine`'s ` (copy)`
  name to fit 100 chars.
- `features/workout/RoutineDetailScreen.tsx`: `handleRenameRoutine`
  pre-validates with `validateRoutineName` into `setWorkoutError` (keeps the
  draft open so the user can fix).
- `features/workout/CustomExerciseManager.tsx`: `handleSaveEdit` length
  guard (`trimmed.length > 100` returns early, same silent precedent as its
  existing empty guard — the modal has no error surface; the data assert is
  the backstop).
- Tests: unit `tests/workoutNameWriteValidation.test.ts` + integration
  `tests/integration/workoutNameWriteValidation.test.ts` (real
  better-sqlite3, no-row-on-reject / row-untouched-on-reject).

## Non-Goals

- No schema/migration change; no sync/outbox change; no stored-value mutation
  (validate only, never trim/rewrite/coerce — except `duplicateRoutine`'s
  system-generated ` (copy)` suffix truncation, which has no user input to
  preserve).
- No `upsertSavedMeal` change (surveyed: sole prod caller is the now-asserted
  `addCalorieEntry`; convenience index, no UI message set to mirror).
- No pomodoro settings/session asserts (surveyed: single UI writer +
  `normalizeSettings` defense in `pomodoro.domain.ts`; no UI message set for
  session rows — different class).
- No daily-plan / weekly-review asserts (surveyed: date-key throws exist;
  weekly-review fan-out rides the now-guarded todo path; weekly-review draft
  validators return string arrays — no single-message UI contract to mirror,
  separate design task).
- No set-timing changes (already asserted via `validateSetTiming` in
  `addSet`/`updateSet`).
- No push/tag/EAS; no PII; no meta-guards.

## Current Checkpoint

- Current milestone: COMPLETE — fix implemented, all gates green, committed.
- Completed: same-class survey; `assertRoutineWrite` / `assertExerciseWrite`
  in `lib/validation.ts` (byte-identical messages); asserts wired into
  `addRoutine` / `updateRoutine` / `addExercise` / `updateExercise` /
  `createCustomExercise` / `updateCustomExercise`; `duplicateRoutine`
  ` (copy)` truncation; rename pre-validation in `RoutineDetailScreen`;
  length guard in `CustomExerciseManager`; unit (4) + integration (12)
  tests green; neighbors green (workout 38 + validation 39);
  `typecheck` 0 errors; scoped `lint` 0/0; ports 8081/8082 free.
- In progress: none.
- Important modified files: `lib/validation.ts`,
  `features/workout/workout.data.ts`,
  `features/workout/RoutineDetailScreen.tsx`,
  `features/workout/CustomExerciseManager.tsx`,
  `tests/workoutNameWriteValidation.test.ts`.
- Last successful validation: focused vitest 16/16 + neighbors 93/93 +
  typecheck 0 + scoped lint 0/0 (2026-09-20, Node v22.23.2).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: all met (asserts + UI guards implemented;
  new focused tests green; `typecheck` 0; scoped `lint` 0/0; neighboring
  suites green; plan validated and marked COMPLETED; committed on main).

## Progress

- [x] Same-class survey (UI↔data contract holes across workout, pomodoro,
  saved-meals, daily-plan, weekly-review).
- [x] `lib/validation.ts` throwing asserts.
- [x] `workout.data.ts` write-path asserts + duplicate truncation.
- [x] UI pre-validation (rename + custom-exercise edit guard).
- [x] Unit + integration tests.
- [x] Focused QA gates (vitest focused, typecheck, lint).
- [x] Plan validate + COMPLETED + commit on main.

## Surprises & Discoveries

- The calorie Run1 plan's deferral rationale ("creation is UI-only") missed
  that the routine RENAME path never calls `validateRoutineName` — the hole
  is reachable from the shipped UI today, no non-UI writer needed.
- `duplicateRoutine` inserts via direct SQL (not `addRoutine`), so even an
  `addRoutine`-only assert would leave the ` (copy)` overflow hole open.
- `RoutineExerciseCard` exposes no name editor, so `updateExercise` name
  updates come only from programmatic callers — the assert is pure backstop.

## Decision Log

- 2026-09-20 — Fix workout names (not thinning): reachable-UI-hole evidence
  overturns the Run1 deferral; same mirror-messages pattern as Run1.
- 2026-09-20 — Truncate (not reject) `duplicateRoutine` long names: reject
  would break duplicating a valid 94+ char routine; truncation keeps the
  ` (copy)` marker and the ≤100 contract.
- 2026-09-20 — Assert-only, no trim/coerce of user input (Run1 precedent);
  silent `|| current.name` fallbacks stay for valid values (dead for invalid
  after the assert, harmless).
- 2026-09-20 — Custom-exercise edit length guard is silent early-return
  (modal has no error surface; matches its existing empty guard).

## Validation Ledger

- 2026-09-20 — `node --version` (v22.23.2) — PASS.
- 2026-09-20 — `npx vitest run tests/workoutNameWriteValidation.test.ts tests/integration/workoutNameWriteValidation.test.ts` — PASS (16/16).
- 2026-09-20 — `npm run typecheck` — PASS (0 errors).
- 2026-09-20 — `npx eslint <6 changed files> --max-warnings 0` — PASS (0/0; full-lint prettier nits fixed via --fix).
- 2026-09-20 — neighbors `calories.data` + `workoutIntegrity` + `workoutCorrection` + `workoutQueries.data` — PASS (54/54 across 6 files).
- 2026-09-20 — neighbors `todoHabit/calorieEntry` validation + `duplicateWriteProbes` — PASS (39/39 across 5 files).
- 2026-09-20 — `npm run web:hygiene` — PASS (8081/8082 free; no campaign servers).

## Changed Files / Areas

- `lib/validation.ts` — reason: throwing asserts (single source of truth).
- `features/workout/workout.data.ts` — reason: write-path asserts + duplicate
  truncation.
- `features/workout/RoutineDetailScreen.tsx` — reason: rename pre-validation.
- `features/workout/CustomExerciseManager.tsx` — reason: edit length guard.
- `tests/workoutNameWriteValidation.test.ts` — reason: unit contract tests.
- `tests/integration/workoutNameWriteValidation.test.ts` — reason: real-DB
  no-row-on-reject tests.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan.
2. `git status --short`; `git diff --stat`; reconcile with checkpoint.
3. Continue from `Exact next action` above.
4. QA: focused `npx vitest run <new test files>` (never broad `pkill -f
   vitest`), `npm run typecheck`, `npm run lint`, neighboring workout suites.
5. Finish: `npm run agent:plan:validate -- --plan
   .agent/execplans/workout-name-data-layer-validation-v1.md`, mark
   COMPLETED, commit on main (no push/tag/EAS).

## Outcomes & Retrospective

- Status: Completed.
- Summary: Workout routine/exercise names now hard-reject at the data layer with byte-identical UI messages (`assertRoutineWrite` / `assertExerciseWrite`), covering 6 write paths plus `duplicateRoutine` truncation; the shipped-UI rename hole is pre-validated with a notice. 16 new tests green; no regressions in 93 neighbor tests.
- Follow-up: weekly-review draft validators (string-array shape, no single-message UI contract) remain a separate design task; `upsertSavedMeal` direct-misuse and pomodoro session asserts surveyed and deferred with rationale in Non-Goals.
