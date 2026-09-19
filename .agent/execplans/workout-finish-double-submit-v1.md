# ExecPlan: workout-finish-double-submit-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

A fat-fingered double-tap on the workout session "Save and finish" button must
log exactly ONE workout — never two. Today the second tap in the same tick also
passes the `isSaving` state check (React state updates are async), so two full
`workout_logs` + session-exercise/set rows are inserted, XP is awarded twice,
and history/volume/PR/weekly totals are inflated. Cleanup is manual per-log
delete. This is the CG-3 defect class (`fix-todo-add-double-submit`), still
unguarded on the workout finish path. Observable success: synchronous
double-press on "Save and finish" leaves `workout_logs COUNT = 1` for the
session, proven red→green by a new Playwright regression test.

## Context

- `features/workout/WorkoutSessionScreen.tsx:663-666` — `handleFinish` checks
  `if (isSaving) return` then `setIsSaving(true)`. Two taps in the same tick
  both see `false` (classic React state race — exactly what CG-3's synchronous
  guard fixed for todos in `TodosScreen.onSave`).
- `features/workout/WorkoutSessionScreen.tsx:918-922` — Save button has neither
  `disabled` nor `loading` (contrast `CaloriesScreen.tsx:657`
  `loading={isSavingEntry}`). `core/ui/Button.tsx` supports `loading` (disables
  + `busy` a11y state, lines 24-26, 71-80, 121-124).
- `features/workout/workout.data.ts:974` — `logWorkoutSession` mints a fresh
  `createId('wrk')` per call; no idempotency key, so both invocations insert
  full rows; `:751` fires `recordAction('workout')` twice (double XP +
  double celebration).
- Shared fix primitive exists and is unit-tested: `lib/submitGuard.ts:20`
  (`createSubmitGuard`), used by `TodosScreen.tsx:128,279,351`,
  `CaloriesScreen.tsx:157,586,634`, `QuickCaptureOverlay.tsx:121,219`;
  unit coverage in `tests/submitGuard.test.ts`.
- Coverage hole confirmed: fat-fingers J7 covers todo double-submit + habit
  double-increment only; `determinism.spec.ts:32` covers calorie form;
  `command-center-v2.spec.ts:192` covers Confirm double-click; workout specs
  (`workout.spec.ts:100`, `workout-gym-v2.spec.ts` lines ~226/294/351) use
  single `.click()` — zero double-submit coverage for any workout write.
- Timed-session e2e flow to reuse: `e2e/workout.spec.ts:72-121` (routine →
  exercise → Start workout → run phase → "Workout complete!" → Save and
  finish → "Workout saved").
- Same-tick double-press recipe: `e2e/journeys/fat-fingers.spec.ts:46-79`
  (`rapidPress` — two pointerdown/pointerup/click sequences synchronously in
  one `evaluate`).

## Scope

- Guard `handleFinish` in `WorkoutSessionScreen.tsx` with the shared
  `createSubmitGuard` (keep `isSaving` for the label/disabled UI), and set the
  Save button `loading={isSaving}`.
- Add `rapidPress` to `e2e/helpers/gestures.ts` (shared; do NOT refactor the
  passing J7 local copy) and add one regression test in `e2e/workout.spec.ts`:
  timed session → synchronous double-press on "Save and finish" →
  `workout_logs COUNT = 1` row oracle via `queryRows` (mirrors J7-step-11/CG-3
  style; `expectRows`-style strict oracle).
- Verify red (new test fails on unfixed code) → green (passes after fix),
  then `qa:fast` + `qa:affected` gates under pinned Node 22.

## Non-Goals

- Sibling write paths (`WorkoutScreen` quick-complete `onCompleteWorkout`,
  `onCreate` add-routine, `QuickAddKcal` preset chips, macro-targets
  empty→0 validation) — same family, documented as follow-ups below; this plan
  fixes exactly ONE gap per the mission loop intent. Do NOT touch them here.
- No a11y theme matrices, no meta-guards, no J8 perf changes, no idempotency
  keys in the data layer (form-level exactly-once is the established contract
  per `lib/submitGuard.ts` header).
- No push, no EAS, no tag, no model switch.

## Current Checkpoint

