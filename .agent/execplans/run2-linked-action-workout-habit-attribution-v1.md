# ExecPlan: run2 linked-action workout XP + habit fast-path attribution

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Run 2 on HEAD `a5fb735` (non-workout id-less award alignment landed):

1. Confirm or fix the `logWorkoutFromLinkedAction` XP path — currently
   reconcile-only — so linked-action workouts award correctly with `entityId`.
2. If already correct, ship the next highest box-executable
   product-correctness gap (real award/attribution bug; Command UI wiring only
   if clearly broken/missing awards).

## Context

- HEAD `a5fb735` clean at start. Host Node v22.23.2 on PATH.
- Run-1 lineage: workout screens pass exact `logId` to
  `recordAction('workout', logId)`; id-less workout fast path returns null;
  command `executeLogWorkout` returns the `workout_logs` row id;
  todo/focus/plan/review id-less fast paths return null. Habit + nutrition
  keep the oldest-unrewarded fallback.
- Engine under investigation: `features/workout/workout.data.ts`
  (`logWorkoutFromLinkedAction` :1123-1171),
  `core/linked-actions/linkedActions.effects.ts` (`'workout.log'` :85-99),
  `features/gamification/gamification.data.ts` (`awardGamificationAction`
  :416-449, `loadActivityCandidates` :542-599, `reconcileGamificationActivity`
  :607-624, `runGamificationHousekeeping` :655-663),
  `features/habits/HabitsScreen.tsx` (`handleIncrement` :615-627),
  `features/habits/habits.domain.ts` (`isHabitActionableOn` :307-318,
  `actionSourceKey` in `gamification.domain.ts` :513-526).

## Scope

- Decision 1 (linked-action workout): document code evidence; pin with a
  reconcile regression test. NO data-layer award call (layering: `*.data.ts`
  must not import gamification as a required side effect — documented in
  `openspec/changes/archive/2026-09-14-close-gamification-overnight-reconcile-gap/design.md:26`;
  reconcile passes explicit ids for all six effect kinds).
- Decision 2 (next gap): fix habit fast-path date/confirmation attribution —
  `HabitsScreen.handleIncrement` fires `recordAction('habit', habitId)` (today
  key) even for backdated (`selectedDateKey`) increments and even when
  `incrementHabit` refused the write (`count: 0`). A past-day check-in
  double-pays (today-key event now + yesterday-key event at reconcile) and
  marks today active with no today action. Fix: pure domain predicate
  `shouldAwardHabitFastPath` + screen gate; backdated increments degrade to
  reconcile (exact, silent — the established miss+reconcile policy).

## Non-Goals

- Wiring `recordAction` into `CommandScreen` (reconcile heals command XP;
  not clearly broken — explicitly deferred by prior plans; job excludes it).
- Wiring `recordAction('plan' | 'review')` into DailyPlan/WeeklyReview
  (reconcile-only by design; latency-only follow-up).
- Habit/nutrition id-less fallback alignment (latent, no live caller;
  follow-up, not this run).
- Todo-toggle `result.completed` gating (same phantom shape, narrower race;
  recorded as follow-up).
- Native e2e, EAS, push/tags, Supabase/remote migrations, model fallback,
  meta-guards, theme matrices. No broad `pkill -f vitest`.

## Current Checkpoint

- Current milestone: COMPLETE — investigated, fixed, tested, gated, validated.
- Completed: linked-action evidence gathered (all six `*FromLinkedAction`
  writers return `producedEntityId` and never call `recordAction`/
  `awardGamificationAction`; `logWorkoutFromLinkedAction` writes
  `workout_logs` with `completed_at = now` and `producedEntityId = input.id`;
  reconcile's workout candidate query finds it by today's `completed_at`
  range and awards with that exact id; housekeeping reconciles yesterday +
  today before freeze). Habit past-day double-pay traced (screen awards
  today-key `:HabitsScreen:623` while the write targets `selectedDateKey`;
  reconcile later pays the action-day key — two events, one increment).
  Implemented `shouldAwardHabitFastPath` predicate + `handleIncrement` gate
  - 3 predicate unit tests + 2 new integration suites (4 tests); targeted
    suites green (integration 25/25 related, unit 73/73 related + 52/52
    habits.domain); `typecheck` 0 errors; fixed import order post-edit.
- In progress: `npm run lint` (repo-wide; re-run on touched files after).
- Important files: `features/habits/habits.domain.ts` (new predicate),
  `features/habits/HabitsScreen.tsx` (`handleIncrement` gate),
  `tests/habits.domain.test.ts` (predicate unit tests),
  `tests/integration/linkedActionWorkoutAward.test.ts` (new reconcile pin),
  `tests/integration/habitBackdateAward.test.ts` (new reconcile pin).
- Last successful validation: `npm run typecheck` PASS (0 errors);
  `npm run lint` PASS (0 errors, 0 warnings); targeted vitest PASS (new
  suites 4/4, habits.domain 52/52, related integration 25/25, related unit
  73/73); `agent:plan:validate` PASS (2026-09-20).
- Current failures: none.
- Relevant quarantines: none.
- Blockers: none.
- Condition required to unblock: none.
- Exact next action: none — task complete.
- Remaining definition of done: none — all conditions validated.

## Progress

