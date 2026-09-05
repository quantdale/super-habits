# ExecPlan: Functional Completion V1 (master orchestration)

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Close Super Habits' product-depth gaps: users must be able to correct, edit, and manage their own data across Todos (recurring series), Calories (day correction), Workout (routines/custom exercises/logs), and Pomodoro (presets/session metadata); the shipped Weekly Review loop must be reachable from the normal in-app flow; the Linked Actions policy must honestly describe the shipped engine; and Planning-surface persistence must be proven with real-SQL/data-oracle tests.

Success = every shipped correction flow has an explicit contract, an implementation in existing surfaces, and oracle-grade tests, with zero regressions against the certified persistence baseline.

## Context

- Campaign driver: `.agent/EXECUTION_PROMPT.md` (Functional Completion V1, ACTIVE, Planned-From `76f79d9`). Waves 0–10 are defined there; this plan is the master orchestration record. Workstream ExecPlans are opened as waves start (Wave 1).
- Certified foundation to reuse, not rebuild: migrations (`core/db/client.ts`, current schema version 24, append-only), `runSyncedMutation`/`runBackupMutation` + durable outbox, restore invariants (`core/backup/`), account ownership (`core/auth/`), `qa:repeat`, multi-AVD native automation, MATURE corpus seeders, `web:verify`/`web:hygiene`.
- Product disposition (authoritative): `docs/ui-ux/2026-09-01-feature-disposition-ledger.md` line 28 — Weekly Review: keep modal; expose from Plan/Progress, not Today.
- Invariants: soft-delete only (documented exceptions), no `getDatabase` outside data layers, `createId`/`toDateKey`, single-page shell, six sections, one global Add, no seventh tab, no second Gym state, no AI/Ask flag changes.

## Scope

Waves 1–10 of `.agent/EXECUTION_PROMPT.md`: OpenSpec correction contracts; Todos recurring-series management; Calories `consumedOn` correction; Workout routine/exercise/log correction; Pomodoro preset authoring + post-hoc session meta; Weekly Review in-app entry + `deleteWeeklyReview` disposition; Linked Actions policy reconciliation; Planning Hub / Weekly Review E2E + real-SQL test floor; regression ladder; adversarial verification; docs truth.

## Non-Goals

No Production Hardening V3 / Certification V3, no two-way sync, no persistence rewrite, no new top-level section, no cycle-elimination campaign, no `workout.data.ts` split, no migration-block edits, no weakened tests, no AI flag changes.

## Current Checkpoint

- Current milestone: Wave 2 COMPLETE (Todos recurring-series correction) → Wave 3 (Calories day-correction) starting.
- Completed:
  - Wave 0: Git/plan truth (`192e496` start == origin/main, clean, single worktree, 48 plans COMPLETED), `web:hygiene` PASS, `qa:fast` PASS (unit 1691/128 files), and E1–E6 re-verification — **all six CONFIRMED** against the tree at `192e496` (original per-E evidence: commit `3e05490`).
  - Wave 1: OpenSpec change `complete-product-correction-flows-v1` — proposal, design D1–D6 (series semantics; calorie `consumedOn` in-place move; workout routine/exercise activation + accidental-log delete with immutable completed numerics; Pomodoro preset authoring + metadata-only session correction, no migration 25; Weekly Review Plan/Progress entry + delete; Linked Actions expose-with-proof vs honest relabel), six capability specs, tasks. `openspec:validate` 51/51. Commit `62356b5`.
  - Wave 2: data layer `updateRecurringSeriesTemplate` (live non-completed instances only, per-row intents), `stopRecurringSeries` (marker cleared on ALL series rows incl. completed/deleted to block rollover resurrection; future pending copies soft-deleted; intents mirror `removeTodo`), `updateTodo({recurrence:'daily'})` restart (fresh `rec_` id, default due today; never clears recurrence). UI: This task / This & future tasks scope chips, confirmed “Stop repeating”, restart toggle on edit, honest recurring Linked-Actions copy. Tests: 6 unit + 3 real-SQL integration + new E2E journey; old dead-end selector updated.
