# ExecPlan: Diary/calories UX pre-validation for future consumed dates

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

The data layer already rejects future `consumed_on` writes
(`assertConsumableDateKey` in `features/calories/calories.data.ts`, HEAD
2673718, pinned by `tests/integration/calorieFutureDateRejection.test.ts`),
but the edit-entry modal in `CaloriesScreen.tsx` only surfaces that refusal
AFTER submit: the web free-text date field and the native `DateTimePicker`
both accept a future date, and `handleSubmit` only checks format before
calling `updateCalorieEntry`.

Observable success: picking/typing a future or malformed consumed date in
the edit modal shows the exact data-layer message BEFORE submit and blocks
the save (Save disabled); today/past dates remain saveable with no behavior
change; the native picker cannot select a future day.

## Context

- Data contract (closed — do not redo): `assertConsumableDateKey` throws
  `Consumed date must be a valid calendar date (YYYY-MM-DD).` for malformed
  input and `Calorie logging is limited to today or a past local date.` for
  `consumedOn > toDateKey()` (lexicographic compare on local-calendar keys).
  Wired into `addCalorieEntry`, `updateCalorieEntry`, and
  `addCalorieEntryFromLinkedAction`. Command path `executeLogCalories`
  (`features/command/command.executor.ts:227-237`) uses the same future
  message for pre-validation.
- Edit modal (`features/calories/CaloriesScreen.tsx:919-1013`): date UI only
  rendered when `editingEntryId` is set. Web (`:931-940`) is a free-text
  `TextField` (`entryDateKey`, trimmed on change, `setCalorieError(null)`);
  native (`:941-972`) is a `Pressable` + `DateTimePicker` with no
  `maximumDate`, `setCalorieError(null)` on pick. `handleSubmit` (`:571-638`)
  validates food/macros/kcal, clears the error, then inside the async body
  checks `isValidDateKey(entryDateKey)` (format only) before
  `updateCalorieEntry` — the future case falls through to the data-layer
  throw caught at `:625-632` (after submit).
- Create path needs no change: `handleSubmit`'s else-branch calls
  `addCalorieEntry` without `consumedOn` (defaults to `toDateKey()` today);
  quick-add and copy-day write to the navigator-capped `selectedDateKey`;
  `DiaryDayNavigator` already disables future (next button at
  `selectedDateKey >= today`, future week-strip cells disabled).
- Layering: pure date validation belongs in `lib/validation.ts` (form
  messages; `lib` may import `lib/time` — no feature/DB imports). Screen
  imports it like the existing `validateCalorieEntry` /
  `validateCalorieComputedKcal`. `Button` (`core/ui/Button.tsx`) already
  supports `disabled` (suppresses press, dims, sets
  `accessibilityState.disabled`).
- Prior plan `calorie-future-date-rejection-v1.md` is COMPLETED and
  deliberately left out the native `maximumDate` cap (one-diff choke point
  preferred then); this run adds exactly that UX remainder plus pre-submit
  validation. Do NOT re-litigate the data-layer contract.

## Scope

- Add pure `validateConsumedDateKey(consumedOn, todayKey = toDateKey())` to
  `lib/validation.ts` returning the exact data-layer strings (null when
  saveable). Imports `isValidDateKey`/`toDateKey` from `lib/time`.
- `CaloriesScreen.tsx` edit path only:
  - `entryDateError` memo (`editingEntryId ? validate(...) : null`).
  - Web `onChangeText` and native picker `onChange` set the date error
    immediately instead of clearing to null.
  - `handleSubmit` pre-validates the date synchronously before the submit
    guard (replaces the format-only async check), setting `calorieError`
    and returning early.
  - Save `Button` gets `disabled={editing && entryDateError}` semantics
    (still honors `loading`).
  - Native `DateTimePicker` gets `maximumDate` = end of today (local
    23:59:59.999) so future picks are blocked at the picker.
- Unit tests in `tests/validation.test.ts`: future → future message;
  malformed → format message; today/past → null.

## Non-Goals

- No data-layer change (`assertConsumableDateKey` untouched); no new product
  rules — mirror the past-only contract.
- No change to `calorieFutureDateRejection` integration tests (must stay
  green as-is); no schema/migration change (still v25).
- No E2E additions this run (existing `calories-day-navigation` edit-flow
  covers the saveable path; unit + typecheck + lint are the gate).
- No gamification, native-device e2e, push, tags, EAS, or PII work.

## Current Checkpoint

- Current milestone: COMPLETE — pre-validation landed and verified.
- Completed: codebase survey; `validateConsumedDateKey` added to
  `lib/validation.ts` (exact data-layer messages); `CaloriesScreen.tsx`
  edit path wired (immediate inline error on web/native change, submit
  pre-check before the guard, Save disabled while invalid/future,
  `maximumDate` = end of today local on the native picker, immediate error
  when opening a legacy future row); 4 unit tests added to
  `tests/validation.test.ts`; RED→GREEN proven; full suite + typecheck +
  lint green on Node v22.23.2; plan validated; committed locally, no push.
