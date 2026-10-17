# ExecPlan: Windows-first successor campaign v1

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Drive SuperHabits to the strongest defensible state of functional completeness,
reliability, performance, accessibility, and maintainability using only work
that can actually be verified on the available Windows/WSL/browser/Node/SQLite
resources (plus authorized Android resources if any become available). iOS
simulator qualification is deferred by the owner and is an accepted external
dependency, never an active workstream. The campaign runs the autonomous loop
DISCOVER → PRIORITIZE → IMPLEMENT → TEST → REVIEW → COMMIT → REASSESS → NEXT
until no material Windows-verifiable work remains, and closes with a report
that keeps engineering completion and product release readiness as separate
verdicts.

## Context

- Worktree: `D:/Documents/tryPython/superhabits-overnight`, branch
  `frontend-v3-post-w17-overnight-successor` (PR #79, base `main` =
  `fb10d6ccfe66b54613c6fd22cb82da7dd7626e4f`). Campaign start head: `f601226`.
  This session may also open the repo at `D:/Documents/tryPython/superhabits`
  (main checkout, `main` @ `fb10d6c`) — all campaign edits land in the
  overnight worktree via absolute paths.
- Superseded plan (COMPLETED 2026-10-17):
  `openspec/changes/frontend-v3-post-w17-overnight-successor/execplan.md`.
  iOS disposition: `docs/ui-ux/v3-audit/post-w17-overnight/NATIVE-CERTIFICATION.md`
  §I — `IOS_QUALIFICATION_DEFERRED_BY_OWNER`. Last device-qualified evidence
  stays run 38941052793 @ `c05860e` = 12 PASS / 1 FAIL; the `f601226` input
  patch is NOT device-certified and 13/13 is never claimed. Release readiness
  is never marked green on iOS grounds.
- Security: `SECURITY_UNREMEDIATED` (`braces` GHSA-vfj7-8cjw-p6xm,
  `node-forge` GHSA-86w9-cpqp-85rv; no published patches). The audit gate
  (`node scripts/audit-runtime-deps.mjs`) stays red as a hard release blocker.
  No waiver, allowlist change, scan skip, or reclassification is authorized.
  PR #79 must NOT merge while it is red. Never touch production Supabase.
- Foreign state preserved untouched: stash `pre-recovery-local-changes`, the
  untracked `.tmp-ios36423379932/` evidence trees in both worktrees, foreign
  emulators `emulator-5570` / `emulator-5594` (do not kill, reset, or disturb
  devices this campaign did not start; Android qualification stays
  ENVIRONMENT_BLOCKED unless an authorized target appears).
- Architecture invariants (see `AGENTS.md`): soft delete only for synced main
  entities; sync enqueue on every applicable write; `getDatabase()` singleton;
  `createId`/`toDateKey` from `lib/`; append-only migrations; workout session
  triple + `saved_meals` + `habit_completions` keep their documented hard-delete
  exceptions.
- Baseline at `f601226` (2026-10-17): `tsc --noEmit` 0; `eslint . --max-warnings 0`
  0 (standalone; note one transient concurrent-run flake re-checked clean);
  full Vitest green (265 files passed, 1 skipped); `openspec validate --all`
  88/88; `agent:plan:validate:all` PASS.

## Scope

- Campaign 1 — workout editor input & persistence reliability (defects found
  in discovery; see Current Checkpoint): fix at source, prove with
  real-SQLite oracles and browser interaction evidence.
- Campaign 2 — local-first reliability (discovery-led, defect-gated): rejected
  writes, workout logging + reward integrity, habit/task relationship
  consistency, Daily Plan persistence, sync-outbox durability/idempotency,
  backup/restore round trips, interrupted operations, offline startup,
  date/timezone boundaries.
- Campaign 3 — Windows/web product quality: browser inspection of primary
  workflows (Today, To Do, Habits, Planning, Calories, Workout, secondary
  surfaces) for navigation, input reachability, keyboard behavior, form
  persistence, loading/error states, accessibility, small-screen
  responsiveness, theme consistency, scroll behavior, performance, visual
  regressions. Material issues only.
- Successor campaigns chosen by value and Windows-verifiability until none
  remain. Final report with separate engineering vs release verdicts.

## Non-Goals

