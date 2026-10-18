# Frozen audit baseline and evidence

## Provenance and limits

Audit date: 2026-10-18. Repository: https://github.com/quantdale/super-habits. Audited source: main `fb10d6ccfe66b54613c6fd22cb82da7dd7626e4f`. There are 20 confirmed findings and one probable finding; IDs below match the owner's final audit report. Six are High; the remainder are Medium. No Critical issue was established.

The audit changed no repository files, Git history, application data or infrastructure. It executed actual TypeScript functions or extracted screen callbacks in memory, using real in-memory SQLite where indicated, with external effects stubbed. Those demonstrations establish the stated boundary defects, not deployed or native-device behavior. The resolution session must add durable regressions through production entrypoints. Do not depend on the original chat or temporary scripts.

Historical checks at the audit revision: typecheck and lint passed; 536 tests across 19 domain files passed; 76 tests across seven selected integration files passed. No full browser/native/cloud qualification occurred. Local Node 24.3.0/npm 11.4.2 were outside the declared Node 22/npm 10 toolchain; use .nvmrc and package.json in resolution. A selected sync verification test emitted a database-closed teardown warning without an assertion failure.

All source anchors are relative paths and audit-time line numbers. Resolve the named function again on the implementation base; line drift is expected. Canonical contracts include openspec/specs/backup-completeness-v2/spec.md, productivity-expansion-hardening/spec.md, gym-training-system/spec.md, ui-ux-mass-wave-hardening/spec.md and user-simulation-platform/spec.md.

## SH-01 — Imported data adopted by the wrong account

High / Confirmed. `core/auth/account.domain.ts:231,273`, `core/auth/accountCoordinator.ts:904`, `core/portable/portableImport.ts:392`.

An owner-A portable import drops a pristine provisional B binding but keeps its source-owner fingerprint; B's Auth session can remain. The domain returns owner_mismatch before local edits. A local mutation correctly leaves an unowned outbox row; with that row present, the earlier adoption branch returns anonymous_ready and bindCurrentUserId B before checking the fingerprint. The coordinator persists B and adopts work. Reproduction output changed from `{status:owner_mismatch,bindCurrentUserId:null}` to `{status:anonymous_ready,bindCurrentUserId:temporary_B}` after only pending/unowned counts changed from zero to one. Local use must remain possible, but unrelated ownership adoption/upload must remain impossible. Restore/import compatibility disclosures explicitly promise that only A can claim this dataset.

## SH-02 — Previous backup generation no longer restorable during upload

High / Confirmed. `core/sync/supabase.adapter.ts:216`, `core/backup/backupCheckpoint.ts:41`, `core/backup/backupRestore.ts:597`.

The specification requires an earlier complete checkpoint to remain restorable while newer changes are pending or publication fails. The adapter overwrites current remote entity rows before publishing a new manifest. With a valid generation-1 manifest for Todo title Original, one successful update to Changed followed by interrupted publication left generation 1 in place; actual Restore V2 returned invalid/integrity_mismatch. Preserving the old manifest alone does not preserve its certified bytes. Settings overwrite, hard deletes, concurrent readers and old clients require the same analysis. Mocks modeled remote storage; no cloud writes occurred. A local-only transaction or altered status label is insufficient remediation.

## SH-03 — Retryable outbox records become terminally blocked

High / Confirmed. `core/sync/sync.engine.ts:358`, `core/sync/outboxAttempts.ts:154`, `core/sync/supabase.adapter.ts:176`.

The persistent-failure bound must be earned per record with relevant evidence. Four transient attempts followed by one missing-table failure produced attempts 5 and blockedNow true with a misleading five-consecutive-missing-table reason. Separately, actual SyncEngine execution with aggregate errors for missing Todos table plus transient Habits HTTP 503 blocked both records after five batches. Healing the adapter then produced no sixth push. The adapter currently carries failed records plus joined messages, losing their individual reasons. Its actual `Missing local rows for ...` wording also classifies transient; include this contract mismatch when repairing the boundary. Do not simply clear all durable diagnostics on restart or retry permanent poison forever.

