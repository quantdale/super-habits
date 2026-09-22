# ExecPlan: workout history quick-log badge

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

A user browsing workout history can tell at a glance which sessions were
quick-logged (one-tap "Complete workout", no per-exercise tracking) versus
fully tracked guided sessions. Both the Recent sessions list and the session
detail modal carry the same `Quick log` pill, styled to the Pop design system,
so the two surfaces never disagree.

## Context

- Write paths (`features/workout/workout.data.ts`):
  - `completeRoutine()` (the "Complete workout" button,
    `WorkoutScreen.tsx:1098+`) writes a `workout_logs` row only — NULL
    started/ended/duration, **no** `workout_session_exercises` rows.
  - `logWorkoutSession()` (guided `WorkoutSessionScreen`) writes the log row
    **plus** session-exercise and session-set rows.
  - There is **no** `source`/`origin` column on `workout_logs`; adding one
    would need migration 26 + backup/portable/supabase contract churn.
    Rejected for this box-scoped polish.
- Read paths (before fix):
  - Recent sessions list (`WorkoutScreen.tsx:484-521`, `recentSessionsSection`)
    renders routine name + date per log with no provenance marker.
  - Detail modal (`WorkoutHistoryDetail.tsx:202-206`) already detects the
    exercise-less case inline (`exercises.length === 0`) and prints muted
    italic copy: "Quick log — no exercises recorded." No badge, and the list
    has no equivalent signal.
- Detection rule (single source of truth): a session is quick-logged ⇔ it has
  **zero** `workout_session_exercises` rows. This matches the detail modal's
  existing copy, so list and detail agree by construction. Legacy
  exercise-less logs read as quick logs on both surfaces — consistent, not a
  new inconsistency.
- Pop contract (`docs/ui-ux/12-pop-design-system.md`): full pills
  (`radius.full`), section hue carries meaning (workout tint fill + tinted
  outline, as the detail stat tiles already do with `${COLOR}14` /
  `${COLOR}33`), `Text` from `@/core/ui/Text` with the `label` role
  (uppercase + tracking) for chip copy, no `data-testid`, no new deps, keep
  existing user-facing strings ("Quick log" already exists in the detail
  modal — reuse it verbatim).

## Scope

- Domain (`workout.domain.ts`): new pure predicate
  `isQuickLoggedSession(exerciseCount: number)` with JSDoc stating the
  zero-exercises rule; Vitest coverage in `tests/workout.domain.test.ts`.
- Data (`workout.data.ts`): new read-only
  `listWorkoutSessionExerciseCounts(): Promise<{ logId: string;
exerciseCount: number }[]>` (`GROUP BY log_id`, no sync enqueue — pure
  read). Wired into the existing concurrent `refresh()` batch in
  `WorkoutScreen.tsx`; missing key ⇒ 0 ⇒ quick log.
- UI: new feature-local `features/workout/QuickLogBadge.tsx` (Pop pill:
  `rounded-full`, workout-tint fill/outline, `label`-role "Quick log" copy,
  `accessibilityLabel="Quick-logged session"`). Used in:
  - `WorkoutScreen.tsx` recent-session rows (badge beside the routine name).
  - `WorkoutHistoryDetail.tsx` header (badge under the date; the existing
    italic "Quick log — no exercises recorded." explanation stays, now gated
    on the shared predicate instead of an inline `=== 0`).
- Tests: domain predicate tests; data-contract test pinning
  quick-complete ⇒ absent/zero count and guided session ⇒ positive count, if
  feasible within the existing workout data-test harness (no device/CI).
- Validation ledger + single conventional commit. Node 22 verification
  (`typecheck`, `lint`, targeted + full Vitest, `agent:plan:validate`).

## Non-Goals

- No migration (no new column on `workout_logs`); no backup/portable/supabase
  contract changes (new query is local read-only).
- No heatmap/analytics changes; no PR/volume math changes.
- No E2E additions (static-export E2E is a heavier gate than this polish
  needs; unit + typecheck + lint cover it).
- No push, tag, or EAS work. No PII.

## Current Checkpoint

- Current milestone: complete — badge implemented, verified, committed as `ac60e78`.
- Completed: path mapping; zero-exercises rule decision; ExecPlan (this
  file); domain predicate; data counts query + refresh() wiring;
  `QuickLogBadge` + list/detail call sites; predicate + data-contract tests;
  full verification green.
