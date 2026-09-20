# ExecPlan: Reject future consumed dates in calorie writes (data layer)

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Fail closed when a calorie write targets a future local date, instead of
silently orphaning the row from every user-visible surface. `addCalorieEntry`,
`updateCalorieEntry`, and `addCalorieEntryFromLinkedAction` throw a clear
error for `consumedOn` after today; the edit modal already surfaces data-layer
throws via `calorieError`, so the user sees why the save was refused instead
of watching the entry vanish.

Observable success: moving an entry to tomorrow is rejected with
`Calorie logging is limited to today or a past local date.` and the row stays
on its original day; today/past writes (create, edit, day-move, linked-action)
work unchanged; no new orphaned-future rows can be written from any caller.

## Context

- HEAD `a6e2e6f` clean at start (todo `shouldAwardTodoFastPath` landed).
  Habit fast path gated at `3a66c34`; todo/focus/workout/plan/review id-less
  fast paths return null. Do not reset/rebase. Node v22.23.2 on PATH.
- Survey (this run) verified the whole gamification award surface is gated:
  - Priority 1 (habit/nutrition id-less): already safe — skip. Todo, focus,
    workout, plan, review id-less fast paths return null
    (`gamification.data.ts:435-443`); habit + nutrition keep the
    oldest-unrewarded fallback, but every live caller pairs it with a real
    write (HabitsScreen always passes `habitId`; CaloriesScreen only after a
    successful add/update) and the fallback only ever pays a REAL candidate
    row from `loadActivityCandidates`. Nutrition is additionally self-
    shielding: the id-less path returns null when today has no meal, so a
    past-day write can never mint phantom today XP (a first-pass date gate
    was prototyped and REVERTED as no-op filler).
  - Priority 2 (CommandScreen delayed awards): not broken — skip.
    `CommandScreen` never calls `recordAction` (zero hits in
    `features/command/`); command XP is reconcile-only by documented design,
    so awards are delayed, not missing; failures return error outcomes, so
    no phantom on failed actions and no unmount race.
  - Entry-point audit: todo/habit/workout/focus screen awards all gate on
    confirmed results (`result.completed`, `shouldAwardHabitFastPath`,
    `status === 'applied' + logId`, `result.inserted`); focus durations are
    bounded [1,120]min so zero-duration phantoms are unreachable; all todo
    completion writers set `completed_at` (reconcile-visible); notification
    quick-actions (todo + habit) write reconcile-visible rows with durable
    claims; habit notification refuses stale dates (`dateKey !== todayKey`);
    plan carry-forward preserves draft status (no phantom plan XP); pending
    focus-log retries use stable ids with dedupe-by-id (exactly-once).
- Defect: `features/calories/calories.data.ts` performs NO future-date check.
  `addCalorieEntry` accepts any `consumedOn` (not even format-checked);
  `updateCalorieEntry` checks format only; `addCalorieEntryFromLinkedAction`
  checks nothing. But the decided contract is past-only: the command path
  rejects future (`command.executor.ts:232-237`, `Calorie logging is limited
to today or a past local date.`), the diary navigator caps navigation at
  today (`DiaryDayNavigator` disables future), and every aggregate range ends
  at today (364-day summaries, 30-day frequent foods, diary reads).
- Reachability: the edit modal exposes a free-text date field on web and an
  uncapped `DateTimePicker` on native (`CaloriesScreen.tsx:928-974`, date
  picker only rendered for edits, format-only validation at `:596`), so any
  user can move an entry to a future date. The write succeeds; the entry then
  disappears from the diary (cannot navigate future), summaries, trends,
  heatmaps, and frequent foods — silent data disappearance with no error.
- Layering: fix lives in `features/calories/calories.data.ts` (the choke
  point covering screen + command + linked-action writers). Restore/portable/
  remote-import paths use direct `INSERT` (not these helpers), so legacy rows
  and restores are unaffected. Copy-day writes via direct `INSERT` with a
  navigator-capped destination (unaffected).

