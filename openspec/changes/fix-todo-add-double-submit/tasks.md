# Tasks — fix-todo-add-double-submit

## 1. Fix: re-entry guard in the add/edit-todo modal write path

- [ ] 1.1 Add a pure, unit-testable re-entry guard to `features/todos/todos.domain.ts` (e.g. `createSubmitGuard()` returning `tryStart()`/`finish()`; `tryStart()` returns `false` while a save is in flight, so a second call cannot start a second write).
- [ ] 1.2 Wire the guard into `onSave()` in `features/todos/TodosScreen.tsx` (line ~157): check the guard at the top and return early when a save is already in flight; mark in-flight before the async create/update begins; clear the guard after the save completes or the modal closes (`setModalVisible(false)` path) — including on error, so a failed save does not dead-lock the submit control.
- [ ] 1.3 Apply the guard to both save paths the modal exposes — the `updateTodo` edit branch (line ~181) and the `addTodo` create branch (line ~191) — so neither can ever write twice.
- [ ] 1.4 Disable (or ignore) the submit button's `onPress` (line ~621) while a save is in flight, so a second press in the same tick never re-enters `onSave()`.
- [ ] 1.5 Keep validation-before-write behaviour unchanged: `validateTodo(title, notes, dueDate)` still runs first and surfaces `setTodoError` on invalid input; a single press saves, closes the modal, resets the form, and refreshes exactly as before.

## 2. Release the J7 step-11 quarantine

- [ ] 2.1 Remove the `test.fixme(true, 'todo double-submit defect …')` call (lines ~487–490) from step 11 "double-submit add-todo lands exactly ONE row" in `e2e/journeys/fat-fingers.spec.ts`, leaving the two `rapidPress(submit, 2)` presses and the strict `expect(n).toBe(1)` row-count assertion (line ~504) untouched — the assertion is released, never weakened.
- [ ] 2.2 Update the spec's header quarantine comment (lines ~31–39) so it no longer describes step 11 as quarantined for this defect.
- [ ] 2.3 Clear the CG-3 entry (lines 42–48) in `docs/testing/known-gaps.md` (double-submit add-todo creates two rows — reason, quarantined tests, companion change), leaving the remaining gap entries intact.

## 3. Unit tests

- [ ] 3.1 Add `createSubmitGuard()` coverage to `tests/todos.domain.test.ts` (repo convention: `{feature}.domain.ts` logic tested in `tests/{feature}.domain.test.ts`): first `tryStart()` succeeds, a second `tryStart()` while in flight returns `false`, `finish()` re-enables the guard, and the guard returns to re-entrant after completion.

## 4. Verification

- [ ] 4.1 `npm run typecheck` and `npm run lint` clean.
- [ ] 4.2 `npm test` passes, including the new `tests/todos.domain.test.ts` tests.
- [ ] 4.3 J7 step 11 passes in the journeys lane: `npm run e2e:journeys` (runs the full `journeys` Playwright project against `dist/`; requires `npm run build:web` first) — fat-fingers step 11 is no longer skipped and asserts exactly one row.
