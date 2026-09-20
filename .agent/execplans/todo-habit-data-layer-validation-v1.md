# ExecPlan: Todo/Habit Data-Layer Write Validation V1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close the todo/habit write-contract hole: `addTodo` / `updateTodo` /
`createRecurringInstances` / `updateRecurringSeriesTemplate` and `addHabit` /
`updateHabit` accepted empty, over-length, and malformed rows at the data
layer, while the UI validators (`validateTodo` / `validateHabit`) rejected
them. Non-UI writers (quick capture, weekly-review executor, recurrence
expansion) bypass UI validation, so invalid rows could reach lists and backup
payloads. Observable success: invalid writes throw with the exact UI messages
and persist nothing; valid writes (all existing UI paths) behave unchanged.

## Context

- Single-page Expo app; SQLite is the source of truth (`core/db/client.ts`).
- Layering: `*.data.ts` owns writes + sync enqueue; `lib/validation.ts` is pure
  (no feature imports); UI calls `.data` / `.domain`.
- Precedent: calories data-layer hard rejects (`2673718`, `d768708`) and
  projects/goals data-layer throws (`features/projects/projects.data.ts`).
  Todos/habits were the outliers in the same class.
- E2E `fat-fingers` already pins "over-length title is rejected with a message
  and writes NO row" for the modal path — the data layer now upholds it
  everywhere.

## Scope

- `lib/validation.ts`: extract field validators with byte-identical messages,
  compose `validateTodo` / `validateHabit` from them, add throwing
  `assertTodoWrite` / `assertTodoPartialUpdate` / `assertHabitWrite`.
- `features/todos/todos.data.ts`: assert in `addTodo` (resolved dueDate),
  `updateTodo`, `createRecurringInstances`, `updateRecurringSeriesTemplate`.
- `features/habits/habits.data.ts`: assert in `addHabit`, `updateHabit`
  (incl. non-empty weekdays with the UI-identical message).
- `features/todos/TodosScreen.tsx`: `handleQuickAdd` pre-validates and shows a
  notice (`quick_add_validation_failed`) instead of throwing into
  `TodoQuickCapture` (no error slot → unhandled rejection).
- Tests: unit `tests/todoHabitWriteValidation.test.ts` + integration
  `tests/integration/todoHabitWriteValidation.test.ts`; fixture repair in
  `tests/integration/todoReminderSnooze.test.ts` (see Surprises).

## Non-Goals

- No schema/migration change; no sync/outbox change; no stored-value mutation
  (validate only, never trim/rewrite).
- No weekly-review decision-loop restructuring; no command-executor changes
  (already validates + catches); no `QuickCaptureOverlay` changes (its
  try/catch already routes throws to inline error).
- No pomodoro `nextPomodoroState` screen wiring (surveyed, lower value).
- No push/tag/EAS; no PII; no meta-guards.

## Current Checkpoint

- Current milestone: COMPLETE — implemented, gated, ready to commit.
- Completed: validation refactor + asserts; all five data-layer write paths
  guarded; quick-add notice guard; 12 unit + 10 integration tests green;
  snooze fixture repair; full suite 217 files / 2208 tests pass; typecheck and
  lint clean.
- In progress: None.
- Important modified files: `lib/validation.ts`,
  `features/todos/todos.data.ts`, `features/habits/habits.data.ts`,
  `features/todos/TodosScreen.tsx`, `tests/todoHabitWriteValidation.test.ts`,
  `tests/integration/todoHabitWriteValidation.test.ts`,
  `tests/integration/todoReminderSnooze.test.ts`.
- Last successful validation: 2026-09-20 — `npm test` 217/217 files, 2208/2208
  tests PASS; `npm run typecheck` 0 errors; `npm run lint` 0 errors 0 warnings;
  Node v22.23.2.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: None — all conditions proven:
  asserts throw exact UI messages with no partial writes; valid writes pass;
  full suite + typecheck + lint green).

## Progress

- [x] 2026-09-20 — Survey clean-main HEAD `ac60e78`; select todo/habit
  data-layer contract as the one box-executable gap.
- [x] 2026-09-20 — `lib/validation.ts`: field validators + throwing asserts,
  messages byte-identical.
- [x] 2026-09-20 — Data-layer wiring (todos 4 paths, habits 2 paths) +
  quick-add notice guard.
- [x] 2026-09-20 — Unit + integration tests written; targeted runs green.
- [x] 2026-09-20 — Full `npm test` failure triaged (snooze fixtures relied on
  the hole) and repaired without weakening assertions; full suite green.
- [x] 2026-09-20 — `typecheck` + `lint` (incl. prettier `--fix`) green.

## Surprises & Discoveries

