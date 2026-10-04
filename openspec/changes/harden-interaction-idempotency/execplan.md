# ExecPlan: Harden interaction idempotency

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Apply the [harden-interaction-idempotency OpenSpec change](proposal.md) and its
[tasks](tasks.md): the inline quick-add task input is re-entrant-safe in the same
tick on both of its entry paths, and a quick-capture calorie undo deletes exactly
the row that capture created instead of the newest row that happens to match its
values. The end-to-end "one row or zero, never two" oracle now covers the inline
surfaces too.

## Context

- Starting HEAD `c1bc380ce330cda1e089fd79b49a12029defbb72` on `main`; two earlier
  changes from this wave were already applied on top of it (docs-only, then the
  day-window fix).
- The repository already owned the pattern: `lib/submitGuard.ts`
  (`createSubmitGuard()` with `tryStart()`/`finish()`), used by the add/edit-todo
  modal, `QuickAddKcal`, and the other quick-capture surfaces.
  `features/todos/TodoQuickCapture.tsx` did not use it: `canSubmit` was
  `trimmed.length > 0 && !isSubmitting`, `setIsSubmitting(true)` ran after the
  closure captured `canSubmit`, and `onSubmitEditing` called `handleSubmit`
  directly with no `disabled` binding on the `TextInput` — so two Enter presses
  in one tick both passed validation and wrote two identical todos.
- On the undo path, `addCalorieEntry` returned nothing, so
  `QuickCaptureOverlay` re-read today's newest-first list and deleted the first
  row matching name, calories and meal type: undoing the older of two identical
  captures deleted the newer one.
- No component-render test library exists in this repository (unit tests mock
  `react-native` down to `Platform`), and `CLAUDE.md` states component rendering
  tests are intentionally limited. The same-tick behaviour therefore had to be
  made executable without a renderer.

## Scope

The three task groups in tasks.md: inline quick-add re-entrancy (1.1-1.5),
identity-based quick-capture undo (2.1-2.5), the E2E oracle (3.1-3.3), and
validation (4.1-4.5).

## Non-Goals

No change to `addTodo`, `addCalorieEntry`, or `deleteCalorieEntry` beyond
returning the created row's identity, and no change to their transaction or
enqueue behaviour. No redesign of the recent-capture list or its storage. No
touch of the modal guard, the other quick-capture surfaces that already use the
guard, or any validation ordering. No schema migration.

## Current Checkpoint

- Current milestone: COMPLETE — all 18 tasks in tasks.md are checked, each backed
  by code and executing coverage, with the validation gate recorded from the
  final tree.
- Completed: the shared guard now covers the inline input through an extracted,
  renderer-free orchestration module; the calorie write returns the created row's
  id and the overlay (live and post-reload paths) resolves undo from it; the
  fat-fingers journey gained the inline one-row oracle and the identical-capture
  undo oracle.
- In progress: none.
- Important modified files: `features/todos/TodoQuickCapture.tsx`, the new
  `features/todos/todoQuickCapture.submit.ts`,
  `features/quick-capture/QuickCaptureOverlay.tsx`, the new
  `features/quick-capture/rebuildRecentCapture.ts`,
  `features/quick-capture/recentCaptures.ts`,
  `features/calories/calories.data.ts`, `lib/submitGuard.ts`,
  `e2e/journeys/fat-fingers.spec.ts`, and four test files.
- Last successful validation: pinned Node `v22.23.2` — `npm run qa:fast` green
  (typecheck 0, lint 0/0, unit 159 files / 1952 tests, both parity scripts OK);
  `npm run qa:integration` 79 files / 386 tests passed, 1 file / 2 tests skipped
  (pre-existing); `openspec validate --all` 68/68; the extended journey is 13/13
  green against a fresh hermetic `dist/` on four consecutive runs.
- Current failures: none attributable to this change.
- Relevant quarantines: none — no assertion weakened, no test skipped, and the
  one existing test that asserted the old `addCalorieEntry` return value was
  tightened to the new contract rather than loosened.
- Blockers: none.
- Condition required to unblock: not applicable.
- Exact resume action after unblock: not applicable.
- Exact next action: none — the change is fully applied. Archiving into
  `openspec/specs/` and committing the tree are separate, user-invoked steps.
- Remaining definition of done: complete.

## Progress

- [x] Wave 0 — confirm the sanctioned guard and the two defect surfaces.
- [x] Wave 1 — renderer-free guarded submit orchestration + component wiring
      (1.1, 1.2).
- [x] Wave 2 — same-tick unit coverage for both entry paths, the ordinary
      submit, validation order, and guard release on failure (1.3-1.5).
