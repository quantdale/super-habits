# Reliability recovery — final report

- Date: 2026-10-18 (final closure round)
- Branch: `superhabits-reliability-recovery-successor`
- Base: `120ab19` = `origin/frontend-v3-post-w17-overnight-successor` (PR #79, open)
- Stacked PR target: `frontend-v3-post-w17-overnight-successor` (not `main`)
- Closure head: `631b005` (multi-rule crash-recovery correction) + this
  documentation commit
- Engineering verdict: **PASS** (all campaigns implemented, pinned, gated; the
  independent-review P1 multi-rule recovery defect was reproduced and fixed;
  one clean full-suite Playwright qualification on the final source)
- Release verdict: **BLOCKED** (unchanged red security gate — `braces`
  GHSA-vfj7-8cjw-p6xm, `node-forge` GHSA-86w9-cpqp-85rv; iOS owner-deferred;
  Android environment-blocked) — release is not this branch's call to make.

## Commits

| Commit    | Campaign     | Summary                                                                   |
| --------- | ------------ | ------------------------------------------------------------------------- |
| `5f63bec` | A1           | Durable linked-action dispatch handoff + startup recovery sweep           |
| `272343a` | —            | ExecPlan checkpoint for A1                                                |
| `f964cb6` | B            | Habit pause/archive writes never fail silently from the modal             |
| `b1a5620` | B            | To-do/focus/planning handlers surface write failures                      |
| `6460f0e` | A2           | Settings values commit together with their backup intent                  |
| `5f3726f` | A3           | Outbox revision floor recovered when hydrate fails                        |
| `c3d204a` | C1           | Backdated activity paid across a bounded 7-day lookback                   |
| `b92d8da` | C2           | Routine-detail snapshot ordering pinned at the real call site             |
| `418e6f5` | —            | ExecPlan checkpoint for Phases 1–4                                        |
| `71a7024` | review       | Local-first settings fallback + atomic habit busy guard                   |
| `a7b6283` | review       | Settings marks dirty before the outbox row (self-healing partial intent)  |
| `2ea6bd3` | C1 visual    | Refresh W15 goldens for the C1 reward truth (8 goldens)                   |
| `5e8e50d` | —            | ExecPlan + report final gate ledger                                       |
| `6642534` | —            | ExecPlan: PR #80 published and final disposition recorded                 |
| `631b005` | A1.1 closure | Multi-rule recovery completed at rule level + historical rule eligibility |

The earlier revision of this table listed the review commit as `fa9cafe`
(which never existed; the real commit is `71a7024`) and omitted
`a7b6283`/`2ea6bd3`/`5e8e50d`/`6642534`. The table above is the complete
sequence (`120ab19..HEAD`).

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

## A1.1 — multi-rule crash-recovery defect (closure round, `631b005`)

An independent review of A1 raised a P1 hypothesis: the startup sweep's
recovery query excluded a whole source event once ANY of its executions
reached a terminal state, while `processSourceAction` dispatches EVERY
matching rule with one durable execution per rule
(`UNIQUE(rule_id, source_event_id)`). A crash after rule A applied and before
rule B settled would then leave rule B's effect permanently missing.

**Reproduction (real SQLite, real engine, before any production change).**
`tests/integration/linkedActionsMultiRuleCrashRecovery.test.ts` constructs one
source completion matching two active rules and interrupts the dispatch after
rule A's effect completed (engine crash hooks and a between-iterations notice
seam that models process death mid-loop). Against the pre-fix code 8 of 11
scenarios fail exactly as hypothesized: `recoverPendingLinkedActions()` returns
`{0, 0, 0}` — incorrectly reporting an empty queue — while the sibling rule
stays `failed`, `running`, or entirely missing and its target effect is absent
(verified for habit increments, and for a 4-rule event across habit, todo,
calorie and pomodoro effects). The two multi-rule “complete” states and the
paused/deleted-rule guards pass both pre- and post-fix.