- iOS simulator builds, iOS workflow dispatches, or iOS-only implementation
  changes without a justified independently testable reason.
- Marking release readiness green, merging PR #79, or weakening the security
  audit in any form.
- Restarting the completed Frontend V3 redesign; cosmetic churn; broad rewrites
  (the workout editor fix stays focused).
- New runtime dependencies (the security gate must not grow surface).
- Destructive remote operations; touching production Supabase.
- Killing or disturbing foreign emulators/processes; preserving foreign
  stashes, worktrees, and untracked evidence.

## Current Checkpoint

- Current milestone: Campaign 1 — workout editor input & persistence
  reliability. Discovery (2026-10-17, at `f601226`) found:
  - **Defect A (regression from f601226)**: `RoutineDetailScreen.tsx`
    `newExerciseName` was flipped to `defaultValue=` while
    `handleAddExercise` still resets the state to `''` — the visible text
    never clears after Add and a second Add duplicates the row. This field is
    local synchronous state and was never refresh-clobbered; fix = restore
    `value=`.
  - **Defect B (the documented NumberStepperField residual, same live bug)**:
    10 stepper fields in the routine editor (`RoutineDetailScreen.tsx` ~794,
    821, 853, 869, 957 and `RoutineExerciseCard.tsx` ~358, 381, 409, 423,
    507 — Active/Rest/Target reps min/max/Target duration) are `value=`-bound
    to re-fetched entity rows with save-on-change → `.then(refresh)`; a
    refresh re-render between keystrokes resets the field to a mid-save
    snapshot (run 38941052793: `42` → `2`). Other steppers (settings,
    habits, planning, session) bind synchronous local state and are safe.
  - **Defect C (out-of-order snapshots + silent rejection)**: `refresh()`
    calls are unordered concurrent reads — a slow refresh can `setExercises`
    after a newer one and regress state to stale rows; the
    `void queuedUpdate*(...).then(refresh)` chains have no `.catch`, so a
    rejected write (e.g. routine deleted mid-edit) is a silent unhandled
    rejection with UI/DB divergence (missing "rejected saves are surfaced"
    invariant).
  - Investigated and NOT fixing without reproduction: cross-remount write
    ordering (all transactions serialize in invocation order via
    `core/db/transactions.ts` per-DB tail chain); stale display of externally
    changed rows in uncontrolled fields (accepted residual, same trade-off
    `f601226` documented).
- Design decisions (confirmed with the owner 2026-10-17): Defect B is fixed
  with a **workout-local draft wrapper** feeding synchronous local state to
  `NumberStepperField` (core/ui semantics unchanged; settings/session-resume
  forms rely on async value pushes). Durable state lives in THIS plan; the
  post-w17 plan is COMPLETED with a forward pointer.
