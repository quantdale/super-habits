# ExecPlan: Calorie Entry Data-Layer Write Validation V1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close the calorie-ledger write-contract hole: `addCalorieEntry` /
`updateCalorieEntry` / `addCalorieEntryFromLinkedAction` assert only the
consumed-date at the data layer, while the UI (`validateCalorieEntry` +
`validateCalorieComputedKcal`) also rejects empty/over-long food names,
negative/over-range/NaN macros, and zero/over-range/uncomputable kcal.
Non-UI writers (quick capture, command executor, linked-action effects)
bypass the form, so invalid rows can reach the ledger, diary aggregates,
frequent-food chips, and backup payloads. Observable success: invalid
writes throw with the exact UI messages and persist nothing; valid writes
(all existing UI paths) behave unchanged.

## Context

- Single-page Expo app; SQLite is the source of truth (`core/db/client.ts`).
- Layering: `*.data.ts` owns writes + sync enqueue; `lib/validation.ts` is pure
  (no feature imports); UI calls `.data` / `.domain`.
- Precedent: todo/habit data-layer asserts at HEAD `0bee9ef` (same pattern:
  field validators with byte-identical messages + throwing asserts + unit and
  real-DB integration tests); calorie date asserts (`assertConsumableDateKey`,
  `2673718`/`d768708`); projects/goals data-layer throws.
- `QuickCaptureOverlay.handleSubmit` already try/catches into `setError`, and
  `executeLogCalories` catches into an `error` outcome, and the linked-action
  engine records adapter throws as `failed` executions — so data-layer throws
  surface inline everywhere (no slot-less submit like HEAD's quick-add case;
  no UI change needed).

## Scope

- `lib/validation.ts`: extract `validateCalorieFoodName` /
  `validateCalorieMacroValue` (numeric) with byte-identical messages,
  refactor `validateCalorieEntry` to compose them unchanged, add throwing
  `assertCalorieEntryWrite` (food + 4 macros + computed/explicit kcal via
  existing `validateCalorieComputedKcal` + meal-type membership reusing the
  existing `'Choose a supported meal type.'` string).
- `features/calories/calories.data.ts`: assert in `addCalorieEntry`
  (resolved `?? 0` macros + explicit calories), `updateCalorieEntry`
  (resolved macros + `kcalFromMacros`-recomputed kcal), and
  `addCalorieEntryFromLinkedAction` (explicit numeric input). Date asserts
  stay as-is.
- Tests: unit `tests/calorieEntryWriteValidation.test.ts` + integration
  `tests/integration/calorieEntryWriteValidation.test.ts` (real
  better-sqlite3, no-row-on-reject on all three paths).

## Non-Goals

- No schema/migration change; no sync/outbox change; no stored-value mutation
  (validate only, never trim/rewrite/coerce).
- No `upsertSavedMeal` change (convenience index with silent no-op on empty
  name, not the ledger; no UI message set to mirror).
- No `setCalorieGoal` / macro-target throw (normalize-on-write app_meta
  settings contract; callers UI-validate via `validateCalorieGoal`).
- No workout routine/exercise-name asserts (surveyed: creation is UI-only,
  fewer bypass writers — lower impact, separate task if ever pursued).
- No pomodoro session duration/type asserts (surveyed: timer-driven rows with
  no UI validation messages to mirror — different class, separate task).
- No daily-plan / weekly-review asserts (surveyed: date-key throws exist;
  weekly-review fan-out already rides the now-guarded todo path).
- No command.validation changes (its own message set stays; the executor
  catch surfaces data-layer messages fail-closed).
- No push/tag/EAS; no PII; no meta-guards.

## Current Checkpoint

- Current milestone: implementation + new tests complete; full-suite gate running.
- Completed: full-domain survey; `lib/validation.ts` field validators +
  `assertCalorieEntryWrite` (messages byte-identical); asserts wired into
  `addCalorieEntry` / `updateCalorieEntry` /
  `addCalorieEntryFromLinkedAction`; unit (6) + integration (4) tests green;
  neighboring calorie suites green (65 unit + 27 integration).
- In progress: full `npm test` gate (background task).
- Important modified files: `lib/validation.ts`,
  `features/calories/calories.data.ts`,
  `tests/calorieEntryWriteValidation.test.ts`,
  `tests/integration/calorieEntryWriteValidation.test.ts`.
- Last successful validation: new unit 6/6 + new integration 4/4 +
  neighbors green; `node -v` = v22.23.2.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: None — all conditions proven (asserts
  throw exact UI messages with no partial writes on all 3 paths; valid
  writes pass; new unit 6/6 + integration 4/4; full suite 219 files /
  2218 tests + typecheck + lint green).