- Current milestone: COMPLETE — fix + regression test verified red→green;
  `qa:fast`, focused integration, timezones, J7, full workout file, and the
  full `npm run e2e` battery (exit 0: 228 passed / 44 lane-gated skips /
  1 flaky-that-passed) are green. Ready to commit locally.
- Completed: survey + evidence verification; guard + `loading` prop in
  `WorkoutSessionScreen.tsx`; shared `rapidPress` in
  `e2e/helpers/gestures.ts`; new double-tap test in `e2e/workout.spec.ts`;
  RED run (unfixed `dist/`: Expected 1, Received 2 — duplicate proven) →
  GREEN run (fixed `dist/`: new test + neighboring timed-session test pass);
  full `workout.spec.ts` chromium 12/12; `qa:fast` green (typecheck, lint,
  142 unit files / 1805 tests, both parity scripts); focused integration
  13/13 (`workoutIntegrity`, `portableExportImport`); `qa:timezones`
  5/5 zones; J7 fat-fingers journey 11/11 on the fixed build.
- In progress: None — validated; committing locally.
- Important modified files: `features/workout/WorkoutSessionScreen.tsx`,
  `e2e/helpers/gestures.ts`, `e2e/workout.spec.ts`.
- Last successful validation: J7 11/11 + full workout file 12/12 on fixed
  `dist/`; `qa:fast` green — all under pinned Node v22.23.2.
- Current failures: None.
- Relevant quarantines: None (workout specs run in the `chromium` PR lane).
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete (local commit is the final step,
  executed now).
- Remaining definition of done: complete — (1) guard + loading in place;
  (2) new test FAILED on unfixed code (Received 2) and PASSES on fixed code;
  (3) `npm run qa:fast` green under Node 22; (4) `npm run qa:affected`
  consulted and proportionate gates run (integration, timezones, J7, full
  workout file, full `npm run e2e` exit 0; native lanes ENVIRONMENT-blocked);
  (5) plan marked COMPLETED with ledger evidence; (6) committed locally as
  `2af57fa`, no push.

## Progress

- [x] 2026-09-19 — Survey + evidence verification; gap chosen (workout
  finish double-submit, CG-3 class).
- [x] 2026-09-19 — ExecPlan created (ACTIVE).
- [x] Implement guard + button loading + e2e regression test.
- [x] Red run (unfixed: Received 2) then green run (fixed) of the new spec.
- [x] `qa:fast` + `qa:affected` gates green under Node 22.
- [x] Focused integration (13/13) + timezones (5/5) + J7 journey (11/11).
- [x] Full `npm run e2e` broad regression (exit 0; J8 floor miss
  classified EXPECTED_KNOWN_GAP entry 15, ceiling held, retry green).
- [x] Local commit (final step) — `2af57fa`, no push.

## Surprises & Discoveries

- 2026-09-19 — RED run oracle was exact: `Expected: 1, Received: 2` on
  unfixed code — the same-tick double-press deterministically logs two
  workouts, confirming the state-race mechanism (not a theoretical risk).
- 2026-09-19 — Native lanes (`qa:native:*`) are ENVIRONMENT-blocked on this
  Linux box: no `emulator`/`adb`, no system images (`emulator -list-avds`
  exit 127; only `maestro` CLI present). Same class as known-gaps
  capability gap 1; the Windows Nitro lane owns native coverage.

## Decision Log

- 2026-09-19 — Fix exactly ONE gap (session "Save and finish"), not the whole
  double-submit family — mission loop intent is one verified increment; the
  siblings are recorded as follow-ups, not fixed here.
- 2026-09-19 — Form-level synchronous guard (`createSubmitGuard`) over
  data-layer idempotency keys — matches the established CG-3 contract and the
  `lib/submitGuard.ts` design note (exactly-once is a sync/outbox concern).
- 2026-09-19 — New regression test goes in `e2e/workout.spec.ts` (`chromium`
  PR lane), not J7 — the timed-session flow already exists there and the PR
  lane gates it; J7's local `rapidPress` stays untouched.

## Validation Ledger

- 2026-09-19 — baseline `git status --short` clean at `657c98f`; `node
  --version` v22.23.2 (pinned) — pre-existing state.
