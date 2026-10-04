# ExecPlan: Fix local-calendar day windows

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Apply the [fix-local-calendar-day-windows OpenSpec change](proposal.md) and its
[tasks](tasks.md): every inclusive "last N local days" window that bounds a
query is computed by local-calendar arithmetic, so a daylight-saving boundary
inside the window can no longer silently give a goal, daily-plan, or project
rollup one day of extra (or missing) history — and each affected read path is
now clock-injectable, so a seeded corpus is evaluated against the seeded day.

## Context

- Starting HEAD `c1bc380ce330cda1e089fd79b49a12029defbb72` on `main`; the tree
  was clean apart from the untracked OpenSpec change directories. The
  `harden-agent-guidance-truth` change had already been applied on top of it.
- Four affected sites: `features/goals/goals.data.ts` (`getGoalRollup`),
  `features/daily-plan/dailyPlan.data.ts` (`listRecentDailyPlans`), and
  `features/projects/projects.data.ts` (`getProjectRollup`,
  `listProjectRollups`). Every consumer used an inclusive lower bound
  (`hc.date_key >= ?`, `date_key >= ?`), which is what turned a one-day-earlier
  start into a one-day-longer window.
- Ground truth verified before editing, all in a forced `America/New_York`:
  a reference of 2026-03-09 00:30 EDT (the morning after the 23-hour
  spring-forward day) computed a 30-day start of `2026-02-07` under
  fixed-millisecond arithmetic versus the correct `2026-02-08`; a reference of
  2026-11-02 23:30 EST (the evening of the day after the 25-hour fall-back day)
  computed `2026-10-05` versus the correct `2026-10-04`; on an ordinary day both
  arithmetics agree.
- The sanctioned pattern already existed: `lib/time.ts`'s `setDate` walk, and the
  archived productivity-expansion design note
  (`openspec/changes/archive/2026-08-30-harden-productivity-expansion-wave-v1/design.md`)
  records the explicit rule against blind `24 * 60 * 60 * 1000` window
  arithmetic.
- `lib/time.ts` already exposes the injectable `nowIso()` seam the integration
  fixtures use, and `tests/time.test.ts` / `tests/calories.domain.test.ts` /
  `tests/integration/dateKeys.test.ts` establish the "force TZ at the top of the
  file" convention (Node re-reads `process.env.TZ` per Date operation).

## Scope

The three task groups in tasks.md: window arithmetic (1.1-1.5), DST regression
coverage (2.1-2.5), and validation (3.1-3.6).

## Non-Goals

No rewrite of the rollup aggregations, ordering, or inclusive/exclusive bound
semantics. No change to `toDateKey()` or any other `lib/time.ts` contract. No new
timezone-matrix zone (the existing matrix already includes America/New_York). No
touch of `getUtcIsoRangeForLocalDateKeys`, which is correct because it queries
UTC timestamp columns. No schema migration.

## Current Checkpoint

- Current milestone: COMPLETE — all 16 tasks in tasks.md are checked, each backed
  by code and executing coverage, with the validation gate recorded from the
  final tree.
- Completed: `lib/time.ts` gained the additive `inclusiveWindowStartDateKey(days,
reference?)` helper and an optional `reference` on `buildDateRangeOldestFirst`
  (so index 0 is the window start); the four sites now derive their window from
  that helper plus `nowIso()`; DST-boundary coverage exists per site plus one
  exactly-N-days integration assertion.
- In progress: none.
- Important modified files: `lib/time.ts`, `features/goals/goals.data.ts`,
  `features/daily-plan/dailyPlan.data.ts`, `features/projects/projects.data.ts`,
  `tests/time.test.ts`, and the new
  `tests/integration/planningDayWindows.test.ts`.
- Last successful validation: pinned Node `v22.23.2` — `npm run qa:fast` green
  (typecheck 0, lint 0/0, unit 157 files / 1941 tests, both parity scripts OK);
  `npm run qa:integration` 78 files / 381 tests passed, 1 file / 2 tests skipped
  (pre-existing); `npm run qa:timezones` 5 zones / 99 tests passed.
- Current failures: none attributable to this change.
- Relevant quarantines: none — no test weakened, skipped, or relaxed; no
  threshold, fixture, or harness touched.
- Blockers: none.
- Condition required to unblock: not applicable.
- Exact resume action after unblock: not applicable.
- Exact next action: none — the change is fully applied. Archiving into
  `openspec/specs/` and committing the tree are separate, user-invoked steps.
