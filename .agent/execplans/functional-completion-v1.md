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

- Current milestone: Wave 0 COMPLETE → Wave 1 (OpenSpec contracts) starting.
- Completed:
  - Git/plan truth: starting HEAD `192e496e259a73fe1c5a0045f999d4212bba8237` == `origin/main`, branch `main`, tree clean, single worktree; `agent:plans` shows all 48 discovered plans COMPLETED.
  - Hygiene: `web:hygiene` PASS (8081/8082 free).
  - Baseline gates: `qa:fast` PASS — typecheck 0 errors, lint 0 (max-warnings 0), Vitest unit 1691 passed / 128 files, journey-label-parity OK (2026-09-05).
  - E1–E6 re-verification (all at `192e496`):
    - E1 CONFIRMED — `updateTodo` (`features/todos/todos.data.ts:434-443`) accepts no recurrence fields; "Repeat daily" toggle renders only when `!editingId` (`features/todos/TodosScreen.tsx:1025-1057`); completion re-spawns tomorrow's instance (`todos.data.ts:683-701`); recurring Linked-Action-source dead-end copy (`TodosScreen.tsx:1114-1117`).
    - E2 CONFIRMED — zero non-test UI callers for `savePomodoroPresets` (`features/pomodoro/pomodoro.presets.store.ts:88`), `updateRoutine` (`features/workout/workout.data.ts:195`), `updateCustomExercise` (`:1988`), `archiveCustomExercise` (`:2051`), archived listing `listCustomExercises(includeArchived)` (`:1934`), `deleteWeeklyReview` (`features/weekly-review/weeklyReview.data.ts:120`), `reorderProjects` (`features/projects/projects.data.ts:214`, callers = integration test only). `setPomodoroSessionMeta` (`features/pomodoro/pomodoro.data.ts:230`) is called only by `SessionNotePrompt.tsx:27` with `note` only. `updateCalorieEntry` (`features/calories/calories.data.ts:212-221`) has no `consumedOn`. Workout data layer exposes no `updateWorkoutLog`/`deleteWorkoutLog`-style path (grep-verified absent).
    - E3 CONFIRMED — `openWeeklyReview` behavioral call-sites: `app/_layout.tsx:160-162` ← `core/notifications/notificationResponseDispatcher.ts:216` only. Disposition ledger line 28 verified verbatim.
    - E4 CONFIRMED — no E2E spec drives Weekly Review guided flow (only settings-ripple reminder preference); no Planning Hub E2E spec; `tests/activityTimeline.test.ts` mocks `core/db/client`; `progress.data` only mocked via `ask.retrieval.test.ts` (real-SQL coverage absent). Vacuous-assertion leads to confirm when touching those specs in Wave 7.
    - E5 CONFIRMED — `calorie.log`/`pomodoro.log` effects implemented (`core/linked-actions/linkedActions.effects.ts:68,100`); policy marks triggers `calorie.entry_logged`/`workout.completed`/`pomodoro.focus_completed` and target features `calories`/`pomodoro` and entities `calorie_log`/`pomodoro_session` as `deferred`/`hidden` (`linkedActions.policy.ts:79-99,108,110,119,121`).
    - E6 CONFIRMED — `README.md:142` ("limited to create_todo and create_habit") and `:148` ("false by default") contradict `features/command/types.ts:9` (`AI_ASK_EXPERIMENT_ENABLED = true`) and the 10-kind `DraftKind` union (`:13-23`).
- In progress: none.
- Important modified files: none yet (only this plan).
- Last successful validation: `qa:fast` PASS + `web:hygiene` PASS at `192e496` (2026-09-05).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None. Known externals (evaluate, never gate): iOS/macOS, disposable Supabase token, internal parser lanes, anonymized real corpus.
- Discovery (Wave 6 input): `tests/linkedActions.engine.test.ts` logs "Skipping unsupported linked action rule" for `pomodoro.log` targets — the engine appears to _gate execution_ on policy, not just authoring. Wave 6 must determine the exact gate location before choosing policy option A vs B.
- Nuance (Wave 2 input): `TodosScreen.tsx:170-171` reads `filters.projectId`/`goalId` for the "has active filters" badge only; query wiring of the project/goal filter branches is not proven — verify in Wave 2.
- Exact next action: Author the Wave-1 OpenSpec change(s) at `openspec/changes/<slug>/` defining correction contracts (series-edit semantics, pomodoro session correction decision, workout-log correction cascade decision, weekly-review management, calorie day-move semantics, Linked Actions policy decision), plus per-workstream ExecPlans; then commit.
- Remaining definition of done: terminal condition A of `.agent/EXECUTION_PROMPT.md` §9 — Waves 1–7 landed with contracts+implementations+oracle tests; Wave 8 ladder green; adversarial PASS; E6 docs reconciled; plans/prompt COMPLETED; pushed clean; hygiene clean.

## Progress

- [x] Wave 0 — Re-baseline: Git/plan truth, hygiene, qa:fast, E1–E6 re-verification (all CONFIRMED) — 2026-09-05
- [ ] Wave 1 — OpenSpec contracts + workstream ExecPlans
- [ ] Wave 2 — Todos recurring-series correction
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
