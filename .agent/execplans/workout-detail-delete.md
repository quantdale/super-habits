# ExecPlan: Visible routine deletion in the detail sheet

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Keyboard users can delete a Workout routine from its detail sheet, cancel safely,
and read a failed deletion in that sheet before retrying.

## Context

Owner-approved task on `ux/workout-delete-routine`, based on `1820715a`.
`RoutineDetailModal` is mounted by `WorkoutScreen`; its existing delete handler
owns confirmation, data-layer deletion, close-on-success and refresh. Shared
`Button` uses `Pressable3D` and `useKeyboardFocusRing`, with a 44px web minimum.
SQLite is unchanged. Existing Tier-2 E2E tests use real abort triggers and the
DB harness; harness navigation destroys React state.

## Scope

Add an onDelete callback, danger button, routine-scoped inline failure and a
synchronous submit guard. Add Playwright keyboard/cancel/delete and in-place
failure/retry evidence. Commit locally when required checks pass.

## Non-Goals

No swipe behavior, database semantics, golden images, thresholds, exclusions,
remote publication, PR creation, or other worktrees change.

## Current Checkpoint

- Current milestone: Complete.
- Completed: Button, parent delete callback, routine-scoped alert, synchronous guard, and two E2E regressions implemented. Typecheck and focused Vitest pass.
- In progress: None.
- Important modified files: This plan, RoutineDetailScreen.tsx, WorkoutScreen.tsx, workout.spec.ts and workout-write-failure.spec.ts.
- Last successful validation: All requested checks passed: 92 Vitest tests; 18 workout, 15 write-failure, 12 keyboard and 7 responsive E2E tests; typecheck, lint, build, formatting, retry report and server hygiene.
- Current failures: None. New keyboard regression passed after entrance-synchronized measurement; initial TEST_BUG preserved in the ledger.
- Relevant quarantines: None for this task.
- Blockers: None.
- Exact next action: None — task complete.
- Remaining definition of done: Complete. All required checks passed, local conventional commit created, and visual impact recorded below.

## Progress

- [x] Inspect guidance and existing flow.
- [x] Implement button, scoped error and guard.
- [x] Add keyboard and failure/retry E2E coverage.
- [x] Validate and review changes.
- [x] Commit locally and hand off.

## Surprises & Discoveries

- The shared Button already provides keyboard focus paint and 44px web geometry.
- The routine detail sheet is not captured by the current visual goldens; the
  workout landing golden captures a closed sheet.
- npm ci completed successfully; its hook installer reports `.git/hooks` is not
  a directory in this worktree. Dependency patches were applied.

## Decision Log

- 2026-11-16 — Reuse parent deletion and shared Button; avoid duplicate persistence
  paths. Scope deletion failure by routine ID so another sheet cannot inherit it.
- 2026-11-16 — Use the existing transient SQLite abort technique to prove retry
  without remounting. Keep all heavy commands serialized under the requested lock.
- 2026-11-16 — Validation focuses on changed UI behavior and requested sweeps;
  broad impact-map lanes for sync, timezones and native lifecycle are not changed
  by this UI-only wiring.

## Validation Ledger

- 2026-11-16 — `/tmp/cx-npmci.log` — PASS: added 1130 packages; patches applied.

- 2026-11-16 — `npm run typecheck` — PASS.
- 2026-11-16 — `npx vitest run tests/workoutWriteFailure.test.ts tests/uiTouchTargetContract.test.ts tests/submitGuard.test.ts tests/workout.data.test.ts tests/workout.domain.test.ts tests/integration/workoutIntegrity.test.ts` — PASS, 5 existing files / 84 tests (submitGuard.test.ts is not an existing file).
- 2026-11-16 — `npm run qa:impact -- --files features/workout/RoutineDetailScreen.tsx features/workout/WorkoutScreen.tsx e2e/workout.spec.ts e2e/workout-write-failure.spec.ts` — PASS; broad rules include unrelated sync/timezone/native lanes, scoped validation rationale above.

- 2026-11-16 — `npm run lint` — PASS, zero warnings.
- 2026-11-16 — `flock /tmp/sh-heavy.lock /workspace/pi-sessions/memwait.sh npm run build:e2e` — PASS, hermetic export; zero Supabase hosts in dist.
- 2026-11-16 — Initial locked Playwright invocation — ENVIRONMENT: sandbox rejected local server bind with EPERM; rerun approved outside sandbox, same command and heavy lock.
- 2026-11-16 — `npm run agent:plan:validate -- --plan .agent/execplans/workout-detail-delete.md` and `git diff --check` — PASS.

