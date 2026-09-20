# ExecPlan: Weekly-review schedule-aware habit summary (F6)

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Weekly Review habit statistics must respect each habit's schedule (`rule_history` via `isHabitScheduledOn` + rule-resolved targets), matching every other habit consumer. An M/W/F habit completed on all 3 scheduled days must report 3 scheduled / 3 completed / 100% — not 7 scheduled / 3 completed / 43% with a false `no_completions` flag. Off-days with 0 completions must never inflate the denominator or trigger attention.

## Context

- Defect: `summarizeHabits` in `features/weekly-review/weeklyReview.summary.ts:88-144` adds `daysInWeek = 7` for EVERY habit and compares against static `habit.target_per_day`, ignoring `rule_history`. Audit F6 (`.agent/hardening-evidence/audit-reports.md`).
- Schedule authority: `features/habits/habits.domain.ts` — `getHabitRuleForDate`, `getHabitTargetForDate`, `isHabitScheduledOn`, `isHabitLifecycleMaskedOn`, `habitCreationDateKey`, `parseHabitLifecycleHistory`.
- Established consumer patterns to match:
  - `features/habits/habitReminders.domain.ts:176-188` — `safeCreationDateKey(created_at)` fallback + per-date `isHabitScheduledOn` + `getHabitTargetForDate`.
  - `features/habits/habitInsights.domain.ts:137-147` — `habitCreationDateKey(created_at)` + `buildDayCompletions(..., rule_history, creationDateKey, todayKey, lifecycle_history)`.
  - `features/habits/HabitsScreen.tsx:711-713` — per-date `isHabitScheduledOn` + `getHabitTargetForDate`.
  - `features/command/command.review.ts:511-523` — `timestampToLocalDateKey(created_at)` + both resolvers.
- F5 landed (`listWeekDateKeys`/`shiftDateKeyByDays` local-calendar arithmetic in `weeklyReview.domain.ts:274-295`, matrix `scripts/qa-timezones.mjs` over `tests/weeklyReview.domain.test.ts`). Reuse; do not regress UTC-dateKey handling.
- No existing `summarizeHabits`/`buildWeeklyReviewSummary` unit or integration tests (verified by grep: only `askParser.test.ts:358` and executor scaffolds reference the shape).
- `Habit` type (`core/db/types.ts:81-97`): `rule_history?`, `status?` (legacy absent = active), `lifecycle_history?`, `created_at`.

## Scope

- Extract pure, DB-free `summarizeHabitWeekOccurrences(habits, completions, dateKeys)` in `features/weekly-review/weeklyReview.domain.ts` (testable like `listWeekDateKeys`).
- Rewire `summarizeHabits` in `weeklyReview.summary.ts` to use it (DB reads stay in summary.ts).
- Per habit × per week dateKey: creation-date fallback → lifecycle mask → `isHabitScheduledOn` → rule-resolved target. Only scheduled days count toward `scheduledOccurrences`/consistency; `no_completions` attention only when scheduled > 0 and completed = 0; zero-scheduled habits contribute nothing and get no flag; `consistencyPercent` null when denominator is 0.
- Unit tests (M/W/F vs daily, rule-resolved target, zero-scheduled, lifecycle mask, timezone pinning) + real-SQLite integration test for `buildWeeklyReviewSummary`.

## Non-Goals

- Habit pause/archive schema durability, workout, PR dead UI, diary copy-day, planning outbox/Supabase, native lanes, push/CI billing.
- Changing `generateInsights` thresholds, todo/focus/workout/calorie summaries, or F5 dateKey helpers.
- New parallel scheduler — reuse `habits.domain` resolvers only.

## Current Checkpoint

- Current milestone: COMPLETE — F6 schedule-aware habit summary shipped and validated.
- Completed: pure `summarizeHabitWeekOccurrences` in `weeklyReview.domain.ts`; `summarizeHabits` rewired (blind 7-day count removed); 9 unit tests + 2 real-DB integration tests; `qa:timezones` 5-zone matrix green; typecheck + touched-surface lint green; full unit suite (1826 tests) green; adjacent integration suites green.
- In progress: none.
- Important modified files: `features/weekly-review/weeklyReview.domain.ts`, `features/weekly-review/weeklyReview.summary.ts`, `tests/weeklyReview.domain.test.ts`, `tests/integration/weeklyReviewSummary.test.ts`.
- Last successful validation: `npm run test:unit` 142 files / 1826 tests PASS; `npm run qa:timezones` PASS (5 zones); typecheck PASS; eslint touched surface PASS.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: None — every condition validated (see Validation Ledger).

## Progress

