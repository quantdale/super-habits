## 1. Inline quick-add re-entrancy

- [x] 1.1 Add a `createSubmitGuard()` ref to `features/todos/TodoQuickCapture.tsx` and enter it at the top of `handleSubmit` before any await, releasing it in `finally`
- [x] 1.2 Confirm both the `Pressable` `onPress` path (`features/todos/TodoQuickCapture.tsx:74`) and the `onSubmitEditing` path (`:70`) pass through the guard, and that `isSubmitting` remains only the button's loading presentation
- [x] 1.3 Add unit coverage that two submissions in the same tick persist exactly one row through the Enter-key path
- [x] 1.4 Add unit coverage that two submissions in the same tick persist exactly one row through the press path
- [x] 1.5 Add unit coverage that a single valid submit still validates before the write and behaves as before

## 2. Quick-capture undo targets the captured row

- [x] 2.1 Make the calorie quick-add write return the created row's identity
- [x] 2.2 Thread that identity into the recent-capture entry in `features/quick-capture/QuickCaptureOverlay.tsx:273-285` and resolve the undo from it
- [x] 2.3 Remove the value-matching fallback that deletes the newest matching row, and make a capture whose identity cannot be resolved a reported no-op rather than an arbitrary delete
- [x] 2.4 Add unit coverage that two identical captures followed by an undo of the first deletes the first row and retains the second
- [x] 2.5 Add unit coverage that a single capture's undo deletes that row exactly as today

## 3. End-to-end oracle

- [x] 3.1 Extend the existing fat-fingers journey step that asserts "one row or zero, never two" for the modal so it also drives the inline quick-add input
- [x] 3.2 Add a journey assertion that two identical calorie captures followed by an undo of the first leave exactly one matching row
- [x] 3.3 Run the extended journey against a fresh hermetic `dist/` and record the exact result

## 4. Validate

- [x] 4.1 Run the affected unit tests and the real-SQLite integration project on pinned Node `v22.23.2` and record the exact result
- [x] 4.2 Run `npm run typecheck` and `npm run lint --max-warnings 0` and record the exact results
- [x] 4.3 Run `npm run qa:fast` and record the exact result
- [x] 4.4 Run `npm run openspec:validate --all` and confirm this change still validates
- [x] 4.5 Review the full diff and confirm no validation ordering, transaction, enqueue, or modal-guard behavior changed
