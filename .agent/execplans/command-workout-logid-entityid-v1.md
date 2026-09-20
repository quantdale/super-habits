# ExecPlan: command-center workout logId entityId

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Command Center workout logging (`executeLogWorkout` in `features/command/command.executor.ts`)
returns the **routine id** as the success `entityId` instead of the **workout log id** just
written by `completeRoutine`. Since `actionSourceKey('workout', entityId, …)` keys the
gamification ledger verbatim by that id, any consumer that awards with the returned
entityId would mint a `workout:<routineId>` source key that never matches reconcile's
`workout:<logId>` key — a latent double-award / misattribution. Observable success: the
command workout success result carries the exact `workout_logs` row id, proven by unit +
integration tests that fail on the current code.

## Context

- Run 1 (HEAD `f81098d` / `6f722fc`) fixed the two workout-screen paths
  (`WorkoutScreen` quick-complete, `WorkoutSessionScreen` finish) to call
  `recordAction('workout', logId)` with the new `CompleteRoutineResult.logId`, and made
  id-less workout fast-path awards a miss (`awardGamificationAction` returns null for
  `kind === 'workout'` without entityId). Reconcile backfills with explicit log ids.
- The command-center path was explicitly deferred as the successor hint:
  `executeLogWorkout` still returns `entityId: routineId`.
  (` .agent/execplans/area7-triage-workout-gamification-entityid-v1.md:113-114`).
- No in-repo caller currently feeds the command `entityId` into `recordAction`
  (`CommandScreen.handleConfirm` only surfaces the message), so the live defect is wrong
  metadata + no exact fast-path attribution; reconcile heals the XP late. The fix is
  still P1 product-correctness: the returned id is the only attribution handle the
  command path gives out, and it names the wrong entity.
- Closed candidates (verified, NOT re-fixed):
  - Area 8 F7: `OverviewScreen` has `loadError` state, F7 comment, error panel + retry
    (`features/overview/OverviewScreen.tsx:227,268-271,530-544`).
  - Area 8 F8: `ProgressInsightsView` (`:37-67,73-101`: loadError, retry, day-rollover,
    foreground refresh) and `ActivityTimelineView` (`:68-94,111-139`: same pattern).
  - Todos F12: `resolveTodoProjectGoalAssociation` F12 branch clears a project-bound goal
    when the project is cleared (`features/todos/todos.data.ts:372-376,415-425`).

## Scope

- Thread `CompleteRoutineResult.logId` through `executeLogWorkout` as the success
  `entityId` (`result.logId ?? null`; null only when no log was written, which cannot
  happen on the `applied` branch but keeps the type honest).
- Update the stale unit-test `completeRoutine` mocks to the post-Run-1 result shape
  (include `logId`).
- Add regression tests: unit (mocked `completeRoutine` → entityId equals the log id, not
  the routine id) + integration (real DB: entityId equals the `workout_logs` row id;
  awarding with it lands on that exact log and reconcile awards nothing further).

## Non-Goals

- Wiring `recordAction` into `CommandScreen` (new React-context dependency; reconcile
  already heals command-center XP — out of scope for this minimal fix).
- Re-triaging Area 7, re-doing workout-screen `recordAction` paths, habit
  pause/archive durability, `weekly_reviews` remote table, native e2e, Supabase/remote
  migrations, store/EAS, meta-guards, theme matrices.

## Current Checkpoint

- Current milestone: COMPLETE — defect proven, fixed, and gated; committed locally.
- Completed: Verified closed candidates (F7/F8/F12); proved the defect with failing
  unit + integration tests; fixed `executeLogWorkout` to return `result.logId ?? null`;
  refreshed stale `completeRoutine` mocks; full unit (1828) + integration (321) suites,
  typecheck, lint, and parity scripts green; plan validated; committed locally.
- In progress: None.
- Important modified files: `features/command/command.executor.ts`,
  `tests/command.executor.test.ts`, `tests/integration/commandWorkoutLogId.test.ts`.
- Last successful validation: `npm run test:integration` 68 files / 321 tests PASS
  (2026-09-20); `agent:plan:validate` PASS.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: None — all conditions validated.

## Progress

- [x] Verify closed candidates (F7, F8, F12) — closed, evidence cited.
- [x] Verify command-center `entityId: routineId` defect live.
- [x] Prove defect with failing test.
- [x] Minimal fix in `executeLogWorkout`.
- [x] Unit + integration regression tests green.
- [x] Typecheck / lint / affected QA gates green.
- [x] Plan COMPLETED + validated; local commit.

