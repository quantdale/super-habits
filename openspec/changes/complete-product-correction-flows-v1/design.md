# Design: Complete Product Correction Flows V1

## D1 — Recurring Todo series (daily-chain model, no new recurrence kinds)

Persisted reality: `todos.recurrence` is `'daily' | null`; a series is the set of rows sharing `recurrence_id`; day rollover spawns today's instance when a series has no active instance due today; completing an instance spawns tomorrow's copy from its title/notes/priority.

Contract:

- **Edit this task** — unchanged `updateTodo` on one instance; copy makes the scope explicit.
- **Edit series (future)** — apply title/notes/priority to every non-deleted instance of the series with `completed = 0`; completed history is never rewritten; subsequently spawned copies inherit because they are copied from the current active instance.
- **Stop repeating** — set `recurrence = NULL` on every row of the series (active and completed) and soft-delete pending instances whose `due_date` is after today. Clearing completed rows is required because the rollover "missing instance" scan keys on `recurrence = 'daily'` rows regardless of completion; leaving them would resurrect the series. `recurrence_id` is preserved for history grouping. No future copy is ever spawned again.
- **Restart** — re-enabling "Repeat daily" on an instance assigns a fresh `recurrence_id`; the old chain stays ended.
- **Delete occurrence** — existing soft delete; behavior against rollover respawn stays as shipped and is documented honestly (deleting the active instance of an unended series can be re-spawned by rollover; "Stop repeating" is the correct end-series action).
- Recurring-source Linked Actions stays blocked; copy explains each daily copy is a separate task (rules bind to one row id).

## D2 — Calorie entry day correction

`updateCalorieEntry` gains optional `consumedOn` (validated local `YYYY-MM-DD` via `toDateKey` semantics). The update preserves the row id and emits exactly one `calorie_entries` update outbox row. Daily aggregates are query-time over `consumed_on`, so source and destination day totals self-correct; diary and Form modes read the same rows. The edit modal gains a date control using the existing date-picker pattern; repeated identical saves stay idempotent; failed saves leave the entry unchanged.

## D3 — Workout correction without history corruption

- **Routines** — activate `updateRoutine` (name/description/goal tag) behind an edit affordance; template edits never rewrite existing `workout_logs` rows.
- **Custom exercises** — activate `updateCustomExercise` (rename/metadata), `archiveCustomExercise`, archived listing (`listCustomExercises(true)`), and restore; archived exercises stay invisible to new routine editing but historical session snapshots are untouched (logs snapshot exercise identity at completion).
- **Completed workout logs** — the only correction is **delete** of an accidentally logged session (mistake quick-completes), with confirmation, cascade to its session exercise/set rows, one durable outbox intent per touched row, and restore inertness (deletes are not replayed as side effects). Numeric reps/load/duration/RPE on completed sessions remain immutable — progression and charts derive from an append-only history; editing them would silently invalidate derived statistics. Contract is explicit in UI copy.
  - Wave-4 amendment (evidence-driven): `workout_logs`, `workout_session_exercises`, and `workout_session_sets` have no `deleted_at` column (bootstrap DDL + migrations 7/20), and mirroring a new column into the remote schema is out of scope. Delete therefore follows the established `saved_meals` hard-delete exception: local rows are hard-deleted and every removed row records a durable remote delete intent in the same transaction. Restore inertness is inherent (no rows, no replay). The user-visible contract — confirmed deletion, cascade, template untouched, no history rewrite — is unchanged.

## D4 — Pomodoro management + safe session correction

- **Presets** — authoring UI for custom presets (create/rename/durations/delete; built-ins protected), persisted through `savePomodoroPresets` onto the existing `app_meta` recoverable-settings path.
- **Post-hoc session correction** — from focus history, edit the note and link/unlink the associated todo through the existing `setPomodoroSessionMeta` contract (note + `linkedTodoId` + snapshot title), keeping its single outbox update semantics.
- **Immutability decision** — session duration/type/completion timestamps are NOT editable and sessions are NOT soft-deletable; no migration 25. Rationale: stats, streaks, and backup checksums treat sessions as an append-only log; metadata-only correction covers the demonstrated user mistake (wrong label/link). This is a documented contract, not a gap.

## D5 — Weekly Review discoverability + management

Per the 2026-09-01 disposition ledger ("keep the modal; expose from Plan/Progress"): the Planning Hub Progress surface gains a Weekly Review entry that opens the existing modal via `openWeeklyReview`; the notification path stays intact. Re-completion of the current week keeps its existing upsert semantics. Review history gains a delete affordance wired to `deleteWeeklyReview` with confirmation (removes the review from rollups; entity is soft-deleted and outbox-synced). No seventh tab, no new FAB.

## D6 — Linked Actions policy honesty

The engine gates execution on `engineSupport`, so `calorie.log`/`pomodoro.log` rules cannot execute despite implemented effects (engine skips "unsupported" rules). Decision procedure (executed in Wave 6):

1. Audit event emission for triggers `calorie.entry_logged`, `pomodoro.focus_completed`, `workout.completed` from the data layers.
2. Where trigger + target + effect are all implemented and exactly-once proven, flip the policy rows to `implemented`/`visible`, add editor rows/validation, and prove end-to-end (author → trigger → exactly-once effect) with integration + E2E.
3. Where any leg is not genuinely shipped, keep the path hidden but relabel with honest terminology and a recorded product reason — the label must never claim "deferred engine" for executed code or vice versa.

Product intent favors exposure for `calorie.log`/`pomodoro.log` targets (the effects and their exactly-once proofs exist); triggers are exposed only with proven emission.