## SH-04 — Workout draft cleared before a successful finish

High / Confirmed. `features/workout/WorkoutSessionScreen.tsx:472,623,756,852`; `tests/integration/workoutSaveIntegrity.data.test.ts:129`; `e2e/workout-w95-audit.spec.ts:16`.

The isComplete effect clears the durable draft on reaching the unsaved summary. Save/finish commits later and claims failed saves retain progress. Actual effect execution cleared the draft with no successful save. A failed finish followed by restart can lose the entered workout. Passing data-layer tests leave the draft untouched because they never execute this screen effect; the E2E audit acknowledges this missing rendered failure case. Retaining only React state or suppressing a success message does not resolve durable loss.

## SH-05 — PWA shell updates do not reach existing v10 clients

High / Confirmed (deployment impact conditional on installed worker). `public/sw.js:23,155`, `core/pwa/registerServiceWorker.ts`, `package.json:17`.

The worker blob is `55eccb49ec947a20e8f4ac10e7a7ab402de3d432` both at 3c4b96c and audited HEAD despite newer shell revisions. CACHE_VERSION is v10; production documents are cache-first. The actual fetch handler served old-index with hitNetwork false. Byte-identical worker updates do not trigger installation of a new shell; fresh installs are a counterexample. No deployed installations were inspected. The build comments describe content-hash revision injection as future work; it is absent from production export. Prove two-build upgrade behavior, not merely a cache-version constant assertion.

## SH-06 — Completion commits before Linked Actions persistence

High / Confirmed. `features/todos/todos.data.ts:795,886`, `features/habits/habits.data.ts:241`, `core/linked-actions/linkedActions.engine.ts:317`.

Ordinary in-app completion writes commit before source event creation/dispatch. An injected interruption at that handoff left Todo completed=1, source events=0. Idempotent completeTodo retry returned matchedRuleCount=0 without redispatch; dispatchCalls remained 1. The effect intent is lost. Notification-origin paths already contain different durable claims and are a control, not proof ordinary paths are safe. PR #80 proposes a durable handoff/startup sweep and multi-rule recovery; verify the entire coherent implementation and tests before reuse.

## SH-07 — Backfill replaces a newer hard-delete intent

Medium / Confirmed. `core/backup/backupBackfill.ts:94,125`, `core/sync/syncPersistence.ts:195`.

Backfill reads rows before opening its enqueue transaction. A real SQLite barrier deleted saved_1 after that read and committed delete revision 1; the stale backfill then committed create revision 2. Final local row count was zero while the durable intent was create. Keyset pagination protects page boundaries but not this within-batch race. Remote deletion is lost and the missing-row intent can stall completeness. Validate soft/hard delete and edit races, not only saved meals.

## SH-08 — Verification fails successfully stored batches above response cap

Medium / Confirmed for capped API. `core/sync/supabase.adapter.ts:234`, `core/sync/sync.engine.ts:295`, `supabase/config.toml:18`.

The repo configures a 1,000-row API maximum. A mock enforcing that cap stored all 1,001 pushed rows, but one unpaged select returned 1,000 IDs and the actual adapter failed all 1,001 records as incompletely stored. The engine snapshots the entire queue without a compatible bound. The remote project's actual cap was not inspected. Pagination/batching must preserve genuine missing-row detection and revision-safe removal.

## SH-09 — Different exercises merge by display name

Medium / Confirmed. `features/workout/workout.domain.ts:787,884`, `features/workout/WorkoutSessionScreen.tsx:804`, `features/workout/workout.data.ts:2127`.

Custom exercise names need not be unique. Actual domain execution with two Press phases, catalog IDs cex_A/cex_B and weighted/timed modalities, produced one summary/group containing two setNumber=1 rows. The screen resolves the group's metadata from the first routine exercise with that name. Stable identity/modality can be lost in history and progression. Legacy free-text compatibility does not justify merging distinct catalog or routine-exercise identities; repeated instances of the same catalog exercise also need position-safe handling.

## SH-10 — Resumed Focus intent keeps an obsolete deadline

