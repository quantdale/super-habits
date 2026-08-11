# Tasks — fix-recurring-todo-expansion-idempotency

## 1. Fix — make the daily-recurring expansion idempotent per activation

- [x] 1.1 Chose an atomic data-layer insert guard: `INSERT ... SELECT ... WHERE NOT EXISTS` closes the interleaving race that a separate re-check could not close; recorded in this task state.
- [x] 1.2 Implemented the guard in `createRecurringInstance` (`features/todos/todos.data.ts`): the insert statement checks for an active row with the same `recurrence_id` and `due_date`, and SQLite's affected-row count determines whether an insert occurred.
- [x] 1.3 The only expansion enqueue remains inside `createRecurringInstance`, and runs only when the atomic insert reports one changed row; duplicate calls produce no second create record.
- [x] 1.4 Left `findMissingRecurrenceIds` as the snapshot-only pure function and `loadTodosOnFocus` unchanged; the recurrence model and instantiation flow stay as-is.
- [x] 1.5 Checked the existing schema/indexes; the focused guard query is acceptable without a schema change or migration because no new column is required.

## 2. Tests

- [x] 2.1 Unit — `tests/todos.data.test.ts`: an insert reporting zero affected rows skips the outbox enqueue, while the SQL retains the active `(recurrence_id, due_date)` predicate.
- [x] 2.2 Unit — `tests/todos.data.test.ts`: an insert reporting one affected row enqueues exactly once.
- [x] 2.3 Integration — `tests/integration/recurringExpansion.test.ts`: three concurrent real-SQLite calls leave one row and one pending outbox create.
- [x] 2.4 Updated the J8 finding header to a fixed-finding note, restored the exact one-active-today-instance-per-series oracle, and retained soft-delete, outbox, and non-recurring-table invariants.
- [x] 2.5 No recurring-expansion entry exists in `docs/testing/known-gaps.md`; no cleanup was needed there.

## 3. Verification

- [x] 3.1 `npm run typecheck` and `npm run lint` pass with 0 errors and warnings under the existing cap.
- [x] 3.2 `npm test` — the full suite passes (656 tests), including the recurrence idempotency tests.
- [x] 3.3 J8 row-count and heatmap boundary assertions pass in the standard `dist/` lane; the unchanged CG-4 and CG-5 D14 performance assertions remain quarantined with their strict bodies intact.
- [x] 3.4 J1 regression `e2e/journeys/a-tuesday.spec.ts` passes unchanged (8/8 steps).
