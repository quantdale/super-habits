# ExecPlan: SuperHabits reliability, recovery & product completeness successor campaign

Plan-Version: 2
Status: ACTIVE

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

- Current milestone: Phase 1 (A1) — linked-action crash recovery
  implementation. All four read-only investigations COMPLETE (2026-10-17);
  every candidate gap CONFIRMED. Findings:
  - **A1 confirmed (P2)**: in-app dispatch paths (`todos.data.ts:886/1026`,
    `habits.data.ts:241`) call `processSourceAction` AFTER the source
    transaction commits with an event id minted in-memory
    (`linkedActions.engine.ts:128`) — a crash between commit and the event
    INSERT (`linkedActions.data.ts:496-552`) permanently loses the effect;
    no startup sweeper exists (zero linked-action calls in
    `core/providers/AppProviders.tsx:105-255`). The notification paths
    (`notificationActions.data.ts:36-55`, `habits.data.ts:279-284`) already
    implement the fix pattern: pre-minted eventId + marker in the SAME
    transaction + replay dispatch with recovery branch
    (`todoNotificationActions.data.ts:108-113`, `habits.data.ts:360-363`).
    Fix design: (1) persist the source `linked_action_events` row inside the
    same `runSyncedMutation`/`runBackupMutation` transaction for the three
    in-app paths, dispatch post-commit with that eventId (engine already
    resumes from a persisted event at `engine.ts:314-318`); (2) one startup
    sweeper in AppProviders bootstrap scanning
    `processed_notification_actions WHERE linked_action_required=1` and
    events lacking terminal executions; no schema change (tables already at
    `core/db/client.ts:322-401`; events/executions are local operational
    state outside backup scope).
  - **A2 confirmed (P3)**: all settings writers are two-transaction
    (setting commit → separate `enqueueBackupSettingsRecord` transaction,
    `core/sync/syncedMutation.ts:167-189`); swallow-points at
    `pomodoro.data.ts:686`, `workout.data.ts:1971-1973`,
    `ThemeProvider.tsx:88/108`; AsyncStorage notification prefs NEVER enqueue
    (`core/notifications/notificationPreferences.ts` — no enqueue path).
    Checkpoint capture is dirty-gated only (`backupCheckpoint.ts:254,280`).
  - **A3 confirmed (P3)**: swallowed hydrate failure
    (`AppProviders.tsx:132-140`) leaves `nextRevision=0` while durable rows
    hold high revisions → new intents silently no-op at the
    `excluded.revision > sync_outbox.revision` guard
    (`syncPersistence.ts:188-198`) → exact-revision removal misses
    (`syncPersistence.ts:118-124`) + checkpoint starvation
    (`backupCheckpoint.ts:104-116`); hard-delete edge can strand remote rows.
  - **B confirmed (P3)**: 8 material silent-failure groups (habit
    pause/archive worst — modal closes before write;
    `HabitsScreen.tsx:265-287` + `1347-1354`; todo toggle `TodosScreen.tsx:426-456`;
    link/unlink named throws; task delete ×2; stop-recurring; pomodoro
    notes ×2; preset save/delete; daily-plan/weekly-review deletes).
    Established fix patterns A–D documented (ValidationError inline,
    InAppNotice, planningWriteError, checkInError).
  - **C1 confirmed (stronger than reported)**: backdated check-ins older than
    yesterday ALWAYS receive no XP (reconcile horizon = today+yesterday,
    `gamification.data.ts:658-661`; fast path refuses backdates,
    `habits.domain.ts:336-342`). Fix: bounded 7-day lookback in
    `runGamificationHousekeeping` + per-day cap scoping; dedupe
    (`UNIQUE(event_kind, source_key)`) makes extra passes no-ops.
  - **C2 confirmed**: single call site `RoutineDetailScreen.tsx:136-149`;
    cheapest proof = browser E2E using the worker-SELECT hold pattern
    (`e2e/habits-w7-audit.spec.ts:288-332`); no component-test framework
    needed.
- Completed: Phase 0 (state verified, worktree + branch at `120ab19`,
  ExecPlan created, npm install done); Phase 0 investigations (4/4 returned).
- In progress: Phase 1 (A1) implementation — transactional event handoff +
  startup sweeper + fault-injection tests.
- Important modified files: none yet (implementation starting).
- Last successful validation: baseline = prior campaign's green gates at
  `120ab19` (recorded in the prior plan); this campaign's first own gate run
  pending.
- Current failures: none.
- Relevant quarantines: none.
- Blockers: standing externals only — security gate red (release BLOCKED),
  iOS owner-deferred, Android ENVIRONMENT_BLOCKED. None block engineering.
- Condition required to unblock: none (not blocked).
- Exact resume action after unblock: N/A.
- Exact next action: implement A1 (1) transactional source-event handoff in
  `todos.data.ts` + `habits.data.ts`, (2) startup sweeper
  (`recoverPendingLinkedActions`) wired in `AppProviders.tsx`, (3)
  integration tests proving crash recovery + exactly-once; then `qa:affected`
  gates.
- Remaining definition of done: every named candidate fixed with
  reproduction-first evidence, disproven with pinned tests, or explicitly
  dispositioned; gates green (typecheck 0, lint 0, full Vitest, targeted
  Playwright, hermetic `build:e2e`); adversarial review round; stacked PR
  published to the PR #79 branch; final report filed.

## Progress

- [x] Phase 0 — verify remote/local Git state (PR #79 head = `120ab19`, unchanged)
- [x] Phase 0 — create successor worktree `superhabits-reliability-recovery` + branch
- [x] Phase 0 — create this ExecPlan (Plan-Version 2, ACTIVE)
- [x] Phase 0 — `npm install` (1273 packages, worktree hook warning benign)
- [x] Phase 0 — investigations A1, A2/A3, B, C1/C2 all complete (4/4 confirmed)
- [ ] Phase 1 (A1) — transactional event handoff + startup sweeper + recovery tests
- [ ] Phase 2 (B) — silent UI write fixes (8 material groups, patterns A–D)
- [ ] Phase 3 (A2, A3) — settings dirty-anchor + outbox hydrate-failure recovery
- [ ] Phase 4 (C1, C2) — bounded reward lookback + sequencer E2E pin
- [ ] Phase 5 — adversarial review, final validation, stacked PR, final report

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

## Decision Log

- 2026-10-17 — Base successor on `120ab19` and target the stacked PR at the
  PR #79 branch — per campaign directive; remote verified unchanged before
  branching.
- 2026-10-17 — Reproduction-or-proof gate before any implementation —
  campaign instruction; prevents speculative rewrites of sound machinery
  (esp. the outbox revision guard and linked-action engine).

## Validation Ledger

- 2026-10-17 — `git worktree add ...` — PASS — worktree at `120ab19`, clean.
- 2026-10-17 — `npm install` — PASS — 1273 packages; ENOTDIR `.git/hooks`
  warning is expected in a linked worktree (git dir is a file).

## Changed Files / Areas

- None yet (implementation starting). Investigation reports are embedded in
  Current Checkpoint findings and the task transcripts.

## Recovery / Resume Instructions

1. `cd D:/Documents/tryPython/superhabits-reliability-recovery`
2. `npm run agent:resume -- --plan .agent/execplans/superhabits-reliability-recovery-successor.md`
3. `git status --short && git rev-parse HEAD` — reconcile with this checkpoint.
4. Read `AGENTS.md`, `.agent/PLANS.md`, this plan; continue from
   `Exact next action`.

## Outcomes & Retrospective

- Status: Active.
- Summary: pending.
- Follow-up: pending.