- In progress: None.
- Important modified files: `lib/validation.ts`,
  `features/calories/CaloriesScreen.tsx`, `tests/validation.test.ts`,
  `.agent/execplans/calorie-future-date-ux-prevalidation-v1.md` (this file).
- Last successful validation: full `npm test` 215 files / 2176 tests PASS;
  `npm run typecheck` clean; `npm run lint` (`--max-warnings 0`) clean;
  all on Node v22.23.2, 2026-09-20.
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: None.
- Exact resume action after unblock: None.
- Exact next action: None — task complete.
- Remaining definition of done: Complete — validator + wiring landed; unit
  RED→GREEN; targeted + full suites green; typecheck + lint clean; plan
  validated; committed locally, no push.

## Progress

- [x] Survey edit modal + create path + navigator + command parity; confirm data layer closed.
- [x] Survey edit modal + create path + navigator + command parity; confirm data layer closed.
- [x] Add `validateConsumedDateKey` to `lib/validation.ts`.
- [x] Wire `CaloriesScreen.tsx` pre-validation (immediate error, disabled Save, `maximumDate`, submit pre-check).
- [x] Add unit tests to `tests/validation.test.ts` (RED→GREEN).
- [x] Run targeted suites + typecheck + lint on Node v22.23.2.
- [x] Validate plan + commit locally (no push).

## Surprises & Discoveries

- `react-hooks/exhaustive-deps` flags `dayGeneration` as an unnecessary dep
  when it is not read inside the memo body; the end-of-today cap is now a
  cheap per-render const, which is also fresher across midnight rollover
  than a mount-once memo.

## Decision Log

- 2026-09-20 — Pre-validate in the screen against a pure `lib/validation`
  helper instead of relying on the data-layer throw: the throw path only
  fires after submit; UX must refuse before submit with identical messages.
- 2026-09-20 — Disable Save while the date is invalid/future AND keep the
  submit-time pre-check: disabled buttons can be bypassed (a11y/keyboard),
  so defense in depth (picker cap + disabled + pre-check + data-layer throw)
  with one message vocabulary.
- 2026-09-20 — Cap the native picker with `maximumDate` = end of today
  local: `@react-native-community/datetimepicker` supports it; web keeps the
  immediate inline error (no `max` attribute on the RN `TextField`).

## Validation Ledger

- 2026-09-20 — `node -v` v22.23.2; `git status --short` clean; HEAD 2673718 — pre-change baseline.
- 2026-09-20 — `tests/validation.test.ts` 35/35 PASS (4 new) — green.
- 2026-09-20 — RED check: `lib/validation.ts` stashed → 4 new tests fail,
  31 existing pass; stash popped → 35/35 PASS — validator load-bearing.
- 2026-09-20 — targeted suites (validation, calories data/domain, command
  executor, calorieFutureDateRejection, caloriesDayMove, caloriesIntegrity)
  7 files / 124 tests PASS.
- 2026-09-20 — `npm test` (both projects) PASS — 215 files / 2176 tests.
- 2026-09-20 — `npm run typecheck` PASS — clean.
- 2026-09-20 — `npm run lint` (`--max-warnings 0`) PASS after fixing one
  exhaustive-deps warning (dayGeneration memo dep → per-render const).

## Changed Files / Areas

- `.agent/execplans/calorie-future-date-ux-prevalidation-v1.md` — this plan.
- `lib/validation.ts` — `validateConsumedDateKey` helper (exact data-layer
  messages, optional `todayKey` override for determinism).
- `features/calories/CaloriesScreen.tsx` — immediate date error, disabled
  Save, `maximumDate`, submit pre-check, immediate error on legacy future
  open.
- `tests/validation.test.ts` — 4 new unit tests (RED→GREEN).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, then `.agent/PLANS.md`, then this plan.
2. Run `git status --short`, `git diff --stat`, `git diff --name-only`; inspect relevant diffs. Git wins over stale narrative.
3. Run `npm run agent:resume -- --plan .agent/execplans/calorie-future-date-ux-prevalidation-v1.md` for discrepancy + QA-impact orientation.
4. Verify `node -v` is v22.23.2 before any test run. Never run broad `pkill -f vitest`.
5. Continue only from `Exact next action` above; update this checkpoint at every milestone, failure, decision, and before finishing.
6. Do NOT touch `assertConsumableDateKey` or `calorieFutureDateRejection` tests; commit locally with a conventional message when green; do not push.

## Outcomes & Retrospective

- Status: Complete.
- Summary: the calorie edit modal now refuses future/malformed consumed
  dates before submit with the exact data-layer vocabulary (inline
  `calorieError` on every keystroke/pick, Save disabled while invalid, and
  a native picker cap at end of today), backed by the pure
  `validateConsumedDateKey` helper. Today/past behavior unchanged; create
  path untouched (no free date field); `calorieFutureDateRejection`
  integration tests untouched and green. Full suite (2176) + typecheck +
  lint green on Node v22.23.2. Committed locally, no push.
- Follow-up: none from this gap. Related remaining gaps (not started): no
  E2E assertion of the disabled-Save state (unit + wiring review cover it;
  component rendering tests remain limited per repo rules); pre-existing
  future rows from before the data-layer guard have no repair/backfill
  (none observed; out of scope).