## Scope

- Reject `consumedOn > toDateKey()` (lexicographic compare on `YYYY-MM-DD`,
  same as the command path) in `addCalorieEntry`, `updateCalorieEntry`, and
  `addCalorieEntryFromLinkedAction` with the command-path message
  (`Calorie logging is limited to today or a past local date.`); reject
  malformed dates in `addCalorieEntry` with the existing
  `Consumed date must be a valid calendar date (YYYY-MM-DD).` message
  (update path already has it).
- No screen change needed: `handleSubmit` already surfaces data-layer throws
  through `setCalorieError` + `finish()` in `finally`; quick-add and create
  paths can only address today/past by construction.
- Integration regression coverage (real better-sqlite3): future create
  throws + writes nothing; future day-move throws + row stays; today/past
  create + past↔today moves still succeed; future linked-action log throws +
  writes nothing.
- Verify with Node 22: new suite + full calories/gamification/command
  suites, typecheck, lint. No broad `pkill -f vitest`.

## Non-Goals

- No schema/migration change (still v25; no `if (version < 26)` block).
- No change to award ledger semantics, XP values, reconcile windows, or
  id-less guards; no `recordAction` wiring changes (reverted the no-op
  nutrition date gate — filler, not a fix).
- No native `maximumDate` picker prop (the data-layer choke point + existing
  error surfacing covers both platforms with one diff).
- No backfill/repair of pre-existing future rows (none observed; restore
  paths untouched by design).
- No E2E, native, sync, push, tags, EAS, or PII work.

## Current Checkpoint

- Current milestone: COMPLETE — guards + regression tests landed and verified.
- Completed: full award-surface survey with skip evidence (priorities 1-2);
  defect isolated (future `consumed_on` orphan) + reachability confirmed
  (edit modal web/native) + blast-radius checked (existing tests/e2e use
  past/today dates only; restore/portable/copy use direct INSERT);
  `assertConsumableDateKey` added + wired into all three writers;
  `tests/integration/calorieFutureDateRejection.test.ts` added (6 tests);
  RED-on-unfixed confirmed (3 rejection tests fail without the guard);
  full unit+integration (215 files / 2172 tests) + typecheck + full lint
  green on Node v22.23.2; plan validated; committed locally, no push.
- In progress: None.
- Important modified files: (pending)
  `features/calories/calories.data.ts`,
  `tests/integration/calorieFutureDateRejection.test.ts` (new).
- Last successful validation: none yet (baseline: clean tree HEAD `a6e2e6f`
  except this untracked plan; Node v22.23.2).
- Current failures: none.
- Relevant quarantines: none.
- Blockers: none.
- Condition required to unblock: none.
- Exact next action: None — task complete.
- Remaining definition of done: Complete — guards + integration tests green;
  calories + gamification + command suites green; typecheck clean; lint
  clean; plan validated; committed locally, no push.

## Progress

- [x] Survey award paths; document priority-1/2 skips with code evidence.
- [x] Isolate + verify future-date orphan defect (reachability, blast
      radius); revert no-op nutrition gate.
- [x] Add future-date rejection to the three calorie writers.
- [x] Add integration regression tests.
- [x] Verify (Vitest focused + typecheck + lint) on Node 22.
- [x] Validate plan + commit (no push).

## Surprises & Discoveries

- A `shouldAwardNutritionFastPath` screen gate was prototyped first, then
  reverted: the id-less nutrition award returns null when today has no
  candidate meal, so past-day writes cannot mint phantom today XP — the gate
  changed no observable behavior (filler). The real nutrition defect is the
  missing future-date validation, not award attribution.
- `updateCalorieEntry`'s day-move to a past date is fully supported (dayMove
  - `caloriesDayMove` suite); only the future direction is unbounded.

## Decision Log

