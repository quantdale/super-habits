## Why

`add-real-world-user-simulation-testing` defines the "one row or zero, never two" contract (risk **R5**: duplicate-writes from rapid user input). Journey **J7 — "Fat fingers"** (step 11, "double-submit add-todo lands exactly ONE row") drives two complete pointer presses of the Add-task submit in the same tick — the fastest a human double-tap can physically land — and proves the app creates **two todo rows**.

The defect is in `features/todos/TodosScreen.tsx` `onSave()`: it runs the full create/update path with no re-entry guard. Two rapid presses each execute `createTodo`, so the modal's submit observer fires twice, and two rows with the same title are persisted (reproduced consistently by J7 step 11: row count = 2). The strict row oracle `expect(n).toBe(1)` is legitimate — the moment the app fixes the double-submit, the assertion must hold again.

The regression already exists, written to the decided contract and quarantined: `e2e/journeys/fat-fingers.spec.ts` step 11 (`test.fixme()` naming this companion), tracked in `docs/testing/known-gaps.md`. This change releases that quarantine.

## What Changes

- Add a **re-entry guard to `onSave()`** in `features/todos/TodosScreen.tsx`: an `isSubmitting` state (or equivalent) that is set before the async save begins, checked at the top of `onSave()` and on the submit button's `onPress`, and cleared only after the save completes or the modal closes. The submit control must be disabled (or the press ignored) while a save is in flight, so a second press in the same tick cannot start a second write.
- Apply the guard to **both** save paths the modal exposes (create and edit — the edit path must also never write twice), keeping the validation-before-write behaviour unchanged.
- **Release J7 step 11's quarantine**: remove the `test.fixme()` from `e2e/journeys/fat-fingers.spec.ts` step 11 and clear the corresponding entry in `docs/testing/known-gaps.md`. The strict `expect(n).toBe(1)` assertion stays; it is removed from quarantine by this change, never weakened.

## Capabilities

### New Capabilities

- `todo-add-double-submit-guard`: submitting the add/edit-todo modal twice in rapid succession creates exactly one todo row (the modal write path is re-entrant-safe).

### Modified Capabilities

- None. The todo CRUD contract is unchanged apart from the re-entry guard; the row-level "one row, never two" invariant is asserted by J7 step 11.

## Impact

- **Modified files**: `features/todos/TodosScreen.tsx` (`onSave()` re-entry guard), `e2e/journeys/fat-fingers.spec.ts` (remove the step-11 quarantine), `docs/testing/known-gaps.md` (clear the J7 quarantine entry).
- **Behaviour change**: a second rapid press of Add/Save does nothing instead of duplicating a row. No user-visible regression for normal single presses (the guard only blocks concurrent in-flight saves).
- **No schema/migration impact**: no SQLite or `app_meta` changes.
- **Testing**: J7 step 11 becomes a passing regression test (it is current failing on the defect, quarantine-released by this change).
- **Follow-up changes**: none anticipated; this closes the J7 double-submit finding.
