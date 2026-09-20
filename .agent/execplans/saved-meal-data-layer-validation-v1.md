# ExecPlan: Saved-Meal Data-Layer Write Validation V1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close the saved-meal write-contract hole: `upsertSavedMeal`
(`features/calories/calories.data.ts:314`) silently returns on empty
food names and performs no macro/kcal/meal-type checks, while the UI
form path that feeds the catalog (`CaloriesScreen.handleSubmit` →
`validateCalorieEntry` + `validateCalorieComputedKcal`) rejects
empty/over-long food names, negative/over-range/NaN macros, and
zero/over-range/uncomputable kcal with exact user-facing messages.
Direct callers of `upsertSavedMeal` (tests, seeders, future writers)
bypass the ledger assert in `addCalorieEntry`, so invalid rows can
reach the `saved_meals` catalog, recent/frequent chips, and backup
payloads. Observable success: invalid saved-meal writes throw with
the exact UI messages and persist nothing; valid writes (all
existing UI paths, including the implicit catalog maintenance in
`addCalorieEntry`) behave unchanged; the NOCASE upsert + backup
enqueue semantics are preserved.

## Context

- Single-page Expo app; SQLite is the source of truth
  (`core/db/client.ts`). Layering: `*.data.ts` owns writes + sync
  enqueue; `lib/validation.ts` is pure (no feature imports); UI
  calls `.data` / `.domain`.
- Precedent: todo/habit asserts (`0bee9ef`), calorie-ledger asserts
  (`5e51a43`), workout-name asserts (`8e47da4`) — field validators
  with byte-identical messages + throwing asserts + unit and
  real-DB integration tests. HEAD is `8e47da4` on main.
- `saved_meals` schema (migration 8, `core/db/client.ts:225`):
  `food_name TEXT NOT NULL`, `calories INTEGER NOT NULL`,
  `protein/carbs/fats/fiber REAL NOT NULL DEFAULT 0`,
  `meal_type TEXT NOT NULL DEFAULT 'breakfast'`, plus `use_count` /
  `last_used_at`; unique index `idx_saved_meals_food_name` on
  `food_name COLLATE NOCASE`. Columns mirror the ledger, so the
  ledger UI contract maps 1:1.
- Sole prod writer today is `addCalorieEntry` (implicit catalog
  maintenance, `maintainSavedMeal` default TRUE) — which now
  asserts BEFORE the catalog call, and wraps the catalog call in
  try/catch (`console.error`, ledger stays committed). So the
  shipped UI path is already indirectly guarded; the hole is direct
  `upsertSavedMeal` misuse (exported, used by seeders/tests, open
  to future writers) plus the silent-drop itself (caller cannot
  distinguish "saved" from "dropped").
- `assertCalorieEntryWrite` (`lib/validation.ts:155`) already
  encodes the exact contract needed (food + 4 macros + computed
  kcal + `SUPPORTED_MEAL_TYPES` membership with the existing
  `'Choose a supported meal type.'` string). `upsertSavedMeal`
  input shape is identical — reuse it, no new helper, no message
  duplication.
- `applyRemoteSavedMeals` is restore-only `INSERT OR REPLACE`
  (same as `applyRemoteCalorieEntries` precedent): must accept
  backup payloads including legacy rows; stays plain by design.

## Scope

- `features/calories/calories.data.ts`: call
  `assertCalorieEntryWrite` at the top of `upsertSavedMeal`
  (before `getDatabase()`), replacing the silent
  `if (!input.foodName?.trim()) return;` with a throw carrying
  `'Food name is required.'`. No other logic change: the atomic
  `INSERT ... ON CONFLICT(food_name COLLATE NOCASE) DO UPDATE`
  - `runBackupMutation` enqueue stays byte-identical.
- `tests/calories.data.test.ts`: update the
  `'upsertSavedMeal returns early for blank names'` test to expect
  a throw with `'Food name is required.'` (contract
  strengthening, not weakening — the mission names the silent
  return as the evidence gap).
