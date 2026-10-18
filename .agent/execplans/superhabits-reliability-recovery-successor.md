# ExecPlan: SuperHabits reliability, recovery & product completeness successor campaign

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close the highest-value remaining Windows-verifiable engineering gaps left by
the completed Windows-first successor campaign (PR #79, head `120ab19`):
linked-action crash recovery, settings backup consistency, sync-outbox
revision recovery, silent UI mutation failures, historical reward
reconciliation, and snapshot-sequencer integration coverage. Work proceeds
candidate-by-candidate, gated on reproduction or a proven missing invariant.
The approved Calm Momentum visual direction is preserved; no redesign. Data
integrity (soft delete, sync enqueue, exactly-once effects, owner binding)
outranks convenience. Engineering completion and release readiness stay
separate verdicts.

## Context

- Worktree: `D:/Documents/tryPython/superhabits-reliability-recovery`,
  branch `superhabits-reliability-recovery-successor`, based on
  `120ab19` = `origin/frontend-v3-post-w17-overnight-successor` (PR #79,
  OPEN/unmerged; verified 2026-10-17 — remote tip still `120ab19`).
  Main checkout `D:/Documents/tryPython/superhabits` stays on `main`
  (`fb10d6c`) and is not edited by this campaign.
- Stacked-PR policy: publish targeting
  `frontend-v3-post-w17-overnight-successor` (PR #79 branch), not `main`.
  Document PR #79 dependency. Do not merge either PR while the security gate
  is red (`braces` GHSA-vfj7-8cjw-p6xm, `node-forge` GHSA-86w9-cpqp-85rv;
  `node scripts/audit-runtime-deps.mjs` must stay red/unwaived).
- Prior campaign report:
  `docs/ui-ux/v3-audit/post-w17-overnight/WINDOWS-FIRST-SUCCESSOR-REPORT.md`
  §10 registered the classified backlog this campaign executes:
  - A1 (P2): F4 linked-action dispatch crash window
    (`core/linked-actions/linkedActions.engine.ts`).
  - A2 (P3): F7 settings backup snapshot gap (`core/backup/`,
    `core/sync/syncedMutation.ts`, restore coordinator).
  - A3 (P3): F5 outbox revision no-op guard
    (`core/sync/syncPersistence.ts` `upsertSyncOutboxRecord`).
  - B (P3): Tier-2 silent-no-op UI writes (~15 sites).
  - C1 (P3): F8 reward backfill window (backdated check-ins older than
    yesterday; `features/gamification/`, `features/habits/`).
  - C2 (P3): snapshotSequencer call-site integration pin
    (`lib/snapshotSequencer.ts`).
- iOS qualification is owner-deferred (`IOS_QUALIFICATION_DEFERRED_BY_OWNER`)
  — no iOS builds/workflows. Android is ENVIRONMENT_BLOCKED (foreign
  emulators `emulator-5570`/`emulator-5594` must not be disturbed).
- Foreign state preserved untouched: stash `pre-recovery-local-changes`,
  `.tmp-ios36423379932/` evidence trees, `superhabits-overnight` and
  `superhabits-post-w17-correction` worktrees, foreign emulators/processes.
- Architecture invariants (`AGENTS.md`): soft delete only; sync enqueue on
  every applicable write via `runSyncedMutation`/`runBackupMutation`;
  `getDatabase()` singleton; `createId`/`toDateKey`; append-only migrations
  (next: `version < 26`); documented hard-delete exceptions only.

## Scope

- Campaign A1 — linked-action crash recovery: read-only lifecycle audit,
  fault-injection reproduction at each dispatch boundary, smallest reliable
  fix only if the gap is demonstrated (durable dispatch intent, event-ledger
  reconciliation, or startup sweeper — chosen by evidence, not assumption).
- Campaign A2 — settings backup consistency: inventory settings stores,
  prove or disprove the drift window, design a durable recoverable settings
  generation/drift-detection mechanism only where justified.
- Campaign A3 — sync-outbox revision recovery: deterministic hydrate-failure
  integration test; fix only a proven valid-mutation rejection; preserve
  monotonicity.
- Campaign B — silent UI failure handling: audit ~15 candidate handlers,
  classify, fix material cases with existing Calm Momentum error conventions.
- Campaign C1 — historical reward reconciliation: prove intended contract,
  make reconciliation accurate and bounded.
- Campaign C2 — snapshot sequencer integration coverage: prove refresh
  ordering at a real call site without heavyweight new test infrastructure.
- Successor workstreams by evidence-weighted value until none remain; final
  report with separate engineering vs release verdicts.

## Non-Goals

- Any visual redesign of Calm Momentum; cosmetic churn.
- Merging PR #79 or the successor PR; weakening/waiving the security audit.
- iOS builds or workflow dispatches; disturbing foreign emulators/devices.
- Removing or weakening the outbox `excluded.revision > sync_outbox.revision`
  ordering safeguard without proof of a concrete valid-mutation rejection.
- New runtime dependencies; new global error framework (use existing
  InAppNotice/error-display conventions).
- Unbounded startup scans; speculative abstraction layers.

## Current Checkpoint

- Stacked PR: https://github.com/quantdale/super-habits/pull/80 (base
  `frontend-v3-post-w17-overnight-successor`, open; release BLOCKED on the
  security gate).

- Current milestone: COMPLETE. Closure round finished: the multi-rule
  crash-recovery defect was reproduced (8/11 pre-fix failures in
  `linkedActionsMultiRuleCrashRecovery`), corrected at rule level with
  historical rule eligibility (`631b005`), regression matrix 11/11, all
  gates green (typecheck 0, lint 0/0, `qa:fast` 2309, integration 449,
  linked-action suites 30/30, hermetic `build:e2e`, full `npm run e2e`
  376/0/0-flaky/87-skipped with visual 34/34, deterministic simulation
  23/23, openspec 88/88), adversarial review recorded, and PR #80's
  description reconciled.

- Original campaign (Phases 1–4, COMPLETE and COMMITTED on
  `superhabits-reliability-recovery-successor`):
  - `f964cb6` Phase 1 (A1) — durable linked-action dispatch handoff + startup
    sweep (in-tx source event with stable id at all three in-app dispatch
    paths, `recoverPendingLinkedActions()` 7-day sweeper in AppProviders,
    `buildTransactionalSourceEvent`, data-layer recovery query, pinned
    crash/exactly-once integration tests). 12 files, 930 insertions.
  - `272343a` execplan checkpoint for A1.
  - `f964cb6` Campaign B (habits pause/archive) + `b1a5620` (todos, pomodoro,
    planning deletes): lifecycle handlers surface `lifecycleError` inside the
    still-open detail modal, close only after the write lands, and guard double
    taps; pinned by `e2e/journeys/habit-lifecycle-persistence.spec.ts` (4/4
    green, RAISE(ABORT) injection). To-do toggles/delete + stop-recurring catch
    and notify; `toggleTodo` gained `noop` for missing/lost-race rows. Pomodoro
    session note prompt + session meta modal + preset save/delete and the
    weekly-review/daily-plan history deletes render inline errors.
  - `6460f0e` Phase 3 (A2) — `runRecoverableSettingsMutation()` applies the
    app_meta write + snapshot capture (INSIDE the tx, AFTER the mutation) +
    `user_backup_settings` outbox row atomically; calories goal/targets,
    pomodoro settings, workout preferences converted. Theme/rest-default
    enqueue failures log (rest default returns false and the session screen
    shows a retriable alert); preset-state saves keep local-first but log.
    Reminder prefs enqueue from `SettingsNotificationsSection` (NOT from
    `notificationPreferences`, which sits in backupSettings' import graph —
    a static or lazy enqueue there re-created the adapter-init cycle).
    Pinned by `tests/integration/settingsOutboxAtomicity.test.ts`.
  - `5f3726f` Phase 3 (A3) — `SyncEngine.hydrate()` recovers the revision floor
    from `loadOutboxMaxRevision()` (dedicated MAX(revision) query) before
    rethrowing, so a failed hydrate can no longer leave `nextRevision=0` and
    silently lose every new intent at the upsert guard. Pinned by
    `tests/integration/syncHydrateFailure.test.ts` (control proves the old
    rejection; recovery proves allocation/removal work).
  - `c3d204a` Phase 4 (C1) — housekeeping reconciles a bounded
    `GAMIFICATION_RECONCILE_LOOKBACK_DAYS = 7` window oldest-first with the
    award cap scoped per day; pinned against real SQLite (backdated days pay,
    8-day-old does not, replay is free, 25/day cap with a second day paying).
  - `b92d8da` Phase 4 (C2) — `e2e/workout-snapshot-ordering.spec.ts` delays
    ONLY the `getAll` response of the prepared `listExercises` statement (rows
    already read → genuinely stale) while an interleaved add refresh applies
    the newer list; verified failing with the claim check removed and passing
    with it restored; stable across repeat runs; workout feature suites green.
- Decisions recorded in the Decision Log (fail-closed event handoff; sweep
  after hydrate; recovery queries live in the data layer; reproduction-first
  gate; per-day cap scoping; notify-from-caller for reminder prefs).
- Completed: original Phases 0–5 (`f964cb6`..`6642534`) plus closure
  Phases 1–7 (`631b005` + this docs commit): multi-rule defect reproduced,
  corrected at rule level, regression matrix green, full Playwright
  qualification clean on the final source, adversarial review recorded,
  docs/PR reconciled.
- In progress: none.
- Important modified files: closure round — `core/linked-actions/`
  (`linkedActions.data.ts` recovery selection + matching cutoff,
  `linkedActions.engine.ts` `recordedAt` + eligibility pass-through,
  `linkedActions.events.types.ts`, `linkedActions.rows.ts`,
  `linkedActions.recovery.ts` docs/classification) and
  `tests/integration/linkedActionsMultiRuleCrashRecovery.test.ts` (11 tests).
  No schema change, no migration.
- Last successful validation: 2026-10-18 (closure round, final) — typecheck
  0 · lint 0/0 · `qa:fast` 182 files/2309 tests · integration 89 files / 449
  tests (2 pre-existing skips) · linked-action suites 30/30 · multi-rule
  matrix 11/11 · hermetic `build:e2e` (0 Supabase hosts) · full `npm run
e2e` 376 passed / 0 failed / 0 flaky / 87 skipped (visual 34/34,
  `retries: 0`) · `qa:simulation --all --mode deterministic` 23/23 ·
  openspec 88/88 · `agent:plan:validate` PASS.
- Current failures: none.
- Relevant quarantines: none.
- Blockers: standing externals only — security gate red (release BLOCKED),
  iOS owner-deferred, Android ENVIRONMENT_BLOCKED. None block engineering.
- Condition required to unblock: none (not blocked).
- Exact resume action after unblock: N/A.
- Exact next action: None — task complete.
- Remaining definition of done: None — full Playwright qualification clean on
  the final source; adversarial-review findings recorded (no material defect);
  ExecPlan/report/commit map internally consistent; PR #80 description
  updated against the PR #79 branch; remote HEAD verified; final report filed
  with separate engineering/release verdicts.

## Progress

- [x] Phase 0 — verify remote/local Git state (PR #79 head = `120ab19`, unchanged)
- [x] Phase 0 — create successor worktree `superhabits-reliability-recovery` + branch
- [x] Phase 0 — create this ExecPlan (Plan-Version 2, ACTIVE)
- [x] Phase 0 — `npm install` (1273 packages, worktree hook warning benign)
- [x] Phase 0 — investigations A1, A2/A3, B, C1/C2 all complete (4/4 confirmed)
- [x] Phase 1 (A1) — transactional event handoff + startup sweeper + recovery
      tests (committed 2026-10-17; 12 files, 930 insertions)
- [x] Phase 2 (B) — silent UI write fixes (8 material groups, patterns A–D) —
      committed `f964cb6` (habits) + `b1a5620` (todos/pomodoro/planning)
- [x] Phase 3 (A2, A3) — single-transaction settings writers + outbox
      hydrate-failure revision-floor recovery — committed `6460f0e`, `5f3726f`
- [x] Phase 4 (C1, C2) — bounded 7-day reward lookback + per-day cap; sequencer
      E2E pin proven failing without the claim — committed `c3d204a`, `b92d8da`
- [x] Closure Phase 1 — multi-rule crash-recovery defect reproduced (real
      SQLite, 8/11 pre-fix failures in `linkedActionsMultiRuleCrashRecovery`)
- [x] Closure Phase 2 — rule-level recovery selection + historical rule
      eligibility + `recordedAt` plumbing — committed `631b005`
- [x] Closure Phase 3 — regression matrix 11/11 green, single-rule suites
      preserved (30/30), full integration + `qa:fast` + lint 0/0 green
- [x] Closure Phase 4 — one clean full `npm run e2e` against the reviewed
      goldens on the final candidate source — PASS 376/0/0-flaky/87-skipped,
      visual 34/34, source `631b005`
- [x] Closure Phase 5 — adversarial review of the correction + tests (13
      challenge areas, findings recorded in the report; no material defect)
- [x] Closure Phase 6 — ExecPlan/report/PR reconciliation (commit map fixed
      (`71a7024` restored, 15-row table), status truthfulness, visual
      9-tests/8-goldens reconciled)
- [x] Closure Phase 7 — final gates green, docs committed, branch pushed to
      PR #80, remote HEAD verified, final report filed

## Surprises & Discoveries

- The notification linked-action path already implements the exact recovery
  pattern A1 needs (in-transaction marker + stable eventId + replay dispatch)
  — the fix generalizes production-proven code instead of inventing new
  architecture; no schema change required.
- A2 is broader than reported: AsyncStorage notification preferences have NO
  backup enqueue path at all (standing drift, not just a crash window); three
  writers swallow enqueue failures without any crash.
- A3's worst consequence is not data loss at push time (adapter re-reads live
  rows) but durable-intent corruption: stale intents survive successful pushes
  (exact-revision removal misses), starving the completeness checkpoint all
  session and risking a terminal hard-delete push failure.
- C1 is deterministic, not probabilistic: the production reconcile horizon is
  exactly today+yesterday, so every >1-day backdate is silently unpaid.
- A2's naive fix created a module cycle: `notificationPreferences` is imported
  by `backupSettings`, which `supabase.adapter` imports, while
  `syncedMutation` imports `sync.engine` — enqueueing from the prefs module
  (static OR lazy dynamic import under Vitest) initialized the adapter
  mid-cycle. The enqueue belongs to the settings caller.
- The settings snapshot must be captured INSIDE the transaction AFTER the
  mutation: capturing before (or outside) it stores a pending payload that
  misses the just-written value, which the adapter's manifest-staleness
  checksum then reads as a different generation.
- C2: delaying only the `prepare` response is NOT a stale snapshot — the
  query then executes late and reads current rows. The genuine repro needs the
  `getAll` response (rows already read) delayed, identified by the
  `nativeStatementId` learned from the matching `prepare`.
- Closure round: the report's commit table had drifted — `fa9cafe` never
  existed (the review-round commit is `71a7024`) and four commits were
  missing; the table is now the full `120ab19..HEAD` sequence.
- Closure round: the "9 failed visual goldens" figure counts failing TESTS,
  not goldens — the strict-comparison control reuses the
  `shell-today-390-light` golden, so 9 failures map to 8 unique goldens (the
  refreshed set). The lane's 34 tests = 30 goldens + 4 self-checks.
- Closure round: `deleteHabit` cascades into
  `deleteLinkedActionRulesForTargetEntity`, so a live "rule whose target is
  missing" state barely occurs (only stray/restore ids); the observable
  legitimate skip for an existing rule is the adapter's `already_completed` /
  `target_missing` terminal skip.
- Closure round: the old event-level exclusion also re-scanned no-rule events
  forever (harmless but reported `skipped` each launch); the rule-level query
  ends that as a side effect — an event with no eligible rule is never swept.

## Decision Log

- 2026-10-17 — Base successor on `120ab19` and target the stacked PR at the
  PR #79 branch — per campaign directive; remote verified unchanged before
  branching.
- 2026-10-17 — Fail-closed event handoff: the in-tx event insert is NOT
  wrapped in try/catch; an insert failure rolls the source mutation back so
  the UI sees a real write failure instead of a silently-lost effect.
- 2026-10-17 — Sweep AFTER hydrate: replayed effects enqueue outbox intents
  that must allocate against the restored durable revision (A3 interplay).
- 2026-10-17 — Keep DB access inside `linkedActions.data.ts` (recovery module
  queries via `listPendingRecoveryLinkedActionEvents`) instead of adding a
  lint-config exclusion for `linkedActions.recovery.ts`.
- 2026-10-17 — Reproduction-or-proof gate before any implementation —
  campaign instruction; prevents speculative rewrites of sound machinery
  (esp. the outbox revision guard and linked-action engine).
- 2026-10-17 — B: modal closes only after the persisting write resolves
  (`Promise<boolean>` from the handler), inline `lifecycleError` for failures;
  row-delete/toggle failures use the existing InAppNotice convention.
- 2026-10-18 — A2: atomic settings writers read the snapshot inside the same
  transaction after the mutation; AsyncStorage-backed prefs keep their
  best-effort local-first write but log instead of swallowing.
- 2026-10-18 — A3: recover the floor from a dedicated `MAX(revision)` query
  (not a retried full load) and rethrow so bootstrap still logs the degraded
  start; allocation stays monotonic.
- 2026-10-18 — Closure: decide recovery completion at RULE granularity —
  mirror the engine's durable unit (`UNIQUE(rule_id, source_event_id)`) in the
  selection query instead of removing the `NOT EXISTS` filter wholesale; rule
  A's terminal execution must never consume rule B's pending work, and
  terminal siblings must never re-apply.
- 2026-10-18 — Closure: historical rule eligibility is
  `rule.created_at <= event.created_at` (the row's timestamp), enforced in
  BOTH `listPendingRecoveryLinkedActionEvents` and the engine's matching via a
  new `recordedAt` on the event record — no rule-identity snapshot schema, and
  the retroactive-effect hole is closed on every path.
- 2026-10-18 — Closure: changed-rule semantics stay "live pipeline" (the
  established A1 replay behavior): a still-matching edited rule settles with
  its current configuration; a rule edited to no longer match never fires.
  Pinned as tests instead of inventing snapshot semantics.

## Validation Ledger

- 2026-10-17 — `git worktree add ...` — PASS — worktree at `120ab19`, clean.
- 2026-10-17 — `npm install` — PASS — 1273 packages; ENOTDIR `.git/hooks`
  warning is expected in a linked worktree (git dir is a file).
- 2026-10-17 — fault-injection integration tests
  (`linkedActionsCrashRecovery.test.ts`, 4 tests) — PASS — crash after
  source commit leaves persisted event; startup sweep replays exactly once.
- 2026-10-17 — targeted linked-actions suites (6 files, 45 tests) — PASS.
- 2026-10-17 — `npm run typecheck` — PASS — 0 errors (after widening input
  `label` to `string | null` + test helper typing).
- 2026-10-17 — `npm run lint` — PASS — 0 errors, 0 warnings (prettier CRLF
  normalization + no-console + DB-client boundary respected via data-layer
  query indirection).
- 2026-10-17 — `npm run qa:fast` — PASS — exit 0: typecheck + lint + all
  182 unit test files (initially 10 failures from stale vi.mock factories,
  fixed with importOriginal spreads + updated expectations).
- 2026-10-18 — habit lifecycle journey
  (`npx playwright test --project=journeys
e2e/journeys/habit-lifecycle-persistence.spec.ts`) — PASS 4/4 (25.9s);
  earlier iterations diagnosed: section switcher is role `tab`, harness
  round-trips land on Today, paused rows hidden by the default Active filter
  (fix: Filter and sort → `Filter habits: All`).
- 2026-10-18 — Campaign B unit/integration — PASS — todos data 30, command
  executor 12, linked-actions integration 18, 9 planning/focus unit files 217.
- 2026-10-18 — A2 regression discovery — `tests/integration/backupCheckpoint`
  failed 11/13 after the first A2 rewrite; root causes: (a) dropped
  `enqueuePrepared` after the settings outbox tx starved the queue, (b) the
  snapshot was captured before the mutation, making the pending payload stale
  against the manifest checksum. Both fixed; suite back to 13/13.
- 2026-10-18 — A2 module-cycle discovery — `syncAdapterProjection` +
  `backupPerformance` failed with `SupabaseSyncAdapter is not a constructor`;
  the notification-prefs enqueue introduced
  backupSettings→notificationPreferences→syncedMutation→sync.engine→adapter.
  Enqueue moved to `SettingsNotificationsSection`; suites green.
- 2026-10-18 — `tests/integration/settingsOutboxAtomicity.test.ts` — PASS 2/2
  (value + intent + pending payload together; payload carries the new value).
- 2026-10-18 — `tests/integration/syncHydrateFailure.test.ts` — PASS 3/3
  (control proves the revision-1 rejection; recovered floor allocates above
  the durable revision, wins the guard and removes exactly).
- 2026-10-18 — gamification suites — PASS 58 tests (11 in the data suite
  incl. 2 new backdate/cap tests).
- 2026-10-18 — `npm run typecheck` / `npm run lint` — PASS 0/0 after every
  commit; `npm run qa:fast` — PASS exit 0 (182 files, 2309 tests).
- 2026-10-18 — full `npx vitest run tests/integration` — PASS 90 files / 451
  tests (2 skipped).
- 2026-10-18 — `npm run build:e2e` — PASS hermetic export, 0 Supabase hosts.

- 2026-10-18 — full `npm run e2e` — 367 passed / 9 failed; all nine were W15
  visual goldens. Attribution proven: rebuild with ONLY C1's lookback
  reverted → visual 34/34 pass; restored → the same 9 fail. Refreshed via
  `npm run visual:update` + `golden-manifest.md` change-log row (maxDiffPixels
  stays 0, no masks); visual lane green 3/3 consecutive runs.
- 2026-10-18 — focused reruns on the final hermetic build: `calories.spec.ts`
  - `workout-snapshot-ordering.spec.ts` 13/13; habit-lifecycle journey 4/4.
- 2026-10-18 — `npm run qa:simulation --all --mode deterministic` — PASS, all
  23 scenarios.
- 2026-10-18 — `npm run openspec:validate` — PASS 88/88.

- 2026-10-18 (closure) — multi-rule reproduction against the UNFIXED code —
  `linkedActionsMultiRuleCrashRecovery.test.ts` — FAIL 8/11 (expected):
  failed-sibling, running-sibling (fresh + stale), missing-sibling (in-process
  - restart), applied+skipped (no-rule event re-swept), new-rule-after-event,
    edited-rule, and the 4-rule exactly-once event all show
    `recoverPendingLinkedActions()` returning `{0,0,0}` while the sibling effect
    is absent. PASS 3/11: both-applied, paused-rule, deleted-rule guards.
- 2026-10-18 (closure) — same suite after `631b005` — PASS 11/11 (incl.
  stable execution identity reuse and `sync_outbox` count stability).
- 2026-10-18 (closure) — existing linked-action suites
  (`linkedActions`, `linkedActionsCrashRecovery`,
  `linkedActionEffectsExactlyOnce`, `linkedActionLogTargets`,
  `linkedActions.engine`) — PASS 30/30 (single-rule idempotency preserved).
- 2026-10-18 (closure) — `npx vitest run tests/integration` — PASS 89 files /
  449 tests (1 file / 2 tests skipped, pre-existing).
- 2026-10-18 (closure) — `npm run qa:fast` — PASS exit 0 (182 files, 2309
  tests + journey-label/quarantine/release-profile parity guards).
- 2026-10-18 (closure) — `npm run typecheck` — PASS 0 errors · `npm run lint`
  — PASS 0 errors/0 warnings (after `lint:fix` normalization).
- 2026-10-18 (closure) — `npm run qa:affected` — linked-actions rule matched:
  required `qa:fast → qa:full → qa:integration → e2e:journeys →
qa:simulation`, journeys `linked-actions` + `power-user`, broad regression
  required.
- 2026-10-18 (closure) — `npm run build:e2e` — PASS hermetic export, 0
  Supabase hosts in `dist/`.
- 2026-10-18 (closure) — `npm run openspec:validate` — PASS 88/88.
- 2026-10-18 (closure) — FULL `npm run e2e` final qualification (5 projects:
  chromium, journeys, simulation, pwa, visual) against `dist/` from the
  hermetic `build:e2e` — **PASS: 376 passed / 0 failed / 0 flaky / 87
  skipped in 39.1m** (chromium 254/45-skipped, journeys 80/42-skipped,
  visual 34/34, pwa 5, simulation self-tests 3). Skips are the pre-existing
  runtime gates (`@sync`/`@account`/`@portable` remote-boundary journeys and
  native/unsupported lanes need a sync backend or device). Local `retries:
0` — no retry masked anything. Source: `631b005` (verified byte-identical
  for app + e2e specs + goldens). Artifacts:
  `.cursor/playwright-output/e2e-report/` (HTML + JSON). This replaces the
  campaign's earlier 367/9 run as the qualification of record; the nine
  historical W15 visual failures stay documented (see report).
- 2026-10-18 (closure) — `npm run agent:plan:validate` — PASS (structure).
- 2026-10-18 (closure) — `npm run agent:resume` recovery command — verified
  working (plan validation PASS; read-only orientation).
- 2026-10-18 (closure) — `npm run qa:simulation -- --all --mode
deterministic` — PASS, all 23 scenarios
  (`simulation-output/run_mvdh1gtr_g920jhqo/run-report.json`).
- 2026-10-18 (closure) — `npm run agent:plan:validate` — PASS at final
  COMPLETED state; `npm run qa:affected` impact plan satisfied (qa:fast ✓,
  qa:integration ✓, e2e:journeys subsumed by the full run ✓,
  qa:simulation ✓, broad regression = the full e2e ✓).

## Changed Files / Areas

- `core/linked-actions/` and tests (`linkedActionsCrashRecovery.test.ts`,
  `linkedActionEffectsExactlyOnce.test.ts`) — A1 durable handoff + recovery.
- `features/habits/HabitsScreen.tsx`, `HabitDetailModal.tsx`,
  `e2e/journeys/habit-lifecycle-persistence.spec.ts` — B habits group.
- `features/todos/TodosScreen.tsx`, `todos.data.ts`,
  `features/pomodoro/SessionNotePrompt.tsx`, `SessionMetaEditModal.tsx`,
  `PomodoroPresetManager.tsx`, `features/weekly-review/ReviewHistoryView.tsx`,
  `features/daily-plan/DailyPlanHistoryView.tsx` — B sweep.
- `core/sync/syncedMutation.ts`, `core/providers/ThemeProvider.tsx`,
  `core/notifications/notificationPreferences.ts`,
  `features/settings/SettingsNotificationsSection.tsx`,
  `features/calories/calories.data.ts`, `features/pomodoro/pomodoro.data.ts`,
  `features/workout/workout.data.ts`, `features/workout/WorkoutSessionScreen.tsx`,
  `tests/integration/settingsOutboxAtomicity.test.ts`, `tests/caloriesTargets.test.ts`
  — A2.
- `core/sync/sync.engine.ts`, `core/sync/syncPersistence.ts`,
  `tests/integration/syncHydrateFailure.test.ts` — A3.
- `features/gamification/gamification.data.ts`,
  `tests/integration/gamification.test.ts` — C1.
- `e2e/workout-snapshot-ordering.spec.ts` — C2.
- Closure round (`631b005`): `core/linked-actions/linkedActions.data.ts`
  (rule-level recovery selection + matching eligibility cutoff),
  `linkedActions.engine.ts` (`recordedAt` + eligibility pass-through),
  `linkedActions.events.types.ts`, `linkedActions.rows.ts`,
  `linkedActions.recovery.ts` (docs + outcome classification),
  `tests/integration/linkedActionsMultiRuleCrashRecovery.test.ts` (11 tests).
- Closure round (this docs commit): this plan and
  `docs/ui-ux/v3-audit/reliability-recovery/RELIABILITY-RECOVERY-REPORT.md`.
- No schema change; no migration.

## Recovery / Resume Instructions

1. `cd D:/Documents/tryPython/superhabits-reliability-recovery`
2. `npm run agent:resume -- --plan .agent/execplans/superhabits-reliability-recovery-successor.md`
3. `git status --short && git rev-parse HEAD` — reconcile with this checkpoint.
4. Read `AGENTS.md`, `.agent/PLANS.md`, this plan; continue from
   `Exact next action`.

## Outcomes & Retrospective

- Status: Completed.
- Summary: all campaigns (A1–A2–A3, B, C1, C2) and the independent-review
  closure correction (A1.1: multi-rule crash recovery at rule granularity +
  historical rule eligibility) are implemented, reproduction-first pinned,
  and gated. The suspected multi-rule recovery defect was CONFIRMED with real
  SQLite before any production change, fixed at the narrowest correct layer
  without schema/migration, and closed with an 11-case matrix plus one clean
  full-suite Playwright qualification on the final source.
- Retrospective: the reproduction-first gate did its job twice — it turned a
  code-reading hypothesis into 8 pinned failing scenarios, and it exposed the
  secondary retroactive-effect hole the naive "drop the NOT EXISTS" fix would
  have shipped. Keeping recovery queries in the data layer (A1's earlier
  decision) made the correction a one-query + one-cutoff change.
- Follow-up: none required. Standing external items remain (security gate,
  native qualification) and are recorded as release blockers, not engineering
  work for this branch.

## Final disposition

- Closure round complete: the multi-rule crash-recovery defect was reproduced
  (8/11 pre-fix failures), corrected (`631b005`, rule-level selection +
  historical rule eligibility), and re-verified (matrix 11/11, single-rule
  suites 30/30, full integration 449, `qa:fast` 2309, full `npm run e2e`
  376 passed / 0 failed / 0 flaky / visual 34/34, deterministic simulation
  23/23, openspec 88/88) on the final source.
- Stacked PR #80 (base `frontend-v3-post-w17-overnight-successor`, PR #79
  branch) description updated with the final state; neither PR may merge.
- Final report:
  `docs/ui-ux/v3-audit/reliability-recovery/RELIABILITY-RECOVERY-REPORT.md`
  (commit map reconciled to the real `120ab19..HEAD` history).
- Engineering verdict: PASS. Release verdict: BLOCKED (unchanged security
  gate — `braces`, `node-forge`; iOS owner-deferred; Android
  environment-blocked).
