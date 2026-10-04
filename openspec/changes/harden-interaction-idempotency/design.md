## Context

See proposal.md for the motivation. Current `main` is `c1bc380`. The repository already owns the pattern: `lib/submitGuard.ts` exposes `createSubmitGuard()` with `tryStart()`/`finish()`, and it is already used by the add/edit-todo modal (`features/todos/TodosScreen.tsx:129,:280,:352`), by `features/calories/QuickAddKcal.tsx:32-37` — whose comment states the rule and names the defect class — and by the other quick-capture surfaces. `features/todos/TodoQuickCapture.tsx` does not use it: `canSubmit` is `trimmed.length > 0 && !isSubmitting` (`:28`), `setIsSubmitting(true)` runs after the closure is captured (`:41`), `onSubmitEditing` calls `handleSubmit` directly (`:70`) with no `disabled` binding on the `TextInput`, and the `Pressable`'s `disabled={!canSubmit}` only constrains the press path. Its caller `features/todos/TodosScreen.tsx:475-496 handleQuickAdd` has no guard of its own. On the undo path, `features/quick-capture/QuickCaptureOverlay.tsx:273-285` closes over `capturedFood`, `cal`, and `mealType`, then resolves the target with `listCalorieEntries().find(...)` on a newest-first list (`features/calories/calories.data.ts:100-106`) because `addCalorieEntry` returns no id.

## Goals / Non-Goals

**Goals:**

- Use the existing synchronous guard on the inline quick-add input, covering both entry paths, with no change to the control's presentation.
- Thread the created row's identity from the calorie write to its undo, so the destructive action targets exactly the row that was created.
- Give the inline quick-capture surfaces the row oracle the modal already has.

**Non-Goals:**

- Changing `addTodo`, `addCalorieEntry`, or `deleteCalorieEntry` signatures beyond returning the identity the caller already needs, and no change to their transaction or enqueue behavior.
- Redesigning the recent-capture list or its storage.
- Touching the modal guard, the other quick-capture surfaces that already use the guard, or any validation ordering.

## Decisions

### 1. Use `createSubmitGuard`, not a new local flag

Add a `submitGuardRef` to `TodoQuickCapture` and enter it at the top of `handleSubmit` before any await, releasing it in `finally`. `isSubmitting` stays for the button's loading presentation only, exactly as `QuickAddKcal` documents.

Alternative: set `isSubmitting` before the await via a ref-backed mirror. Rejected. It reimplements the shared guard locally, and the two implementations would drift.

### 2. The guard is entered in the component, not the caller

The caller `handleQuickAdd` stays unguarded. The component owns both entry paths, which is where the same-tick race lives.

Alternative: guard in `TodosScreen.handleQuickAdd`. Rejected. The Enter-key path and the press path converge in the component; guarding the caller would leave the component's own state presentation able to double-run and would not cover a future second call site.

### 3. Return the created row's id from the calorie write

`addCalorieEntry` returns the created row's id (or the row), and the quick-capture overlay closes over that value for its undo. The fallback value-matching resolution is removed rather than kept as a backstop.

Alternative: keep the matcher but scope it to rows created after the capture timestamp. Rejected. It still cannot distinguish two identical rows created in the same session, which is exactly the reproducible case, and it keeps a heuristic on a destructive path. Alternative: make undo a last-write-wins delete of the newest matching row. Rejected. That deletes the wrong row in the identical-capture case.

### 4. The E2E oracle is a journey step, not a new spec file

Extend the existing fat-fingers journey's step-11 oracle — which already asserts "one row, never two" for the modal — to also drive the inline quick-add input and the identical-capture undo, keeping one place where the contract is asserted end to end.

Alternative: a dedicated `quick-capture-idempotency.spec.ts`. Rejected. A second file weakens the single-oracle property the modal path already enjoys and doubles the journey-label parity surface.

## Risks / Trade-offs

- [Returning an id from `addCalorieEntry` changes a widely used signature] → The return is additive; existing callers ignore it, and the transaction and enqueue behavior are untouched.
- [A guard entered before validation could swallow a validation error] → The guard wraps only the submit attempt and releases in `finally`; validation still runs before the write and its error still surfaces through the existing `error` state.
- [Removing the value-matching fallback could break undo after a reload] → The stored recent-capture entry carries the row identity, so a post-reload undo resolves the same row; if a legacy stored entry lacks the identity, undo resolves to a no-op that reports it could not find the capture rather than deleting an arbitrary row.
- [Extending the fat-fingers journey adds steps to a `@p0` lane] → The steps reuse the existing reset/seed helpers and add no new fixture.

## Migration Plan

No data or schema migration. Apply order: (1) add the guard to `TodoQuickCapture` covering both entry paths; (2) thread the created row identity from `addCalorieEntry` through the quick-capture undo and remove the value-matching fallback; (3) add unit coverage for the same-tick double submit on both entry paths; (4) add unit coverage for the identical-capture undo ordering; (5) extend the fat-fingers journey step to assert the inline oracle; (6) run the affected unit, integration, and journey lanes. Rollback is a revert of the single commit.

## Open Questions

None. Both surfaces, their entry paths, and the sanctioned guard are all identified in the current tree.