- Tests: new unit `tests/savedMealWriteValidation.test.ts`
  (assert reuse pins exact messages through the saved-meal path)
  - new integration
    `tests/integration/savedMealWriteValidation.test.ts` (real
    better-sqlite3: reject invalid direct upserts with no row, no
    mutation of existing row, valid upsert still coalesces +
    bumps `use_count`).
- Pomodoro surveyed, deferred with rationale (see Non-Goals).

## Non-Goals

- No schema/migration change; no sync/outbox change; no
  stored-value mutation (validate only, never trim/rewrite/coerce).
- No `applyRemoteSavedMeals` validation (restore-only import;
  same precedent as `applyRemoteCalorieEntries` — must accept
  legacy backup payloads; backup-manifest validation lives in
  `core/backup/`).
- No `addCalorieEntry` change (already asserts; its try/catch
  around `upsertSavedMeal` already contains catalog failures so
  the ledger never fails on a catalog reject — verified, untouched).
- No pomodoro session asserts (surveyed: `logPomodoroSession` /
  `recordCompletedPomodoroSession` / `insertPomodoroSessionRecord`
  take timer-derived duration/type/ISOs; no UI validator with
  messages exists to mirror — `validateSetTiming` is the workout
  rest-timer contract, not pomodoro).
- No pomodoro settings throw (surveyed: single pre-validated UI
  writer `PomodoroSettingsInline:27` → `PomodoroScreen:470`
  `handleSaveSettings`; data layer uses normalize-on-write
  `normalizePomodoroSettings` bounded-integer fallbacks by design,
  same class as calorie-goal/macro-target app_meta settings;
  speculative polish per mission — deferred).
- No weekly-review draft asserts (no single-message UI contract;
  string-array validators — separate design task, unchanged).
- No gamification, no native-only e2e, no push/tags/EAS, no PII.
- No re-do of ledger / todo-habit / workout-name asserts.

## Current Checkpoint

- Current milestone: COMPLETE — fix implemented, all gates green, committed.
- Completed: full survey; RED integration tests proved the hole
  (3 failed / 1 passed pre-fix); `upsertSavedMeal` now reuses
  `assertCalorieEntryWrite` (silent blank-name return replaced
  with `'Food name is required.'` throw); blank-name unit test
  updated to expect the throw; new unit (2) + integration (4)
  tests green; neighbors green (65 unit + 25 + 6 integration);
  `typecheck` 0 errors; scoped `lint` 0/0; plan validated.
- In progress: none.
- Important modified files: `features/calories/calories.data.ts`,
  `tests/calories.data.test.ts`,
  `tests/savedMealWriteValidation.test.ts`,
  `tests/integration/savedMealWriteValidation.test.ts`.
- Last successful validation: new unit 2/2 + new integration
  4/4 + neighbors 65 + 31 green; `node -v` = v22.23.2.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: None — all conditions proven
  (RED pre-fix 3-fail; asserts throw exact UI messages with no
  partial writes; valid NOCASE coalesce + use_count unchanged;
  unit + integration + typecheck + lint green).

## Progress

- [x] 2026-09-20 — Survey HEAD `8e47da4`; select saved-meal
      write contract as the Run 1 gap (silent empty-name drop +
      missing macro/kcal/mealType rejects on the direct path).
- [x] 2026-09-20 — RED tests proving the defect (unit +
  real-DB integration: 3 failed / 1 passed pre-fix).
- [x] 2026-09-20 — `upsertSavedMeal` hard-reject via reused
  `assertCalorieEntryWrite`; blank-name test updated to throw.
- [x] 2026-09-20 — Targeted vitest + typecheck (+ lint) green;
  plan validated; COMPLETED; committed locally.

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-09-20 — Fix saved-meals (not pomodoro): only
  saved-meals has all three of (a) existing user-facing UI
  message set to mirror (ledger form validators), (b) an
  exported direct write path bypassing the asserted ledger path,
  (c) a silent-drop (caller cannot tell saved from dropped).
  Pomodoro sessions have no UI message contract; pomodoro
  settings are single-writer + normalize-by-design.
- 2026-09-20 — Reuse `assertCalorieEntryWrite` directly (no new
  `assertSavedMealWrite`): input shapes are identical
  (foodName + 4 macros + calories + mealType string) and the
  catalog columns mirror the ledger — one source of truth, no
  message drift. A wrapper would add indirection with zero
  contract difference.
