# ExecPlan: Area 7 triage + workout gamification entityId fix

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

1. Triage Area 7 (notification actions) findings F1–F4 against live code and mark each as fixed-in-repo or native-deferred with file/test evidence.
2. Ship the next box-executable P1 in the same run: pass the correct workout log `entityId` from both workout finish paths into `recordAction('workout', logId)`, so the gamification fast path can no longer silently award the oldest unrewarded log; require `entityId` for workout awards on the fast path while keeping reconcile backfill intact.

## Context

- HEAD `c063bb1` (Ask habit_streak pause-masking). Clean tree at start. Host Node v22.23.2 on PATH.
- Area 7 audit: `.agent/hardening-evidence/audit-reports.md` lines 882–1118 (AREA 7 — NOTIFICATION ACTIONS, findings F1–F4 P1 + F5–F9 P2).
- Gamification engine: `features/gamification/gamification.data.ts` (`awardGamificationAction`, `loadActivityCandidates` orders workouts `completed_at ASC`), `features/gamification/GamificationProvider.tsx` (`recordAction` fast path), `features/gamification/gamification.domain.ts` (`actionSourceKey`: workout keyed by entity id).
- Workout writers: `features/workout/workout.data.ts` (`completeRoutine` mints `wrk_` logId internally, returns `{status, reason, routineName}` without it; `logWorkoutSession` returns `Promise<void>`), callers `features/workout/WorkoutSessionScreen.tsx:714-757` (finish) and `features/workout/WorkoutScreen.tsx:1097-1108` (quick-complete) both call `recordAction('workout')` with no id.
- Full native notification-button e2e on this Linux box is ENVIRONMENT-blocked (no iOS/Android notification response host); dispatcher/scheduler/snooze logic is covered by unit + real-SQLite integration tests instead.

## Scope

- Area 7 F1–F4 triage with live-code evidence (dispatcher, todoReminderActions, scheduler, TodoReminderHost, _layout wiring, tests).
- Workout gamification fix: return log identity from `logWorkoutSession` + `completeRoutine`; pass it at both screen call sites; require `entityId` for workout fast-path awards in `awardGamificationAction`; regression tests.
- QA: typecheck, lint, affected vitest suites (unit + integration), `agent:plan:validate`, local commit (no push).

## Non-Goals

- Native device notification tap e2e / EAS / push / tags / model switch.
- Changing fallback behavior for non-workout kinds (todo/focus/nutrition/plan/review) — workout only.
- Meta-guards, a11y matrices, store-declaration filler, owner PII.

## Current Checkpoint

- Current milestone: COMPLETE — fix shipped, all gates green, committed locally.
- Completed: startup + Area 7 F1–F4 triage (all fixed in-repo, evidence below); `logWorkoutSession` → `{status, logId}`, `CompleteRoutineResult` += `logId` (incl. linked-action path); both screens pass the just-written log id and award only on applied; workout fast-path award without entityId returns null (docstring updated); 5 new regression tests, proven to fail on old code (stash check: 1 failed as designed) and pass on new; typecheck clean; eslint clean; full vitest 209 files / 2146 tests green on Node v22.23.2; plan validated; committed locally, no push.
- In progress: None.
- Important modified files: `features/workout/workout.data.ts`, `features/workout/WorkoutSessionScreen.tsx`, `features/workout/WorkoutScreen.tsx`, `features/gamification/gamification.data.ts`, `tests/integration/gamificationWorkoutAward.test.ts`.
- Last successful validation: `npm test` — 209 files / 2146 tests PASS (2026-09-20, Node v22.23.2).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: None — all conditions validated.

## Progress

- [x] Startup: AGENTS.md, PLANS.md, node version, git status/HEAD.
- [x] Area 7 F1–F4 triage against live code.
- [x] Return logId from `logWorkoutSession` + `completeRoutine`.
- [x] Pass entityId at WorkoutSessionScreen finish + WorkoutScreen quick-complete.
- [x] Require entityId for workout fast-path awards; update docstring.
- [x] Add regression tests (oldest-unrewarded trap + explicit-id attribution + reconcile backfill).
- [x] Run typecheck, lint, affected vitest suites + full suite.
- [x] Validate plan, commit locally.