- Completed work: Campaign 0 — repository recovery, baseline gates at `f601226`, iOS deferral recorded (2026-10-17). Campaign 1 — workout input/persistence reliability COMPLETE at `cd25edd` (pushed): defects A/B/C fixed at source + web keystroke-loss root cause (`keyboardDismissMode` blur-on-scroll in `core/ui/Modal.tsx` + `core/ui/Screen.tsx`) + `lib/snapshotSequencer.ts`; pre-fix browser reproduction captured (3/3 designed failures at `f601226`); new spec 9/9 across 3 repeats; targeted lanes 47/47; full battery at `cd25edd` **368 passed / 86 skipped / 4 host-load-class misses** (all 4 re-verified green in isolation/quiet-host runs: 3 HEAVY timeouts pass alone, the habits-w7 800ms check-in ceiling passes 3/3 quiet — same host-load class as CG-4/CG-5; strict assertions preserved).
- Campaign 2 (local-first) discovery complete via two parallel read-only audits. Fixed at source (in progress → gates): (F1) `rescheduleWorkoutDate` now moves a day in ONE transaction (was two commits — a failed destination leg left the workout "moved to nowhere"); (F3) `runBackupMutation` fails closed when a mutation queues sync intents but reports `changed: false` (row writes without their intents could previously commit silently — enforced by convention only); (F6) `updateRoutine`/`updateCustomExercise`/`updateBodyWeightEntry` now read-merge-write inside the serialized transaction (stale-snapshot sibling-field clobber — the rule `updateExercise`/`updateSet` already enforced) and `addSet` assigns `set_number` in-transaction (two rapid "add set" taps could share a number); (rejected-writes) the divergence-class silent-rejection sites now surface errors and keep the editor open: TodosScreen drag-reorder (optimistic reorder snapped back silently) + editor Save, HabitsScreen editor Save, CalorieGoalModal (closed as if saved), PomodoroSettingsInline (silent no-op). New real-SQLite suite `tests/integration/workoutMutationIntegrity.data.test.ts` (5 tests) pins move-atomicity (failure-injection oracle), the fail-closed guard, concurrent-field merge, and set-number distinctness. Full Vitest after Phase 2: 267 files passed | 1 skipped (0 failures).
- In progress: hermetic `build:e2e` (Phase 2) + targeted Playwright lanes (todos/habits/calories/pomodoro/workout + new spec), then the Phase-2 milestone commit/push.
- Important modified files: `features/workout/workout.data.ts` (atomic move + in-transaction reads/numbering), `core/sync/syncedMutation.ts` (fail-closed intent contract), `features/todos/TodosScreen.tsx`, `features/habits/HabitsScreen.tsx`, `features/calories/CalorieGoalModal.tsx`, `features/pomodoro/PomodoroSettingsInline.tsx` (rejected-save surfacing), `tests/integration/workoutMutationIntegrity.data.test.ts` (new).
- Last successful validation: 2026-10-17 — `tsc --noEmit` 0; `eslint . --max-warnings 0` 0; Vitest **2707 passed | 20 skipped** (the 3 test + 1 suite failures in the first parallel run were host-load 5s/10s subprocess timeouts — `auditRuntimeDeps`, `nativeAuthMock`, `qaNativeProvision`, `restore.coordinator` — each re-passed serially); `lib/snapshotSequencer.test.ts` 6/6; pre-fix repro run captured (3/3 failed as designed).
- Failures: `node scripts/audit-runtime-deps.mjs` exit 1 (braces 3.0.3 / node-forge 1.4.0 HIGH, no published compatible patch) — genuine, unfixable today, gate correctly red. Do not merge PR #79. Do not waive.
- Relevant quarantines: none added by this campaign; no assertion weakened.
- Blockers: (a) security gate red (external, standing) — release BLOCKED; (b) iOS qualification owner-deferred (`IOS_QUALIFICATION_DEFERRED_BY_OWNER`); (c) Android ENVIRONMENT_BLOCKED.
- Exact next action: None — campaign closed 2026-10-17. Successor candidates are registered in Outcomes & Retrospective below and in `docs/ui-ux/v3-audit/post-w17-overnight/WINDOWS-FIRST-SUCCESSOR-REPORT.md`.
- Remaining definition of done: All items complete or dispositioned — three Windows-verifiable workstreams plus the adversarial-review round shipped with reproduction evidence and green gates; externally blocked work (iOS `IOS_QUALIFICATION_DEFERRED_BY_OWNER`, Android `ENVIRONMENT_BLOCKED`, security `SECURITY_UNREMEDIATED`) stays explicitly external and is never claimed green; final report filed.

## Progress