**Root cause.** `listPendingRecoveryLinkedActionEvents()` decided completion at
EVENT granularity (`NOT EXISTS` any terminal execution) while the engine's
durable unit is the RULE. A secondary hole sat behind it: recovery replays
through the live `processSourceAction` pipeline, which re-matched rules
authored AFTER the historical event (retroactive effects), and events with no
matching rules were re-swept on every launch.

**Correction (narrowest correct layer, no schema/migration).**

1. Recovery selection is now rule-level: an event is pending while some
   eligible rule lacks a terminal (`applied`/`skipped`) execution for it —
   missing, `planned`, `failed`, and stale-`running` siblings all keep the
   event pending; terminal siblings are never re-applied.
2. Rule eligibility is historical and enforced in BOTH the selection query and
   the engine's rule matching: only active, undeleted rules with
   `created_at <= ` the event row's `created_at` may act on an event. Rules
   authored later never fire retroactively (previously a live hole); paused or
   deleted rules never resurrect; events with no applicable rules are never
   re-swept.
3. The engine carries the event's `recordedAt` (the row's `created_at`,
   previously dropped by normalization) so dispatch and replay share one
   eligibility rule.

**Query efficiency** (verified with `EXPLAIN QUERY PLAN` against the runtime
definitions): the rule probe seeks `idx_linked_action_rules_source_lookup`
and the per-rule execution probe seeks
`idx_linked_action_executions_source_rule (rule_id=?, source_event_id=?)` —
where the old event-level `NOT EXISTS` correlated probe was a full
`SCAN linked_action_executions` per event. The 7-day
`occurred_at >= cutoff` bound and the local-only table size are unchanged.

**Supported historical semantics** (established A1 behavior, now pinned):
recovery replays through the live pipeline, so a still-matching rule that was
edited after the event fires with its CURRENT configuration; a rule edited so
it no longer matches the historical source never fires. Rule history is not
snapshotted — no new schema was introduced.

**Lease semantics** (unchanged, now explicitly tested and documented): a
`running` execution is protected by its 5-minute claim lease
(`EXECUTION_STALE_AFTER_MS`). A sweep that meets a fresh lease leaves the rule
untouched (the event is reported `skipped`, not consumed) and the retry happens
at a later startup sweep once the lease is stale — the sweep runs once per
launch (AppProviders, after sync hydration), so “later” means the next launch.
Immediate startup recovery is not claimed while a valid lease stands.

**Exactly-once preserved.** Recovered executions reuse their stable execution
identity and pre-minted produced entity ids (deterministic calorie/pomodoro/
workout row ids), terminal executions map to duplicates, chain fingerprints and
stable-source guards are untouched, and the single-rule crash suite stays
green unchanged. Post-fix the matrix is 11/11: failed sibling, running sibling
(fresh lease respected → stale reclaimed), missing sibling (in-process and
across a simulated restart), both-applied and applied+skipped terminal states,
paused/deleted/new/edited historical rules, and a 4-rule event completing
habit.increment, todo.complete, calorie.log and pomodoro.log exactly once with
stable `sync_outbox` counts across repeated sweeps and re-dispatch.

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

## Adversarial review (closure round)

Independent challenge of `631b005` and its tests, against the review brief's
checklist. Findings with evidence:

1. **Multi-rule completion criteria.** Verified the selection unit is the rule
   (`UNIQUE(rule_id, source_event_id)`), matching the engine's dispatch loop;
   terminal siblings map to duplicates and are never re-applied (matrix tests
   - existing `linkedActions` replay tests).
2. **Eligibility of historical rules.** Verified the bound is enforced in BOTH
   the SQL selection and the engine matching (`recordedAt` = the event row's
   `created_at`), closing the retroactive-effect hole on every path including
   recovery replay. Edge semantics documented: edited-but-matching rules settle
   with their current configuration; edited-away rules never fire.
3. **Execution lease semantics.** Verified a fresh `running` lease is never
   stolen (test asserts the effect is NOT applied and the row is untouched),
   stale leases are reclaimed with the stable execution identity, and the
   retry path is honestly documented as the NEXT startup sweep (the sweep runs
   once per launch, after sync hydration).
