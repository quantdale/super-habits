# ExecPlan: calorie-goal-empty-zero-v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Fix the CalorieGoalModal / Settings nutrition-defaults sibling of the
MacroTargetsModal empty→0 hole closed at HEAD e950ee5: clearing a macro
field in the goal path silently saves 0 (`Number('') === 0` passes the
0–999 check), and clearing the calories field is rejected only with the
misleading range message. Observable success: cleared/whitespace-only
fields in `validateCalorieGoal` are rejected with a clear error,
explicit `0` macros still save, and calorie entry forms (which
intentionally treat empty as 0 + rely on the computed-kcal guard) are
untouched — proven by focused unit regression (red→green) plus
typecheck/lint gates under Node 22.

## Context

- HEAD e950ee5 fixed `MacroTargetsModal` with a local empty check
  (`features/calories/MacroTargetsModal.tsx:53-59`,
  `Enter a value for every field.`) but left the identical hole in the
  goal path: `validateCalorieGoal` (`lib/validation.ts:64-80`) does
  `Number(protein.trim())` etc., so `''`/`'   '` → 0 passes.
- Call sites sharing `validateCalorieGoal`: `CalorieGoalModal.handleSave`
  (`features/calories/CalorieGoalModal.tsx:42-56`, NumberStepperField
  strips to `''` on clear) and Settings nutrition defaults
  (`features/settings/SettingsScreen.tsx:274-305` via
  `CalorieGoalFormState`). Fixing in `validateCalorieGoal` covers both;
  a modal-local fix would leave Settings broken.
- Must-not-break: `validateCalorieEntry` (`lib/validation.ts:28-53`)
  intentionally allows empty macro strings (entry form starts `''`,
  `CaloriesScreen.tsx:138-141`, submits `parseNumericInput(...) ?? 0`,
  all-empty caught by `validateCalorieComputedKcal(0)`). Red proof on
  this box: `validateCalorieEntry('Chicken','','','','')` → null is
  correct and stays.
- Red proof (Node 22.23.2, `--experimental-strip-types`, this tree):
  `validateCalorieGoal('2000','','0','0')` → null (BUG);
  `validateCalorieGoal('2000','150','   ','65')` → null (BUG);
  `validateCalorieGoal('','150','200','65')` →
  `"Daily calorie goal must be at least 500."` (rejected, misleading);
  `validateCalorieGoal('2000','0','0','0')` → null (correct, keep).
- Safety: never `pkill -f vitest` (matches tool bridge); exact-PID kills
  only after `/proc/<pid>/cmdline` inspection. No push/tags/EAS/PII.

## Scope

- `lib/validation.ts` — `validateCalorieGoal` rejects empty/whitespace-only
  fields first with a clear error (`Enter a value for every goal field.`),
  before the existing 500–6000 / 0–999 range checks. No change to
  `validateCalorieEntry`, `validateCalorieComputedKcal`, or any other
  validator.
- `tests/validation.test.ts` — focused regression: empty + whitespace-only
  macro rejection (each field), empty/whitespace calories rejection with
  the clear error, explicit `'0'` macros still accepted, valid goal still
  accepted.
- Gates: focused vitest file, `npm run typecheck`, `npm run lint`,
  `npm run qa:fast` (or `test:unit` fallback if qa:fast is heavy — record
  what ran).

## Non-Goals

- No change to calorie entry semantics, entry UI, MacroTargetsModal,
  double-submit guards, migrations, sync/backup, a11y matrices,
  docs-only work, native/emulator lanes (ENVIRONMENT-only → out of scope).
- No e2e modal test (pure validator; unit red→green is the proportionate
  proof; modal already surfaces `goalError` unchanged).
- No push, no tags, no EAS, no PII.

## Current Checkpoint

- Current milestone: task complete (local commit is the final step,
  executed now).
- Completed: red proof captured; `validateCalorieGoal` empty guard
  implemented; 4 regression tests added; focused suite + full unit suite +
  typecheck + lint all green under Node 22.
- In progress: none — validated; committing locally.
- Important modified files: `lib/validation.ts`, `tests/validation.test.ts`
  (plus this plan file).