Medium / Confirmed. `features/pomodoro/PomodoroScreen.tsx:766`, `features/pomodoro/pomodoro.domain.ts:548`.

Start 25-minute focus at 01:00, run five minutes, pause twenty, resume 01:25, relaunch 01:26. Actual resume saved original start 01:00 plus totalSeconds 1500 and cleared pausedRemainingSeconds. Actual reconciliation returned complete-unlogged despite 1,140 seconds owed. Keep session identity separate from the running countdown deadline/elapsed duration. Clock skew, repeated pause/resume, normal completion and legacy active intents need compatibility tests.

## SH-11 — Rejected Focus startup keeps an active claim

Medium / Confirmed. `features/pomodoro/PomodoroScreen.tsx:572,643`, `features/pomodoro/pomodoro.startup.ts:255`.

Execute the actual screen start callback with a scheduling rejection. First result is failed; second is conflict; live claims stay `{starting:false,active:true}`. The recovery callback resets rendered flags but not sessionActiveRef. A permission-denied null scheduler result is a separate successful-warning control. Restore the whole lifecycle authority, and verify a second start through actual orchestration rather than a helper with custom recovery effects.

## SH-12 — Project/Goal relationships are not enforced consistently

Medium / Confirmed. `features/todos/todos.data.ts:163,389`, `features/habits/habits.data.ts:706`, `features/goals/goals.data.ts:31`; contract `openspec/specs/productivity-expansion-hardening/spec.md:109`.

Real SQLite/data API reproductions: addGoal accepted projectId missing; addTodo with goal G in Project P persisted project_id null; moving that Todo's Project to P2 kept G in P; clearing a linked Habit's Project kept G. Creation and update enforce different subsets. Existing parent deletion/move behavior and legacy snapshots must be retained, while invalid new writes fail atomically. Existing corrupt rows require a deliberate repair policy; do not silently delete entities or infer missing exercise/parent identities.

## SH-13 — New Todo drops selected associations

Medium / Confirmed. `features/todos/TodosScreen.tsx:348,1110`.

Creation dialog choices update editProjectId/editGoalId but addTodo omits both. Actual callback/data execution persisted null/null despite selections. Edit mode passes them. Verify create, cancel/reset, edit and reload across the planning views after the authoritative data contract is fixed. Passing only a payload-shape test is insufficient.

## SH-14 — Parent creation plus failed rule saving duplicates on retry

Medium / Confirmed. `features/todos/TodosScreen.tsx:348`, `features/habits/HabitsScreen.tsx:545`.

Actual Todo onSave committed a parent then encountered injected linked-rule persistence failure. One retry created a second same-title parent. Habits follow the same sequence. Both writes need an atomic composed operation or a durable resumable partial result; newly created identity cannot be discarded. Validation must cover multiple rule rows, concurrent taps and process interruption as well as a single throwing rule-save stub. An inline error alone does not establish idempotency.

## SH-15 — Reschedule can remove the source without saving destination

Medium / Confirmed. `features/workout/workout.data.ts:2571`.

From a weekly workout at 2026-10-19, call reschedule to 2026-10-20 with a missing routine. Actual API threw Routine not found after source became a rest override. The two operations commit independently. PR #79 contains a proposed atomic two-leg operation; revalidate it on the selected base, including actual second-leg failure, same-day move, calendar validation and backup intents.

## SH-16 — Derived quest completion suppresses unpaid quest rewards

Medium / Confirmed. `features/gamification/gamification.data.ts:479`, `features/gamification/gamification.domain.ts:580`.

On 2026-10-18, committing a daily plan then awarding its action returned plan_today complete=true, one plan event worth 8 XP, and no gamification_quests row; the 15-XP quest award was absent. Post-action canonical facts build an already-complete quest board, then computeActionReward treats complete flags as previously paid. XP-hunter can still work. Distinguish earned eligibility from recorded payment; preserve exactly-once behavior, local-only scope and backdated attribution already improved on the successor branch.

## SH-17 — Distinct reminder deliveries share a dedupe fingerprint