- [x] Startup: reads, git/node verification, defect evidence confirmed.
- [x] Pure `summarizeHabitWeekOccurrences` in `weeklyReview.domain.ts`.
- [x] Rewire `summarizeHabits` in `weeklyReview.summary.ts`.
- [x] Unit coverage in `tests/weeklyReview.domain.test.ts`.
- [x] Integration coverage `tests/integration/weeklyReviewSummary.test.ts`.
- [x] Validation: focused tests + `qa:timezones` + typecheck/lint under Node 22.23.2.
- [x] ExecPlan COMPLETED + validate + local commit.

## Surprises & Discoveries

- 2026-09-20 — No existing `summarizeHabits`/`buildWeeklyReviewSummary` tests existed, so the F6 defect had zero coverage; the new pure helper + integration test close that gap directly.
- 2026-09-20 — `Habit.status` without lifecycle history (legacy-shaped rows) needed an explicit safety net; post-migration rows always carry history, but without the net a paused legacy row would still generate 7 false misses.

## Decision Log

- 2026-09-20 — Put schedule math in a pure `weeklyReview.domain.ts` helper (F5 precedent: `listWeekDateKeys` extracted for DB-free testing) rather than testing through SQLite only. Keeps `*.data.ts`/DB layering intact and auto-enrolls new tests in the `qa:timezones` 5-zone matrix.
- 2026-09-20 — Creation fallback: `habitCreationDateKey(created_at)` (insights pattern; NaN-safe → undefined → legacy every-day fallback). Matches insights/reminders semantics for empty histories.
- 2026-09-20 — Lifecycle: date-level masking via `isHabitLifecycleMaskedOn` (insights pattern), plus a safety net treating a non-active `status` with empty lifecycle history as fully masked (a paused row without history must not generate 7 false misses). Pre-pause scheduled days in the same week still count.

## Validation Ledger

- 2026-09-20 — startup `git status --short` (clean) + `node -v` (v22.23.2) + HEAD `a2fb4f0` — PASS (baseline).
- 2026-09-20 — `npx vitest run tests/weeklyReview.domain.test.ts` — PASS (51 tests, incl. 9 new F6).
- 2026-09-20 — `npx vitest run tests/integration/weeklyReviewSummary.test.ts` — PASS (2 tests, real SQLite).
- 2026-09-20 — focused `tests/habits.domain.test.ts` + `habitScheduling` + `weeklyReviewExecutor` + `habitInsights` integration — PASS (102 + 15 tests, no regressions).
- 2026-09-20 — `npm run typecheck` (`tsc --noEmit`) — PASS (0 errors).
- 2026-09-20 — `eslint` touched surface (`--max-warnings 0`, prettier autofix applied) — PASS clean.
- 2026-09-20 — `npm run qa:timezones` — PASS (Asia/Manila, UTC, America/New_York, Pacific/Honolulu, Pacific/Kiritimati; 94 tests).
- 2026-09-20 — `npm run test:unit` — PASS (142 files, 1826 tests).
- 2026-09-20 — `npm run qa:affected` — matched `agent-workflow-and-documentation` only; broad regression not required.

## Changed Files / Areas

- `.agent/execplans/weekly-review-schedule-aware-summary-v1.md` — this plan.
- (planned) `features/weekly-review/weeklyReview.domain.ts` — pure helper.
- (planned) `features/weekly-review/weeklyReview.summary.ts` — rewire `summarizeHabits`.
- (planned) `tests/weeklyReview.domain.test.ts` — unit coverage.
- (planned) `tests/integration/weeklyReviewSummary.test.ts` — real-DB coverage.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this plan.
2. Run `git status --short`, `git diff --stat`, `git log --oneline -3`; reconcile with Checkpoint.
3. Run `npm run agent:resume -- --plan .agent/execplans/weekly-review-schedule-aware-summary-v1.md`.
4. Continue from `Exact next action`. Never `push/tag/reset/rebase`; never broad `pkill -f vitest`; use finite QA paths only.

## Outcomes & Retrospective

- Status: Complete.
- Summary: `summarizeHabits` no longer assumes 7 scheduled days per habit. New pure `summarizeHabitWeekOccurrences` resolves each habit × each local week dateKey through Habit Engine V2 (`isHabitScheduledOn` + rule-resolved target, creation-date fallback, lifecycle masking). M/W/F fully completed now reports 3/3/100% with no attention flag (was 7/3/43% + false flag); zero-scheduled habits contribute nothing and stay silent; existing F5 dateKey assertions untouched and still matrix-covered.
- Follow-up: none required. Next product-correctness work per handoff (see final report).
