# ExecPlan: non-workout id-less award alignment

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Align the id-less `awardGamificationAction` / `recordAction` fallback for the
non-workout action kinds (`todo`, `focus`, `plan`, `review`) with the workout
miss+reconcile policy: an id-less fast-path award for an entity-keyed kind
must return null (miss, healed by reconcile backfill with explicit ids)
instead of silently awarding the oldest unrewarded row, which mis-attributes
XP when more than one unrewarded action of that kind exists.

## Context

- HEAD `da72f87`. Clean tree at start. Host Node v22.23.2 on PATH.
- Workout precedent (Run 1, commit `f81098d`): both workout finish paths
  (`WorkoutScreen` quick-complete, `WorkoutSessionScreen` finish) pass the
  just-written log id into `recordAction('workout', logId)`, and
  `awardGamificationAction` returns null for `kind === 'workout'` without an
  entityId (`features/gamification/gamification.data.ts:425-429`). Reconcile
  backfills with explicit log ids. Run 2 (commit `da72f87`) threaded the log
  id through the command-center `executeLogWorkout` result.
- Engine under change: `features/gamification/gamification.data.ts`
  (`awardGamificationAction` id-less fallback at `:425-435`,
  `loadActivityCandidates` at `:528-585` orders todos by `completed_at ASC`,
  focus by `started_at ASC`, workouts by `completed_at ASC`, reviews by
  `completed_at ASC`; plans unbounded order, capped at 25), plus
  `features/gamification/GamificationProvider.tsx:121-142` (`recordAction`
  fast path) and `actionSourceKey` in
  `features/gamification/gamification.domain.ts:513-526` (todo/focus/plan/
  review keyed verbatim by entity id; nutrition keyed by day).