- [x] Wave 3 — `addCalorieEntry` returns the row id; the overlay's live and
      rebuilt undo paths resolve it; the value-matching fallback removed
      (2.1-2.3).
- [x] Wave 4 — identity coverage for the identical-capture undo, the single
      capture, and the legacy no-op (2.4, 2.5).
- [x] Wave 5 — journey oracle extended to the inline surfaces (3.1-3.3).
- [x] Wave 6 — validation and full-diff review (4.1-4.5).

## Surprises & Discoveries

- **The same-tick behaviour was not executable as written.** With no
  component-render library in the repo, the guard could not be driven through
  `onPress`/`onSubmitEditing` in a unit test. The handler body was therefore
  lifted into `features/todos/todoQuickCapture.submit.ts`, which the component
  calls with its own guard ref, state setters, and persist callback — the guard
  stays owned by the component, and the orchestration is now testable without a
  renderer. The extracted function is the code the component runs, not a copy of
  it.
- **The calorie undo is not just a live-path defect.** `rebuildRecentCapture`
  carried the same value-matching fallback for entries restored after a reload,
  so it was moved into its own module and given the same identity contract, with
  an explicit reported no-op for legacy records that carry no id.
- **A row oracle destroys the page.** `queryRows`/`expectRows` navigate the page
  into the DB harness document (`ensureDbContext` → `page.goto`), so every step
  must `returnToApp(page)` — and, on the To Do section, re-select the section —
  before driving the UI again. The first journey draft failed for exactly this
  reason, which looked like an app crash.
- **The overlay's restored list needs a settle signal.** Clicking an Undo control
  immediately after reopening the overlay is a moving-target click: the modal's
  fade-in and the auto-focus scroll shift the element between the box
  measurement and the press, so `onPress` never fires and the test fails
  silently (no error, no row change). Instrumenting `handleUndo` proved the
  handler was never called in the failing runs, and a non-forced click (which
  waits for element stability) fixed it — 4/4 green afterwards. This is a test
  interaction race, not a product defect.
- One pre-existing integration test asserted `addCalorieEntry` resolved to
  `undefined`; it now asserts the created id pattern, which is a stricter check
  of the same contract.

## Decision Log

- Use `createSubmitGuard` (not a new local flag) and enter it before any `await`,
  releasing it in `finally`, exactly as `QuickAddKcal` documents.
- Guard inside the component's own submit path rather than in the caller
  (`TodosScreen.handleQuickAdd`), because both entry paths converge there.
- Return the created row's id from `addCalorieEntry` (additive) and remove the
  value-matching fallback entirely rather than scoping it: a time-scoped matcher
  still cannot separate two identical captures in one session.
- Make the identity available to the post-reload undo too, so a restored entry
  resolves the same row; a legacy record without an id reports an explicit no-op
  instead of deleting an arbitrary row.
- Extend the existing fat-fingers journey step instead of adding a second spec
  file, keeping one place where the "one row or zero, never two" contract is
  asserted end to end.
- Put the E2E undo assertion after a reload + reopen, so it exercises the rebuilt
  undo closures (the restored path) rather than only the live one.

## Adversarial Review and Dispositions

- **Non-vacuity of the calorie oracle.** The "undo the first of two identical
  captures" assertion would fail under the old behaviour by construction: the old
  closure matched against a newest-first list, so it deleted the newer row and
  the survivor would be the first capture, not the second. The oracle asserts the
  survivor is the second capture's id, so a regression to value matching fails.
- **Guard placement review.** The extracted orchestration keeps the guard entry
  before any `await` and the release in `finally`, and the component still
  passes its own `canSubmit`/`trimmed` read at call time, so the loading
  presentation and the empty-input rejection behave exactly as before (pinned by
  the "writes nothing while the input is empty" and the loading-toggle coverage).
- **No behavioural drift elsewhere.** `addCalorieEntry`'s transaction, enqueue,
  and saved-meal maintenance are untouched; only the return value is additive.
  The modal guard, the other quick-capture surfaces, and every validation
  ordering are unchanged, and the full unit + integration suites are green.
- **Test-only fix for a flaky interaction.** The Undo click race was fixed in the
  spec (drop `force: true` so Playwright waits for stability), not by weakening
  the assertion; the row-identity oracle is unchanged.

## Validation Ledger

