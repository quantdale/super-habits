# ExecPlan: ask-habit-streak-pause-masking-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Ask "habit_streak" answers ("How are my streaks?") must agree with the Habits
tab: a paused interval bridges the streak instead of breaking it. Today
`computeHabitStreaks` (`features/command/ask.retrieval.ts:151`) drops the
habit's durable `lifecycle_history` (and creation-date fallback), so Ask
reports a reset streak for habits whose pause just ended while HabitsScreen,
HabitDetailModal, insights, momentum, gamification, the heatmap grid, and
`retrieveHabitProgress` all report the bridged streak. Observable success: one
new unit test with a paused interval in the middle of a run asserts the bridged
streak through `retrieveHabitStreak`, and it passes.

## Context

- Durable habit lifecycle landed in migration 20 (`habits.status`,
  `habits.lifecycle_history`); every streak/consistency surface threads
  `lifecycle_history` into `buildDayCompletions`/`buildHabitGrid` so paused
  dates arrive as unscheduled and streaks bridge the gap.
- `retrieveHabitStreak` is live via the `habit_streak` intent
  (`features/command/askParser.ts:359-363`) and the deterministic fallback
  (`deterministicAnswer`), not dead code.
- `computeHabitStreaks` is the single private helper behind all three
  `retrieveHabitStreak` call sites (overall list + single lookup); it calls
  `buildDayCompletions(completions, targetPerDay, undefined, ruleHistory)`
  with no `fallbackEffectiveFromDate` and no `lifecycleHistory`.
- `retrieveHabitProgress` already masks correctly via
  `calculateHabitProgressInsights(habit, …)` which forwards
  `habit.lifecycle_history`; this change makes streak retrieval consistent
  with it.
- `buildDayCompletions` signature:
  `(completions, targetPerDay, days?, history?, fallbackEffectiveFromDate?,
  todayKey?, lifecycleHistory?, rangeStartDateKey?)`.
- `habitCreationDateKey(created_at)` (`features/habits/habits.domain.ts:238`)
  is the canonical creation fallback used by all masked call sites.
- Existing tests: `tests/ask.retrieval.test.ts` → `describe('retrieveHabitStreak')`
  mocks `@/features/habits/habits.data` (`listHabits`, `getCompletionHistory`).

## Scope

- Thread `lifecycle_history` + creation fallback through `computeHabitStreaks`
  at both `retrieveHabitStreak` call sites.
- One regression unit test proving the bridged streak (red before, green after).
- Gates: focused vitest file, then `typecheck` + `lint` + full unit project.

## Non-Goals

- No schema/migration change; no sync/backup/portable touch.
- No change to `retrieveHabitProgress`, daily overview, or any masked surface.
- No E2E (Ask deterministic fallback is unit-covered; e2e Ask needs a remote
  boundary per known-gap entries 10–13).
- No native-only work; no push/tags.

## Current Checkpoint

- Current milestone: COMPLETE — fix shipped, all gates green, committed locally.
- Completed: survey; red-proof test (1/7 vs 8/8); fix threading
  `lifecycle_history` + creation fallback through `computeHabitStreaks`;
  full unit suite 1827 pass; typecheck/lint/parity clean; plan validated;
  committed locally (no push/tags).
- In progress: none.
- Important modified files: `features/command/ask.retrieval.ts`,
  `tests/ask.retrieval.test.ts`.
- Last successful validation: `npm run lint` exit 0; `test:unit` 142/142
  files, 1827/1827 tests; both parity scripts OK (2026-09-20).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: None — every Progress item is checked and validated.

## Progress

- [x] Survey audits + tree; choose gap (2026-09-20).
- [x] Regression test proves defect (red: current 1/longest 7 vs 8/8).
- [x] Fix + test green (21/21 ask.retrieval; 76 adjacent).
- [x] Full unit (1827) / typecheck / lint / parity gates.
- [x] Plan COMPLETED + validated + committed locally.

## Surprises & Discoveries

- The four prompted candidates (weekly-review idempotency F3, todos bulk F4,
  todos F12, pomodoro updater side effects) are all already fixed on main, as
  are Area 8 F2/F4, Area 2 F1/F2/F5, Area 1 F5/F9/F10/F11, pomodoro findings
  2–3, calories diary/index/goal-recompute, portable planning import, scope
  epochs, `weekly_reviews` remote table, adapter column projection, PWA
  reload/update staleness, and most Area 6/8 P2s.
- `retrieveHabitProgress` masks via insights domain but the sibling
  `retrieveHabitStreak` helper does not — the inconsistency survived because
  the two paths use different streak plumbing.

## Decision Log

- 2026-09-20 — Chose Ask streak pause-masking over weaker P2s: it is the last
  unmasked streak surface, user-visible (contradictory numbers across
  surfaces), fully box-verifiable, minimal fix. Habit pause-schema durability
  itself is out of scope per job constraints, but this consumes the already-
  durable column.
- 2026-09-20 — Unit test (mocked data layer) over integration: matches the
  existing `retrieveHabitStreak` test style and pins the exact contract.

## Validation Ledger

- 2026-09-20 — `node -v` — PASS — v22.23.2.
- 2026-09-20 — new test pre-fix — FAIL (as designed) — current 1/longest 7
  vs expected 8/8: Ask streak ignored the paused interval.
- 2026-09-20 — `npx vitest run tests/ask.retrieval.test.ts` post-fix —
  PASS — 21/21.
- 2026-09-20 — adjacent `askParser/autoModeRouter/habits.domain` — PASS —
  76/76.
- 2026-09-20 — `npm run test:unit` — PASS — 142 files, 1827 tests.
- 2026-09-20 — `npm run typecheck` — PASS — clean.
- 2026-09-20 — `npm run lint` — PASS — exit 0.
- 2026-09-20 — `journey-label-parity` + `quarantine-register-parity` — PASS.
- 2026-09-20 — e2e battery — NOT RUN (justified) — no e2e spec covers the
  `habit_streak` retrieval path (verified by grep); Ask remote suites are
  env-gated per known-gaps 10–13; unit pins the contract.

## Changed Files / Areas

- `features/command/ask.retrieval.ts` — thread lifecycle + fallback (pending).
- `tests/ask.retrieval.test.ts` — paused-interval regression test (pending).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan.
2. `git status --short; git log --oneline -3` (base: `61ed1f3`, clean main).
3. Verify `node -v` is v22.23.2.
4. Continue from `Exact next action` above.

## Outcomes & Retrospective

- Status: Complete.
- Summary: `computeHabitStreaks` now forwards `lifecycle_history` and the
  creation-date fallback into `buildDayCompletions`, so Ask streak answers
  bridge paused intervals exactly like the Habits tab, insights, momentum,
  gamification, grid, and `retrieveHabitProgress`. One regression test pins
  the bridged streak (8/8) for a 7-day run split by a 3-day pause.
- Follow-up: none required; residual Ask polish (F10 done, F12 nits) and the
  multi-PR habit-lifecycle schema work remain out of scope per job rules.
- Lessons: when a durable column lands, audit every consumer — sibling
  retrieval paths using different plumbing (`computeHabitStreaks` vs
  insights domain) diverge silently.