## Progress

- [x] 2026-09-20 — Survey clean-main HEAD `0bee9ef`; select calorie-ledger
  write contract as the one highest-impact box-executable gap.
- [x] 2026-09-20 — `lib/validation.ts`: field validators + throwing assert,
  messages byte-identical.
- [x] 2026-09-20 — Data-layer wiring (add / update / linked-action paths).
- [x] 2026-09-20 — Unit + integration tests written; targeted runs green.
- [x] 2026-09-20 — Full `npm test` + typecheck + lint green; plan validated;
  committed on main.

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-09-20 — Fix calories (not workout/pomodoro): only calories has all
  three of (a) existing user-facing UI message set to mirror, (b) multiple
  live non-UI writers bypassing it, (c) high-frequency ledger rows feeding
  aggregates + backup. Workout names lack bypass writers; pomodoro sessions
  lack a UI message contract; settings use normalize-on-write by design.
- 2026-09-20 — Validate *resolved* macro values (`?? 0` applied, kcal
  recomputed via `kcalFromMacros`) per the HEAD `addTodo` resolved-dueDate
  precedent — never the raw optional input.
- 2026-09-20 — Reuse exact UI messages (single source of truth, no drift);
  meal-type membership reuses the existing command-surface string since the
  calories form has no meal-type message (picker-only input).
- 2026-09-20 — Throw (fail closed) in `addCalorieEntryFromLinkedAction`
  rather than returning `skipped`: the engine records throws as `failed`
  with the message, so nothing is silently corrupted or silently dropped.
- 2026-09-20 — No UI changes needed: every non-UI caller already routes
  throws to inline feedback (overlay `setError`, executor `error` outcome,
  engine `failed` execution).

## Validation Ledger

- 2026-09-20 — `node --version` — PASS — v22.23.2.
- 2026-09-20 — `npx vitest run tests/calorieEntryWriteValidation.test.ts` —
  PASS — 6/6.
- 2026-09-20 — `npx vitest run --project integration
  tests/integration/calorieEntryWriteValidation.test.ts` — PASS — 4/4.
- 2026-09-20 — neighboring suites (`calories.data`, `calories.domain` +
  5 calorie integration files) — PASS — 65 + 27, 0 failures.
- 2026-09-20 — `npm test` (full) — PASS — 219 files / 2218 tests, 0 failures.
- 2026-09-20 — `npm run typecheck` — PASS — 0 errors.
- 2026-09-20 — `npm run lint` — PASS after prettier `--fix` on the two new
  test files — 0 errors, 0 warnings.
- 2026-09-20 — new tests re-run after prettier fix — PASS — 6/6 + 4/4.

## Changed Files / Areas

- `lib/validation.ts` — extracted `validateCalorieFoodName` /
  `validateCalorieMacroValue`, composed `validateCalorieEntry`, added
  `assertCalorieEntryWrite`.
- `features/calories/calories.data.ts` — asserts in `addCalorieEntry`,
  `updateCalorieEntry`, `addCalorieEntryFromLinkedAction`.
- `tests/calorieEntryWriteValidation.test.ts` — new unit contract tests.
- `tests/integration/calorieEntryWriteValidation.test.ts` — new real-DB tests.

## Recovery / Resume Instructions

1. Read `AGENTS.md` and `.agent/PLANS.md`.
2. Read this plan completely.
3. `git status --short`; `git log --oneline -3` (expect HEAD `0bee9ef` + maybe
   uncommitted task files).
4. Reconcile this plan's Current Checkpoint with the working tree; Git wins.
5. Continue only from the plan's `Exact next action`.

## Outcomes & Retrospective

- Status: COMPLETED 2026-09-20.
- Summary: calorie-ledger writes now hard-reject invalid input at the data
  layer with the exact UI messages (empty/over-long food name,
  negative/NaN/over-range macros, zero/over-range/uncomputable kcal,
  unsupported meal type), writing nothing on reject; all three write paths
  (add, update, linked-action) guarded on resolved values; no UI changes
  needed since every caller already routes throws to inline feedback. 10
  new tests pin the contract; full suite (2218), typecheck, and lint green.
- Remaining work: none in scope.
- Follow-ups (not started, separate tasks if ever pursued): workout
  routine/exercise-name asserts (UI-only creation today); pomodoro session
  duration/type asserts (no UI message contract to mirror); settings
  throw-vs-normalize policy (by-design normalize-on-write).
- Lessons: none — the HEAD precedent applied cleanly; no fixture relied on
  the hole (full suite green on first run).