4. **Exactly-once replay.** Verified for habit.increment, todo.complete,
   calorie.log, pomodoro.log: recovered executions reuse stable execution ids
   and pre-minted produced entity ids; repeated sweeps and re-dispatch are
   no-ops with stable row and outbox counts.
5. **Source-event persistence.** Untouched by the fix; the durable handoff
   tests (4/4) stay green unchanged.
6. **Crash/restart correctness.** Verified in-process interruption and a
   file-backed simulated restart both complete the sibling effect once.
7. **Outbox and backup side effects.** `sync_outbox` counts are asserted stable
   across repeat sweeps and re-dispatch; replayed effects enqueue through the
   unchanged `runSyncedMutation`/`runBackupMutation` paths.
8. **Infinite or repeated recovery loops.** Repeated sweeps report zeros once
   all eligible rules are terminal; duplicate-only, unsupported-rule and
   self-noop outcomes are classified `skipped`; identity-deduped events are
   re-scanned read-only inside the 7-day window (pre-existing, harmless,
   documented).
9. **Query efficiency and seven-day bounds.** `EXPLAIN QUERY PLAN` proves the
   per-rule probes are index seeks (rules: `idx_linked_action_rules_source_lookup`;
   executions: `idx_linked_action_executions_source_rule`) where the old
   correlated probe was a full executions scan; the 7-day cutoff is unchanged.
   The `linked_action_events.occurred_at` window filter still scans the
   local-only table (no dedicated index) — same as before, noted as residual.
10. **Regression-test completeness.** The matrix from the review brief is
    covered end-to-end (single-rule baseline preserved in the original suite;
    multi-rule partial/complete states, lease phases, restart, and the four
    historical-rule cases in the new suite).
11. **Visual baseline legitimacy.** Eight goldens changed, nine tests failed —
    reconciled (shared strictness control); pixel bands localize to reward
    surfaces/level chips/tab band; `maxDiffPixels: 0`, no masks, no unrelated
    baselines regenerated; manifest change-log complete.
12. **CI and Playwright provenance.** The full-suite qualification ran against
    `dist/` from the hermetic `build:e2e` (0 Supabase hosts), local `retries:
0`, one owned server via `scripts/serve-e2e.js`, and app source + e2e specs
    - goldens byte-identical to `631b005` (`git diff 631b005 --name-only`
      afterwards lists only docs/plan files).
13. **Documentation accuracy.** The commit map is reconciled to the real
    history (including the corrected `71a7024` SHA), the ExecPlan status is
    truthful, and lease/replay semantics are documented where they are
    implemented.

No material finding required further implementation. Residual risks are
listed below (lease retry timing, read-only re-scans, current-config replay,
event-window scan) — all bounded and documented, none a confirmed defect.

## Gates

Final closure-round qualification (2026-10-18, source `631b005` + docs):

| Gate                                                            | Result                                                                                                                                                                                                                             |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                             | PASS — 0 errors                                                                                                                                                                                                                    |
| `npm run lint` (`--max-warnings 0`)                             | PASS — 0 errors / 0 warnings                                                                                                                                                                                                       |
| `npm run qa:fast`                                               | PASS — 182 unit files / 2309 tests + journey-label, quarantine-register and release-profile parity guards                                                                                                                          |
| `npx vitest run tests/integration`                              | PASS — 89 files / 449 tests passed (2 tests in 1 file skipped, pre-existing), incl. `linkedActionsMultiRuleCrashRecovery` 11/11                                                                                                    |
| linked-action suites (5 files)                                  | PASS — 30/30 (single-rule crash and exactly-once suites preserved unchanged)                                                                                                                                                       |
| `npm run build:e2e` (hermetic)                                  | PASS — 0 Supabase hosts in `dist/`                                                                                                                                                                                                 |
| `npm run e2e` (chromium + journeys + simulation + pwa + visual) | **PASS — 376 passed / 0 failed / 0 flaky / 87 skipped (39.1m)** — chromium 254, journeys 80, visual 34/34, pwa 5, simulation 3; local `retries: 0`; skips are the pre-existing `@sync`/`@account`/`@portable`/native runtime gates |
| `npm run qa:simulation -- --all --mode deterministic`           | PASS — all 23 scenarios (run report: `simulation-output/run_mvdh1gtr_g920jhqo/run-report.json`)                                                                                                                                    |
| `npm run openspec:validate`                                     | PASS — 88 items, 0 failed                                                                                                                                                                                                          |
| `npm run agent:plan:validate`                                   | PASS — ExecPlan structure                                                                                                                                                                                                          |