- [x] Investigate linked-action workout XP path with code evidence.
- [x] Pin linked-action workout reconcile (integration test).
- [x] Add `shouldAwardHabitFastPath` predicate + unit tests.
- [x] Gate `HabitsScreen.handleIncrement` (today-only + confirmed write).
- [x] Pin habit backdate reconcile (integration test).
- [x] Targeted vitest + typecheck + lint + plan validate.
- [x] Local commit (no push).

## Surprises & Discoveries

- `CommandScreen.handleConfirm` still never calls `recordAction` — command
  XP is reconcile-only by prior-plan decision; awards are delayed, not
  missing, so the job's Command-UI condition ("only if clearly
  broken/missing") does not trigger.
- `incrementHabit` returns `{count: 0}` (not a throw) for
  missing/paused/unscheduled writes, while `executeLogHabit` (command path)
  already gates on `result.count < 1` — the screen path is the inconsistent
  one.
- Quantitative "+" button (`HabitsScreen:988-989`) has no `disabled` prop
  but its container is gated on `actionableOnSelected` (`:953`), so the live
  hole is backdated dates + stale-render races, both covered by the gate.

## Decision Log

- 2026-09-20 — Linked-action workout: CORRECT, no fix. Why: reconcile-only
  is the documented design (data layer never awards; all six effect kinds
  behave identically); `producedEntityId` IS the `wrk_` log id and reconcile
  awards it exactly; housekeeping covers yesterday + today before freeze, so
  no streak misclassification; ledger idempotency blocks doubles.
- 2026-09-20 — Next gap = habit fast-path date/confirmation attribution.
  Why: live, reachable via the supported day-strip backfill flow, produces
  wrong ledger rows (phantom today activity + double XP) — a real
  award/attribution bug, not latency. Fix degrades non-today/unconfirmed
  increments to reconcile (exact + silent), matching the miss+reconcile
  policy from Run 1.
- 2026-09-20 — Predicate lives in `habits.domain.ts` (pure, unit-tested)
  rather than inline-only. Why: repo testing strategy covers domain, not
  screens; the policy ("fast path only for confirmed today writes") deserves
  a pinned unit.

## Validation Ledger

- 2026-09-20 — `node -v` → v22.23.2 PASS; `git status --short` clean at
  `a5fb735` PASS; HEAD `git rev-parse` =
  `a5fb7351aee54f6114783a3a7fc81230d5659106` PASS.
- 2026-09-20 — new `linkedActionWorkoutAward` 2/2 PASS; new
  `habitBackdateAward` 2/2 PASS; `habits.domain` 52/52 PASS (3 new).
- 2026-09-20 — related integration 25/25 PASS (`gamification`,
  `gamificationWorkoutAward`, `gamificationIdlessAward`,
  `commandWorkoutLogId`, `linkedActionEffectsExactlyOnce`); related unit
  73/73 PASS (`habits.data`, `gamification.domain`, `command.executor`).
- 2026-09-20 — `npm run typecheck` PASS (0 errors).
- 2026-09-20 — `npm run lint` (`--max-warnings 0`) PASS on final files;
  targeted eslint on touched files PASS; prettier check PASS on touched files.
- 2026-09-20 — final re-run post-format: `habitBackdateAward` +
  `linkedActionWorkoutAward` 4/4 PASS; `habits.domain` 52/52 PASS.
- 2026-09-20 — `agent:plan:validate` PASS.

## Changed Files / Areas

- (pending) `features/habits/habits.domain.ts`
- (pending) `features/habits/HabitsScreen.tsx`
- (pending) `tests/habits.domain.test.ts`
- (pending) `tests/integration/linkedActionWorkoutAward.test.ts`
- (pending) `tests/integration/habitBackdateAward.test.ts`

## Outcomes & Retrospective

- Status: Complete.
- Summary: (1) Linked-action workout XP confirmed correct — reconcile-only
  by documented design, awarded exactly via `producedEntityId`, pinned by
  `linkedActionWorkoutAward` (applied → reconcile pays the exact log id
  once; skipped → zero). No data-layer change. (2) Fixed habit fast-path
  misattribution: `HabitsScreen.handleIncrement` now fires `recordAction`
  only for confirmed today writes (`shouldAwardHabitFastPath` in
  `habits.domain.ts`, unit-tested); backdated day-strip check-ins and
  refused writes degrade to silent exact reconcile. Pinned by
  `habitBackdateAward` (yesterday increment → one award under yesterday's
  key, zero under today's). Typecheck/lint green, targeted suites green,
  committed locally, no push.
- Follow-up: habit/nutrition id-less fallback alignment (latent, no live
  caller); `recordAction` in `CommandScreen` and plan/review wiring
  (latency-only, reconcile heals); TodosScreen toggle-result gating on
  `result.completed` (same phantom shape, narrower race); Area 7 native tap
  e2e (device lane).
- Lessons: habit source keys are per-habit-per-day while `recordAction`
  defaults to today — any screen that writes for a non-today date must not
  use the bare fast path; the command executor already knew this
  (`result.count < 1` gate in `executeLogHabit`) but the screen did not.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this plan.
2. Run `git status --short`, `git diff --stat`, `node -v` (expect v22.23.2).
3. Continue from `Exact next action` above; update this checkpoint at each
   milestone.
4. Before finishing: `npm run typecheck`, `npm run lint`, targeted vitest
   suites listed under definition of done,
   `npm run agent:plan:validate -- --plan
.agent/execplans/run2-linked-action-workout-habit-attribution-v1.md`,
   local commit (no push).