## Surprises & Discoveries

- Area 7 F1–F4 all appear already fixed in-repo (dispatcher branch, occurrenceId payloads, reconcileTodoReminders + TodoReminderHost, dual-identifier cancel, integration tests). Residual risk is native-only delivery (tap path through OS), which is ENVIRONMENT-blocked on this Linux box. Details in Outcomes triage table.
- `awardGamificationAction` docstring claims "newest unrewarded action" but `.find()` over an ASC-ordered candidate list awards the OLDEST. Fix direction per job: require entityId on the workout fast path (return null) rather than flipping to newest, so a missed report degrades to reconcile backfill instead of a wrong-log award.
- `completeRoutine`'s result is also consumed by `command.executor.ts:292` (ignores extra fields — additive change is safe) and `logWorkoutFromLinkedAction` has its own id input (out of scope).

## Decision Log

- 2026-09-20 — Workout fast path without entityId returns null (no silent award) instead of picking newest: a wrong-log award is silent corruption; a missed fast-path award is self-healed by reconcile/housekeeping. Reconcile always passes explicit entityIds so backfill is unaffected.
- 2026-09-20 — `logWorkoutSession` returns `{ status, logId }` and `CompleteRoutineResult` gains `logId: string | null` (null when skipped): additive, backward-compatible with callers/tests that ignore the return.
- 2026-09-20 — Screens award only when a logId was actually produced (applied path), fixing the secondary bug where quick-complete recorded XP even when the routine was missing/deleted (skipped).

## Validation Ledger

- 2026-09-20 — `node -v` → v22.23.2 — PASS (host Node matches requirement).
- 2026-09-20 — `git status --short` → clean; `git log --oneline -3` → c063bb1 HEAD — PASS.
- 2026-09-20 — `npm run typecheck` — PASS, 0 errors.
- 2026-09-20 — new `tests/integration/gamificationWorkoutAward.test.ts` — 5/5 PASS on new code.
- 2026-09-20 — stash-check (old `gamification.data.ts`): new suite 1 failed / 4 passed — PASS (regression test bites on old behavior, then `git stash pop` restored the fix).
- 2026-09-20 — related integration (gamification, workoutIntegrity, workoutQueries, workoutCorrection, todoReminderActions, todoReminderSnooze): 44/44 PASS.
- 2026-09-20 — related unit (workout.data, gamification.domain, todoReminderReconcile): 53/53 PASS.
- 2026-09-20 — `npm run lint` (`--max-warnings 0`) — PASS after `eslint --fix` on the new test file (prettier only).
- 2026-09-20 — qa:affected focused files (workout.domain, workout.data unit, workoutIntegrity, portableExportImport, workoutReminderScheduler, agent-execplan): all PASS.
- 2026-09-20 — `npm test` full suite — 209 files / 2146 tests PASS.
- Native lanes (smoke/targeted/lifecycle) + Playwright e2e: NOT RUN — ENVIRONMENT-blocked on this Linux box (no Android/iOS notification response host / device); contract behavior covered by unit + real-SQLite integration tests.

## Changed Files / Areas

- `.agent/execplans/area7-triage-workout-gamification-entityid-v1.md` — this plan.
- `features/workout/workout.data.ts` — return log identity (pending).
- `features/workout/WorkoutSessionScreen.tsx` — pass entityId (pending).
- `features/workout/WorkoutScreen.tsx` — pass entityId, only on applied (pending).
- `features/gamification/gamification.data.ts` — require workout entityId on fast path (pending).
- `tests/integration/gamificationWorkoutAward.test.ts` — new regression tests (pending).

## Recovery / Resume Instructions