- Remaining definition of done: complete.

## Progress

- [x] Wave 0 — confirm or extend the calendar-walk helper (task 1.1).
- [x] Wave 1 — fix all four window starts and the three clock calls (1.2-1.5).
- [x] Wave 2 — per-site DST unit/integration coverage (2.1-2.3) plus the
      exactly-N-days integration assertion (2.4) and the boundary-only proof
      (2.5).
- [x] Wave 3 — validation gate (3.1-3.6) and full-diff review.

## Surprises & Discoveries

- A static `vi.mock('@/lib/time')` factory keeps serving the clock instance it
  captured on its FIRST invocation, even across the `vi.resetModules()` calls
  `freshDatabase()` performs. The first draft of the integration test pinned the
  clock through such a mock and two tests silently read a stale instant (they
  failed with "expected 2 to be 1" rather than a clock error). `fixtures/seeders.ts`
  documents this exact trap and re-binds with `vi.doMock` on every seed; the
  final test instead pins the reference instant with fake timers, which no module
  registry can desynchronize.
- The fall-back failure mode is the mirror image of spring-forward: a reference
  late in the local day after the 25-hour day computes a start one day LATE, so
  the inclusive window silently spans N-1 days and the oracle observed 0 instead
  of 1 completion.
- `.env.example`-style precision matters here too: the off-by-one only appears
  when the reference instant sits within the offset change of local midnight,
  which is why the tests pin 00:30 (spring-forward) and 23:30 (fall-back)
  instants rather than a noon reference — a noon reference passes under BOTH
  arithmetics and would have proven nothing.

## Decision Log

- Reuse and extend the sanctioned `setDate` walk rather than introduce a second
  arithmetic: `inclusiveWindowStartDateKey` is additive, and
  `buildDateRangeOldestFirst` gained an optional `reference` so its index 0 is
  exactly the window start (one implementation, no fork).
- Derive the window from the reference's LOCAL date key, then walk back N-1
  calendar days on the key, rather than compensating a millisecond subtraction
  for the DST offset — the latter needs the offset and reintroduces the same
  error class at the next boundary.
- Clock injection goes through the existing `nowIso()` seam (no new DI
  parameter on four public signatures).
- Put the per-site DST oracles in the integration project with a real SQLite
  database and direct `habit_completions` rows at exact keys, because the defect
  is a SQL lower-bound fact; the pure helper is additionally pinned in
  `tests/time.test.ts` (unit project) at both boundaries and on an ordinary day.
- Pin the reference instant with fake timers rather than a `lib/time` module mock
  (see Surprises).

## Adversarial Review and Dispositions

- **Non-vacuity proven, twice.** Replaying the new coverage against the legacy
  fixed-millisecond arithmetic (temporarily restored, imports kept intact so the
  legacy expression actually executed) failed 5 of the 7 integration tests:
  goal spring-forward 2≠1, goal fall-back 0≠1, daily-plan spring 2 rows, project
  spring 2≠1, and the exactly-N-days assertion 31≠30. Only the ordinary-day test
  passed, which is precisely the intended boundary-only behaviour. The helper
  tests in `tests/time.test.ts` likewise assert the legacy value differs at both
  boundaries. An earlier non-vacuity attempt was confounded (the revert broke the
  `toDateKey` import and failed with `ReferenceError`), so the revert was redone
  with imports intact before drawing any conclusion.
- **Test-only change.** No `app/`, `core/`, `lib/` (beyond `time.ts`), or
  `supabase/` behaviour changed; no schema, migration, threshold, fixture, or
  harness was touched, and no assertion was weakened or skipped.
- **Aggregation semantics preserved.** Only the four window-start expressions and
  the three `Date.now()` calls were replaced; every query's inclusive lower
  bound, ordering, and row shape is byte-identical, which the unchanged
  `planningRollups` / `planningDetails` / `dailyPlanDeletion` suites confirm.

## Validation Ledger

