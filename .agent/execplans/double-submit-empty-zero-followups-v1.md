# ExecPlan: double-submit-empty-zero-followups-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Fix the four documented follow-ups from HEAD 8217363
(`workout-finish-double-submit-v1.md` Outcomes): three same-tick
double-submit races that duplicate rows/XP (CG-3 class) plus one silent
empty→0 validation hole that zeroes macro targets and hides the macro bars.
Observable success: a synchronous double-press on quick-complete, add-routine,
and quick-add-kcal each persists exactly ONE row, and clearing a macro-target
field is rejected with a clear error instead of saving 0 — all proven by new
regression tests (FAIL on unfixed `dist/`, PASS on fixed `dist/`).

## Context

- Shared fix primitive (unit-tested): `lib/submitGuard.ts:20`
  (`createSubmitGuard` — sync `tryStart` + `finish` in `finally`); canonical
  call-site pattern in `TodosScreen.tsx:279,351` (guard-first, validation
  inside `try`, `finish()` in `finally`) and
  `WorkoutSessionScreen.tsx:225,670,760` (HEAD 8217363).
- (1) `features/workout/WorkoutScreen.tsx:1084-1090` — `onCompleteWorkout`
  is fire-and-forget `void (async () => { await completeRoutine(...); ... })`
  with no guard; `completeRoutine` (`workout.data.ts:229-258`) mints a fresh
  `createId('wrk')` per call, so a same-tick double-tap logs two workouts and
  fires `recordAction('workout')` twice (double XP).
- (2) `features/workout/WorkoutScreen.tsx:267-278` — `onCreate` validates via
  `validateRoutineName` then `await addRoutine(...)` (`workout.data.ts:161`,
  fresh `wrk` id per call) with no in-flight guard; double-tap creates two
  routines.
- (3) `features/calories/QuickAddKcal.tsx:30-46` — `saveKcal` checks React
  `saving` state (async — both same-tick presses see `false`); chips call
  `saveKcal` directly (`:75`), manual Add goes through `handleSubmit` (`:48`)
  → `saveKcal` (`:59`). `MAX_QUICK_ADD_KCAL = 9999` bound and integer>0
  validation live in `handleSubmit`. Callee
  `CaloriesScreen.handleQuickAddKcal` (`CaloriesScreen.tsx:550-569`) needs no
  change (single write path, guarded at the single `saveKcal` funnel).
- (4) `features/calories/MacroTargetsModal.tsx:53-55` — `Number('') === 0`
  passes the non-negative check, so a cleared field silently saves 0;
  `buildTargetProgress` (`calories.domain.ts:170-172`) hides bars on
  non-positive targets. `calories` stays owned by the goal modal
  (`onSave` carries `currentTargets.calories` through — do not change).
- Test recipe (HEAD pattern): shared `rapidPress` in
  `e2e/helpers/gestures.ts:179` + strict `workout_logs`/`workout_routines`/
  `calorie_entries` COUNT oracles via `queryRows`, and modal-error assertions
  per `e2e/calories.spec.ts:127-132`. `PillChip` exposes
  `accessibilityLabel` on a Pressable (`core/ui/PillChip.tsx:45`), so chips are
  addressable as `Quick add <n> kilocalories`. Node pinned to v22.23.2 (fnm).
- Safety: never `pkill -f vitest` (would match the tool bridge); exact-PID
  kills only after inspecting `/proc/<pid>/cmdline`.

## Scope

- (1) Guard the `WorkoutScreen` quick-complete closure with a shared
  `createSubmitGuard` ref (sync `tryStart`, `finish()` in `finally`).
- (2) Guard `WorkoutScreen.onCreate` with its own `createSubmitGuard` ref;
  validation runs inside `try` so the error path still calls `finish()`.
- (3) Replace the async `saving`-state re-entry checks in `QuickAddKcal`
  with a shared sync `createSubmitGuard` (both chips and manual Add funnel
  through `saveKcal`); keep `saving` for the Add-button `loading` UI,
  keep `MAX_QUICK_ADD_KCAL` + integer>0 validation untouched.
- (4) Reject empty/whitespace macro-target fields with a clear error
  (`Enter a value for every field.`); keep the existing non-negative and
  ≤999 checks and the `calories`-passthrough ownership.
