# ExecPlan: TodosScreen toggle-result gating for gamification fast path

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Gate the TodosScreen gamification fast-path award on the confirmed toggle
result (`result.completed === 1`) so failed or non-completed toggles never
mint phantom XP/streak activity. Mirror the habit
`shouldAwardHabitFastPath` policy. Reconcile backfill remains the healing
path for real completions that miss the fast path.

Observable success: completing a todo awards once; a failed toggle (missing /
deleted / raced row → `completed: 0`) awards nothing; un-completing awards
nothing; a real completion that skips the fast path is still healed by
`reconcileGamificationActivity`.

## Context

- Habit fast path already gated at HEAD 3a66c34 via
  `shouldAwardHabitFastPath(dateKey, count, todayKey)` in
  `features/habits/habits.domain.ts`, wired into
  `features/habits/HabitsScreen.tsx#handleIncrement`. Do not reset/rebase.
- Defect: `features/todos/TodosScreen.tsx#handleToggleTodo` gates on stale UI
  state (`if (todo.completed === 0) recordAction('todo', todo.id)`), not on
  the toggle result. `setTodoCompletion` in `features/todos/todos.data.ts`
  returns `{ completed: 0|1 }` where `0` covers missing/deleted rows, lost
  races (`changes !== 1`), and non-completed states. The current gate awards
  even when `result.completed === 0`.
- Why phantom XP is real: `awardGamificationAction({ kind: 'todo', entityId })`
  in `features/gamification/gamification.data.ts` does NOT validate the todo
  row — with an explicit entityId it mints unconditionally (ledger
  idempotency only). Todo source keys are the bare entity id
  (`actionSourceKey`), so a phantom fast-path award also blocks the later
  reconcile award for the same id via the unique (kind, source_key) index.
- Reconcile source of truth: `loadActivityCandidates` selects
  `todos WHERE completed = 1 AND deleted_at IS NULL AND completed_at` in the
  local-day UTC window; `reconcileGamificationActivity` passes explicit ids.
  A missed fast path degrades to this backfill — same miss+reconcile policy
  as the habit backdate guard and the id-less workout/todo/focus/plan/review
  guards.
- Other callers already safe: `command.executor.ts#executeCompleteTodo`
  checks `result.completed !== 1`; bulk complete (`bulkSetTodoCompletion` via
  `runBulkAction`) is reconcile-only (no `recordAction`); notification and
  linked-action completions are reconcile-only by design.
- Layering: predicate lives in `features/todos/todos.domain.ts` (pure, no DB /
  React); screen wires it; tests in `tests/` (unit) +
  `tests/integration/` (data layer, real better-sqlite3 via
  `tests/integration/helpers/db.ts`).

## Scope

- Add `shouldAwardTodoFastPath(completed: 0 | 1): boolean` predicate in
  `features/todos/todos.domain.ts` with habit-mirror docstring.
- Rewire `TodosScreen.handleToggleTodo` to gate `recordAction('todo', …)` on
  `shouldAwardTodoFastPath(result.completed)`.
- Domain unit coverage + integration regression coverage:
  completed toggle awards; failed/non-completed toggle does not award;
  reconcile heals after confirmed completion.
- Verify with Node 22 (`node --version` = v22.23.2 via fnm PATH):
  focused Vitest (new + neighboring gamification/todo suites), typecheck,
  lint. No broad `pkill -f vitest`.

## Non-Goals

- No schema/migration change (still v25; no `if (version < 26)` block).
- No change to `awardGamificationAction` ledger semantics, XP values,
  reconcile windows, or id-less guards.
- No bulk/notification/linked-action/command award-path changes (already
  reconcile-only or already result-gated).
- No E2E, native, sync, push, tags, EAS, or PII work.

## Current Checkpoint

- Current milestone: COMPLETE — gate + predicate + regression tests landed and verified.
- Completed: ExecPlan written; `shouldAwardTodoFastPath` added to
  `features/todos/todos.domain.ts`; `TodosScreen.handleToggleTodo` gated on
  `result.completed`; domain unit tests + `tests/integration/todoToggleAward.test.ts`
  added; full unit (142 files / 1833 tests) + full integration (72 files /
  333 tests) + typecheck + full lint + parity scripts green on Node v22.23.2;
  plan validated; committed locally, no push.
- In progress: None.
- Important modified files: `features/todos/todos.domain.ts`,
  `features/todos/TodosScreen.tsx`, `tests/todos.domain.test.ts`,
  `tests/integration/todoToggleAward.test.ts`.
- Last successful validation: `npm run test:integration` 72/72 files,
  333/333 tests PASS (2026-09-20); `npm run test:unit` 142/142, 1833/1833
  PASS; `npm run typecheck` clean; `npm run lint` clean; parity scripts OK.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: Complete — all definition-of-done items validated (see Progress).

## Progress