| Date       | Command / source                                                                                                   | Outcome                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-29 | Boundary ground truth, forced `America/New_York`                                                                   | CONFIRMED — 30-day start `2026-02-07` (legacy) vs `2026-02-08` (calendar) at spring-forward; `2026-10-05` vs `2026-10-04` at fall-back evening; identical on an ordinary day |
| 2026-09-29 | `npx vitest run tests/time.test.ts` (pinned Node v22.23.2)                                                         | PASS — 10/10                                                                                                                                                                 |
| 2026-09-29 | `npx vitest run --project integration tests/integration/planningDayWindows.test.ts`                                | PASS — 7/7                                                                                                                                                                   |
| 2026-09-29 | Legacy-arithmetic revert, same integration file                                                                    | FAIL — 5/7 fail (2≠1, 0≠1, 2 rows, 2≠1, 31≠30); proves the coverage is not vacuous                                                                                           |
| 2026-09-29 | `npx vitest run --project integration planning{DayWindows,Rollups,Details.data}.test.ts dailyPlanDeletion.test.ts` | PASS — 23/23                                                                                                                                                                 |
| 2026-09-29 | `npm run qa:timezones` (pinned Node v22.23.2)                                                                      | PASS — Asia/Manila, UTC, America/New_York, Pacific/Honolulu, Pacific/Kiritimati; 99 tests                                                                                    |
| 2026-09-29 | `npm run qa:fast` (pinned Node v22.23.2)                                                                           | PASS — typecheck 0 errors; lint 0 errors / 0 warnings; unit 157 files / 1941 tests; journey-label-parity OK; quarantine-register-parity OK                                   |
| 2026-09-29 | `npm run qa:integration` (pinned Node v22.23.2)                                                                    | PASS — 78 files / 381 tests passed, 1 file / 2 tests skipped (pre-existing skips)                                                                                            |
| 2026-09-29 | `npx prettier --check` on every changed file                                                                       | PASS — all clean                                                                                                                                                             |
| 2026-09-29 | `npm run openspec:validate` (`--all`)                                                                              | PASS — 68 passed / 0 failed                                                                                                                                                  |
| 2026-09-29 | `openspec validate fix-local-calendar-day-windows --type change --strict`                                          | PASS — change is valid                                                                                                                                                       |
| 2026-09-29 | `node scripts/agent-execplan.mjs validate --plan …`                                                                | PASS — ExecPlan valid                                                                                                                                                        |
| 2026-09-29 | Full-diff review                                                                                                   | Only the four window-start expressions, the three clock calls, and their tests changed                                                                                       |

## Changed Files / Areas

- `lib/time.ts` — new `inclusiveWindowStartDateKey(days, reference?)`; `buildDateRangeOldestFirst(days, reference?)` gained an optional reference and now shares the same normalized calendar walk.
- `features/goals/goals.data.ts` — `getGoalRollup` window start via the helper + `nowIso()`; `Date.now()` removed.
- `features/daily-plan/dailyPlan.data.ts` — `listRecentDailyPlans` window start via the helper + `nowIso()`; `Date.now()` removed.
- `features/projects/projects.data.ts` — `getProjectRollup` and `listProjectRollups` window starts via the helper + `nowIso()`; both `Date.now()` calls removed.
- `tests/time.test.ts` — helper-level DST coverage (spring-forward, fall-back morning and evening, ordinary-day equality with the previous arithmetic, and `buildDateRangeOldestFirst`'s injected reference).
- `tests/integration/planningDayWindows.test.ts` (new) — per-site read-path oracles against real SQLite at both boundaries, the exactly-N-local-days span assertion, and the ordinary-day boundary-only proof.
- `openspec/changes/fix-local-calendar-day-windows/tasks.md` — all 16 tasks checked.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan, and the change's
   `proposal.md` / `specs/` / `tasks.md`.
2. `git status --short` and `git diff --stat`; reconcile this checkpoint against
   the real tree.
3. Re-run `npx vitest run tests/time.test.ts` and
   `npx vitest run --project integration tests/integration/planningDayWindows.test.ts`.
4. No implementation action remains. Archiving the change into
   `openspec/specs/` and committing the tree are separate, user-invoked steps.

## Outcomes & Retrospective

- Status: Completed.
- Summary: four inclusive "last N local days" windows now walk calendar days
  instead of subtracting fixed milliseconds, which removes the once-a-year one-day
  rollup error in goal, daily-plan, and project windows and makes those read
  paths deterministic under the seeded fixtures. The defect was reproduced
  concretely before the fix (a 30-day window spanning 31 local days across
  spring-forward, and 29 across fall-back) and the coverage fails on the legacy
  arithmetic, so the behaviour is pinned rather than merely intended.
- Follow-up: archive this change into `openspec/specs/` when the user invokes the
  OpenSpec archive step. The remaining pending changes in `openspec/changes/`
  still need their own apply pass; `harden-interaction-idempotency` touches the
  To Do / calorie quick-add surfaces and `reduce-section-activation-render-work`
  touches the J8 hot path, so neither overlaps this diff.