## Surprises & Discoveries

- `CommandScreen.handleConfirm` never calls `recordAction`: the command surface has no
  gamification fast path at all — reconcile is currently its only award route. This
  bounds the live blast radius to wrong-metadata + delayed XP, and confirms the minimal
  threading fix (no CommandScreen wiring) is the right scope.

## Decision Log

- 2026-09-20 — Fix = return `result.logId ?? null` as entityId, no `recordAction`
  wiring in CommandScreen. Why: minimal attribution correction; reconcile remains the
  award route for command writes; avoids adding a gamification-context dependency to
  the command overlay.
- 2026-09-20 — Fallback is `null`, never `routineId`. Why: falling back to the routine
  id would reintroduce the exact misattribution being removed; a null id degrades to
  reconcile backfill with the correct log id.

## Validation Ledger

- 2026-09-20 — `node -v` → v22.23.2 PASS; `git status --short` clean at `6f722fc`.
- 2026-09-20 — new unit test pre-fix FAIL (`expected 'routine_1' to be
  'wrk_log_exact_1'`) — defect proven; post-fix 12/12 PASS.
- 2026-09-20 — new integration test pre-fix FAIL (entityId `wrk_…880` ≠ log row
  `wrk_…881`; routine and log ids share the `wrk_` prefix) — defect proven at the DB
  level; post-fix 2/2 PASS.
- 2026-09-20 — `npm run typecheck` PASS; `npm run lint` PASS (exit 0).
- 2026-09-20 — `npm run test:unit` PASS — 142 files / 1828 tests.
- 2026-09-20 — `npm run test:integration` PASS — 68 files / 321 tests (includes
  `commandCenterV2`, `gamificationWorkoutAward`, `gamification`).
- 2026-09-20 — `journey-label-parity` OK; `quarantine-register-parity` OK.
- 2026-09-20 — `npm run qa:affected` resolved qa:fast → qa:full; ran the cheapest
  sufficient gates instead (no UI/rendered-output change — `DraftPreview` renders
  only `successResult.message`; successor hint scoped gates to typecheck +
  gamification/workout suites + plan validate). e2e:full/simulation NOT RUN —
  recorded as a deliberate scope decision, not a pass.

## Changed Files / Areas

- `features/command/command.executor.ts` — return `logId` as workout success entityId.
- `tests/command.executor.test.ts` — `completeRoutine` mocks to Run-1 shape + new
  exact-logId assertion.
- `tests/integration/commandWorkoutLogId.test.ts` — new real-DB exact-attribution test.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this plan.
2. Run `git status --short`, `git diff --stat`; Git wins over narrative.
3. Continue from `Exact next action` above; update this checkpoint at each milestone.
4. Finish with `npm run agent:plan:validate -- --plan .agent/execplans/command-workout-logid-entityid-v1.md`
   and a local commit (no push).

## Outcomes & Retrospective

- Status: Complete.
- Summary: `executeLogWorkout` now returns the `workout_logs` row id just written
  (`result.logId ?? null`) instead of the routine id. Proven by a unit test (mocked
  `completeRoutine` → entityId equals the log id) and a real-DB integration test
  (entityId equals the `workout_logs` row; awarding with it lands on that exact log
  and reconcile awards nothing further), plus a ledger-level test pinning the old
  shape (routine id mints a foreign source key → double award). Stale
  `completeRoutine` mocks updated to the Run-1 result shape. Full unit + integration
  suites, typecheck, lint, and parity scripts green; committed locally, no push.
- Follow-up: remaining related P1s — (1) non-workout id-less fallback still awards
  oldest-unrewarded while its docstring says nothing (deliberate per-kind decision,
  open for todos/focus/plans/reviews); (2) linked-action workout effects
  (`logWorkoutFromLinkedAction`) never call `recordAction` — reconcile-only, confirm
  intentional; (3) command surface still has no gamification fast path (reconcile-only
  XP for command writes) — wiring `recordAction` into `CommandScreen` is a possible
  latency follow-up; (4) Area 7 native tap e2e (Maestro) still needs a device lane.
- Lessons: routine and log ids share the `wrk_` prefix, so the misattribution was
  invisible to prefix-based inspection — only a real-DB row comparison exposed it.