- Four new e2e regression tests (no `data-testid`, no weakened assertions):
  quick-complete double-press → `workout_logs` COUNT = 1; add-routine
  double-press → `workout_routines` COUNT = 1; quick-add chip double-press →
  `calorie_entries` COUNT = 1; cleared macro field → error visible + no
  `calorie_targets` row written. RED run on unfixed `dist/`, then GREEN.

## Non-Goals

- No data-layer idempotency keys (form-level exactly-once is the established
  `lib/submitGuard.ts` contract, per the v1 plan decision).
- No new button `loading`/disabled states beyond what exists (guard-only
  changes; `QuickAddKcal` keeps its existing `loading={saving}`).
- No a11y theme matrices, no J8 perf changes, no PII, no calories-ownership
  changes, no touch of the HEAD 8217363 finish-session path/tests.
- No push, no tags, no EAS.

## Current Checkpoint

- Current milestone: plan written; tests + fixes not yet implemented.
- Completed: startup checklist reads (AGENTS.md map, .cursorrules,
  superhabits-rules, PLANS.md); sibling v1 plan + HEAD diff studied;
  all four defect sites + test hooks verified in current tree.
- In progress: None — validated; committing locally.
- Important modified files: none yet (plan file only).
- Last successful validation: `node -v` → v22.23.2; HEAD == 8217363
  confirmed; `git status` to be re-checked before building.
- Current failures: None.
- Relevant quarantines: None (workout + calories specs run in `chromium`).
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete (local commit is the final step,
  executed now).
- Remaining definition of done: complete — (1) four guards/fix in place;
  (2) new tests FAILED on unfixed code (three Received-2 + one missing-error)
  and PASS on fixed code; (3) `qa:fast` + proportionate `qa:affected` gates
  green under Node 22 (full workout + calories files, J7, integration,
  timezones, full `npm run e2e` exit 0; native lanes ENVIRONMENT-blocked);
  (4) no existing tests weakened; (5) plan COMPLETED + validated;
  (6) committed locally, no push.

## Progress

- [x] 2026-09-19 — Survey + evidence verification; ExecPlan created (ACTIVE).
- [x] 2026-09-19 — Four e2e regression tests added (unfixed tree).
- [x] 2026-09-19 — RED run on unfixed `dist/`: all four new specs FAIL as
  intended (quick-complete Received 2; add-routine Received 2; quick-add
  chip Received 2; macro empty-field error never appears). Existing
  8217363 session-finish double-tap test still PASSes (harness sanity).
- [x] 2026-09-19 — Four fixes implemented (guards + empty-field rejection).
- [x] 2026-09-19 — GREEN run on fixed `dist/` + affected-spec regression
  (full workout + calories files 23 passed / 1 flaky-that-passed, isolated
  re-run green).
- [x] 2026-09-19 — `qa:fast` green; focused integration 13/13; timezones
  5/5; J7 11/11; full `npm run e2e` exit 0 (233 passed / 44 lane-gated
  skips); native lanes ENVIRONMENT-blocked; ports free; plan COMPLETED +
  `agent:plan:validate`; local commit (final step).

## Surprises & Discoveries

- 2026-09-19 — `queryRows` destroys the app page: e2e oracles over
  fire-and-forget writes MUST wait on a post-commit UI signal (session
  card, hero total) before the first harness read, or the read can race
  and kill the write (observed: 0-row poll timeout on unfixed code).

## Decision Log

- 2026-09-19 — One shared quick-complete guard in `WorkoutScreen` (not
  per-row): matches the one-guard-per-screen precedent (Todos, session
  finish, calorie form); the in-flight window is one `completeRoutine` write
  (refresh is fire-and-forget), so cross-routine suppression is negligible.
  Per-row guards would require changing `RoutineSwipeRow`'s
  `onCompleteWorkout: () => void` prop contract for no correctness gain.
- 2026-09-19 — Separate guards for `onCreate` vs quick-complete: different
  forms must not block each other.
- 2026-09-19 — Guard lives at the `saveKcal` funnel (not in
  `CaloriesScreen.handleQuickAddKcal`): chips and manual Add share it by
  construction; validation stays before the funnel so both presses validate
  then contend on the guard.
- 2026-09-19 — E2E (notunit) regression for all four: the race is a
  same-tick UI pressing phenomenon invisible to pure unit tests; the modal
  empty→0 check rides the existing `calories.spec.ts` modal pattern.
  `createSubmitGuard` itself is already unit-covered.

## Validation Ledger