- [x] Map defect (stale `todo.completed` gate) + reconcile healing path.
- [x] Add `shouldAwardTodoFastPath` predicate.
- [x] Rewire `TodosScreen.handleToggleTodo` to `result.completed`.
- [x] Add domain + integration regression tests.
- [x] Verify (Vitest focused + typecheck + lint) on Node 22.
- [x] Validate plan + commit (no push).

## Surprises & Discoveries

- The `edit` tool rejected the `todos.domain.ts` predicate insertion as a
  syntax error, so the predicate (and the screen gate + domain-test import)
  were applied via a Python file-rewrite instead; content verified by read-back
  + typecheck + tests. No behavior difference.
- The settle-animation branch in `handleToggleTodo` (`todo.completed === 0`)
  was deliberately left untouched: on a failed toggle the post-refresh row
  stays pending, so no completed row is ever held — animation timing only,
  out of scope for the gamification gate.

## Decision Log

- 2026-09-20 — Mirror habit policy with a tiny pure predicate
  (`shouldAwardTodoFastPath`) rather than an inline `result.completed === 1`
  check: keeps the "confirmed-write" policy testable in the domain layer and
  gives the screen a named, habit-parallel gate.
- 2026-09-20 — Keep bulk/notification/linked-action/command paths untouched:
  bulk is reconcile-only, command already result-gates, notification +
  linked-action completions are reconcile-only by design.

## Validation Ledger

- 2026-09-20 — `git log --oneline -15 + git status --short` — context capture —
  clean-tree HEAD 3a66c34.
- 2026-09-20 — `npx vitest run tests/todos.domain.test.ts --project unit` — PASS —
  1 file / 20 tests (incl. 2 new predicate tests).
- 2026-09-20 — `npx vitest run tests/integration/todoToggleAward.test.ts --project integration` — PASS —
  1 file / 3 tests (completed awards / failed does not / reconcile heals).
- 2026-09-20 — neighboring `gamification.test.ts + gamificationIdlessAward.test.ts + habitBackdateAward.test.ts + gamificationWorkoutAward.test.ts` — PASS —
  4 files / 21 tests.
- 2026-09-20 — `habits.domain.test.ts + todos.data.test.ts` — PASS — 82 tests.
- 2026-09-20 — `npm run typecheck` — PASS — clean.
- 2026-09-20 — `npx eslint` on 4 changed files — PASS — clean.
- 2026-09-20 — `npm run test:unit` — PASS — 142 files / 1833 tests (Node v22.23.2).
- 2026-09-20 — `npm run lint` (full) — PASS — clean.
- 2026-09-20 — `journey-label-parity.mjs + quarantine-register-parity.mjs` — PASS — OK/OK.
- 2026-09-20 — `npm run test:integration` — PASS — 72 files / 333 tests.
- 2026-09-20 — `npm run qa:affected` — ADVISORY — matched todos /
  native-ui-and-persistence / agent-workflow-and-documentation; E2E + native
  lanes not run (out of task scope: box-executable Node-22 verification only).
- 2026-09-20 — `npm run agent:plan:validate -- --plan .agent/execplans/todos-toggle-result-gating-v1.md` — PASS — valid ACTIVE (pre-completion).

## Changed Files / Areas

- `features/todos/todos.domain.ts` — add `shouldAwardTodoFastPath` (pending).
- `features/todos/TodosScreen.tsx` — gate `recordAction` on toggle result
  (pending).
- `tests/todos.domain.test.ts` — domain predicate coverage (pending).
- `tests/integration/todoToggleAward.test.ts` (new) — completed awards /
  failed does not / reconcile heals (pending).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, then `.agent/PLANS.md`, then this plan.
2. Run `git status --short`, `git diff --stat`, `git diff --name-only`;
   inspect relevant diffs. Git wins over stale narrative.
3. Run `npm run agent:resume -- --plan .agent/execplans/todos-toggle-result-gating-v1.md`
   for discrepancy + QA-impact orientation.
4. Continue only from `Exact next action` above; update this checkpoint at
   every milestone, failure, decision, and before finishing.
5. Never run broad `pkill -f vitest`; Node 22.23.2 is on PATH (fnm).
6. Commit locally with a conventional message when green; do not push.

## Outcomes & Retrospective

- Status: Complete.
- Summary: `TodosScreen.handleToggleTodo` now awards only on
  `shouldAwardTodoFastPath(result.completed)` (confirmed `completed === 1`),
  mirroring `shouldAwardHabitFastPath`. Failed toggles (missing/deleted/race)
  and the un-complete direction award nothing; real completions that miss the
  fast path heal via `reconcileGamificationActivity`. Domain + integration
  regression coverage added (2 unit + 3 integration tests). Full unit
  (1833) + integration (333) + typecheck + lint green on Node v22.23.2.
  Committed locally, no push.
- Follow-up: none required. If the settle-animation branch is ever revisited,
  consider gating it on `result.completed` too for symmetry (behavior-neutral today).