Historical qualification (kept for the record): the campaign's first full
`npm run e2e` was **367 passed / 9 failed**, the nine failures being W15
visual tests driven by the C1 reward truth (8 unique goldens — see the visual
section). The reviewed golden refresh plus this closure round's clean full
run above is the qualification of record; the nine historical failures are
not erased.

Provenance: the full run executed against `dist/` produced by the hermetic
`build:e2e`, its own owned server (`scripts/serve-e2e.js`, no stale preview),
`workers: 1`, `retries: 0`, and app source + `e2e/` specs + goldens
byte-identical to `631b005` (`git diff 631b005 --name-only` afterwards lists
only `docs/` and `.agent/` plan files). Artifacts:
`.cursor/playwright-output/e2e-report/` (HTML + `report.json`), failures
dir `.cursor/playwright-output/e2e-failures/` (empty — no failures).

## Residual risks / follow-ups

### Visual golden refresh (C1)

The first full `npm run e2e` run failed exactly nine W15 `visual-regression`
TESTS. Attribution was proven, not assumed: rebuilding with only C1's
lookback reverted makes all 34 visual tests pass; restoring it reproduces the
same nine failures. The count reconciles precisely: the lane runs 34 tests —
30 golden captures plus 4 capture-readiness/strictness self-checks — and the
strict-comparison control reuses the `shell-today-390-light` golden, so nine
failing tests map to EIGHT unique goldens. Those eight
(`achievements-390-light`, `plan-hub-projects-768-light`,
`settings-top-1280-dark`, `shell-today-1280-light`, `shell-today-390-dark`,
`shell-today-390-light`, `shell-today-768-light`, `timeline-1280-light`) were
regenerated with the documented reviewed path (`npm run visual:update`) plus a
`golden-manifest.md` change-log entry; `maxDiffPixels` stays 0 and nothing is
masked. The lane was then green 3/3 consecutive runs.

Closure-round re-verification (direct pixel inspection, old-vs-new from
`2ea6bd3^`): differences are localized to reward/level content — the
achievements screen (fully reward-derived) carries almost all changed pixels,
the Today tablet frame's changed bands cover the rewards row and the level
carrying tab band, `shell-today-390-light` changes ONLY in the tab band
(311 px), and `settings-top-1280-dark`/`timeline-1280-light` change by
130–139 px in the level-chip and tab-band rows. No dimensions changed, no
layout or styling region changed, and no unrelated golden was regenerated.
(The reviewing agent could not eyeball the renders directly — image input is
unavailable in this session — so the evidence is the pixel-band localization,
the revert-based attribution, and the 3/3 green lane.)

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
- Multi-rule recovery (A1.1): a crash-abandoned execution with a still-fresh
  claim lease is retried only at a later startup sweep (the sweep runs once per
  launch), so an effect interrupted ≤5 minutes before a restart may wait for
  the next launch. This is the documented lease contract, not a data-loss path.
- Events whose rules all dedupe on stable source identity (e.g. two rapid
  completions of one source day, chain-guard suppressions) carry no terminal
  execution for the suppressed event and are re-scanned read-only on each
  launch inside the 7-day window; no effect, notice, or row is ever produced.
  Same behavior pre- and post-fix; bounded by the lookback.
- A rule whose only unfinished sibling work is an unsupported or self-noop
  rule shape likewise re-scans read-only inside the window (those shapes
  record no execution by design).
- `linked_action_events.occurred_at` has no dedicated index, so the 7-day
  window filter scans the local operational table at each startup sweep. The
  per-rule execution probe is an index seek on
  `idx_linked_action_executions_source_rule`; volumes are bounded by local
  usage and the table is outside backup scope. A future migration could add an
  index if the table ever grows large; none was added here (no schema change).