- In progress: none.
- Important modified files: `features/todos/todos.data.ts`, `features/todos/TodosScreen.tsx`, `tests/todos.recurringSeries.data.test.ts`, `tests/integration/recurringSeriesCorrection.test.ts`, `e2e/todos.spec.ts`.
- Last successful validation: typecheck 0, lint 0 (max-warnings 0), full Vitest 1946/1946 (177 files), todos chromium 9/9, `e2e:journeys:p0` 25/25 on fresh `dist/` (2026-09-05).
- Current failures: None. (One TEST_BUG fixed in-flight: the new E2E edited a stale row before post-completion refresh — replaced with the stable “1 pending, 1 completed” oracle; assertion strengthened, not weakened.)
- Relevant quarantines: None.
- Blockers: None. Externals unchanged (iOS/macOS, disposable Supabase, parser lanes, real corpus); native lanes scheduled for Wave 8 — probe Android availability then.
- Discovery (Wave 6 input): `tests/linkedActions.engine.test.ts` logs “Skipping unsupported linked action rule” for `pomodoro.log` — the engine gates execution on policy `engineSupport`; option A requires flipping trigger+feature+entity+effect rows together plus end-to-end exactly-once proof.
- Discovery (Wave 7 input): RN-web `MenuSheet` does not expose `role=dialog`; E2E must target its items via `getByRole('button', { name })` (see todos.spec pattern).
- Residual (recorded, not dropped): TodosScreen `filters.projectId`/`goalId` are read only for the active-filter badge; wiring the toolbar filter vs removing the branches is dispositioned in the Wave 10 sweep per prompt Wave 2.
- Exact next action: Wave 3 — add `consumedOn` to `updateCalorieEntry` (validation, single outbox intent), date control in the calorie edit modal, aggregate/outbox/E2E coverage.
- Remaining definition of done: terminal condition A of `.agent/EXECUTION_PROMPT.md` §9.

## Progress

- [x] Wave 0 — Re-baseline: Git/plan truth, hygiene, qa:fast, E1–E6 re-verification (all CONFIRMED) — 2026-09-05
- [x] Wave 1 — OpenSpec contracts + design decisions D1–D6 (commit `62356b5`, openspec 51/51)
- [x] Wave 2 — Todos recurring-series correction (unit 6 + integration 3 + E2E; full Vitest 1946/1946; todos spec 9/9; P0 25/25)
- [ ] Wave 3 — Calories day-correction
- [ ] Wave 4 — Workout correction
- [ ] Wave 5 — Pomodoro correction depth
- [ ] Wave 6 — Weekly Review surfacing + Linked Actions policy
- [ ] Wave 7 — Planning-surface test floor
- [ ] Wave 8 — Regression ladder
- [ ] Wave 9 — Adversarial verification
- [ ] Wave 10 — Residual P0/P1 sweep + docs truth + closure

## Surprises & Discoveries

- Engine runtime skips `pomodoro.log`/`calorie.log` legacy rules ("unsupported") despite implemented effects — policy likely gates execution too (`linkedActions.engine` + policy resolution). Wave 6 must audit the gate path before choosing A (authorable) vs B (honest deferral).
- `web:hygiene` and the whole `qa:fast` chain work cleanly on this Windows host; native lanes use existing `scripts/qa-native*.mjs`.

## Decision Log

- 2026-09-05 — Master orchestration plan + per-wave workstream plans (proven shape from prior campaigns) — single source for campaign checkpoint; workstream plans own implementation detail.

## Validation Ledger

- 2026-09-05 — `npm run agent:plans` — PASS — 48/48 COMPLETED predecessors.
- 2026-09-05 — `npm run web:hygiene` — PASS — 8081/8082 free.
- 2026-09-05 — `npm run qa:fast` — PASS — typecheck 0, lint 0, Vitest unit 1691/1691 (128 files), label parity OK.

## Changed Files / Areas

- `.agent/execplans/functional-completion-v1.md` — this master plan.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`.
2. Read `.agent/EXECUTION_PROMPT.md` fully (authoritative waves + invariants).
3. Read this plan completely, then any ACTIVE workstream ExecPlan it lists.
4. `git status --short`; `git diff --stat`; `git log --oneline -10`; reconcile checkpoint with Git (Git wins).
5. `npm run agent:resume -- --plan .agent/execplans/functional-completion-v1.md`.
6. `npm run qa:affected` for changed files; run resolved gates.
7. Continue from `Exact next action`; update this plan before finishing any session.

## Outcomes & Retrospective

- Status: Active (Wave 0 complete).