- 2026-09-20 — Throw (fail closed) on empty name instead of
  silent return: the mission explicitly names silent-return as
  the evidence gap ("do not silently drop invalid payloads that
  UI would block"). The existing blank-name unit test pins the
  old behavior and must be updated — contract strengthening,
  not weakening.
- 2026-09-20 — Leave `applyRemoteSavedMeals` plain: restore
  must import legacy/V1 payloads; same precedent as
  `applyRemoteCalorieEntries` (unvalidated in the ledger run).

## Validation Ledger

- 2026-09-20 — `node --version` — PASS — v22.23.2.
- 2026-09-20 — new integration pre-fix — RED (proves hole) —
  3 failed / 1 passed (`blank names resolve instead of
  rejecting`; invalid macros/kcal/mealType land rows; invalid
  upsert mutates existing row; valid coalesce passes).
- 2026-09-20 — new unit `tests/savedMealWriteValidation.test.ts` —
  PASS — 2/2 (shared-assert contract pin).
- 2026-09-20 — new integration post-fix — PASS — 4/4.
- 2026-09-20 — updated `tests/calories.data.test.ts` — PASS —
  22/22 (blank-name now expects the throw, still no DB touch).
- 2026-09-20 — neighbors unit (calories.data +
  calorieEntry + savedMeal + validation) — PASS — 65, 0 failures.
- 2026-09-20 — neighbors integration (savedMealUniqueness +
  calorieEntry + duplicateWriteProbes + constraints) — PASS —
  25, 0 failures.
- 2026-09-20 — `portableExportImport` integration — PASS — 6/6.
- 2026-09-20 — `npm run typecheck` — PASS — 0 errors.
- 2026-09-20 — `npx eslint` scoped (4 changed source/test
  files) — PASS — 0 errors, 0 warnings; prettier clean after
  `--write` on the plan file.

## Changed Files / Areas

- `features/calories/calories.data.ts` — reason: `upsertSavedMeal` assert (planned).
- `tests/calories.data.test.ts` — reason: blank-name test updated to throw (planned).
- `tests/savedMealWriteValidation.test.ts` — reason: new unit contract tests (planned).
- `tests/integration/savedMealWriteValidation.test.ts` — reason: new real-DB tests (planned).

## Recovery / Resume Instructions

1. Read `AGENTS.md` and `.agent/PLANS.md`.
2. Read this plan completely.
3. `git status --short`; `git log --oneline -3` (expect HEAD `8e47da4` + maybe uncommitted task files).
4. Reconcile this plan's Current Checkpoint with the working tree; Git wins.
5. Continue only from the plan's `Exact next action`.
6. QA: focused `npx vitest run <new test files>` (never broad `pkill -f vitest`; kill ONLY orphan vitest worker PIDs precisely if needed), `npm run typecheck`, `npm run lint`, neighboring calorie suites.
7. Finish: `npm run agent:plan:validate -- --plan .agent/execplans/saved-meal-data-layer-validation-v1.md`, mark COMPLETED, commit on main (no push/tag/EAS).

## Outcomes & Retrospective

- Status: Completed.
- Summary: `upsertSavedMeal` now hard-rejects invalid writes at
  the data layer by reusing the shared `assertCalorieEntryWrite`
  (byte-identical UI messages: food name, 4 macros, computed
  kcal, meal type), replacing the silent blank-name early
  return with a `'Food name is required.'` throw. Invalid
  direct upserts write nothing and leave existing rows
  untouched; valid NOCASE coalesce + `use_count` bump +
  backup enqueue unchanged; the `addCalorieEntry` catalog
  try/catch containment means the ledger never fails on a
  catalog reject. 6 new tests green; no regressions in 96
  neighbor tests.
- Remaining work: none in scope.
- Follow-up (not started, separate tasks if ever pursued):
  pomodoro session asserts (no UI message contract to mirror —
  timer-driven rows); pomodoro settings throw-vs-normalize
  policy (by-design normalize-on-write, single pre-validated
  UI writer); weekly-review draft shape (no single-message UI
  contract).