- Recovery replays run against the CURRENT rule configuration. A rule edited
  after its source event settles with the edited configuration if it still
  matches the historical source, and never fires if it no longer matches.
  Editing history is not snapshotted (by design; no schema for it).

Focused reruns on the final hermetic build: `calories.spec.ts` +
`workout-snapshot-ordering.spec.ts` 13/13, habit-lifecycle journey 4/4.

## Verification addendum — final independent review (2026-10-18)

Scope: adversarial review of the committed PR #80 diff (`120ab19...HEAD`,
focused on `6642534...631b005`) in the successor worktree at `33593b8`
(= `origin/superhabits-reliability-recovery-successor`; working tree clean).
Unrelated preserved artifacts (`.tmp-ios36423379932/`, `features_tsx_list.txt`,
foreign stashes/worktrees) were excluded and left untouched.

Invariants re-verified against source, not summaries: rule-level completion
(one terminal sibling cannot suppress an unfinished one — the `NOT EXISTS` is
correlated per `rule_id`); exactly-once (terminal sibling duplicates, stable
execution/produced-id reuse, idempotent adapters, target-table and
`sync_outbox` counts asserted); historical eligibility (`created_at <=` the
event row's `created_at`, ISO-string comparable at ms precision, equality
eligible; engine matching carries the same cutoff via `recordedAt`); leases
(fresh `running` untouched, stale reclaimed with stable identity); SQL (rule
probe seeks `idx_linked_action_rules_source_lookup`, per-rule execution probe
seeks `idx_linked_action_executions_source_rule`; NULL source-entity matching
is identical to the TypeScript matcher; `EXISTS` cannot duplicate events);
unsupported/self-noop/identity-deduped events re-scan read-only inside the
window; crash boundaries before/during/after effect and before finalize all
covered; source event commits atomically with its source mutation. Broader
campaign re-verified: A2 keeps the committed value on backup-intent failure
(`backupEnqueued: false`) and only mutation failures throw; A3's recovered
floor is monotonic (`Math.max`) and the revision guard is untouched; B's modal
surfaces `lifecycleError` and disables lifecycle buttons while busy; C1 is
chronological, bounded to 7 local days with a per-day 25-award cap and a
unique source key; C2's spec delays the worker `getAll` response of the
prepared `listExercises` statement (rows already read — genuinely stale) at
the real call site.

Independent execution: the six linked-action suites were re-run at this head
— **41/41** (`linkedActionsMultiRuleCrashRecovery` 11, `linkedActions` 10,
`linkedActionsCrashRecovery` 4, `linkedActionEffectsExactlyOnce` 4,
`linkedActionLogTargets` 3, `linkedActions.engine` 9). The earlier exact-source
full-suite qualification (376/0/0-flaky/87-skipped, visual 34/34) remains
valid; the review introduced no source change, so it was not re-run.

Findings: no P0/P1/P2. One P3 — **a rule paused at event time and re-enabled
later fires on the historical event at a subsequent startup sweep** (eligibility
is "existed-then AND active-now"; no status-transition history exists to prove
the rule was active at the moment of the action). Reproduced deterministically:
rule paused → source action completes (event commits, zero executions, sweep
is a no-op while paused) → rule re-enabled → next sweep applies the effect
exactly once (`replayedEvents: 1`). Impact is one late but rule-consistent
effect inside the 7-day horizon; no double-apply and no corruption; identical
behavior existed in the A1 baseline. Disposition: DOCUMENTED, no code change —
the alternatives (status-history snapshot = new schema; `updated_at` heuristic)
would break the documented live-configuration semantics for edited rules
(pinned by `completes an interrupted rule with its current configuration`).
The contract wording "paused/deleted rules never resurrect" means active at
sweep time; the pause-AFTER-event case (never fires) is covered by tests.

Verdicts: `INDEPENDENT_REVIEW: PASS_WITH_NONBLOCKING_FINDINGS` ·
`ENGINEERING_CAMPAIGN: PASS` · `PRODUCT_RELEASE: BLOCKED` (security gate red,
unchanged).