- [x] Campaign 0 — repository recovery, baseline gates at `f601226`, iOS deferral recorded (2026-10-17)
- [x] Campaign 1 — discovery: defects A/B/C identified and scoped (2026-10-17)
- [x] Campaign 1 — pre-fix browser reproduction captured (3/3 designed failures at `f601226`)
- [x] Campaign 1 — fix Defect A (add-exercise name field restored to controlled local state)
- [x] Campaign 1 — fix Defect B (synchronous-draft fields for all 26 save-on-change builder inputs; `+` clamp in `NumberStepperField`)
- [x] Campaign 1 — fix Defect C (rejected-save surfacing in queued writes + handlers) + snapshot ordering guard (`lib/snapshotSequencer.ts`)
- [x] Campaign 1 — tests green post-fix (new spec 9/9 ×3 repeats, targeted lanes 47/47) + Phase-1 milestone committed/pushed (`cd25edd`)
- [x] Campaign 1 — broad regression battery: full Playwright 368 passed / 86 skipped / 4 host-load-class misses (all re-verified green in isolation/quiet-host runs)
- [x] Campaign 2 — local-first reliability: F1 atomic schedule move, F3 fail-closed intent contract, F6 in-transaction merge + set numbering, rejected-save surfacing at 5 divergence-class UI sites; real-SQLite integrity suite; milestone committed/pushed (`6b23b6e`)
- [x] Campaign 3 — Windows/web product-quality sweep: 24 screenshots captured (`simulation-output/phase3/` — owner-reviewable; the agent cannot view images) + all machine-checkable quality axes green (a11y AA ×3 themes, 34 visual goldens, boundary/NaN sweeps, keyboard specs, HEAVY perf ceilings)
- [x] Adversarial review of `f601226..6b23b6e` (independent agent) + response fixes: A1 date-key validation restored in `rescheduleWorkoutDate`, A2 move/delete-exercise rejection escapes closed, A3 rename callback escape closed, A4 contract wording made honest, B2 sticky error cleared on success, B3 WorkoutScreen reschedule/assign errors surfaced, B4 set numbering switched to `MAX(set_number)+1`
- [x] Final — F2 atomic `duplicateRoutine` (one transaction, per-row intents) + fault-injection oracle
- [x] Final — gates + security re-verification + final report (`docs/ui-ux/v3-audit/post-w17-overnight/WINDOWS-FIRST-SUCCESSOR-REPORT.md`)

## Surprises & Discoveries

- The first baseline `lint` and `test` runs failed only when executed
  concurrently on this Windows host (exit 1 with no findings); each passes
  standalone. Do not run `eslint` and `vitest` concurrently here; re-check any
  suspicious gate failure serially before treating it as real.
- `updateExercise`/`updateSet` already do read-merge-write inside one
  serialized transaction (`withSQLiteTransaction` chains per-DB tails), so
  cross-field stale overwrites at the data layer are already guarded; the
  residual defects are UI-side value binding and refresh ordering.
- The `f601226` `defaultValue` uncontrolled-input fix is INSUFFICIENT on web:
  browser reproduction kept `4` of `42` in `Target load`. The clobber is a
  timing race between per-keystroke saves and their refresh re-renders (echo
  writes reach the DOM between keystrokes); both `value=` and `defaultValue=`
  bindings lose text. The synchronous-draft wrapper is the robust contract.
- **Keystroke loss root cause (web): RNW `ScrollView._handleScroll` calls
  `dismissKeyboard()` on EVERY scroll event when `keyboardDismissMode="on-drag"`
  — and `core/ui/Modal.tsx` + `core/ui/Screen.tsx` set that prop unconditionally.
  Any scroll event — including layout reflows fired by save-on-change refreshes
  (ValidationError insertion, content resize) and `scrollIntoView` — blurs the
  focused input (blur() stack: `blurTextInput` ← `_handleScroll`), so subsequent
  keystrokes land on BODY and are lost. Reproduced deterministically with a
  focus/blur trace (`focusout INPUT … → key '2' -> BODY`). Fixed by
  Platform-gating the prop (`none` on web — no soft keyboard to dismiss —
  `on-drag` kept on native).**
- `NumberStepperField`'s `+` on an empty field computed `min(max, validNum+1)`
  from `Number('') = 0`, yielding `1` even for `min=5` fields (reproduced:
  `41` from a stale `40` after a reverted clear). Now clamped to `min`.

## Decision Log

- 2026-10-17 — Deferred (documented, not fixed, from the Campaign 2 audits):
  (F2) `duplicateRoutine` is N+1 transactions — a mid-copy failure leaves a
  half-built routine (needs one-transaction copy); (F4) linked-action dispatch
  on user paths is at-most-once with a crash window before `processSourceAction`
  (needs a durable dispatch marker — architectural); (F5)
  `upsertSyncOutboxRecord` silently no-ops a non-advancing revision (only
  reachable after a hydrate failure); (F7) settings writes commit before their
  backup-snapshot intent with no drift repair; (F8) reward backfill covers only
  yesterday+today so backdated check-ins older than yesterday under-earn
  (local-only reward layer). Tier-2/3 UI silent-no-op sites (todo toggle/delete,
  habit pause/archive, project/goal link-unlink, pomodoro notes/presets,
  daily-plan and weekly-review deletes) keep their current behavior — each is
  a no-op-without-feedback, not data divergence; recorded for a successor.
