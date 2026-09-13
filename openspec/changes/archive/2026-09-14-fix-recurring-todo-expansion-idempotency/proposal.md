## Why

The daily-recurring-todo expansion is not idempotent per activation (found by **J8 — "Three months in"**, risk **R6/R9**). Each activation of the Todos section calls `loadTodosOnFocus`, which runs `findMissingRecurrenceIds(allTodos, todayKey)` and then, for every uncovered series, `createRecurringInstance` (a plain `INSERT`).

`findMissingRecurrenceIds` **snapshots the uncovered set** (it reads the `allTodos` array captured before the loop), while each `createRecurringInstance` `await`s its insert. On a fast switch away and back — the walk activates the section repeatedly, and the J8 measured round activates it again right after the warm-up mount — the previous activation's inserts have not committed when the next activation snapshots the still-uncovered series, so the second activation creates **additional today instances** of the same series (observed: seeded-127 pending grew 12–34 instances across 3–4 visits, runs varied). The result is duplicate "today" rows for the same daily-recurring series, and matching duplicate `create` records in the sync outbox.

J8 therefore asserts invariants (self-consistent list, untouched soft-deletes, outbox create-count == row growth, non-todo tables byte-identical) instead of an exact recurrence count — a workaround for a real app defect, documented in the spec's header.

## What Changes

- **Make the expansion idempotent per activation** so rapid re-activation cannot create a second today-instance of an already-created series. Design options, any of which closes the race:
  - re-query the existing rows **after** the snapshot but **before** inserting each instance (`SELECT … WHERE recurrence_id = ? AND due_date = today AND deleted_at IS NULL`) and skip if present — the simplest, race-free guard at the insert site; or
  - enforce the invariant in the data layer with an upsert keyed on `(recurrence_id, due_date)`, so a duplicate activation replaces rather than doubles; or
  - serialize activations (a per-series inflight flag) so a second activation waits for the first's inserts to commit before re-snapshotting.
- **Keep the outbox consistent**: whatever the mechanism, no `create` may be enqueued for an instance that was not inserted, and no duplicate create for the same (series, today) pair.
- **Verify with J8**: the walk's row-oracle invariants still hold, and the expansion now produces exactly one today-instance per uncovered series per activation (J8 may restore an exact-count assertion for today's instances if it chooses; the invariant assertions must remain green in the interim).
- **Release the spec-side workaround narrative**: J8's header notes the finding; with the fix, the header's "NOT idempotent — assert invariants" caveat can be cleared (or kept as a documented fixed-finding, per the register).

## Capabilities

### New Capabilities

- `recurring-todo-expansion-idempotency`: activating the Todos section any number of times in a row creates at most one today-instance per uncovered daily-recurring series, exactly once.

### Modified Capabilities

- None. The daily-recurrence instantiation flow, the `recurrence_id` model, and the outbox write path are unchanged apart from the duplicate-creation guard.

## Impact

- **Modified files**: `features/todos/todos.data.ts` (`createRecurringInstance` / the expansion call site) and/or `features/todos/todos.domain.ts` (`findMissingRecurrenceIds` — if the guard lives in the domain logic), `e2e/journeys/three-months-in.spec.ts` (header narrative; optionally restore exact today-instance assertions).
- **Behaviour change**: rapid section switching no longer duplicates today's recurring instances; the outbox no longer gains duplicate creates for the same series/day. No change for normal single activation.
- **No schema/migration impact**: no SQLite column changes (the guard may use an index on `(recurrence_id, due_date)` if a new one is needed — check existing indexes first).
- **Testing**: J8's row-oracle invariants must stay green; a unit test for the idempotent-expansion guard; J1's "Task 7 instantiated exactly once" assertion continues to pass.
- **Follow-up changes**: none anticipated; this closes the J8 recurring-todo finding.