- Last successful validation: `node -v` → v22.23.2; full `npm test` —
  207 files / 2120 tests PASS; `npm run typecheck` clean;
  `npm run lint` (`--max-warnings 0`) clean.
- Current failures: none.
- Relevant quarantines: none (unit path).
- Blockers: none.
- Condition required to unblock: none.
- Exact next action: none — task complete (local commit is the final step,
  executed now).
- Remaining definition of done: complete — (1) empty/whitespace goal fields
  rejected with a clear error, explicit 0 still accepted, entry semantics
  untouched; (2) red→green proven (pre-fix null → post-fix error string);
  (3) focused + full unit gates green; typecheck + lint green; (4) no
  existing tests weakened; (5) plan COMPLETED + validated; (6) committed
  locally, no push.

## Progress

- [x] 2026-09-20 — Red proof + ExecPlan created (ACTIVE).
- [x] 2026-09-20 — Fix + 4 regression tests, focused vitest 31/31 green
  (red→green proven via strip-types probe: empty/whitespace → null
  pre-fix, `'Enter a value for every goal field.'` post-fix).
- [x] 2026-09-20 — `npm run typecheck` clean; `npm run lint` clean
  (one prettier format fix in the new tests); full `npm test` 207/207
  files, 2120/2120 tests PASS; plan COMPLETED; local commit (final step).

## Surprises & Discoveries

- None yet.

## Decision Log

- Fix in `validateCalorieGoal` (not modal-local): covers both
  CalorieGoalModal and Settings nutrition defaults with one guard, and
  leaves `validateCalorieEntry`'s intentional empty-as-0 semantics alone.
- Unit (not e2e) regression: the defect is a pure-function validation
  hole; the modal already renders the returned error. Cheapest sufficient
  gate per impact-map thinking.

## Validation Ledger

- 2026-09-20 — `node -v` v22.23.2; HEAD e950ee5 confirmed.
- 2026-09-20 — Red proof via `node --experimental-strip-types` (see
  Context): empty/whitespace macros → null (bug confirmed).
- 2026-09-20 — `npx vitest run tests/validation.test.ts` — pass (31/31,
  incl. 4 new goal empty-rejection tests; green probe: empty/whitespace →
  `'Enter a value for every goal field.'`, explicit `'0'` → null).
- 2026-09-20 — `npm run typecheck` — pass (clean); `npm run lint` — pass
  (clean after one prettier format fix in the new tests).
- 2026-09-20 — `npm test` — pass (207 files / 2120 tests, 0 failures).

## Changed Files / Areas

- `lib/validation.ts` — `validateCalorieGoal` empty/whitespace guard.
- `tests/validation.test.ts` — 4 new `validateCalorieGoal` regression tests.

## Recovery / Resume Instructions

1. `cd /home/box/Desktop/super-habits`; `node --version` must be v22.x.
2. Read this plan; `git status --short`; `git log --oneline -3`.
3. Continue from `Exact next action` above.
4. QA: focused `npx vitest run tests/validation.test.ts`, then
   `npm run typecheck`, `npm run lint`, `npm run qa:fast`.

## Outcomes & Retrospective

- Status: COMPLETED 2026-09-20.
- Summary: one real product-correctness gap fixed — the goal-path sibling
  of the e950ee5 MacroTargetsModal hole. `validateCalorieGoal` treated a
  cleared macro field as 0 (`Number('') === 0` passes 0–999) and rejected
  a cleared calories field only with the misleading range message, so both
  `CalorieGoalModal` and Settings nutrition defaults could silently persist
  a zeroed goal. The validator now rejects any empty/whitespace-only field
  with `Enter a value for every goal field.`; explicit `'0'` macros,
  the valid-goal path, and the under-500/over-6000/over-999 range checks
  are unchanged, and `validateCalorieEntry` (intentional empty-as-0 +
  computed-kcal guard) is untouched. Four focused unit tests prove
  red→green; full suite 2120/2120 green. No tests weakened; no
  meta-guard, a11y matrix, docs-only, or native work.
- Follow-up (not in scope): audit siblings `validatePomodoroSettings` /
  entry-adjacent numeric validators for the same `Number('') === 0`
  class if a future run targets them — left untouched here by design.