- In progress: none.
- Important modified files: `features/workout/workout.domain.ts`,
  `features/workout/workout.data.ts`, `features/workout/QuickLogBadge.tsx`
  (new), `features/workout/WorkoutScreen.tsx`, `features/workout/
WorkoutHistoryDetail.tsx`, `tests/workout.domain.test.ts`,
  `tests/workout.data.test.ts`, this plan.
- Last successful validation: `npm test` 215 files / 2186 tests PASS;
  `npm run typecheck` PASS; `npm run lint` PASS (after one prettier
  `--fix` on `WorkoutScreen.tsx`); targeted workout suites 55/55 PASS;
  `agent:plan:validate` PASS (2026-09-20, Node v22.23.2).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: none (single commit landed as `ac60e78`).

## Progress

- [x] Map quick-log write path vs guided write path + history UI surfaces.
- [x] Decide zero-exercises detection rule (no schema change) with rationale.
- [x] Write ExecPlan (this file).
- [x] Domain: `isQuickLoggedSession` predicate.
- [x] Data: `listWorkoutSessionExerciseCounts` + refresh() wiring.
- [x] UI: `QuickLogBadge` + list/detail call sites.
- [x] Tests: predicate tests + data-contract test.
- [x] Verify: typecheck, lint, vitest, plan validate.
- [x] Single commit (`ac60e78`).

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-09-20 — Detect quick logs by zero `workout_session_exercises` rows
  instead of adding a `source` column. Why: matches the detail modal's
  existing "Quick log — no exercises recorded." copy exactly; needs no
  migration 26 and no backup/portable/supabase contract churn; `completeRoutine`
  never writes exercises while `logWorkoutSession` always does, so the rule
  is exact for current write paths. Rejected a schema column explicitly for
  scope, not merit.

## Validation Ledger

- 2026-09-20 — `node --version` — PASS — `v22.23.2`.
- 2026-09-20 — `git status --short` / `git log --oneline -5` — PASS — clean
  tree, head `e52c34f`.
- 2026-09-20 — `npm run typecheck` — PASS — 0 errors.
- 2026-09-20 — `npx vitest run tests/workout.domain.test.ts
tests/workout.data.test.ts` — PASS — 2 files, 55 tests passed.
- 2026-09-20 — `npm run lint` — FAIL then PASS — one prettier formatting
  error in `WorkoutScreen.tsx` (multi-line Text props), fixed via
  `eslint --fix`; re-run 0 errors, 0 warnings.
- 2026-09-20 — `npm test` — PASS — 215 files, 2186 tests, 0 failures
  (baseline 2182 + 4 new).
- 2026-09-20 — `npm run agent:plan:validate -- --plan
.agent/execplans/workout-history-quick-log-badge.md` — PASS — Status COMPLETED.
- 2026-09-22 — `git show --stat ac60e78` + checkbox reconciliation — PASS —
  the single-commit task is ticked to match the landed commit; `validate --all`
  now passes this plan (was the sole CI quality-lane failure).

## Changed Files / Areas

- `features/workout/workout.domain.ts` — `isQuickLoggedSession` predicate.
- `features/workout/workout.data.ts` — `listWorkoutSessionExerciseCounts`
  read-only query.
- `features/workout/QuickLogBadge.tsx` (new) — Pop pill badge.
- `features/workout/WorkoutScreen.tsx` — counts wiring + list badge.
- `features/workout/WorkoutHistoryDetail.tsx` — detail badge + shared
  predicate for the explanation line.
- `tests/workout.domain.test.ts`, `tests/workout.data.test.ts` — predicate
  tests + counts-contract test + quick-complete writes-no-exercises assertion.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan.
2. Run `git status --short`, `git diff --stat`, `git diff --name-only`.
3. Reconcile checkpoint with working tree; continue from Exact next action.
4. Run `npm run qa:affected` when applicable; then cheapest sufficient gates
   (`typecheck`, `lint`, targeted Vitest) before broad `npm test`.
5. Run `npm run agent:plan:validate -- --plan
.agent/execplans/workout-history-quick-log-badge.md` before completion.

## Outcomes & Retrospective

- Status: Completed.
- Summary: quick-logged sessions now carry a `Quick log` Pop pill in both
  the Recent sessions list and the session detail header, driven by one
  shared zero-exercises predicate over a single read-only counts query — no
  schema change. Verified: typecheck/lint clean, 2186 Vitest tests green on
  Node 22. Landed as commit `ac60e78`; the Progress commit task was
  reconciled on 2026-09-22 after it was found unchecked despite the commit
  being on main (restored `agent:plan:validate:all` / CI quality lane).
- Follow-up: none. A `source`-column model remains a possible future
  direction but needs migration 26 + contract churn; not pursued here.
