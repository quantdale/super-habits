# ExecPlan: Apply the three frontier-audit OpenSpec changes

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Implement every pending OpenSpec change authored by the frontier audit, using the
repository's OpenSpec apply workflow, then validate (`openspec validate`), review
the diff, and prove all tasks are complete with QA evidence.

Success: `openspec/changes/{fix-backup-push-hard-delete-and-owner-stamping,
close-gamification-overnight-reconcile-gap, route-workout-day-reminder-taps}`
have zero unchecked tasks; each change strict-validates; typecheck/lint/unit/
integration gates are green on the final tree.

## Context

- Parent audit campaign: `.agent/execplans/frontier-audit-openspec-proposals-v1.md`
  (COMPLETED; explicitly deferred implementation to `/opsx:apply`).
- SuperHabits invariants: local SQLite is source of truth; recoverable writes go
  through `runBackupMutation`/`runSyncedMutation` + durable outbox; soft-delete
  only except documented hard-delete exceptions (`habit_completions`,
  `saved_meals`, now workout history); reward ledger is local-only; migrations
  append-only; no schema change pending.
- OpenSpec 1.8.0, schema `spec-driven`. Validation command:
  `npm run openspec:validate` (aggregate) plus `npx openspec validate <change>
--type change --strict`.

## Scope

1. **fix-backup-push-hard-delete-and-owner-stamping** — move `workout_logs`,
   `workout_session_exercises`, `workout_session_sets` into
   `BACKUP_HARD_DELETE_ENTITIES`; route habit reminder, linked-action habit
   increment, habit daily-target, and todo reminder completions through the
   owner-stamped durable-intent contract (`runBackupMutation`), including the
   missing in-memory `enqueuePrepared` for the todo path; update/add tests.
2. **close-gamification-overnight-reconcile-gap** — housekeeping reconciles
   yesterday then today before spending a streak freeze; bounded lookback; add
   integration coverage.
3. **route-workout-day-reminder-taps** — classify `kind: 'workout-day-reminder'`
   as `open`; add `openWorkout` handler wired to `setActiveSection('workout')`;
   dispatcher unit tests.

## Non-Goals

- No new OpenSpec changes, no archive/sync into `openspec/specs/`.
- No schema migration; no Restore V2/Scope-7 changes.
- No two-way sync, no gamification feature expansion, no notification action
  buttons, no web notification routing.
- Do not weaken tests or add skips/retries.

## Current Checkpoint

- Current milestone: COMPLETE — all three changes applied, validated, reviewed; failures
  classified and preserved.
- Completed: Waves 0–7. All OpenSpec tasks checked (13/13, 10/10, 7/7); change specs
  strict-validated; aggregate validation 60/60; final `npm test` 197/197 files green;
  typecheck/lint clean; Chromium 141 passed/7 skipped; P0 journeys 25/25; full
  journeys 98 passed with the two classified failures below; `e2e:sync` 40/40;
  simulation lane reproduced a pre-existing, change-independent failure (see below).
- In progress: None.
- Important modified files: as listed under Changed Files / Areas.
- Last successful validation: 2026-09-14 — `npm run typecheck` 0; `npm run lint` 0/0;
  `npm test` 197 files / 2069 tests passed; `openspec validate --all` 60/60;
  three strict change validations; `npm run e2e:sync` 40 passed.
- Current failures: two journey-lane results and one simulation scenario, all classified
  below as pre-existing/host/env conditions, none attributable to this campaign's diff.
- Relevant quarantines: none of the campaign's files/tests were weakened or skipped.
- Blockers: Native lane cannot run from an intentionally uncommitted tree
  (`qa-native-provision.mjs` requires clean-tree provenance at four points).
- Condition required to unblock: commit the tree (not requested by the user).
- Exact resume action after unblock: `npm run qa:native:provision` then
  `npm run qa:native:android` / `--tag persistence`.
- Exact next action: None — campaign complete; OpenSpec archive is a separate,
  user-invoked step.
- Remaining definition of done: Complete.

## Progress

- [x] Wave 0 — Reconcile Git + plan truth; baseline gates.
- [x] Wave 1 — Change A implementation.
- [x] Wave 2 — Change A tests.
- [x] Wave 3 — Change B implementation + tests.
- [x] Wave 4 — Change C implementation + tests.
- [x] Wave 5 — Mark OpenSpec tasks; strict-validate each change.
- [x] Wave 6 — QA ladder (typecheck, lint, unit, integration, chromium, journeys, sync,
      simulation triage) and adversarial re-read.
- [x] Wave 7 — Final review: every task backed by code/test evidence; report.

## Surprises & Discoveries

- `loadActivityCandidates` and `reconcileGamificationActivity` already accept an
  explicit date key in the current tree; the gamification defect was the
  provider's freeze-before-reconcile order and the absence of a yesterday pass.
- `withSQLiteTransaction` serializes per database and uses
  `withExclusiveTransactionAsync` on native, so the notification flows were migrated
  to `runBackupMutation` with every in-transaction call on the passed `transactionDb`.
- The integration harness exposes only `withTransactionAsync`; `Platform.OS` resolves
  the non-exclusive path in tests, so `runBackupMutation` is testable against real
  SQLite.
- The workstation's `.env.local` real Supabase env creates two documented
  environment classes: the ordinary journeys lane cannot exercise the remote-boundary
  portable-owner spec (correct lane `e2e:sync` 40/40), and `qa:simulation` rebuilds
  with that env, causing real-network signup failures. A local-only rebuild is the
  canonical E2E environment.