Medium / Confirmed. `core/notifications/notificationResponseDispatcher.ts:202`, `app/_layout.tsx:163`, `core/notifications/weeklyReviewReminderScheduler.ts:17`.

Fingerprint is request identifier plus action. Two weekly deliveries at different dates share the fixed request ID. Executing the actual host callback produced one dispatch instead of two. Its 64-entry cache lasts for the mounted host; this is not a claim of persistence across app restarts. Todo rescheduling and repeated snooze deliveries also need examination. Distinguish delivery identity from the action's durable business idempotency key.

## SH-18 — Simulation outbox oracles give false passes

Medium / Confirmed. `simulation/runner/execute.ts:237,352`.

Actual attached oracle with a nonempty expected outbox and query result [] returned passed/0 records. Actual standalone unspecified oracle swallowed a failed SQLite read and returned expectOracle outbox. Scenario notes such as offline writes enqueued or failed record still pending are not assertions. Convert relevant no-expectation cases to explicit meaningful invariants, including captured dynamic IDs; a successful parse/count alone does not prove enqueue behavior.

## SH-19 — API legs perform shadow SQL instead of real data functions

Medium / Confirmed. `simulation/runner/apiLeg.ts:21,216`, `simulation/README.md:368`, `openspec/specs/user-simulation-platform/spec.md:82`.

Actual execCreateTodo inserted a row with notes string null and no sync_outbox entry. Registry handlers generate alternate IDs and replay SQL rather than production validation/mutation hooks. This violates the API-leg contract. Raw SQL remains legitimate for explicitly labeled fixtures, harness inspection and controlled failure injection; it must not be mislabeled production API execution. Any new bridge must be absent from ordinary builds and closed against arbitrary SQL/functions and remote access.

## SH-20 — Dependency security gate blocks release and downstream CI

Medium / Confirmed. `package-lock.json:7199,12906`, `.github/workflows/ci.yml:126`.

Recorded packages: braces 3.0.3 (GHSA-vfj7-8cjw-p6xm) and node-forge 1.4.0 (GHSA-86w9-cpqp-85rv). Current-main CI run 39060484078/job 117477263949 passed preceding test steps (264 files passed, one skipped) and correctly failed the advisory gate; dependent browser/nightly jobs skipped. App-level exploitability was not established. Registry/advisories must be rechecked during implementation; no fixed version is assumed. Do not waive or broaden allowlists, fabricate success, or force-upgrade Expo/RN without a compatibility decision.

Primary evidence: https://github.com/quantdale/super-habits/actions/runs/39060484078 ; https://github.com/advisories/GHSA-vfj7-8cjw-p6xm ; https://github.com/advisories/GHSA-86w9-cpqp-85rv .

## SH-21 — Cloud native workflow lacks enforced credential isolation

Medium / Probable. `.eas/workflows/native-e2e.yml:13`, `eas.json:17`.

The cloud path builds e2e-test directly. Its profile enables a test seam but does not blank Supabase variables, disable dotenv or provide the local provisioner's isolation scan. EAS environment merging can supply live public variables; the actual account configuration was not inspected, and no contamination was claimed. Local provisioning and `.github/workflows/ios-native-e2e.yml` already provide hermetic counterexamples. Establish scope, then enforce isolation independent of account defaults; verify built artifacts and both platforms without printing secrets or starting paid runs by default.

Primary behavior reference: https://docs.expo.dev/eas/workflows/environment/ .

## Unresolved intent and excluded claims

Recurring Todo successors currently omit Project/Goal associations (`features/todos/todos.data.ts`, createRecurringInstances). This was reproduced but not counted as a confirmed defect because per-instance versus series inheritance is not settled by the inspected specifications. Preserve behavior until existing product evidence resolves intent; if it does not, report SPEC_AMBIGUITY and propose a separate decision rather than silently expanding this campaign.

Live Supabase schema/row caps, deployed PWA installations, EAS variables, OS notification delivery, background lifecycle, full accessibility, and the full correctness of unmerged branches were not certified. Original successful checks do not prove these properties. Do not inflate the finding count with documentation style or unverified security hypotheses.