- 2026-09-20 — `tests/integration/todoReminderSnooze.test.ts` stored full ISO
  datetimes (`2026-08-12T18:00:00.000Z`) in `due_date` and built occurrence IDs
  from them. Production UI paths can only produce YYYY-MM-DD keys (the UI
  validator always rejected datetimes), so the fixtures were exercising the
  contract hole, not production behavior. Repaired by switching fixtures to
  date keys with identical assertions (occurrence algebra unchanged; the
  midnight-crossing test keys off the snoozed fire time, which is preserved).
  Classification: TEST_BUG (fixture relied on missing validation), fixed by
  correcting the fixture, not by weakening any assertion.

## Decision Log

- 2026-09-20 — Reuse exact UI messages in data-layer asserts (single source of
  truth, no drift) rather than new error strings.
- 2026-09-20 — Validate the *resolved* dueDate in `addTodo` (after
  recurrence-default application), not the raw optional input.
- 2026-09-20 — Include `createRecurringInstances` and
  `updateRecurringSeriesTemplate`: direct-INSERT / fan-out paths bypassing
  `addTodo`, same contract.
- 2026-09-20 — `weekdays` param typed `readonly unknown[]` so pure
  `lib/validation.ts` never imports feature types.
- 2026-09-20 — Quick-add surfaces validation via in-app notice (matches
  bulk-action failure UX) instead of silent truncation or an unhandled throw.
- 2026-09-20 — Repair snooze fixtures rather than widen the data contract to
  accept timestamps (would reintroduce UI/data divergence).

## Validation Ledger

- 2026-09-20 — `node --version` — PASS — v22.23.2.
- 2026-09-20 — `npm run typecheck` — PASS — 0 errors.
- 2026-09-20 — `npx vitest run tests/todoHabitWriteValidation.test.ts` —
  PASS — 12/12.
- 2026-09-20 — `npx vitest run --project integration
  tests/integration/todoHabitWriteValidation.test.ts` — PASS — 10/10.
- 2026-09-20 — `npm test` (first full run) — FAIL (known, triaged) — 10
  failures confined to `todoReminderSnooze.test.ts`: `Error: Due date must be
  a valid YYYY-MM-DD date.` from fixtures storing ISO datetimes.
- 2026-09-20 — `npx vitest run --project integration
  tests/integration/todoReminderSnooze.test.ts` (after fixture repair) —
  PASS — 10/10.
- 2026-09-20 — `npm test` (final) — PASS — 217 files / 2208 tests, 0 failures.
- 2026-09-20 — `npm run lint` — PASS after prettier `--fix` on touched/new
  files — 0 errors, 0 warnings.

## Changed Files / Areas

- `lib/validation.ts` — extracted `validateTodoTitle/Notes/DueDate`,
  `validateHabitName/Target`; `validateTodo`/`validateHabit` compose them;
  added `assertTodoWrite`, `assertTodoPartialUpdate`, `assertHabitWrite`.
- `features/todos/todos.data.ts` — asserts in `addTodo`, `updateTodo`,
  `createRecurringInstances`, `updateRecurringSeriesTemplate`.
- `features/habits/habits.data.ts` — asserts in `addHabit`, `updateHabit`.
- `features/todos/TodosScreen.tsx` — `handleQuickAdd` pre-validation + notice.
- `tests/todoHabitWriteValidation.test.ts` — new unit contract tests.
- `tests/integration/todoHabitWriteValidation.test.ts` — new real-DB tests.
- `tests/integration/todoReminderSnooze.test.ts` — fixtures to date keys.

## Recovery / Resume Instructions

1. Read `AGENTS.md` and `.agent/PLANS.md`.
2. `git status --short`; `git log --oneline -3` (expect this task committed).
3. This plan is COMPLETED — no resume needed. For follow-ups, create a new
   task plan; do not reopen this one.

## Outcomes & Retrospective

- Status: COMPLETED 2026-09-20.
- Summary: task/habit write paths now hard-reject invalid input at the data
  layer with the exact UI messages (empty/over-long title/name/notes, bad
  target, bad/empty schedule, malformed due date), writing nothing on reject;
  the one UI path without an error slot (quick add) pre-validates with a
  notice. 22 new tests pin the contract; full suite (2208), typecheck, and
  lint are green.
- Remaining work: none in scope.
- Follow-ups (not started, separate tasks if ever pursued): pomodoro
  `nextPomodoroState` screen wiring (rules-noted single-source drift, lower
  user value); audit other `due_date` readers for datetime assumptions (none
  found — all producers emit keys).
- Lessons: the full-suite run caught a fixture relying on the hole — the new
  contract paid for itself immediately; fixture repair (not assertion
  weakening) was the correct classification.
