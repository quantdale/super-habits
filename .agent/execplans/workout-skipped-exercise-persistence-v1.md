# ExecPlan: workout-skipped-exercise-persistence-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Fix guided-workout finish wiring that silently drops fully-skipped exercises: `WorkoutSessionScreen.handleFinish` builds `logWorkoutSession({ exercises })` from `summarizeCompletedSets` only, so an exercise where every active phase was Skipped has no summary entry and its `collectSessionSetRecords` rows (`completed: false`) are never persisted. History detail omits the exercise, and progression (`listRecentWorkoutSetOutcomes` → `recommendProgression`) falls back to an older completed session instead of holding on the skip. After the fix, every attempted exercise persists with truthful `setsCompleted` (0 for fully-skipped) plus its `completed=0` set rows; completed counts, volume, and PR inputs remain skip-excluding.

## Context

- Single-page shell; workout guided session in `features/workout/WorkoutSessionScreen.tsx` (`handleFinish`, lines ~669-753).
- Domain provenance helpers in `features/workout/workout.domain.ts`: `summarizeCompletedSets` (excludes `skipped`, correct), `collectSessionSetRecords` (marks `completed: dispositions[i] !== 'skipped'`, correct).
- Persistence in `features/workout/workout.data.ts`: `logWorkoutSession` inserts `workout_session_exercises` + `workout_session_sets` with `completed` flag; reads (`listRecentLoggedSets`, `listLoggedSetsForExerciseNames`, `buildExerciseHistory`, `computeSessionTotalVolume`, `findNewPersonalRecords`) all filter `completed=1` for measurable work and keep skipped rows for progression hold. `listRecentWorkoutSetOutcomes` deliberately keeps skipped rows.
- Original audit F1 (skipped counted as done) is fixed and pinned by `tests/workout.domain.test.ts` (skipped / partial / final-phase-skip) and `tests/integration/workoutQueries.data.test.ts` (prefill excludes skipped, outcomes keep them). Residual is wiring-only: `exercises: summary.map(...)` drops skipped-only exercise names.
- Shortlist ruled out as already closed (verified 2026-09-19): habit pause/archive durable (`habits.status` + `lifecycle_history` with data-layer guards and screen filtering); PR path wired (`findNewPersonalRecords` in `handleFinish` + live-PR effect + `WorkoutHistoryDetail`/`WorkoutScreen` PR display); diary copy-day reachable + single-transaction + same-day guard (`copyCalorieEntriesFromDay` via `runBackupMutation`); planning outbox cascades enqueue (`projects.data.ts` + `goals.data.ts` enqueue todos/habits/goals on project/goal moves and deletes).

## Scope

- Add pure domain helper to build session exercise payloads from `summary + records + routine metadata`, including skipped-only exercises with `setsCompleted: 0`.
- Switch `handleFinish` to the helper (single wiring change).
- Unit tests for helper + wiring semantics (skipped-only, partial, all-skipped, multi-exercise mixed).
- Integration test proving `completed=0` rows persist and read back for a skipped-only exercise via `logWorkoutSession` → `getWorkoutLogDetail` / outcomes / totals.
- Focused QA + `qa:affected` gates.

## Non-Goals

- No schema/migration changes; `workout_session_sets.completed` and `sets_completed` semantics unchanged.
- No changes to quick-complete (`completeRoutine`), linked-action logs, volume/PR math, summary-screen display totals, draft resume, or weekly-review F6.
- No native-only work; no test weakening; no pushes.

## Current Checkpoint

- Current milestone: COMPLETE — fix landed, all gates green, committed locally.
- Completed: F1-residual audit; red repro (temporary vitest proved Bench skipped×2 dropped from wired exercises); `groupSessionExercises` helper + `handleFinish` union wiring; 3 unit + 1 integration test; typecheck/lint; qa:fast (1817 unit), qa:integration (312), qa:timezones (5-zone matrix), focused workout e2e (21 passed); plan validated; committed locally.
- In progress: none.
- Important modified files: `features/workout/workout.domain.ts`, `features/workout/WorkoutSessionScreen.tsx`, `tests/workout.domain.test.ts`, `tests/integration/workoutQueries.data.test.ts`.
- Last successful validation: focused workout e2e 21/21 passed 2026-09-19.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: complete (all conditions validated).