- Stale doc: `docs/knowledge-base/gamification.md:59-62` still describes the
  pre-workout-fix fallback ("callers that only know the kind ... omit it and
  the newest unrewarded action of that kind is awarded") — wrong on both
  counts now (code awards oldest, workout already misses).

## Scope

- Per-kind policy decision with code evidence for `todo`, `focus`, `plan`,
  `review`.
- Implement alignment in `awardGamificationAction`: require `entityId`
  (return null on id-less) for the kinds where the oldest-unrewarded fallback
  can mis-attribute.
- Refresh the `awardGamificationAction` docstring and the stale
  `docs/knowledge-base/gamification.md` fallback paragraph.
- Add/update integration tests covering id-less vs entityId paths for every
  kind changed.
- Validate: typecheck, lint, targeted vitest suites, `agent:plan:validate`;
  local commit, no push.

## Non-Goals

- Changing `habit` / `nutrition` fallback behavior (out of the job's scope;
  recorded as follow-up).
- Wiring `recordAction('plan' | 'review')` into `DailyPlanView` /
  `WeeklyReviewScreen` (reconcile-only by design today; a latency follow-up).
- Wiring `recordAction` into `CommandScreen` (deferred in the prior plan).
- Native e2e, EAS, push/tags, Supabase/remote migrations, model fallback.

## Current Checkpoint

- Current milestone: COMPLETE — policy aligned, tested, and gated;
  committed locally.
- Completed: per-kind evidence (see Decision Log); `gamification.data.ts`
  guard extended to the todos/focus/plan/review kinds + docstring;
  `gamification.md` fallback paragraph refreshed; new
  `gamificationIdlessAward` suite 5/5 PASS; stash-check proves bite on old
  code (4 fail / 1 pass — the pass is the explicit-id-only test, which is
  behavior-identical on both); related integration 21/21, domain unit
  37/37, typecheck 0 errors, eslint 0/0, plan validated; committed locally
  with no remote publish.
- In progress: None.
- Important modified files: `features/gamification/gamification.data.ts`,
  `docs/knowledge-base/gamification.md`,
  `tests/integration/gamificationIdlessAward.test.ts`.
- Last successful validation: `node -v` v22.23.2; `git status --short` clean
  at `da72f87` (2026-09-20).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: None — all conditions validated.

## Progress

- [x] Per-kind evidence + policy decisions (this plan).
- [x] Guard edit in `gamification.data.ts` (+ docstring).
- [x] Refresh stale `gamification.md` fallback paragraph.
- [x] New integration tests for id-less vs entityId paths.
- [x] Targeted vitest + typecheck + lint + plan validate.
- [x] Local commit (no push).

## Surprises & Discoveries

- `DailyPlanView` and `WeeklyReviewScreen` contain zero `recordAction` /
  `awardGamification` references: plan/review awards are reconcile-only
  today, so requiring entityId changes no live behavior for those kinds —
  it only hardens the latent fallback.
- `executeStartFocus` (`features/command/command.executor.ts:317-335`)
  returns `entityId: null` (timer start, no row yet): command-center focus
  awards are reconcile-only too. The exact id becomes available later in
  `PomodoroScreen:343-380` via `recordCompletedPomodoroSession`, which
  already passes `result.id`.
- `executeCompleteTodo` (`command.executor.ts:137-172`) already returns the
  exact `todoId`; `TodosScreen:410-417` and `PomodoroScreen:362` pass exact
  ids. All live todo/focus fast paths are already exact.
- `daily_plans` has a partial unique index (at most one ACTIVE row per
  date_key; see `upsertDailyPlanInTx` in
  `features/daily-plan/dailyPlan.data.ts:108-122`), so the plan fallback
  cannot mis-attribute today — but it is still oldest-unrewarded shaped, and
  requiring entityId is free since no caller uses the fallback.

## Decision Log

- 2026-09-20 — `todo`: REQUIRE entityId (option a). Why: multiple todos can
  complete per day; candidates ordered `completed_at ASC`
  (`gamification.data.ts:538-543`); `actionSourceKey('todo', …)` keys by
  entity id (`gamification.domain.ts:519-524`). An id-less call with two
  unrewarded todos awards the oldest — the exact trap the workout fix
  removed. All production callers already pass exact ids
  (`TodosScreen:417` passes `todo.id`; `executeCompleteTodo` returns
  `todoId`), and reconcile passes explicit ids, so the guard changes no live
  success path — it turns a future silent mis-award into a reconcile-healed
  miss.
- 2026-09-20 — `focus`: REQUIRE entityId (option a). Why: multiple focus
  sessions per day; candidates ordered `started_at ASC` (`:544-550`); keyed
  by session id. Same oldest-unrewarded trap. Live callers exact
  (`PomodoroScreen:362` passes `result.id` from
  `recordCompletedPomodoroSession`, which returns the created `pom_` id in
  `pomodoro.data.ts:204-222`); command start-focus is reconcile-only
  (`entityId: null`).
- 2026-09-20 — `plan`: REQUIRE entityId (option a, not b). Why: although the
  partial unique index caps the fallback at one active candidate per day
  (safe today), the fallback is still oldest-unrewarded shaped and no
  production caller uses it (zero `recordAction` in `features/daily-plan/`;
  command `add_todo_to_daily_plan` returns the todo id, not the plan id).
  Requiring entityId is uniform with the other entity-keyed kinds,
  future-proof, and reconcile (explicit `dplan_` ids from
  `commitDailyPlan`/`completeDailyPlan` in `dailyPlan.data.ts:259-272`)
  is unaffected.
- 2026-09-20 — `review`: REQUIRE entityId (option a). Why: reviews are keyed
  by `wrev_` id; candidates ordered `completed_at ASC` (`:567-573`); two
  reviews (e.g. a late prior-week review + this week's) can complete the
  same day, so oldest-unrewarded can mis-attribute. No production caller
  uses the fallback (zero `recordAction` in `features/weekly-review/`;
  `saveWeeklyReview` in `weeklyReview.data.ts:49-57` returns the `wrev_` id
  for a future exact caller); reconcile passes explicit ids.
- 2026-09-20 — `habit` / `nutrition`: KEEP existing behavior (option c,
  out of scope). Why: the job scopes the decision to todo/focus/plan/
  review. Nutrition is day-keyed (`actionSourceKey` returns the dateKey), so
  its id-less path cannot mis-attribute. Habit keeps its per-habit-per-day
  fallback untouched; any habit oldest-vs-newest concern is follow-up work,
  not this run.

## Validation Ledger

- 2026-09-20 — `node -v` → v22.23.2 PASS; `git status --short` clean at
  `da72f87` PASS.
- 2026-09-20 — new `tests/integration/gamificationIdlessAward.test.ts` —
  5/5 PASS on new code.
- 2026-09-20 — stash-check (old `gamification.data.ts`): new suite 4
  failed / 1 passed — PASS (the 4 id-less assertions bite on the old
  oldest-unrewarded fallback; the pass is the explicit-id-only test, which
  is identical on both).
- 2026-09-20 — related integration (`gamification`,
  `gamificationWorkoutAward`, `commandWorkoutLogId`, `gamificationIdlessAward`)
  — 21/21 PASS.
- 2026-09-20 — unit `gamification.domain` — 37/37 PASS.
- 2026-09-20 — `npm run typecheck` PASS (0 errors); `npm run lint`
  (`--max-warnings 0`) PASS.

## Changed Files / Areas

- `features/gamification/gamification.data.ts` — id-less miss guard now
  covers todo/focus/plan/review + docstring rewritten.
- `docs/knowledge-base/gamification.md` — fallback paragraph refreshed to
  the miss+reconcile policy.
- `tests/integration/gamificationIdlessAward.test.ts` — 5 per-kind id-less
  vs entityId regression tests.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this plan.
2. Run `git status --short`, `git diff --stat`, `node -v` (expect v22.23.2).
3. Continue from `Exact next action` above; update the checkpoint at each
   milestone.
4. Before finishing: `npm run typecheck`, `npm run lint`, targeted vitest
   suites, `npm run agent:plan:validate -- --plan
   .agent/execplans/non-workout-idless-award-alignment-v1.md`, local commit
   (no push).

## Outcomes & Retrospective

- Status: Complete — shipped and verified, committed locally.
- Summary: id-less fast-path awards for the todos, focus, plan, and review
  kinds are now misses (`awardGamificationAction` returns null), healed by
  reconcile backfill with explicit ids — the same miss+reconcile policy as
  workouts. No live success path changes: all live todos/focus callers
  already pass an exact id, and plan/review are reconcile-only today.
  Docstring and `gamification.md` refreshed; 5 new regression tests prove
  id-less miss + exact-id attribution + reconcile backfill per kind.
- Follow-up: habit oldest-unrewarded fallback (kept, out of scope);
  `recordAction('plan' | 'review')` wiring for instant feedback;
  `recordAction` in `CommandScreen`.