- 2026-09-20 — Pick future-date calorie rejection as the ONE defect: every
  gamification award path verified gated or reconcile-safe, so the next
  highest box-executable product-correctness gap is silent data
  disappearance (future entries invisible in diary/summaries/trends with no
  error), contradicting the decided past-only contract the command path
  already enforces.
- 2026-09-20 — Enforce at the data layer (all three writers), not the
  screen: one choke point covers edit modal + quick-add + command +
  linked-action writers; restore/portable/remote imports bypass it by
  design (direct INSERT), so legacy data and restores are unaffected.
- 2026-09-20 — Reuse the exact command-path message for the future case and
  the existing format message for malformed dates: one vocabulary for the
  same rule across surfaces.

## Validation Ledger

- 2026-09-20 — `git status --short` clean at HEAD `a6e2e6f` (after revert;
  plan untracked); `node -v` v22.23.2 — context capture.
- 2026-09-20 — `calorieFutureDateRejection` 6/6 PASS (new suite) — green.
- 2026-09-20 — RED check: guard stashed → 3/6 fail (rejections), 3/3
  controls pass; guard restored → 6/6 PASS — fix is load-bearing.
- 2026-09-20 — neighboring unit (calories data/domain, command.executor)
  77/77 PASS; neighboring integration (dayMove, integrity, dateKeys,
  constraints, softDelete, linkedActionExactlyOnce, gamification,
  idlessAward, commandWorkoutLogId, activityTimeline, progressData) 54/54
  PASS.
- 2026-09-20 — `npm test` (both projects) PASS — 215 files / 2172 tests.
- 2026-09-20 — `npm run typecheck` PASS — clean.
- 2026-09-20 — `npm run lint` (full, `--max-warnings 0`) PASS — clean;
  eslint --fix + prettier --write applied to touched files, rerun green.

## Changed Files / Areas

- `features/calories/calories.data.ts` — future (+format) rejection in
  `addCalorieEntry`, `updateCalorieEntry`, `addCalorieEntryFromLinkedAction`
  (pending).
- `tests/integration/calorieFutureDateRejection.test.ts` (new) — future
  create/move/linked-action rejected without writes; today/past paths
  unaffected (pending).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, then `.agent/PLANS.md`, then this plan.
2. Run `git status --short`, `git diff --stat`, `git diff --name-only`;
   inspect relevant diffs. Git wins over stale narrative.
3. Run `npm run agent:resume -- --plan
.agent/execplans/calorie-future-date-rejection-v1.md`
   for discrepancy + QA-impact orientation.
4. Continue only from `Exact next action` above; update this checkpoint at
   every milestone, failure, decision, and before finishing.
5. Never run broad `pkill -f vitest`; Node 22.23.2 is on PATH (fnm).
6. Commit locally with a conventional message when green; do not push.

## Outcomes & Retrospective

- Status: Complete.
- Summary: calorie writers now fail closed on future `consumed_on`
  (`assertConsumableDateKey` in `calories.data.ts`, wired into
  `addCalorieEntry`, `updateCalorieEntry`,
  `addCalorieEntryFromLinkedAction`) with the command-path message, so a
  future date can no longer silently orphan a row from the diary, summaries,
  trends, and heatmaps. The edit modal surfaces the refusal through the
  existing `calorieError` path. Pinned by
  `tests/integration/calorieFutureDateRejection.test.ts` (future create /
  day-move / linked-action log rejected without writes; today/past paths
  unaffected). Full suite (2172) + typecheck + lint green on Node v22.23.2.
  Committed locally, no push.
- Follow-ups: none from this defect (restore/portable/remote imports bypass
  the helpers by design; native `maximumDate` picker cap deliberately left
  out — one-diff choke point preferred).
- Lessons: the id-less nutrition fast path is self-shielding (null when
  today has no candidate), so award-gating there was filler; the live
  nutrition gap was write validation, found only by checking what the award
  layer cannot see (rows no surface queries).