## Progress

- [x] Reproduce fully-skipped-exercise drop (red test/script).
- [x] Add domain helper + switch `handleFinish` to union wiring.
- [x] Unit tests (skipped-only / partial / all-skipped / mixed-exercise).
- [x] Integration test (persist + read back `completed=0` for skipped-only exercise).
- [x] Run focused QA gates + `qa:affected`.
- [x] Mark COMPLETED, `agent:plan:validate`, commit locally.

## Surprises & Discoveries

- Red repro (temporary test, since removed): 2-exercise sequence, Bench skipped×2 + Row completed×2 → summary `[Row:2]`, records Bench×2 `completed:false` + Row×2 `completed:true`, current `summary.map` wiring yields `[Row]` only. Proves the drop.
- `groupSessionExercises` orders by first appearance in records (sequence order) and defaults missing summary entries to 0; summary-only fallback kept for safety (unreachable today).

## Decision Log

- 2026-09-19 — Chose wiring fix in screen + pure domain helper (not a `summarizeCompletedSets` change): summary correctly counts completed work; the bug is using it as the sole driver for the persisted exercise list. Keeps measurable-work semantics intact while restoring skipped provenance.
- 2026-09-19 — Chose workout F1-residual over shortlist: other P1 candidates verified closed (habit lifecycle, PR wiring, copy-day, planning outbox); skipped-only drop is the remaining box-executable product-correctness gap with wrong-history + wrong-progression impact.

## Validation Ledger

- 2026-09-19 — `node -v` — PASS — v22.23.2.
- 2026-09-19 — `git log --oneline -3` — PASS — HEAD `269a049` present, tree clean.
- 2026-09-19 — red repro `tests/workout.skipdrop.repro.test.ts` (temporary) — PASS (reproduced) — Bench records exist, wired list omits Bench; file removed after.
- 2026-09-19 — `npx vitest run tests/workout.domain.test.ts` — PASS — 42/42 (incl. 3 new `groupSessionExercises` cases).
- 2026-09-19 — `npx vitest run --project integration tests/integration/workoutQueries.data.test.ts` — PASS — 5/5 (incl. new skipped-only persistence case).
- 2026-09-19 — `npm run typecheck` — PASS — 0 errors.
- 2026-09-19 — `npx eslint <4 changed files> --max-warnings 0` — PASS after `--fix`.
- 2026-09-19 — `npm run qa:fast` — PASS — 142 files / 1817 tests + label/quarantine parity.
- 2026-09-19 — `npm run qa:integration` — PASS — 65 files / 312 tests.
- 2026-09-19 — `npm run qa:timezones` — PASS — 5-zone matrix.
- 2026-09-19 — `npm run build:web` + `npx playwright test --project=chromium e2e/workout.spec.ts e2e/workout-gym-v2.spec.ts` — PASS — 21/21.

## Changed Files / Areas

- `features/workout/workout.domain.ts` — new pure helper (planned).
- `features/workout/WorkoutSessionScreen.tsx` — `handleFinish` wiring (planned).
- `tests/workout.domain.test.ts` or focused new test — unit coverage (planned).
- `tests/integration/workout*.test.ts` — persistence coverage (planned).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this plan.
2. Run `git status --short`, `git diff --stat`, `git log --oneline -5`; verify HEAD includes `269a049`.
3. Verify `node -v` is v22.23.2.
4. Re-read `features/workout/WorkoutSessionScreen.tsx:669-753`, `features/workout/workout.domain.ts:822-908`, `features/workout/workout.data.ts:950-1096`.
5. Continue from `Exact next action` above; run `npm run qa:affected` before broad gates.

## Outcomes & Retrospective

- Status: Complete.
- Summary: guided-workout finish now persists fully-skipped exercises with `setsCompleted: 0` + `completed=0` set rows via `groupSessionExercises`; completed counts, volume, PR, and prefill semantics unchanged (still skip-excluding); progression outcomes now see the skip and hold.
- Follow-up: weekly-review F6 (`summary.ts` 7-day assumption vs `rule_history`) remains the next highest box-executable correctness candidate; shortlist items verified closed (habit lifecycle, PR wiring, copy-day, planning outbox).
