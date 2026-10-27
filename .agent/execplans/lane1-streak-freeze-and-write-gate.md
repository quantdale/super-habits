# ExecPlan: Lane 1 / PR 2 — streak freeze accounting, one streak definition, one habit write gate

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Three audit defects (Appendix C #2, #6, #10) are fixed and pinned by tests:

1. A used streak freeze is released when its day later becomes active, so the
   `MAX_BANKED_FREEZES = 3` ceiling is enforced and a spent grant no longer
   consumes the budget forever.
2. There is ONE streak definition (`features/habits/habitStreak.domain.ts`) and
   the Habit surfaces plus the local reward ledger both route through it, so two
   numbers labelled "streak" on Home can no longer disagree about the same data.
3. Linked-action habit writers respect the single habit write gate
   (`isHabitActionableOn`), so they can never complete a habit on an unscheduled,
   pre-creation, or paused/archived day.

## Context

- Audit: `/workspace/super-habits-audit.md`, Appendix C items #2, #6, #10, §4.7
  items 2 and 4, §5 recommended order items 2 and 3.
- Single source of truth for local day math: `lib/time.ts`
  (`toDateKey`, `parseLocalDateKey`, `addLocalDays`, `diffLocalDays`).
- Habit schedule authority: `features/habits/habits.domain.ts`
  (`isHabitScheduledOn`, `isHabitActionableOn`, `buildDayCompletions`).
  Spec: `openspec/specs/habit-scheduling-and-history-semantics/spec.md`
  ("Schedule-aware streaks").
- Reward ledger authority: `openspec/specs/local-reward-ledger/spec.md`.
- Reward tables are local-only derived data (never synced, never backed up), so
  releasing a freeze row needs no outbox intent.

## Scope

- `features/habits/habitStreak.domain.ts` (new shared engine)
- `features/habits/habits.domain.ts` (habit adapters)
- `features/gamification/gamification.domain.ts` (reward adapter + freeze state)
- `features/gamification/gamification.data.ts` (freeze release + housekeeping)
- `features/gamification/LevelHero.tsx`, `AchievementsScreen.tsx` (labels)
- `features/habits/habits.data.ts` (linked-action write gate)
- Focused tests: `tests/habitStreak.domain.test.ts` (new),
  `tests/gamification.domain.test.ts`, `tests/habits.data.test.ts`,
  `tests/integration/gamification.test.ts`,
  `tests/integration/habitScheduling.test.ts`,
  `tests/integration/linkedActions.test.ts`.

## Non-Goals

- Housekeeping cost (audit C #3) and the duplicate snapshot read — a different
  lane's work.
- `planAutoFreeze` lookback policy (§3.3) and badge-write transactionality
  (§3.2) — recorded as follow-ups, out of this brief.
- Any change to package deps, `vercel.json`, `.github/`, `supabase/`.

## Current Checkpoint

- Current milestone: Complete.
- Completed: shared streak engine + both adapters; freeze release in the award
  transaction and in housekeeping; unified linked-action write gate; reward
  surface labels; new/extended focused tests.
- In progress: None.
- Important modified files: `features/habits/habitStreak.domain.ts`,
  `features/habits/habits.domain.ts`, `features/habits/habits.data.ts`,
  `features/gamification/gamification.domain.ts`,
  `features/gamification/gamification.data.ts`,
  `features/gamification/LevelHero.tsx`,
  `features/gamification/AchievementsScreen.tsx`.
- Last successful validation: `npm run typecheck` (clean), `npm run lint`
  (0 errors, 0 warnings), `npx vitest run` (2788 passed, 2 skipped).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: Complete.

## Progress

- [x] Read the audit sections for #2, #6, #10, §4.7, §5 and locate the three
      streak implementations and both linked-action habit writers.
- [x] Add `features/habits/habitStreak.domain.ts` (`computeStreakRun`,
      `fillStreakDayGaps`) as the single streak definition.
- [x] Route `calculateCurrentStreak` / `calculateLongestStreak` (Habits tab,
      insights, Ask) through it via `toHabitStreakDays`.
- [x] Route `computeStreakSummary` (reward ledger, Home card) through it via
      `toRewardStreakDays` in sparse mode.
- [x] Fix freeze accounting: `banked` capped at `MAX_BANKED_FREEZES`,
      `used > earned` surfaced via `isFreezeAccountingInconsistent`.
- [x] Add `releaseStaleFreezes`; call it in the award transaction and in
      `runGamificationHousekeeping` before `ensureStreakFreeze`.
- [x] Make `incrementHabitFromLinkedAction` and
      `ensureHabitDailyTargetFromLinkedAction` call `isHabitActionableOn`.
- [x] Distinguish the reward streak label from the per-habit streak label.
- [x] Tests: earn/use/release/cap, scheduled-day gaps, today-not-yet-done,
      freezes, off-day + pre-creation write-gate refusals (real SQLite).
- [x] Full gates: typecheck, lint, full Vitest.

## Surprises & Discoveries

- `ensureHabitDailyTargetFromLinkedAction` had the same gate hole but never
  rendered it visibly: a zero-count row is filtered out by `buildDayCompletions`,
  so the unscheduled write silently vanished. `incrementHabitFromLinkedAction`'s
  unscheduled write was equally invisible, which is why only a row-level
  assertion could catch it — the audit's "✅ static" proof was right.
- The reward ledger's day history is **sparse** (only days with a record), while
  habit day history is **dense** (every local day). A single gapless walk cannot
  serve both: dense needs "absent current day = grace", sparse needs "absent day
  = miss". `computeStreakRun` therefore takes an explicit `sparse` mode, keeping
  one rule set (completed counts, frozen bridges, required miss breaks, today has
  grace) with one documented difference in how an absent day is read.
- Several existing tests asserted the old gate hole (an off-day linked-action
  increment "applied"), and the engine fixture habit was created _today_ while
  the tests wrote to fixed past dates. Both were fixture assumptions, not
  product contracts; the assertions now encode the correct gate behaviour.

## Decision Log

- 2026-10-28 — One engine with a `sparse` flag instead of two modules — keeps a
  single definition of a streak day while preserving each history's documented
  grace semantics; splitting the modules would have re-created audit C #10.
- 2026-10-28 — Release a freeze when the same day has `xp > 0` in the ledger —
  that is exactly the predicate `loadStreakDays` uses for "active", so the
  release decision and the streak reading can never disagree.
- 2026-10-28 — Release inside the award transaction _and_ in housekeeping —
  the award path is where a backdated/linked-action write becomes visible, and
  housekeeping is the only path that sees reconciler-awarded overnight rows.
- 2026-10-28 — Do not clamp `used` to `earned` — the audited defect was the
  silent clamp; `isFreezeAccountingInconsistent` surfaces it instead.
- 2026-10-28 — Keep both habit writers' refusal reason as `target_inactive` —
  it is the existing vocabulary in the linked-action execution/notice surface,
  and adding a new reason would need a contract-registry change in the command
  lane, which this brief does not own.

## Validation Ledger

- 2026-10-28 — `npm run typecheck` — pass (0 errors).
- 2026-10-28 — `npm run lint` — pass (0 errors, 0 warnings, `--max-warnings 0`).
- 2026-10-28 — `npx vitest run` (full suite, both projects) — pass: 256 files,
  2788 tests passed, 2 skipped.
- 2026-10-28 — `npx vitest run tests/habitStreak.domain.test.ts` — pass (18 tests).
- 2026-10-28 — `npx vitest run tests/integration/gamification.test.ts` — pass (15 tests).
- 2026-10-28 — `npx vitest run tests/integration/habitScheduling.test.ts` — pass (8 tests).

## Changed Files / Areas

- `features/habits/habitStreak.domain.ts` — new single streak definition.
- `features/habits/habits.domain.ts` — `toHabitStreakDays` + adapters.
- `features/habits/habits.data.ts` — the one write gate in both linked-action
  writers; removed the now-unused `isHabitLifecycleMaskedOn` import.
- `features/gamification/gamification.domain.ts` — `toRewardStreakDays`,
  delegating `computeStreakSummary`, capped/`isFreezeAccountingInconsistent`
  freeze state.
- `features/gamification/gamification.data.ts` — `releaseStaleFreezes` + its two
  call sites and the documented housekeeping order.
- `features/gamification/LevelHero.tsx`, `AchievementsScreen.tsx` — "reward
  streak" label and an explicit per-habit distinction.
- `tests/habitStreak.domain.test.ts` (new), `tests/gamification.domain.test.ts`,
  `tests/habits.data.test.ts`, `tests/integration/gamification.test.ts`,
  `tests/integration/habitScheduling.test.ts`,
  `tests/integration/linkedActions.test.ts`.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this plan.
2. Run `npm run agent:resume -- --plan .agent/execplans/lane1-streak-freeze-and-write-gate.md`.
3. Reconcile warnings against Git. The task is complete; any new work is a
   follow-up below, not unfinished scope.

## Outcomes & Retrospective

- Status: Complete.
- Summary: One streak engine now backs the Habits tab, per-habit insights, Ask,
  and the reward ledger; the reward surface labels its number "reward streak" so
  it cannot be read as the per-habit number. Freeze accounting releases a frozen
  day once that day is genuinely active, caps the bank at 3, and surfaces
  `used > earned` instead of clamping. Both linked-action habit writers now go
  through `isHabitActionableOn`.
- Evidence: `npm run typecheck`, `npm run lint` (`--max-warnings 0`), and the
  full `npx vitest run` (2788 passed) above; new real-SQLite tests cover
  earn/use/release/cap and off-day/pre-creation refusals.
- Remaining: None for this brief.
- Follow-up (not owned here, recorded for the audit): housekeeping cost
  (C #3, one `loadStreakDays` per pass), `planAutoFreeze` single-day bridge
  (§3.3), badge-write transactionality (§3.2), and `GitHubHeatmap`'s own
  independent streak summary (a heatmap caption, not a habit/reward surface).
