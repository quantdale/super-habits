# Tasks — fix-recurring-todo-expansion-idempotency

## 1. Fix — make the daily-recurring expansion idempotent per activation

- [ ] 1.1 Decide the guard design from the proposal's options — insert-site re-check (simplest, race-free at the insert site), upsert keyed on `(recurrence_id, due_date)`, or a per-series inflight flag serializing activations — and record the choice in the change notes.
- [ ] 1.2 Implement the guard in `createRecurringInstance` (`features/todos/todos.data.ts`): before the `INSERT INTO todos` (~line 133), re-query for an existing active row with the same `recurrence_id` and `due_date` (`deleted_at IS NULL`); if present, return without inserting and without calling `syncEngine.enqueue` (~line 152).
- [ ] 1.3 Keep the outbox consistent: the only expansion enqueue remains the one inside `createRecurringInstance`, fired only when the insert actually happened — no `create` for an instance that was not inserted, no duplicate create for the same (series, today) pair.
- [ ] 1.4 Leave `findMissingRecurrenceIds` (`features/todos/todos.domain.ts`) as the snapshot-only pure function and `loadTodosOnFocus` (`features/todos/TodosScreen.tsx`) unchanged unless the guard is placed there; the `recurrence_id` model and instantiation flow stay as-is.
- [ ] 1.5 Check existing indexes on `todos`; add a supporting index on `(recurrence_id, due_date)` in the bootstrap DDL (`core/db/client.ts`) only if the guard's re-check query needs one — no column changes, no schema-version bump.

## 2. Tests

- [ ] 2.1 Unit — `tests/todos.data.test.ts`: `createRecurringInstance` skips the INSERT and enqueues nothing when the re-check finds an existing active `(recurrence_id, due_date)` row (mock `getDatabase` returns a row; assert no insert `db.runAsync` and no `syncEngine.enqueue` call).
- [ ] 2.2 Unit — `tests/todos.data.test.ts`: pass-through — no existing row, so exactly one INSERT and one `syncEngine.enqueue` call.
- [ ] 2.3 Integration — `tests/integration/` (new `tests/integration/recurringExpansion.test.ts`): against the real SQLite, two consecutive `createRecurringInstance` calls for the same (series, today) leave exactly one row and one outbox `create` record.
- [ ] 2.4 Release the J8 workaround (there is no `test.fixme()`/`it.fails()` to remove — J8 runs green with relaxed assertions): update the FINDING header block (`e2e/journeys/three-months-in.spec.ts` lines 30–41) to a fixed-finding note; restore the exact-count assertion in the "Row-level oracles" step (~line 420, currently invariants-only at 425–459) asserting exactly one active today-instance per uncovered series, keeping the retained invariants (16 seeded soft-deletes untouched, outbox create-count == row growth, byte-identical non-todo tables); drop the "NOT idempotent" caveat comment at lines 227–230. No assertion is weakened.
- [ ] 2.5 Register cleanup: the J8 finding currently lives only in the spec header — there is no contract-gap entry for it in `docs/testing/known-gaps.md`; if one was added meanwhile, clear it here.

## 3. Verification

- [ ] 3.1 `npm run typecheck` and `npm run lint` clean.
- [ ] 3.2 `npm test` — the full suite (unit + integration Vitest projects) passes, including the new tests from 2.1–2.3.
- [ ] 3.3 J8: `npx playwright test --project=journeys e2e/journeys/three-months-in.spec.ts` green with the restored exact-count assertion (standard `dist/` lane on :8081; this spec carries no `@sync` steps, so no dist-sync lane needed).
- [ ] 3.4 J1 regression: `e2e/journeys/a-tuesday.spec.ts` — "Task 7 instantiated exactly once" (~lines 195–204) still passes unchanged.