1. Read AGENTS.md and `.agent/PLANS.md`.
2. Read this plan file completely.
3. Run `git status --short`, `git diff --stat`, `node -v` (expect v22.23.2).
4. Continue from `Exact next action` above; update the checkpoint as you go.
5. Before finishing: `npm run typecheck`, `npm run lint`, affected vitest suites, `npm run agent:plan:validate -- --plan <this-path>`, local commit (no push).

## Outcomes & Retrospective

- Status: Complete — shipped and verified, committed locally (hash below).
- Summary: Area 7 F1–F4 confirmed already fixed in-repo; the run's product-correctness outcome is the workout gamification attribution fix (both finish paths now award the exact log just written; id-less workout fast-path awards are misses healed by reconcile instead of silent wrong-log awards).
- Area 7 triage summary (with live-code evidence):
  - F1 (dispatcher todo-reminder branch): FIXED in-repo — `core/notifications/notificationResponseDispatcher.ts:94-127` classify + `:213-233` dispatch; handlers wired in `app/_layout.tsx:179-188`; tests in `tests/integration/todoReminderActions.test.ts`, `todoReminderSnooze.test.ts`.
  - F2 (fireAt-scoped occurrenceId): FIXED — `core/notifications/todoReminderScheduler.ts:158-172,218` payload + classifier fallback `:117-123`.
  - F3 (reconcileTodoReminders): FIXED — `todoReminderScheduler.ts:278-398`, `TodoReminderHost.tsx`, settings toggle wiring, `tests/todoReminderReconcile.test.ts`.
  - F4 (snooze lifecycle): FIXED — `todoReminderActions.ts:162-288` (queue, claim-first, tap-time validation, midnight-crossing allowed), `TODO_REMINDER_SNOOZE_MINUTES = 15` in `reminderPlanning.ts:13`, dual-identifier cancel `:235-238` called from todos.data mutation paths.
  - Native residual: OS-delivered tap e2e remains ENVIRONMENT-blocked on this Linux box (no notification response host); covered by contract tests instead.
- Gamification fix files: `features/workout/workout.data.ts` (`LogWorkoutSessionResult`, `CompleteRoutineResult.logId`, linked-action path carries `input.id`), `features/workout/WorkoutSessionScreen.tsx` (finish passes just-written logId, applied-only), `features/workout/WorkoutScreen.tsx` (quick-complete passes logId, applied-only — also fixes XP on skipped writes), `features/gamification/gamification.data.ts` (workout fast path without entityId → null + docstring), `tests/integration/gamificationWorkoutAward.test.ts` (5 tests: exact-id attribution ×2, id-less miss + reconcile backfill of 2, newest/oldest split attribution, skipped-write no-award).
- Commit: code `f81098d` (local only, no push) — 5 code/test files; this plan file finalized in the follow-up commit.
- Validation evidence: typecheck 0 errors; eslint 0/0; new suite 5/5; stash-check proves bite on old code (1 fail); related integration 44/44; related unit 53/53; qa:affected focused files green; FULL `npm test` 209 files / 2146 tests PASS on Node v22.23.2. Native + Playwright e2e NOT RUN (ENVIRONMENT-blocked, no device/response host on this Linux box).
- Remaining related P1s (not in this run's scope): (1) non-workout fallback still awards OLDEST unrewarded while its docstring says "newest" — deliberate per-kind decision still open for todo/focus/plan/review; (2) command-center `executeLogWorkout` returns routineId as entityId, not the log id — reconcile heals it, but passing the new `CompleteRoutineResult.logId` would make the fast path exact; (3) linked-action workout effects (`logWorkoutFromLinkedAction`) never call `recordAction` — reconcile-only by design, confirm intentional; (4) Area 7 native tap e2e (Maestro) still needs a device lane.
- Exact next action for Run 2 successor: thread `CompleteRoutineResult.logId` through `features/command/command.executor.ts` `executeLogWorkout` (return logId as the result entityId and/or call `recordAction('workout', logId)` via the gamification context if available in that surface); add one integration test asserting the command path awards the exact log; run typecheck + gamification/workout suites + `agent:plan:validate` on a new ExecPlan.
