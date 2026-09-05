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

- Current milestone: Wave 3 COMPLETE (Calories day correction) → Wave 4 (Workout correction) starting.
- Completed:
  - Wave 0 — truth/hygiene/gates/E1–E6 (all CONFIRMED; commit `3e05490`).
  - Wave 1 — OpenSpec change `complete-product-correction-flows-v1` (design D1–D6, 6 specs, tasks; openspec 51/51; commit `62356b5`).
  - Wave 2 — Todos recurring-series correction (data+UI+6 unit+3 integration+E2E; todos 9/9; P0 25/25; commit `0065ae9`).
  - Wave 3 — Calories day correction: `updateCalorieEntry` accepts validated `consumedOn` (isValidDateKey; throws on bad key BEFORE touching the DB), in-place move preserving id + single coalesced update intent; edit modal gains a “Consumed on” control (web TextField labeled “Consumed date”, native DateTimePicker) shown only in edit mode — the add/form flow is untouched. Real-SQL integration (3: move preserves identity + coalesced outbox update; month boundary + idempotent re-save; invalid key no-op) and E2E (diary wrong-day → move to today → both ledgers correct → identity survives reload). Discovered: kcal is recomputed from macros on update (existing contract; E2E asserts macros, not stale kcal). Gates: typecheck 0, lint 0, calories unit 22/22, day-navigation spec 5/5.
- In progress: none.
- Important modified files: `features/calories/calories.data.ts`, `features/calories/CaloriesScreen.tsx`, `tests/integration/caloriesDayMove.test.ts`, `e2e/calories-day-navigation.spec.ts`.
- Last successful validation: as above (2026-09-05); prior full-suite state still valid except unrun full Vitest for Wave 3 changes (planned in next gate batch).
- Current failures: None. Two TEST_BUGs fixed in-flight (stale 300-kcal expectation vs recompute contract; both strengthened to macro assertions).
- Relevant quarantines: None.
- Blockers: None (externals unchanged).
- Exact next action: Wave 4 — audit `workout.data.ts` (updateRoutine/updateCustomExercise/archiveCustomExercise/listCustomExercises already exist; log-delete path missing), then build routine-edit UI, custom-exercise manage UI, and confirmed accidental-log delete with cascade + tests.
- Remaining definition of done: terminal condition A of `.agent/EXECUTION_PROMPT.md` §9.

## Progress

- [x] Wave 0 — Re-baseline: Git/plan truth, hygiene, qa:fast, E1–E6 re-verification (all CONFIRMED) — 2026-09-05
- [x] Wave 1 — OpenSpec contracts + design decisions D1–D6 (commit `62356b5`, openspec 51/51)
- [x] Wave 2 — Todos recurring-series correction (unit 6 + integration 3 + E2E; full Vitest 1946/1946; todos spec 9/9; P0 25/25)
- [x] Wave 3 — Calories day-correction (integration 3 + E2E 5/5 day-navigation; unit 22/22)
- [ ] Wave 4 — Workout correction
- [ ] Wave 5 — Pomodoro correction depth
- [ ] Wave 6 — Weekly Review surfacing + Linked Actions policy
- [ ] Wave 7 — Planning-surface test floor
- [ ] Wave 8 — Regression ladder
- [ ] Wave 9 — Adversarial verification

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
