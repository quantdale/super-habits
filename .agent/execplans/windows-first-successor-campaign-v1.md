# ExecPlan: Windows-first successor campaign v1

Plan-Version: 2
Status: ACTIVE

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
- Completed work: Campaign 0 — repository recovery, baseline gates at `f601226`, iOS deferral recorded (2026-10-17). Campaign 1 discovery — defects A/B/C identified and scoped (2026-10-17).
- In progress: implementing Defect A/B/C fixes + snapshot-ordering guard in `features/workout/`.
- Important modified files: `docs/ui-ux/v3-audit/post-w17-overnight/NATIVE-CERTIFICATION.md` (§I deferral), `openspec/changes/frontend-v3-post-w17-overnight-successor/execplan.md` (closed with forward pointer); campaign code changes land in `features/workout/` and `e2e/`.
- Last successful validation: 2026-10-17 baseline at `f601226` — `npm run typecheck` exit 0; `npm run lint` exit 0; `npm test` green (265 files passed, 1 skipped); `npm run openspec:validate` 88/88; `npm run agent:plan:validate:all` PASS.
- Failures: `node scripts/audit-runtime-deps.mjs` exit 1 (braces 3.0.3 / node-forge 1.4.0 HIGH, no published compatible patch) — genuine, unfixable today, gate correctly red. Do not merge PR #79. Do not waive.
- Relevant quarantines: none added by this campaign; no assertion may be weakened.
- Blockers: (a) security gate red (external, standing) — release BLOCKED; (b) iOS qualification owner-deferred (`IOS_QUALIFICATION_DEFERRED_BY_OWNER`); (c) Android ENVIRONMENT_BLOCKED.
- Exact next action: implement Defect A (restore `value={newExerciseName}` in `features/workout/RoutineDetailScreen.tsx`), then the workout-local draft stepper for Defect B's 10 call sites (`RoutineDetailScreen.tsx`, `RoutineExerciseCard.tsx`), then Defect C's error surfacing + monotonic snapshot sequencer for `refresh`; capture pre-fix browser reproduction of A/B, then run the Phase-1 gates.
- Remaining definition of done: Phase 1 DoD — all three defects fixed at source with reproduction evidence; Phase-1 gates green (qa:affected ladder, hermetic `build:e2e`, targeted Playwright, full Vitest); no assertion weakened; milestone committed and pushed to the campaign branch.

## Progress

- [x] Campaign 0 — repository recovery, baseline gates at `f601226`, iOS deferral recorded (2026-10-17)
- [x] Campaign 1 — discovery: defects A/B/C identified and scoped (2026-10-17)
- [ ] Campaign 1 — fix Defect A (add-exercise name field)
- [ ] Campaign 1 — fix Defect B (draft-backed steppers, 10 call sites)
- [ ] Campaign 1 — fix Defect C (rejected-save surfacing) + snapshot ordering guard
- [ ] Campaign 1 — tests: pre-fix reproduction, post-fix Playwright oracle, sequencer unit test
- [ ] Campaign 1 — Phase-1 gates + milestone commit/push
- [ ] Campaign 2 — local-first reliability (discovery-led, defect-gated)
- [ ] Campaign 3 — Windows/web product-quality browser inspection
- [ ] Final — security disposition re-verification, adversarial review, final report

## Surprises & Discoveries

- The first baseline `lint` and `test` runs failed only when executed
  concurrently on this Windows host (exit 1 with no findings); each passes
  standalone. Do not run `eslint` and `vitest` concurrently here; re-check any
  suspicious gate failure serially before treating it as real.
- `updateExercise`/`updateSet` already do read-merge-write inside one
  serialized transaction (`withSQLiteTransaction` chains per-DB tails), so
  cross-field stale overwrites at the data layer are already guarded; the
  residual defects are UI-side value binding and refresh ordering.

## Decision Log

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

- Not complete. Fill this section only when Status becomes COMPLETED.