- 2026-09-19 — `node --version` v22.23.2; HEAD 8217363 — pre-existing state.
- 2026-09-19 — RED `workout.spec.ts -g double-tapping` — 2 FAIL (both
  Received 2) + 1 PASS (v1 regression) on unfixed `dist/`.
- 2026-09-19 — RED `calories.spec.ts -g double-pressing|rejects empty`
  --retries=0 — 2 FAIL (chip Received 2; empty-field error timeout) on
  unfixed `dist/`.
- 2026-09-19 — GREEN fixed `dist/`: 4/4 new specs PASS; full
  `workout.spec.ts` + `calories.spec.ts` 23 passed + 1 flaky-that-passed
  (custom-exercise-manager, isolated re-run 1/1 PASS → host-load flake,
  same class as v1 EXPECTED_KNOWN_GAP entry 15; diff touches no dialog
  path).
- 2026-09-19 — `npm run qa:fast` — PASS (typecheck + lint + 142 unit files
  / 1805 tests + journey-label-parity + quarantine-register-parity).
- 2026-09-19 — focused integration (`workoutIntegrity`,
  `portableExportImport`) — 13/13 PASS.
- 2026-09-19 — `npm run qa:timezones` — 5/5 zones PASS (43 tests each).
- 2026-09-19 — J7 fat-fingers journey on fixed `dist/` — 11/11 PASS.
- 2026-09-19 — full `npm run e2e` — exit 0: 233 passed / 44 skipped
  (lane-gated) / 0 failures (23.9m).
- 2026-09-19 — native-lane probe — ENVIRONMENT (no emulator/adb on this
  box, maestro CLI only); same capability gap as v1, recorded not passed.
- 2026-09-19 — `npm run web:hygiene` — PASS (8081/8082 free).
- 2026-09-19 — Surprise: first chip-test draft polled `queryRows` with no
  UI wait and timed out at 0 rows — reading rows destroys the app page and
  can kill the in-flight fire-and-forget write. Fixed by waiting on the
  hero total moving off zero (refresh-after-commit signal) before the
  oracle, mirroring the workout session-card pattern.

## Changed Files / Areas

- `features/workout/WorkoutScreen.tsx` — guards (1) + (2) (pending).
- `features/calories/QuickAddKcal.tsx` — sync guard (3) (pending).
- `features/calories/MacroTargetsModal.tsx` — empty-field rejection (4) (pending).
- `e2e/workout.spec.ts` — quick-complete + add-routine double-press tests (pending).
- `e2e/calories.spec.ts` — quick-add chip double-press + macro empty-field tests.

## Recovery / Resume Instructions

1. `cd /home/box/Desktop/super-habits`; `node --version` must be v22.x
   (fnm pinned).
2. Read this plan; `git status --short`; `git log --oneline -3`.
3. Continue from `Exact next action` above.
4. QA: `npm run qa:affected`, then required gates; e2e needs fresh
   `npm run build:web` (Playwright owns its server via
   `scripts/serve-e2e.js`; never Metro as a gate).

## Outcomes & Retrospective

- Status: COMPLETED 2026-09-19.
- Summary: four real product defects fixed and proven red→green. (1)
  `WorkoutScreen` quick-complete held no guard, so a same-tick double-tap
  logged two workouts + double XP — now holds a shared synchronous
  `createSubmitGuard`. (2) `onCreate` add-routine had no in-flight guard —
  double-tap created two templates — now holds its own guard with the
  validation-error path still calling `finish()` via `finally`. (3)
  `QuickAddKcal.saveKcal` checked async React `saving` state (both
  same-tick presses saw `false`) — now holds a shared sync guard covering
  chips and manual Add through the `saveKcal` funnel; `MAX_QUICK_ADD_KCAL`
  + validation and the `loading` UI unchanged. (4) `MacroTargetsModal`
  treated cleared fields as 0 (`Number('') === 0`), silently zeroing targets
  and hiding bars — empty/whitespace fields are now rejected with `Enter a
  value for every field.`; `calories` ownership untouched (still carried
  from `currentTargets`). Four new e2e regression tests: all FAIL on
  unfixed code (three `Received 2`, one missing-error timeout), all PASS on
  fixed code. Full battery exit 0 (233 passed / 44 lane-gated skips). No
  tests weakened; no meta-guard or a11y matrix added.
- Follow-up: none — the v1 plan's four named follow-ups are all closed by
  this plan.