- 2026-09-19 — `npm run typecheck` + `npm run lint` — PASS (exit 0).
- 2026-09-19 — RED: new double-tap spec on unfixed `dist/` — FAIL as
  intended (`Expected: 1, Received: 2`, artifact
  `.cursor/playwright-output/e2e-failures/workout-Workout-double-tap-*`).
- 2026-09-19 — GREEN: rebuilt fixed `dist/`; new spec + neighboring
  timed-session spec — 2/2 PASS.
- 2026-09-19 — `npx playwright test workout.spec.ts --project=chromium` —
  12/12 PASS (1.5m).
- 2026-09-19 — `npm run qa:fast` — PASS (142 unit files / 1805 tests +
  journey-label-parity + quarantine-register-parity).
- 2026-09-19 — `npx vitest run --project integration
  tests/integration/workoutIntegrity.test.ts
  tests/integration/portableExportImport.test.ts` — 13/13 PASS.
- 2026-09-19 — `npm run qa:timezones` — 5/5 zones PASS (43 tests each).
- 2026-09-19 — `npx playwright test --project=journeys
  e2e/journeys/fat-fingers.spec.ts` on fixed `dist/` — 11/11 PASS.
- 2026-09-19 — native-lane feasibility probe — ENVIRONMENT (no emulator/adb
  images on this box); recorded, not a pass.
- 2026-09-19 — full `npm run e2e` — exit 0: 228 passed / 44 skipped
  (lane-gated) / 1 flaky-that-passed (J8 step-3 headroom floor: worst switch
  710ms of 800ms = 11.2% headroom, ceiling HELD). Standalone Tom re-run:
  first attempt floor-miss, retry green — same-tree retry pass =
  EXPECTED_KNOWN_GAP entry 15 (host-load sensitivity), not a regression:
  this diff touches only the session finish handler + test helpers, nothing
  in the section-switch path. A `-g` filter isolating step 3 alone times out
  (120s) because the step depends on prior journey setup — harness-ordering
  artifact of the filter, not product signal; the journey-scoped `-g "Tom"`
  run is the valid re-verify.

## Changed Files / Areas

- `features/workout/WorkoutSessionScreen.tsx` — guard + button loading (pending).
- `e2e/helpers/gestures.ts` — shared `rapidPress` (pending).
- `e2e/workout.spec.ts` — double-tap regression test (pending).

## Recovery / Resume Instructions

1. `cd /home/box/Desktop/super-habits`; ensure `node --version` is v22.x
   (fnm pinned; never default Node 20).
2. Read this plan; `git status --short` (must be clean or show only this
   task's three files); `git log --oneline -3`.
3. Continue from `Exact next action` above.
4. QA: `npm run qa:affected`, then required gates; e2e needs fresh
   `npm run build:web` + `scripts/serve-e2e.js` (Playwright owns its server;
   never Metro as a gate).

## Outcomes & Retrospective

- Status: COMPLETED 2026-09-19.
- Summary: one real product defect fixed and proven red→green. The workout
  session "Save and finish" path held only an async-state re-entry check, so
  a same-tick double-tap logged two workouts and awarded double XP (CG-3
  class). `handleFinish` now holds the shared synchronous `createSubmitGuard`
  and the Save button shows `loading` (disabled + busy) while saving. New
  `e2e/workout.spec.ts` regression test double-presses the real button and
  asserts `workout_logs COUNT = 1`: FAIL on unfixed code (Received 2), PASS
  on fixed code. Full battery exit 0 (228 passed / 44 lane-gated skips).
  No tests weakened; no meta-guard or a11y matrix added.
- Follow-up (not this plan): `WorkoutScreen.onCompleteWorkout` quick-complete
  double-tap (`WorkoutScreen.tsx:1084-1090`, fresh `wrk` id per call in
  `workout.data.ts:234`); `WorkoutScreen.onCreate` add-routine double-tap
  (`:267-278`, id in `workout.data.ts:166`); `QuickAddKcal` preset-chip
  state-only guard (`QuickAddKcal.tsx:30,33,49,75`, unguarded
  `CaloriesScreen.handleQuickAddKcal :550-569` vs guarded form path `:586`);
  `MacroTargetsModal` empty-field→0 silent save (`:53-55`, `Number('')===0`,
  hidden bar via `calories.domain.ts:170-172`).