- 2026-10-17 — iOS is `IOS_QUALIFICATION_DEFERRED_BY_OWNER`: accepted external
  dependency, no simulator runs, no 13/13 claim, release readiness never
  green on iOS grounds.
- 2026-10-17 — Defect B fix lives in `features/workout/` (draft wrapper), not
  in `core/ui/NumberStepperField` (owner-confirmed): the shared primitive
  cannot distinguish stale echoes from external pushes, and
  settings/habits/planning/session-resume call sites depend on external value
  adoption.
- 2026-10-17 — One authoritative campaign plan = this file (owner-confirmed);
  the post-w17 plan is COMPLETED with a forward pointer.
- 2026-10-17 — Fix only reproduced defects or clearly demonstrated missing
  invariants; no broad workout-editor rewrite.

## Validation Ledger

- 2026-10-17 — Baseline at `f601226` (overnight worktree): `git rev-parse HEAD`
  = `f6012262242b729eba5838052a7b89c577febe36`; only untracked
  `.tmp-ios36423379932/` evidence present. `npm run typecheck` exit 0;
  `npm run lint` exit 0 (standalone re-run); `npm test` green (265 test files
  passed, 1 skipped); `npm run openspec:validate` 88/88;
  `npm run agent:plan:validate:all` PASS.
- 2026-10-17 — Campaign 1 pre-fix reproduction (hermetic `build:e2e`, 0
  Supabase hosts): `npx playwright test e2e/workout-editor-input-reliability.spec.ts
--project=chromium` — 3/3 FAILED at `f601226` exactly as designed (add-name
  stale text; `Target load` rapid typing kept `4` of `42`; stepper reverted
  `fill('')` to `40` and `+` produced unclamped `41`). A MutationObserver probe
  (throwaway spec, since deleted) showed the same input node surviving echo
  writes while the value still regressed — a timing race between per-keystroke
  saves and their refresh re-renders, in both `value=` and `defaultValue=`
  bindings.
- 2026-10-17 — Post-fix static gates: `tsc --noEmit` 0; `eslint .
--max-warnings 0` 0; Vitest `npm test` 2707 passed | 20 skipped with 3 test
  - 1 suite host-load timeouts (`auditRuntimeDeps`, `nativeAuthMock`,
    `qaNativeProvision`, `restore.coordinator` — all subprocess/probe/hook
    timing under parallel load) — each re-passed in a serial re-run.
- 2026-10-17 — Phase-1 milestone `cd25edd` (pushed): new spec 9/9 across
  3 repeats (deterministic after the blur fix), targeted lanes
  (workout-gym-v2, calories-w10, habits, todos) 47/47, `qa:fast` OK,
  `qa:integration` 84 files OK (real SQLite), `qa:timezones` 5 zones OK.
  Full battery at `cd25edd`: 368 passed / 86 skipped / 4 host-load-class
  misses (3 HEAVY timeouts pass alone; habits-w7 800ms ceiling passes 3/3 on
  a quiet host) — assertions preserved, no weakening.
- 2026-10-17 — Phase-2 milestone `6b23b6e` (pushed): full Vitest 267 files
  passed | 1 skipped (0 failures) incl. 5 new real-SQLite integrity tests
  (move atomicity failure-injection, fail-closed guard, concurrent-field
  merge, set-number distinctness); targeted Playwright 95/95 across todos,
  habits, calories, pomodoro, workout (incl. HEAVY ceilings and the
  failed-write retry contracts).
- 2026-10-17 — Adversarial review round (independent agent, `f601226..6b23b6e`):
  A1–A4 confirmed defects fixed immediately (date-key validation regression,
  two rejection escapes, overclaimed guard comment); B2/B3/B4 fixed (sticky
  error, WorkoutScreen move/assign surfaces, MAX-based set numbering); B1/B5/
  B6/B7 recorded as accepted trade-offs; C1–C6 confirmed the data-layer
  fixes, guard false-positive audit, extraction parity, and that the tests
  pin their claims.