- 2026-11-16 — `npx vitest run tests/workoutWriteFailure.test.ts tests/uiTouchTargetContract.test.ts tests/workout.data.test.ts tests/workout.domain.test.ts tests/integration/workoutIntegrity.test.ts` — PASS, 5 files / 84 tests.
- 2026-11-16 — `npx vitest run tests/workoutSessionSave.test.ts` — PASS, 8 tests including the reused synchronous guard contract.

- 2026-11-16 — First locked four-spec Playwright run — all 19 sweeps and the new sheet failure/retry case passed; new keyboard case failed on a one-shot 43.6328px measurement during the modal scale entrance (TEST_BUG). Original trace/screenshot/context preserved at `/tmp/cx-routine-delete-initial-failure/`. Fix retries the same >=44px and viewport assertions for up to 5 seconds; no threshold changed.

- 2026-11-16 — First four-spec Playwright run finished: 51 passed / 1 failed in 10.4m; the only failure was the new test readiness issue above. All 15 write-failure, 12 keyboard and 7 responsive cases passed. Initial JSON report preserved alongside the failure artifacts.
- 2026-11-16 — `npm run typecheck` after test readiness fix — PASS; lint rerun in progress. New keyboard E2E case passed in the full workout rerun.

- 2026-11-16 — `flock /tmp/sh-heavy.lock /workspace/pi-sessions/memwait.sh npx playwright test e2e/workout.spec.ts e2e/workout-write-failure.spec.ts e2e/v2-keyboard-focus.spec.ts e2e/v2-responsive-sweep.spec.ts --project=chromium` — First invocation 51 passed / 1 TEST_BUG, resolved as above; three unaffected specs entirely green (15 + 12 + 7 cases).
- 2026-11-16 — `flock /tmp/sh-heavy.lock /workspace/pi-sessions/memwait.sh npx playwright test e2e/workout.spec.ts --project=chromium` — PASS, 18/18 in 2.2m after readiness fix. Together all 52 unique targeted cases pass; no product changes occurred between browser runs.
- 2026-11-16 — Final `npm run typecheck`, `npm run lint`, `git diff --check`, and `npx prettier --check features/workout/WorkoutScreen.tsx features/workout/RoutineDetailScreen.tsx e2e/workout.spec.ts e2e/workout-write-failure.spec.ts .agent/execplans/workout-detail-delete.md` — PASS.
- 2026-11-16 — `node scripts/e2e-retry-report.mjs` — PASS, zero retried tests.
- 2026-11-16 — `npm run web:hygiene` — PASS outside sandbox, ports 8081 and 8082 free. Initial sandbox result was ENVIRONMENT: bind denial falsely reports occupied ports. No processes killed.

- 2026-11-16 — Local conventional commit created with all five task files; pre-commit eslint/prettier hooks passed. Final commit identity is available via `git log -1`; this completed plan is included by amend.

## Changed Files / Areas

- `features/workout/RoutineDetailScreen.tsx` — visible danger action and local alert.
- `features/workout/WorkoutScreen.tsx` — reuse delete flow, guard and scoped error.
- `e2e/workout.spec.ts`, `e2e/workout-write-failure.spec.ts` — intended regressions.
- `.agent/execplans/workout-detail-delete.md` — durable checkpoint and evidence.

## Recovery / Resume Instructions

Read AGENTS.md and .agent/PLANS.md, then this plan. Inspect Git status/diff and run
`npm run agent:resume -- --plan .agent/execplans/workout-detail-delete.md` and
`npm run qa:affected`. Resume from Exact next action. Use Node 22 and wrap every
heavy build/Playwright/export command with
`flock /tmp/sh-heavy.lock /workspace/pi-sessions/memwait.sh <command>`.

## Outcomes & Retrospective

- Status: Completed.
- Summary: Visible danger-styled Delete routine button reuses the existing confirmation and data flow. A synchronous guard prevents concurrent submissions; failures stay readable beside the button in the open sheet and can be retried. All 52 unique requested browser cases and 92 focused Vitest tests pass.
- Visual impact: Routine detail gains the danger action and, on failure, an inline alert. No routine-detail visual golden exists; workout-landing-390-light captures the closed sheet and is unaffected. No goldens regenerated.
- Lessons: Wait for observable rendered geometry when checking a control inside the existing modal spring; retain the 44px threshold.
- Follow-up: None for implementation. Driver pushes and opens the PR; no remote operations performed.
