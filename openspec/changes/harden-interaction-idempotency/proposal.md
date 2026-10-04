## Why

The repository already closed the "one row or zero, never two" contract for the add/edit-todo modal, and its own comment in the inline calorie quick-add records that the same-tick double-press class is closed app-wide. Two surfaces still violate it. The inline quick-add task input reads a React state flag that is set after the closure is captured, and its Enter-key path is not covered by the button's `disabled` binding, so two Enter presses in one tick both pass validation and write two todos with identical titles. The quick-capture calorie undo cannot identify the row it captured, because `addCalorieEntry` returns no id; it re-reads today's newest-first list and deletes the first row matching name, calories, and meal type, so undoing the older of two identical captures deletes the newer one and leaves the row the user asked to remove.

## What Changes

- Route the inline quick-add task input's submit paths through the repository's existing synchronous submit guard, so two presses in the same tick produce exactly one write, and add a "one row, never two" regression for the Enter-key path.
- Make the quick-capture calorie path return the created row's identity so undo resolves the exact row it captured rather than matching by value, and add regression coverage for two identical captures where the older is undone.
- Add the "one row or zero, never two" oracle to the inline quick-capture surfaces in the E2E layer, which currently covers only the modal path.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `todo-add-double-submit-guard`: Extend the re-entrancy contract from the add/edit-todo modal to the inline quick-add input, and add a same-class requirement that a destructive quick-capture action resolves the exact row it captured rather than matching by value.

## Impact

Touches `features/todos/TodoQuickCapture.tsx`, its caller, the calorie quick-add data path, `features/quick-capture/QuickCaptureOverlay.tsx`, and their tests. No schema change, no migration, no change to any existing validation ordering, and no change to the modal guard that already passes. Applying it removes duplicate todos from the inline quick-add path and removes a mis-targeted delete from the quick-capture path.
