# Reliability recovery — final report

- Date: 2026-10-18
- Branch: `superhabits-reliability-recovery-successor`
- Base: `120ab19` = `origin/frontend-v3-post-w17-overnight-successor` (PR #79, open)
- Stacked PR target: `frontend-v3-post-w17-overnight-successor` (not `main`)
- Engineering verdict: **PASS** (all campaigns implemented, pinned, and gated)
- Release verdict: **BLOCKED** (unchanged red security gate; iOS owner-deferred;
  Android environment-blocked) — release is not this branch's call to make.

## Commits

| Commit    | Campaign | Summary                                                         |
| --------- | -------- | --------------------------------------------------------------- |
| `5f63bec` | A1       | Durable linked-action dispatch handoff + startup recovery sweep |
| `272343a` | —        | ExecPlan checkpoint for A1                                      |
| `f964cb6` | B        | Habit pause/archive writes never fail silently from the modal   |
| `b1a5620` | B        | To-do/focus/planning handlers surface write failures            |
| `6460f0e` | A2       | Settings values commit together with their backup intent        |
| `5f3726f` | A3       | Outbox revision floor recovered when hydrate fails              |
| `c3d204a` | C1       | Backdated activity paid across a bounded 7-day lookback         |
| `b92d8da` | C2       | Routine-detail snapshot ordering pinned at the real call site   |
| `fa9cafe` | review   | Local-first settings fallback + atomic habit busy guard         |
| `418e6f5` | —        | ExecPlan checkpoint for Phases 1–4                              |

## Method

Reproduction-or-proof gate before every change: each campaign started from the
prior campaign's classified finding, and every fix is pinned by a test that
fails on the pre-fix behavior (fault injection, delayed worker response,
durable floor control, bounded-window control). No schema change, no migration,
no new dependency.

## A1 — linked-action dispatch crash window (P2)

Finding: the three in-app completion paths dispatched linked actions after the
source transaction committed, with an event id minted in memory. A crash in
that gap lost the effect permanently; no startup sweep existed.

Fix: `buildTransactionalSourceEvent()` + `insertLinkedActionEventInTransaction()`
persist the source event with a stable id inside the same transaction as the
source mutation (`setTodoCompletion`, `bulkSetTodoCompletion`, habit threshold
crossing, notification completion). Dispatch runs post-commit against that id.
`recoverPendingLinkedActions()` sweeps a bounded 7-day window at startup
(AppProviders, after hydrate so replayed intents allocate against the restored
durable revision) and replays events lacking a terminal execution.

Evidence: `tests/integration/linkedActionsCrashRecovery.test.ts` (4/4),
`tests/integration/linkedActionEffectsExactlyOnce.test.ts` (4/4), plus the
existing linked-action suites (18/18).

## B — silent mutation failures (P3, 8 groups)

| Group                           | Fix                                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Habit pause/archive (worst)     | Handler returns success; inline `lifecycleError` in the still-open modal; close only after the write lands; ref-backed busy guard |
| To-do toggle                    | Catch + notice; new `noop` result for missing/lost-race rows (no phantom settle)                                                  |
| To-do delete ×2, stop-recurring | catch + notice; editor stays open on failure                                                                                      |
| Pomodoro note prompt/meta       | inline error, typed value kept                                                                                                    |
| Preset save/delete              | error slot (save and delete), local list untouched on failure                                                                     |
| Weekly-review delete            | inline validation error, retriable row kept                                                                                       |
| Daily-plan delete               | inline validation error, retriable row kept                                                                                       |

Evidence: `e2e/journeys/habit-lifecycle-persistence.spec.ts` (4/4; pause success
persists status + `lifecycle_history`; injected `RAISE(ABORT)` keeps the modal
open with the pause/resume and archive alerts, then both retry cleanly);
Campaign B unit/integration suites (todos 30, command executor 12, planning and
focus 217).

## A2 — settings backup consistency (P3)

Finding (broader than reported): every settings writer committed the value and
then opened a separate transaction for the `user_backup_settings` intent, so a
crash between them left a persisted setting with no backup intent. AsyncStorage
notification preferences had no enqueue path at all. Three writers swallowed
enqueue failures.

Fix: `runRecoverableSettingsMutation()` commits the app_meta write, the
settings snapshot captured INSIDE the transaction after the mutation, the
pending-settings payload, and the outbox intent together. Local-first is
preserved: if only the intent/bookkeeping step fails, the value still commits
and the result reports `backupEnqueued: false` (calories renders “saved
locally, backup unconfirmed”; others log). Theme and rest-default enqueue
failures log; the rest-default caller gets a retriable inline alert. Reminder
preferences enqueue from `SettingsNotificationsSection` — deliberately not
from `notificationPreferences`, which sits in `backupSettings`' import graph
(enqueueing there re-created the adapter-initialization cycle).

Evidence: `tests/integration/settingsOutboxAtomicity.test.ts` (value + intent +
pending payload present together; payload carries the just-written value);
`backupCheckpoint` 13/13 (including the stale-manifest-generation race);
`e2e/calories.spec.ts` partial-backup-intent test.

## A3 — outbox revision floor (P3)

Finding: a swallowed hydrate failure left `nextRevision=0` while durable rows
held high revisions. New intents allocated 1..n, silently lost the
`excluded.revision > sync_outbox.revision` guard, and their exact-revision
removal could never match — starving the completeness checkpoint and stranding
hard-delete intents for the session.

Fix: `hydrate()` recovers the floor from a dedicated `MAX(revision)` query
(resilient to row-shape failures in the full load), lifts the in-memory floor,
then rethrows so bootstrap still logs the degraded start; allocation remains
monotonic (`Math.max`).

Evidence: `tests/integration/syncHydrateFailure.test.ts` (3/3) — the control
proves a cold-engine revision-1 intent loses to a durable revision-50 row; the
recovered engine allocates above 50, wins the guard, and its record is
removable by exact revision.

## C1 — historical reward reconciliation (P3)

Finding: housekeeping reconciled exactly today + yesterday, so any check-in
recorded more than one local day back was deterministically unpaid (the
same-day fast path refuses backdates). Not a rare race.

Fix: housekeeping walks `GAMIFICATION_RECONCILE_LOOKBACK_DAYS = 7` local days
oldest-first (streak math stays chronological), scopes the 25-award cap per day
(not one shared budget), then plans the freeze on the resulting ledger. The
unique `(event_kind, source_key)` index keeps replayed passes free; the window
stays small so ancient history is never rewritten.

Evidence: `tests/integration/gamification.test.ts` — days 3 and 6 back pay, day
8 does not, a repeat pass awards nothing, 30 same-day completions cap at 25
while a second backdated day still pays.

## C2 — snapshot sequencer call-site pin (P3)

Finding: the sequencing guard in `RoutineDetailScreen` had no test at its real
call site.

Fix/evidence: `e2e/workout-snapshot-ordering.spec.ts` learns the
`nativeStatementId` of the prepared `listExercises` statement, delays ONLY that
statement's `getAll` response (rows were already read, so the payload is
genuinely stale), and interleaves a real “add exercise” refresh that applies the
newer list. Verified both directions: with the claim check removed the spec
fails (the added exercise reverts); restored, it passes. Stable across repeated
runs; `workout` + `workout-gym-v2` suites stay green (21/21).