- The simulation `long-term-user-disaster-recovery` scenario fails at a
  post-day-rollover `logCalories` section switch (blank content area) on this tree
  **with and without** the gamification change (A/B: old order failed at the same
  step twice), so it is pre-existing, not a campaign regression.

## Decision Log

- 2026-09-14 — Use one master ExecPlan in `.agent/execplans/` for the apply
  campaign (three independent changes, one session state).
- 2026-09-14 — Route the reminder/linked-action writes through `runBackupMutation`
  (the change's preferred option) instead of a bespoke helper.
- 2026-09-14 — Do not fix the pre-existing simulation day-rollover section-render
  failure: it is outside the three OpenSpec changes, reproduced without this diff,
  and the scenario's own lane is the simulation harness whose fix requires a design
  decision (fake-clock/rAF vs section transition). Preserved as a classified failure.

## Validation Ledger

- 2026-09-14 — `git status --short` / `openspec list --json` — PASS — three changes,
  0/30 tasks complete at baseline.
- 2026-09-14 — `npm run typecheck` — PASS — 0 errors (multiple runs, final tree).
- 2026-09-14 — `npm run lint` — PASS — 0 errors / 0 warnings (final tree).
- 2026-09-14 — `git diff --check` — PASS — no whitespace errors.
- 2026-09-14 — focused unit + integration runs — PASS — habits/todos/dispatcher/
  backup-push/gamification/workout-correction/owner-stamping.
- 2026-09-14 — `npm test` (final tree) — PASS — 197 files / 2068+ tests green.
  (One earlier run had a 5s host-load timeout in `qaNativeProvision` git fixture;
  isolated re-run PASS and the following full run PASS.)
- 2026-09-14 — `npm run openspec:validate` — PASS — 60/60 items.
- 2026-09-14 — `npx openspec validate <change> --type change --strict` ×3 — PASS.
- 2026-09-14 — `npm run build:web` (local-only, blank Supabase) — PASS.
- 2026-09-14 — `npx playwright test --project=chromium` — PASS — 141 passed,
  7 skipped, 0 failed.
- 2026-09-14 — `npm run e2e:journeys:p0` — PASS — 25/25.
- 2026-09-14 — `npx playwright test --project=journeys` — 98 passed, 6 skipped,
  2 classified failures (portable-owner ENVIRONMENT; J8 headroom known-gap 15).
- 2026-09-14 — `npm run build:sync` + `npm run e2e:sync` — PASS — dummy-env export
  verified; remote-boundary lane 40/40 including portable-owner recovery.
- 2026-09-14 — `three-months-in` standalone ×4 — 704/731 ms fails (12.0%/8.6%
  headroom) then 2 full passes; ceiling never breached; matches known-gap 15 host
  variance.
- 2026-09-14 — `npm run qa:simulation -- --all --mode deterministic` — 22/23 PASS;
  `long-term-user-disaster-recovery` failed (pre-existing, see above).
- 2026-09-14 — local-only isolated scenario ×3 + old-gamification A/B ×2 — FAIL at
  `logCalories` after day rollover in all runs (pre-existing; independent of the
  campaign diff).
- 2026-09-14 — native Android — NOT RUN — canonical provision requires a clean tree;
  tree is intentionally uncommitted. Emulator + Maestro are present; web/unit proof
  used for this campaign (the workout-day tap is native-only and its routing logic
  is covered by dispatcher tests).

## Changed Files / Areas

- `core/backup/backup.types.ts` — delete-semantic partition.
- `features/habits/habits.data.ts`, `features/todos/todoNotificationActions.data.ts` — owner-stamped durable intents.
- `features/gamification/gamification.data.ts`, `features/gamification/GamificationProvider.tsx` — housekeeping order.
- `core/notifications/notificationResponseDispatcher.ts`, `lib/notifications.ts`, `lib/notificationConstants.ts`, `app/_layout.tsx` — workout reminder routing.
- `tests/backupInventoryCoherence.test.ts`, `tests/integration/{workoutCorrection,syncAdapterProjection,backupPushOwnerStamping,gamification}.test.ts`, `tests/notificationResponseDispatcher.test.ts` — oracle tests.
- `openspec/changes/**/tasks.md` — all checkboxes complete.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this ExecPlan.
2. `git status --short`; `npx openspec list --json`.
3. Verify each checked task against code/tests; all three changes report complete.
4. No implementation action remains; archive the changes via the OpenSpec archive
   workflow when the user requests it.

## Outcomes & Retrospective

- Status: Completed.
- Summary: Applied all three pending OpenSpec changes end-to-end. Change A moved the
  three workout-history tables to hard-delete, routed habit and task reminder and
  linked-action writes through `runBackupMutation` (owner stamp + post-commit
  in-memory enqueue), and added coherence/adapter/real-SQLite oracles. Change B added
  `runGamificationHousekeeping` (reconcile yesterday, reconcile today, then freeze)
  and wired the provider to it with overnight/genuine-miss/outbox integration tests.
  Change C classified `workout-day-reminder` taps and routed them to the Workout
  section with dispatcher tests. All 30 OpenSpec tasks are complete; specs validate
  strict; the final tree is green on typecheck, lint, 197-file Vitest, Chromium,
  P0 journeys, and the `e2e:sync` remote-boundary lane.
- Follow-up: (1) archive the three changes via OpenSpec when requested; (2) the
  pre-existing simulation day-rollover section-render failure should be triaged by
  the simulation/harness owner; (3) native smoke/persistence remains available once
  the tree is committed (clean-tree provenance); (4) known-gap 15 headroom floor
  remains host-load sensitive and was not weakened.
