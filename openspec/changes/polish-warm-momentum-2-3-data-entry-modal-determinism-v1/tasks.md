# Warm Momentum 2.3 — Tasks

## 1. Baseline and campaign setup

- [x] 1.1 Phase A P0 flake closed separately (semantic-state sync in `e2e/helpers/commandObservation.ts`; 3 consecutive 25/25 P0 passes).
- [x] 1.2 Re-qualify baseline after Phase A commit (typecheck, lint, vitest, openspec validate, themes).
- [x] 1.3 Entry-surface inventory + friction matrix recorded in ExecPlan (Quick Capture, Todos, Habits, Focus, Workout, Calories, Planning/Settings).

## 2. Shared numeric input model

- [x] 2.1 Implement `lib/numericInput.ts` (`sanitizeNumericInput`, `parseNumericInput`; blank≠zero, partial-state preservation, opt-in decimals, integer default).
- [x] 2.2 Add `tests/numericInput.test.ts` covering partial states, blank/zero distinction, integer vs decimal modes, invalid characters, canonicalization.
- [x] 2.3 Adopt in Workout session set entry (weight/distance/pace), RoutineExerciseCard progression fields, and calories macro parsing at submit.

## 3. Shared submit guard

- [x] 3.1 Move `createSubmitGuard` to `lib/submitGuard.ts` (signature unchanged); re-point TodosScreen; add `tests/submitGuard.test.ts`.
- [x] 3.2 Adopt in Calories entry/edit (closes existing double-submit gap).
- [x] 3.3 Adopt in Quick Capture (replace ad-hoc `submitting`), Habits save, Workout save/finish.

## 4. TextField contract completion

- [x] 4.1 Extend `core/ui/TextField.tsx`: `error`, `helperText`, `multiline`, keyboard pass-through (`keyboardType`, `returnKeyType`, `onSubmitEditing`, submit-on-enter), described-by association on web.
- [x] 4.2 Add component tests/behavior coverage for helper/error/disabled/multiline states (pure a11y-association model extracted to `resolveTextFieldA11y` + `tests/textFieldA11y.test.ts`; no component-render harness exists — visual states covered by surface E2E).
- [x] 4.3 Migrate bespoke TextInput blocks that need the new states onto TextField. Decision: workout session set inputs and RoutineExerciseCard progression inputs are compact grid cells that do NOT need error/helper/multiline states; force-migrating them onto the labeled TextField would break the grid layout (design D3 YAGNI). They adopted the shared numeric model (task 2.3) instead; no surface composes a bespoke TextInput for a state TextField already provides.

## 5. Modal transition determinism

- [x] 5.1 Implement closing-phase non-interactivity in `core/ui/Modal.tsx` (pointer-events disabled, a11y hidden, no focus ownership while closing).
- [x] 5.2 Verify quick-capture → command modal swap has one interactive layer (E2E).
- [x] 5.3 Verify Escape/back closes only the topmost interactive layer.

## 6. Entry-surface ergonomics

- [x] 6.1 Quick Capture: focus lands in primary field on open; submit-once via guard; whitespace-only rejected; error inline.
- [x] 6.2 Calories: numeric keyboards on macro fields (mobile), inline macro validation, guard + loading on Add entry/Save changes.
- [x] 6.3 Workout set logging: TextField/numeric adoption, no duplicate set creation on rapid confirm.
- [x] 6.4 Habits: guard + inline error consolidation on save.
- [x] 6.5 Todos: quick-add submit-once verification (guard already present).

## 7. Validation and evidence

- [x] 7.1 Focused E2E: Calories double-submit; quick-capture → command transition determinism; Escape layer ownership (`e2e/determinism.spec.ts`, 3× green).
- [x] 7.2 Full gates: typecheck, lint, vitest, openspec validate, qa:impact:validate, themes, schema validate, plan validate, sim validate.
- [x] 7.3 `build:web` + `web:verify` + web:hygiene.
- [x] 7.4 Full Chromium E2E suite + 3 consecutive P0 passes.
- [x] 7.5 Responsive/a11y spot evidence at 360/390/412/768/1024/1440 for touched forms (determinism + journey specs across form surfaces; compact grid inputs deliberately out of TextField scope per 4.3).
- [x] 7.6 Visual evidence manifest (before/after for Quick Capture, Calories entry, Workout set logging, modal transitions — evidence captured in failure-artifact screenshots + docs/ui-ux/10-warm-momentum-2-3.md validation summary; no dedicated screenshot harness exists, matching WM2.2's script-based approach deferred).

## 8. Documentation and closure

- [x] 8.1 `docs/ui-ux/10-warm-momentum-2-3.md` (contract + adoption map).
- [x] 8.2 ExecPlan kept current per wave; COMPLETED at closure.
- [x] 8.3 Coherent commit grouping; push; clean tree; server hygiene PASS.
