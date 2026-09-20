# ExecPlan: Daily-Plan Scheduled-Habits Lifecycle Exclusion

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

The Daily Plan "Scheduled habits today" list must honour the same durable
habit-lifecycle contract as every other today-obligation surface: a paused or
archived habit owes nothing and must not be listed as scheduled. Today
`DailyPlanView` filters only by `isHabitScheduledOn` (schedule rule), so a
paused vacation habit still appears under "Scheduled habits today" while the
Habits tab, Overview rings, reminders, notification completion, command
`log_habit`, and Ask retrieval all treat it as carrying no obligation. Fix the
contradiction with a pure, unit-tested selector and wire the view to it.

## Context

- Decided F1 lifecycle semantics (migration 20: `habits.status` +
  `habits.lifecycle_history`, written atomically by
  `setHabitLifecycleStatus` in `features/habits/habits.data.ts:783-830`):
  "Pause from today (inclusive): the habit owes nothing until resumed."
- Established today-denominator pattern in
  `features/habits/HabitsScreen.tsx:689-699`: status-active filter, then
  `isHabitScheduledOn`.
- Canonical schedule+lifecycle gate in
  `features/habits/habits.domain.ts:307-318`: `isHabitActionableOn`
  (schedule AND NOT lifecycle-masked), documented as shared by "increments,
  linked-action adapters, and UI enablement".
- Offender: `features/daily-plan/DailyPlanView.tsx:104-107` —
  `habits.filter((h) => isHabitScheduledOn(h.rule_history, today, h.target_per_day))`.
  `DailyPlanView` is always rendered for today (`PlanningHubScreen.tsx:75`
  passes no `dateKey`), so the today-obligation contract applies directly.
- Cross-feature domain import precedent: `momentum.domain.ts:1` imports from
  `habits.domain`; `overview.domain.ts:8` imports `isHabitScheduledOn`.
- Existing unit suite: `tests/dailyPlan.domain.test.ts`.

## Scope

- Add pure `selectScheduledHabitNamesForPlan(habits, dateKey)` to
  `features/daily-plan/dailyPlan.domain.ts` (status-active AND actionable-on).
- Wire `DailyPlanView` to the selector (no behavior change besides exclusion).
- Vitest RED→GREEN coverage in `tests/dailyPlan.domain.test.ts`.
- Targeted tests + `npm run typecheck` (+ lint on touched files); local commit.

## Non-Goals

- No pomodoro-session assert invention (no UI message contract exists).
- No settings normalize-on-write policy rewrite (policy, not a mirror).
- No weekly-review draft-shape contract invention.
- No gamification/XP, native/device lanes, push/tags/EAS/PII.
- No change to schedule resolution itself (no creation-date fallback added;
  mirrors `HabitsScreen` today denominators exactly).

## Current Checkpoint

- Current milestone: COMPLETE — fix verified and committed locally.
- Completed: Survey; RED (5 failed / 16 passed on verbatim-extracted
  schedule-only selector); GREEN fix (pure `selectScheduledHabitNamesForPlan`
  = status-active AND `isHabitActionableOn`); view wired; targeted suite
  21/21; typecheck 0 errors; eslint clean on touched files; local commit.
- In progress: None.
- Important modified files: `features/daily-plan/dailyPlan.domain.ts`,
  `features/daily-plan/DailyPlanView.tsx`, `tests/dailyPlan.domain.test.ts`.
- Last successful validation: 21/21 unit + typecheck + eslint (2026-09-20).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: None — all conditions proven (RED 5-fail pre-fix; selector excludes paused/archived via status + interval mask; view wired; 21/21 unit + typecheck + lint green; committed locally).

## Progress

- [x] Survey candidates against HEAD; isolate one real box-executable gap.
- [x] ExecPlan created (Plan-Version: 2, ACTIVE).
- [x] RED: verbatim-extracted selector + failing tests (5 failed / 16 passed).
- [x] GREEN: selector fix + view wiring (21/21).
- [x] Targeted tests + typecheck (+ lint) pass.
- [x] Local commit; plan marked COMPLETED.

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-09-20 — Selected Daily-Plan lifecycle exclusion over thinning: it is a
  real contradictory-UI product bug (criterion B), box-executable, P2 but the
  only live item after honest survey; pomodoro-session asserts and
  weekly-review drafts stay out (no UI contract to mirror — inventing one is
  explicitly out of scope). Selector semantics = status-active AND
  `isHabitActionableOn` (covers legacy status-only rows and interval-masked
  dates; for today both agree with `HabitsScreen`).

## Validation Ledger

- 2026-09-20 — `node -v` — PASS — v22.23.2 (repo-pinned, verified before tests).
- 2026-09-20 — `npx vitest run tests/dailyPlan.domain.test.ts --project unit` on schedule-only selector — RED as designed — 5 failed / 16 passed (paused, archived, paused-legacy, closed-interval, mixed cases fail).
- 2026-09-20 — same suite after fix — PASS — 21/21.
- 2026-09-20 — `npm run typecheck` — PASS — 0 errors.
- 2026-09-20 — `npx eslint <3 touched files> --max-warnings 0` — PASS after `prettier --fix` (2 pre-existing-style format nits in new code, semantics untouched; suite re-run GREEN after fix).

## Changed Files / Areas

- `features/daily-plan/dailyPlan.domain.ts` — new pure selector.
- `features/daily-plan/DailyPlanView.tsx` — use selector.
- `tests/dailyPlan.domain.test.ts` — RED→GREEN coverage.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan.
2. `git status --short`; `git diff --stat`; confirm HEAD still `14bb0b2`-based.
3. Verify `node -v` is v22.23.2 before any test.
4. Continue from `Exact next action` above.

## Outcomes & Retrospective

- Status: COMPLETED.
- Summary: Daily Plan "Scheduled habits today" now excludes paused/archived habits via the pure `selectScheduledHabitNamesForPlan` selector (status-active AND `isHabitActionableOn`), matching the decided migration-20 today-obligation contract used by Habits denominators, Overview rings, reminders, and notification/command guards. RED→GREEN proven; typecheck/lint clean; committed locally (no push, no tag).
- Follow-up: none for this gap. Nearest residuals remain blocked/out-of-scope by mission rules: pomodoro-session data-layer asserts (no UI message contract — must not invent), settings normalize-on-write (policy), weekly-review draft shape (no single UI contract), native/device lanes (owner/device/CI).
