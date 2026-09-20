# ExecPlan: command-review-paused-habit-guard-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close the live preview→execute contract break for `log_habit`: the Command
Center review path (`features/command/command.review.ts`) marks a draft
`ready` for a paused/archived habit scheduled today, but the executor
(`features/command/command.executor.ts:186-197`) refuses it at confirm time
with a validation error. The user is promised "ready", confirms, and gets an
error. After this change, review reports `needs_input` with a resume-first
message for non-active habits, so preview and execution agree and no wasted
confirm is possible.

## Context

- Survey evidence (2026-09-20, main `4ce3626`): every other mission-named
  residual is FIXED (overview F2/F4/F7/F8, planning enqueue F1, weekly-review
  executor F3, pomodoro updater finding 1, carry-forward F7, pomodoro-settings
  empty-field messaging, plus habit lifecycle durability, bulk-todo
  atomicity, workout skip/duration, calories diary/copy, restore/portable
  planning import, todo-reminder dispatcher, PWA reload gate, remote parity,
  read-then-write F6, ask fallback F10, briefing focus filter, timeline
  window/bucket, weekly UTC parsing, rest ceilings, weekly_reviews remote
  table, scheduler permission reasons, F12 clearing, preset/type-label
  cleanups, notes field, session-local rest default, hasAnyData CTAs,
  decrement-timeline bucketing, command executor guard, weekly-review pause
  masking, pomodoro meta columns, notification guards).
- Live remnants found but weaker: (a) this gap — contradictory
  ready-then-refuse contract (selected); (b) workout `rest_seconds === 0`
  means inherit-default with no explaining copy (behavioral P2, needs a
  product decision between nullable-column migration vs copy change —
  deferred); (c) timeline labels decrement bumps "Completed" (audit itself
  noted suppression "may not be worth it" without an operation marker —
  deferred); (d) workout history list lacks quick-log badge (pure chrome —
  deferred).
- Key files:
  - `features/command/command.review.ts:487-541` (log_habit review block —
    no status guard; fix site)
  - `features/command/command.executor.ts:186-197` (executor guard —
    contract to mirror)
  - `features/overview/overview.domain.ts:236-238` (`isActiveHabit` helper)
  - `features/command/command.resolver.ts:62-68` (resolution; leave as-is)
  - Tests: `tests/command.review.*` / `tests/command*` (to confirm names)
- Layering: review is pure-ish orchestration over `.data`/domain; the fix
  adds an `isActiveHabit` check reusing the existing helper — no DB, no
  migration, no sync change.

## Scope

- Guard the `log_habit` review block so a resolved habit with
  `status !== 'active'` yields `needs_input` (not `ready`) with a
  resume-first message matching the executor wording.
- RED→GREEN unit coverage for paused + archived (+ active control).
- Targeted vitest + typecheck (+ lint) green; local commit.

## Non-Goals

- Gamification / XP / streaks / awards (explicitly out of scope).
- Changing habit resolution/matching semantics (`resolveHabitReference`
  stays as-is; exact match still resolves, only readiness changes).
- Rest-zero semantics, timeline decrement labeling, quick-log list badge
  (documented deferred remnants).
- Native lanes, E2E, push/tags/EAS, PII.

## Current Checkpoint

- Current milestone: complete — fix landed, all gates green, committed.
- Completed: survey; RED test (ready for paused habit); fix (lifecycle
  guard in log_habit review); GREEN (6/6 integration + 77 unit +
  typecheck + lint); local commit.
- In progress: none.
- Important modified files: `features/command/command.review.ts`,
  `tests/integration/commandCenterV2.test.ts`.
- Last successful validation: typecheck exit 0; eslint LINT_OK;
  commandCenterV2 6/6; 5 command unit files 77/77 (2026-09-20).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: done (all conditions validated).

## Progress

- [x] Survey audit-reports.md + known-gaps.md + recent main history
- [x] Verify all mission-named residuals against current main (all FIXED)
- [x] Sweep remaining areas; select live gap (review/executor split)
- [x] Read fix site + existing tests
- [x] RED test (paused/archived ready → must be needs_input)
- [x] Fix review guard mirroring executor
- [x] Targeted vitest + typecheck + lint green
- [x] Local commit + final report

## Surprises & Discoveries

- 2026-09-20 — Thinning is real: ~40 audit findings verified FIXED on
  main; remaining live items are P2/chrome/decision-deferred. The
  review/executor split is the highest-value box-executable defect left.

## Decision Log

- 2026-09-20 — Selected review-side guard (needs_input + resume message)
  over resolver-side filtering, so the paused habit still resolves exactly
  and the user gets actionable guidance instead of a not-found maze.

## Validation Ledger

- 2026-09-20 — survey sweeps (7 explore subagents) — PASS (evidence only,
  no code change).
- 2026-09-20 — new RED test pre-fix — FAIL as designed (`ready` for
  paused habit, expected `needs_input`).
- 2026-09-20 — `npx vitest run --project integration
  tests/integration/commandCenterV2.test.ts` — PASS 6/6 post-fix.
- 2026-09-20 — command unit files (executor, v2.contracts,
  remoteParity, realParser, normalize) — PASS 77/77.
- 2026-09-20 — `npm run typecheck` — PASS exit 0.
- 2026-09-20 — `npx eslint` on both changed files — PASS (LINT_OK).

## Changed Files / Areas

- `features/command/command.review.ts` — planned fix site.
- `tests/` — planned RED/GREEN coverage.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan.
2. `git status --short`; `git log --oneline -5`.
3. Continue from `Exact next action` above.

## Outcomes & Retrospective

- Status: Complete.
- Summary: review/executor contract reunited for non-active habits with
  one guard + one integration test; no weakened tests; gates green.
- Follow-up: deferred remnants — workout rest-zero copy/decision, timeline
  decrement labeling (needs operation marker), workout-list quick badge.
  High-value box-executable defects are thinning (~40 findings verified
  FIXED on main).