| Date       | Command / source                                                                                                       | Outcome                                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-29 | `npx vitest run tests/{todoQuickCaptureSubmit,quickCapture,quickCaptureUndoRebuild,submitGuard,calories.data}.test.ts` | PASS — 60/60                                                                                                                            |
| 2026-09-29 | `npx vitest run --project integration tests/integration/quickCaptureCalorieUndo.test.ts`                               | PASS — 5/5                                                                                                                              |
| 2026-09-29 | `npm run build:e2e` (fresh hermetic `dist/`)                                                                           | PASS — exported; `[build:e2e] OK — hermetic export (0 Supabase hosts in dist/)`                                                         |
| 2026-09-29 | `npx playwright test --project=journeys e2e/journeys/fat-fingers.spec.ts --workers=1` ×4                               | PASS — 13/13 steps each run (first three attempts exposed the two spec-side races documented above; both fixed)                         |
| 2026-09-29 | Instrumented `handleUndo` during the flake investigation                                                               | EVIDENCE — failing runs logged no undo call at all (moving-target click), passing runs logged `undo start … recentLen 2 → removed=true` |
| 2026-09-29 | `npm run qa:fast` (pinned Node v22.23.2)                                                                               | PASS — typecheck 0; lint 0/0; unit 159 files / 1952 tests; journey-label-parity OK; quarantine-register-parity OK                       |
| 2026-09-29 | `npm run qa:integration` (pinned Node v22.23.2)                                                                        | PASS — 79 files / 386 tests passed, 1 file / 2 tests skipped (pre-existing)                                                             |
| 2026-09-29 | `npx prettier --check` on every changed file                                                                           | PASS — all clean                                                                                                                        |
| 2026-09-29 | `npm run openspec:validate` (`--all`)                                                                                  | PASS — 68 passed / 0 failed                                                                                                             |
| 2026-09-29 | `openspec validate harden-interaction-idempotency --type change --strict`                                              | PASS — change is valid                                                                                                                  |
| 2026-09-29 | `node scripts/agent-execplan.mjs validate --plan …`                                                                    | PASS — ExecPlan valid                                                                                                                   |
| 2026-09-29 | Full-diff review                                                                                                       | Inline quick-add + quick-capture calorie undo + their tests only; no validation, transaction, enqueue, or modal-guard behaviour changed |

## Changed Files / Areas

- `lib/submitGuard.ts` — exported `SubmitGuard` type (additive).
- `features/todos/todoQuickCapture.submit.ts` (new) — the guarded submit
  orchestration both entry paths funnel through.
- `features/todos/TodoQuickCapture.tsx` — `createSubmitGuard()` ref; both entry
  paths call the extracted orchestration.
- `features/calories/calories.data.ts` — `addCalorieEntry` returns the created
  row's id.
- `features/quick-capture/recentCaptures.ts` — `RecentCapture` carries
  `calorieEntryId` (with `calorieRef` demoted to legacy read-only);
  `nextCalorieCaptureKey(entryId?)`; persistence keeps the identity.
- `features/quick-capture/rebuildRecentCapture.ts` (new) — post-reload undo
  closures, identity-based with a reported no-op for legacy records.
- `features/quick-capture/QuickCaptureOverlay.tsx` — live capture path stores and
  resolves the row identity; the local rebuild function moved to the new module.
- `e2e/journeys/fat-fingers.spec.ts` — the inline one-row oracle and the
  identical-capture undo oracle, plus the shared `rapidPress` helper now imported
  from `helpers/gestures`.
- `tests/todoQuickCaptureSubmit.test.ts` (new), `tests/quickCaptureUndoRebuild.test.ts` (new), `tests/integration/quickCaptureCalorieUndo.test.ts` (new), `tests/integration/caloriesIntegrity.test.ts`.
- `openspec/changes/harden-interaction-idempotency/tasks.md` — all 18 tasks checked.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this plan, and the change's
   `proposal.md` / `specs/` / `tasks.md`.
2. `git status --short` and `git diff --stat`; reconcile this checkpoint against
   the real tree.
3. Re-run `npx vitest run tests/todoQuickCaptureSubmit.test.ts
tests/quickCaptureUndoRebuild.test.ts` and
   `npx vitest run --project integration tests/integration/quickCaptureCalorieUndo.test.ts`.
4. No implementation action remains. Archiving the change into
   `openspec/specs/` and committing the tree are separate, user-invoked steps.

## Outcomes & Retrospective

- Status: Completed.
- Summary: the inline quick-add input can no longer write two todos from two
  activations in one tick (either entry path, or both together), and a
  quick-capture calorie undo deletes the row that capture created — the
  mis-targeted delete is gone for both the live path and the post-reload path.
  The one-row oracle now covers the inline surfaces end to end.
- Follow-up: archive this change into `openspec/specs/` when the user invokes the
  OpenSpec archive step. Four pending changes remain in `openspec/changes/`
  (`reduce-section-activation-render-work`, `harden-ci-lane-integrity`,
  `harden-native-evidence-and-release-posture`,
  `harden-silent-failure-certification`), each needing its own apply pass.