- 2026-10-17 — Final state gates: `tsc --noEmit` 0; `eslint . --max-warnings 0`
  0; full Vitest 266 files passed | 1 skipped (1 host-load hook timeout —
  `restore.coordinator` beforeAll, re-passed serially); workout e2e lanes
  40/40 over the final build; `--project=visual` 34/34 (one earlier
  achievements-overlay capture flake passed in isolation and in the full
  re-run); `openspec validate --all` PASS; `agent:plan:validate:all` PASS.
- 2026-10-17 — Security re-verification: `npm view braces version` = 3.0.3,
  `npm view node-forge version` = 1.4.0 (both still latest, no patch);
  `node scripts/audit-runtime-deps.mjs` exit 1 with the same 2 undocumented
  HIGH (`braces` GHSA-vfj7-8cjw-p6xm, `node-forge` GHSA-86w9-cpqp-85rv).
  SECURED UNCHANGED. No waiver, no allowlist change, no merge.

## Changed Files / Areas

- `docs/ui-ux/v3-audit/post-w17-overnight/NATIVE-CERTIFICATION.md` — §I iOS
  deferral disposition (no findings altered).
- `openspec/changes/frontend-v3-post-w17-overnight-successor/execplan.md` —
  closed COMPLETED with forward pointer.

## Recovery / Resume Instructions

- Fresh session: `npm run agent:resume -- --plan .agent/execplans/windows-first-successor-campaign-v1.md`
  from `D:/Documents/tryPython/superhabits-overnight`, then `git status --short`
  and `git rev-parse HEAD`. Reconcile with this checkpoint; continue from
  its Exact next action.
- Do not pop `pre-recovery-local-changes`, delete `.tmp-ios36423379932/`, or
  disturb foreign emulators. Do not start iOS builds. Do not merge PR #79.
- The main checkout at `D:/Documents/tryPython/superhabits` stays on `main`;
  campaign edits belong to the overnight worktree.

## Outcomes & Retrospective

- Closed 2026-10-17 with the Windows-verifiable scope exhausted and every
  remaining item either dispositioned or explicitly external. Three
  workstreams plus an adversarial-review round shipped, each behind
  reproduction evidence: (1) workout input/persistence reliability — the web
  keystroke-loss root cause (RNW scroll-driven `blurTextInput` via
  `keyboardDismissMode="on-drag"`), the echo-clobber class (synchronous-draft
  fields), the add-name regression, silent rejected saves, and out-of-order
  refresh snapshots; (2) local-first write integrity — atomic schedule move,
  atomic routine duplication, fail-closed sync-intent contract, in-transaction
  read-merge-write and set numbering, rejected-save surfacing at the five
  divergence-class UI sites; (3) web product quality — sweep artifacts plus
  the green machine-checkable axes (a11y ×3 themes, 34 visual goldens,
  boundary/NaN, keyboard, HEAVY ceilings).
- Separately verdicted (see the final report): **engineering completion:
  COMPLETE for the Windows-verifiable scope**; **product release readiness:
  BLOCKED** — the mandatory security gate stays red (`braces` GHSA-vfj7-8cjw-p6xm,
  `node-forge` GHSA-86w9-cpqp-85rv; registry re-checked 2026-10-17: 3.0.3 /
  1.4.0 remain latest, no published patch), iOS is
  `IOS_QUALIFICATION_DEFERRED_BY_OWNER`, Android is `ENVIRONMENT_BLOCKED`.
  PR #79 stays OPEN and unmerged.
- Successor candidates (registered, deliberately not done here): Tier-2
  silent-no-op UI writes (task toggle/delete, habit pause/archive, project/
  goal link-unlink, pomodoro notes/presets, daily-plan and weekly-review
  deletes — no divergence, no feedback); F4 linked-action dispatch crash
  window (needs a durable dispatch marker — architectural); F5 outbox
  revision no-op guard (reachable only after hydrate failure); F7 settings
  snapshot gap (needs a repair/drift design decision); F8 reward backfill
  window (local-only reward layer, under-payment only); owner review of the
  24 Phase-3 sweep screenshots (the agent cannot view images).
- Lessons: the f601226 "uncontrolled input" fix was platform-blind — web and
  native lose keystrokes through different mechanisms and both needed real
  browser evidence; audit-then-fix with pre-fix reproduction made every
  campaign fix defensible; and the independent adversarial review caught
  four real gaps in the campaign's own fixes (validation regression,
  rejection escapes, overclaimed contract), which is exactly why it runs.