## Adversarial review round

1. **Local-first regression (caught by the e2e gate, fixed in `fa9cafe`).** The
   first A2 shape rolled the local value back when only the backup intent
   failed, breaking the documented calories partial-failure UX. The runner now
   degrades to `backupEnqueued: false`.
2. **Habit double-tap guard** read render state; two taps in one tick both
   passed. A ref mirror makes the check atomic; a duplicate returns false so the
   in-flight write closes the modal.
3. **Stale comment/untyped local** around the to-do fast-path award.

Also verified during A2 integration debugging: the snapshot must be read after
the mutation (a pre-mutation capture stores a stale pending payload the manifest
checksum rejects), and `enqueueBackupSettingsRecord` must re-enqueue the
prepared record after its transaction (dropping it starved the queue).

## Gates

| Gate                                                  | Result                                             |
| ----------------------------------------------------- | -------------------------------------------------- |
| `npm run typecheck`                                   | PASS — 0 errors                                    |
| `npm run lint` (`--max-warnings 0`)                   | PASS — 0 errors/warnings                           |
| `npm run qa:fast`                                     | PASS — 182 unit files / 2309 tests + parity guards |
| `npx vitest run tests/integration`                    | PASS — 90 files / 451 tests (2 skipped)            |
| `npm run build:e2e` (hermetic)                        | PASS — 0 Supabase hosts in `dist/`                 |
| `npm run e2e` (feature + journeys + simulation + pwa) | see run log below                                  |
| `npm run qa:simulation --all --mode deterministic`    | see run log below                                  |
| `npm run openspec:validate`                           | see run log below                                  |

## Residual risks / follow-ups

- A failed hydrate still loses the unflushed queue for that session (rows are
  retried next launch; the revision floor is now safe). Not a data-loss path.
- If the backup-intent step fails after the pending snapshot was written, a
  snapshot without an outbox row can remain in app_meta; the next save
  overwrites it and the adapter never pushes it without a record.
- First housekeeping run after a long offline stretch may award up to the
  bounded window (7 days × 25/day). Throttled to once per minute.
- C2's spec depends on the expo-sqlite worker protocol (`prepare` →
  `getAll`, `nativeStatementId`); an SDK upgrade that changes the protocol will
  fail the spec loudly rather than silently lose coverage.
- Native lanes were not run: Android is environment-blocked (foreign emulators
  must not be disturbed) and iOS is owner-deferred. Web is this campaign's
  verification surface.
- Security gate stays red (`braces` GHSA-vfj7-8cjw-p6xm, `node-forge`
  GHSA-86w9-cpqp-85rv); release remains blocked and neither PR may merge.
