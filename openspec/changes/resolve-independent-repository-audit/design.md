## Context

See proposal.md for motivation and audit-baseline.md for frozen evidence. This design is the implementation blueprint; validation-matrix.md defines proof. Existing main specifications remain binding. Read the selected implementation base, not only the audit line numbers, before editing.

The greatest architectural change is SH-02: a mutable current-row store cannot retain a manifest-addressed previous snapshot. All other packages must preserve that recovery invariant rather than adding more success labels around the same unsafe storage model.

## Goals / Non-Goals

**Goals:** Close each demonstrated failure at its authoritative boundary; keep local use independent of remote availability; preserve compatible old data; produce deterministic negative tests and a reviewable branch. Let a workhorse finish one bounded subtask at a time without relying on this conversation.

**Non-Goals:** Change the approved Calm Momentum visual direction, add two-way sync, repair production datasets without a separate plan, rewrite past migrations, remove verification to obtain green results, or declare unavailable native/cloud checks passed. Do not broaden this campaign into every historical issue on the successor branches.

## Decisions

### D1. Base selection and bounded execution

Use the START-HERE.md base procedure. Prefer current main if successors merged, otherwise a fresh campaign worktree from the coherent current PR #80 tip. This retains the already developed atomic reschedule and Linked Actions recovery. Do not rewrite existing worktrees or merge a release-blocked stack. A main-only implementation is the fallback after dependency analysis, not a blind series of cherry-picks.

At W0 record the exact baseline and re-run every counterexample relevant to changed source. A defect already fixed on that base still needs adversarial verification, an implementing commit reference and production-path regression before ALREADY_FIXED_VERIFIED. Earlier green reports are leads. The campaign review diff is against the selected base; separately disclose the full main-to-head stack and its unmerged dependencies.

Default execution is one workhorse and serial packages. Delegation is optional only when explicitly authorized and genuinely independent. Sync/backup/ownership files, Todo/Habit composed writes, and the same screen's tests must never have competing writers. Keep the only live checkpoint/disposition table in execplan.md; check off tasks.md after the described proof exists.

### D2. Evidence boundaries precede evidence-dependent certification

W1 repairs SH-18 and implements SH-19's isolated production API seam before simulation results are accepted as evidence. Unit/real-SQLite tests and carefully instrumented UI journeys can still establish product fixes while this is underway. Every new negative test must fail on the affected implementation (or on a temporary isolated revert of the specific fix); preserve that proof. Source-string assertions, custom recovery callbacks, screenshot existence and a query merely returning successfully cannot certify the behavior.

Use the pinned Node/npm toolchain. Prefer existing test frameworks and harnesses; add a dependency only if existing tools cannot cover the real orchestration, with a recorded rationale and lockfile/security review. Preserve failures and classify them using docs/testing/autonomous-qa.md. A timing retry does not erase the first failure.

### D3. Imported ownership is a universal adoption precondition (SH-01)

Make the fingerprint restriction apply before every path that can bind, seed, adopt unowned work, or promote provisional ownership for imported populated data. Centralize the predicate and enforce it in the coordinator's committing boundary as defense against stale decisions. A matching verified source account can claim the import; unrelated temporary or protected accounts cannot. Keep local edits usable and unowned while remote work is paused. A local-only source file without a fingerprint retains its disclosed adoption behavior.

Test the complete portable import, real local mutation, coordinator refresh, durable binding/outbox, restart and adapter gate. A domain-only decision test is necessary but insufficient. Invalid/missing fingerprints and storage read failures must not silently become permission to adopt a dataset that has recorded protected origin. Do not reassign already-owned outbox rows.

### D4. Per-record failure evidence, bounded verification and race-safe backfill (SH-03/07/08)

Extend the adapter/engine failure contract to carry structured per-entity or per-record failures, preserving transport codes and safe diagnostics. Classify each affected record from its own error; successful entities remain removable. Maintain a separate consecutive persistent-failure streak, resetting it on transient failures, success or a different persistent class. Do not inherit transient counts into the bound. Recognize the adapter's actual missing-local-row diagnostic. Persist and hydrate the ledger without losing revision guards.

Existing falsely blocked rows require a bounded repair/retry policy: retain the diagnosis, reset/reprobe only records affected by the accounting correction or an explicit retry operation, and do not resurrect physically deleted entities. Test restart with an old ledger, a healed backend and new edits to the same key. A lower-priority valid entity must not inherit another entity's poison.

Batch writes and read-back by bounded row and encoded-request size; paginate read-back with deterministic ordering and compare the complete expected ID set. Use a conservative default below the supported cap, verify under a lower configured cap, and fail visibly when the server truncates a page unexpectedly. Handle zero rows and genuine missing IDs without marking all accepted writes successful. Remove durable work only for exact acknowledged revisions; edits arriving during upload remain pending.

For backfill, re-read candidate existence/state and inspect any newer durable intent inside the serialized enqueue transaction. Preserve a committed delete, skip absent rows appropriately and ensure keyset progress without manufacturing an intent for a missing row. Do not hold one transaction for the whole dataset or perform network I/O inside it. Cover within-page races for all hard-delete families, not just page-boundary deletion.

### D5. Immutable recovery generations with atomic publication (SH-02)

**Chosen architecture:** Separate immutable published recovery data from mutable staging/outbox transport. Do not solve SH-02 by changing labels, weakening checksums, leaving only an old manifest, or wrapping only local SQLite work in a transaction. New clients use a capability-negotiated generation protocol; legacy readers remain supported for existing backups.

The implementation will add owner-scoped generation storage, bounded generation payload chunks, and an atomically updated head pointer. Suggested logical records are generation metadata (protocol/scope/settings contract and manifest), immutable chunks (owner, snapshot ID, entity, ordinal, canonical payload/checksum), and owner head (snapshot ID plus publication sequence). Exact SQL names/layout can follow existing conventions; their observable semantics are fixed below. Use the canonical ID mechanism for new local entity identities and register new prefixes. A local counter alone cannot allocate globally unique snapshots across two devices using the same owner.

1. Under one local transaction, capture a coherent full recoverable snapshot plus settings, the relevant outbox revisions and local upload identity. Persist enough immutable upload state to resume a killed process. Use a dedicated local operational table if app_meta JSON would create unbounded rewrites; justify any append-only migration from the actual current schema version. No network or AsyncStorage read occurs inside that transaction; stage cross-store settings coherently using the existing durable settings approach. Pending upload state carries its durable owner and participates in ownership and restore-emptiness safety checks as applicable; excluding it from user backup payloads must not make conflicting pending work invisible.
2. Upload bounded chunks for the new generation. Pending content is not a restore candidate. Repeating the same chunk with identical content is idempotent; changing content under an existing immutable identity is rejected. Canonical semantics preserve explicit nulls, tombstones, omitted hard-deleted rows and all recoverable entity relationships.
3. Verify all chunks and their metadata. Publish the generation and advance its owner head in one server database transaction after validating ownership, completeness and expected previous head. Use an owner-authenticated RPC/transaction with narrowly scoped privileges. A request body cannot choose a different owner. Default to invoker security; if stronger privileges prove necessary, document and test every auth/privilege boundary and search_path.
4. A lost publication response can be retried by the same snapshot ID without double publication or pointer regression. Concurrent same-owner publishers use compare-and-swap/serialized head advancement; stale retries cannot roll back a newer head. This remains one-way backup, not dataset merge.
5. After acknowledged publication, remove only captured/acknowledged outbox revisions. Newer local writes remain dirty/pending. Reconcile a kill before local acknowledgement from the durable upload identity and remote published metadata; do not blindly capture a duplicate generation.
6. Restore resolves one published head/generation and fetches data by that immutable identity. Concurrent publication or later edits cannot mix rows/settings across generations. Full structural/reference/checksum validation still precedes atomic local import, with no historical side effects.
7. Retain at least the current and previous complete generation. Failed/staged uploads cannot delete either. For this campaign, automatic production garbage collection is disabled; record a bounded retention/cleanup design and storage measurements, but no automatic purge can be introduced without its own race and rollback proof. Do not promise indefinite retention or silently discard history.

**Protocol migration:** The new contract must be distinguishable from backup schema 2 and must not write generation-specific semantics into a row an old reader will misinterpret. Keep V1/V2/Scope-6/Scope-7/Portable V1 decoders and canonical checksum compatibility. An incompatible/newer protocol produces an explicit refusal, never a best-effort import. If the remote lacks generation capability, upgraded clients retain local outbox work and show upgrade-required/paused backup; they must not silently fall back to overwriting the only certified checkpoint. Valid legacy backups remain restorable. A first-generation cutover must establish an immutable recovery point before destructive mutation of the sole valid legacy recovery data; an already-corrupt legacy checkpoint cannot be relabeled valid.

Old clients may still mutate legacy tables. Their operations must not affect the new immutable namespace. Preserve previous-generation integrity independently of such writers and include old/new-client coexistence in the disposable-backend proof. Do not infer two-way sync or compatibility of old clients with the new publication API.

**Design proof gate:** Before integrating this protocol into AppProviders, implement an isolated thin slice that publishes G1, changes/deletes data and settings for G2, interrupts every upload/publish/ack stage, and restores G1 from another client. Exercise concurrency, tampered chunks and owner-B access. Select chunk budgets from measured payload sizes and documented backend limits; do not use one unbounded JSON RPC for the mature corpus. If this proof fails, correct the design and tests before wider wiring.

Alternatives considered: one giant atomic row upsert/RPC (unbounded payload/transaction and old-writer problems); a client-side double buffer without atomic head publication (races/ambiguity); status-only changes (do not preserve recoverability). Immutable staging plus an atomic head has an explicit failure boundary and keeps restore deterministic.

Primary platform references, recheck before implementation: [PostgREST transactions](https://docs.postgrest.org/en/stable/references/transactions.html), [Supabase database functions](https://supabase.com/docs/guides/database/functions), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). These support the transaction/auth approach, not a claim that a sequence of client requests is atomic.

### D6. Durable user-operation boundaries (SH-04/06/14/15)

For ordinary Todo/Habit completion, reuse/revalidate the successor's durable source-event handoff. Persist stable source identity with the authoritative write, then dispatch after commit. Completion recovery is per historically eligible rule, not per event with any terminal execution. Cover two rules with interruption between them, stale/fresh leases, multiple restarts and effects exactly once. New rules must not fire retroactively; paused/deleted rules must not resurrect. Keep effects/remote work outside the source transaction and avoid nested transaction deadlocks.

For workout drafts, add a distinct pending-save/completed-summary recovery state. Keep entered values, dispositions, identities, cursor/summary and active elapsed time until a committed log ID is known or the user explicitly discards. Save exceptions and nonthrowing skipped writes retain the durable pending state. Successful acknowledgement plus cleanup is idempotent; a kill after log commit but before draft cleanup must reconcile the saved log rather than duplicate it. Upgrade old draft shapes conservatively. Do not mark partial timed/strength work complete merely because recovery lacks a value.

Prefer a composed data-layer Todo/Habit-and-rule save in one transaction, extracting transaction-aware helpers rather than nesting top-level mutation helpers. Validate the entire proposed rule set before writes; enqueue each recoverable change in the same unit. Retain screen draft values and show failure accurately. If existing APIs require durable resumable partial results instead, first record why atomic composition is infeasible and prove stable parent identity across process restart; a transient ref with a newly created ID alone is insufficient.

Revalidate PR #79's atomic reschedule; both schedule overrides and their intents must commit/rollback together. Include same-date no-op semantics, impossible dates, missing/soft-deleted routines and forced second-leg failure. Reuse the coherent fix and regression coverage when present.

### D7. Identity and relationship contracts (SH-09/12/13)

Carry routine-exercise instance identity through timer phases, entered values, grouping, save and history. Use catalog identity as metadata/analytics identity, not as a replacement for repeated instance positions. Distinct entries with the same name or catalog ID stay distinguishable; legacy free-text entries use stable routine instance/position identity with immutable name snapshots, never fuzzy remapping. Check added sets, skipped exercises, duplicate set numbers and old drafts. Repair only data whose identity is provable; report irreversible legacy ambiguity instead of guessing.

Centralize Project/Goal association resolution in the data layer and use it on every create/update/bulk/command/assignment entrypoint. Validate active parents inside the mutation transaction. Assigning a Project-backed Goal aligns the Project. A project-only reassignment or clear that conflicts with an existing Project-backed Goal clears the Goal (matching existing Todo clear semantics); a Goal selection explicitly supplied in the same mutation is authoritative and aligns to its Project. A Goal without a Project does not impose a Project. Preserve specified Goal move/delete and Project delete cascades. Reject missing/soft-deleted parents without changing child or outbox. Add creation payload fields to the Todo editor only after this contract exists.

For already inconsistent data, default to a non-destructive in-transaction repair only where the hierarchy determines the result: validate/repair Goal-to-Project references first, then align a child to an existing active Goal's valid Project; clear a missing/deleted parent reference while retaining the entity and any valid other association. A Goal whose missing Project was cleared no longer imposes a Project on its children. Publish affected backup intents. First prove this policy against fixtures and audit legacy restore semantics; do not silently repair checksummed remote imports before validation or manufacture missing parent rows.

Recurrence inheritance remains outside implementation unless a pre-existing authoritative decision settles it. Record the decision or SPEC_AMBIGUITY separately; do not treat this audit's observed omission as an instruction to redesign series semantics.

### D8. Timer, payment and notification identities (SH-10/11/16/17)

Focus retains its stable session identity/original start for idempotent logging, but stores an independent current running deadline or accumulated active elapsed time. Pause freezes remaining time; resume recomputes the deadline from that remainder. Persist the transition in ordered writes so a late pause save cannot overwrite a newer resume. Reconciliation never counts paused time as focus, and legacy intents retain their supported fallback semantics. Preserve the existing interrupted-session UX: an unfinished recovered timer can be abandoned with its truthful interruption notice rather than introducing a new timer-resume feature. Audit existing ended_at attribution separately from the clock identity to avoid a new regression.

Unify failed-start cleanup of synchronous claims, rendered flags, active intent and scheduled notification ownership. A scheduling rejection must permit a subsequent start. Denied permission/null remains a warning-success path. Repeated starts while the first attempt is still pending must still conflict.

Quest payment uses persisted paid quest IDs, separate from derived eligible/complete flags. Evaluate post-action facts, write payment ledger and XP atomically, and retain unique payment identities across retries, undo/recheck, restart and backdated reconciliation. Preserve the successor's bounded historical reward behavior and the local-only reward boundary; no reward data joins backup/account scope.

Notification host dedupe uses actual delivery/occurrence identity plus action; durable action execution keeps its domain idempotency key. Weekly repeat delivery dates, Todo base versus snooze delivery and rescheduled fire times cannot share a host replay key. A rejected dispatch must not be permanently swallowed by a pre-recorded in-memory key. Test listener/cold-start replay of the same response and two genuinely distinct deliveries.

### D9. PWA and production-path simulation (SH-05/18/19)

Create one post-export revision step shared by production, hermetic E2E, sync and verification exports. Hash a deterministic sorted set of boot-critical output bytes/paths, including index and its relevant asset graph; exclude the generated worker's own revision field to avoid a hash cycle. File mtimes, wall-clock timestamps and randomness do not affect revision. Generate the worker/cache identity from the content manifest; retain isolation headers, offline assets, explicit user update application and cross-tab reload behavior. Export variants must not accidentally ship test worker mutations. Test two actual exports at one persistent isolated origin/profile; synthetic query markers alone do not prove SH-05 fixed.

Make every oracle expectation executable and propagate failed inspection. Replace scenario notes claiming enqueue/retention with predicates on captured IDs/counts/operations/owners; read-only diagnostic oracles must be labeled diagnostic rather than satisfying a correctness requirement. Exercise the runner's dispatch path, including malformed queries and negative expected state.

For API legs, use a typed allowlisted bridge in the hermetic simulation test build that invokes existing production feature data functions after AppProviders readiness on the app's singleton connection. No arbitrary SQL/function import, remote-triggerable action or second SQLite connection. Register through a build-only boundary; ordinary builds must expose no callable bridge, and release guards must reject the test flag. A handler registry maps semantic names to actual data APIs and validated typed args. Preserve production ID/date/validation/sync/event behavior. Raw SQL is allowed only for clearly labeled fixture setup, read oracles and deliberate fault injection, not apiLeg mutation handlers. Migrate current API-leg cases and revise invalid assumptions from shadow SQL without weakening intended invariants.

### D10. Security and cloud isolation (SH-20/21)

Recheck advisory records, registry versions and actual dependency paths on the pinned toolchain. Prefer supported compatible upstream fixes. Inspect PR #57 only as a candidate; it is not an approved framework migration. Any required Expo/RN upgrade needs a written compatibility decision and complete framework/native/export qualification. Do not edit advisory evidence, gate thresholds or allowlists to convert red into green. If no compatible remediation exists, preserve SH-20 as BLOCKED_EXTERNAL and continue other work; release remains blocked.

SH-21 is first a code/configuration-scope classification. EAS account environment inspection, if available, must be read-only and expose only variable names/classification, never secrets. Enforce credential-free builds regardless of defaults: disable dotenv, explicitly neutralize relevant public backend and remote-AI variables, pin the intended environment/test profile and fail closed if unexpected live endpoints reach the artifact. Reuse existing hermetic helpers/guards where possible, verify Android and iOS outputs, and retain the normal release profile's behavior. Do not run a paid/cloud workflow merely to demonstrate the risk. Synthetic malicious ambient env tests plus artifact inspection provide local proof; actual cloud/device qualification stays explicit if unavailable.

## Work Packages and Dependency Order

| Wave | Package / finding IDs                                                        | Dependencies                                     | Exit evidence                                                                                       |
| ---- | ---------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| W0   | Base/provenance and reproduction of all IDs                                  | Planning handoff                                 | Correct worktree/base, baseline failures, per-ID state                                              |
| W1   | SH-18/19 oracle and bridge foundations; SH-21 isolation; SH-20 investigation | W0                                               | Negative oracle failures, real API-path proof, ordinary-build absence, current security disposition |
| W2   | SH-01/03/07/08 ownership and outbox                                          | W0                                               | Real persistence/restart/race matrix; no false terminal blocks                                      |
| W3   | SH-02 immutable generation thin slice, migrations, integration               | W2; W1 for simulation certification              | Old-generation restore under every failure barrier, compatibility and owner isolation               |
| W4   | SH-04/06/14/15 durable composed operations                                   | W2; selected successor review                    | Crash/retry/rollback through actual entrypoints                                                     |
| W5   | SH-09/10/11/12/13/16/17                                                      | W4 for draft/save identities; SH-12 before SH-13 | Cross-surface/restart assertions and stable identities                                              |
| W6   | SH-05 export/upgrade; complete SH-19 migration and composite scenarios       | W1, W3-W5                                        | Two-build PWA proof, all API legs real, combined recovery journeys                                  |
| W7   | Full regression and review packet                                            | All safe local packages                          | Exact-revision evidence; every ID disposition; explicit external/release blocks                     |

W1 and W2 are independent in concept but the default workhorse executes serially. A stalled dependency advisory or unavailable remote device never blocks unrelated local tasks. W3 schema development can proceed locally while deployment authorization remains unavailable. Do not call generation correctness certified from mocks alone.

## Risks / Trade-offs

- [Immutable snapshots cost storage/bandwidth] -> bounded chunks, measured mature-corpus capture/upload, at least two retained generations, explicit cleanup design; no unbounded single-payload transaction.
- [Old writers invalidate legacy tables] -> separate new namespace and protocol-aware restore; no claim of safe fallback to mutable publication.
- [Existing corrupt ownership/association/history] -> detect and document; repair only provable local relationships transactionally, preserve user rows, no speculative relabeling.
- [Nested helpers or long captures block SQLite] -> transaction-aware seams, no network in transaction, queue/revision tests, measured capture cost and UI responsiveness.
- [Transient generation publication errors] -> stable upload identity, retryable idempotency and server-side compare-and-swap; never delete last-good content to retry.
- [New test bridge exposes mutators] -> hermetic build-only registration, typed allowlist and ordinary/release artifact negative checks.
- [Goldens or timing gates mask behavior] -> no blanket baseline refresh, masks, retries or threshold increases; classify each changed expectation with evidence.
- [External qualification unavailable] -> independent local work continues; review packet states the blocker, owner/resource needed and exact resume command; release never silently turns green.

## Migration Plan

1. Inspect the chosen base, current schema contracts and pending migrations; allocate new local/remote versions only then. Never edit applied migrations. Use the Supabase CLI's migration-new command for remote files, with no linked production push.
2. Develop additive generation schema and client capability negotiation against a fresh isolated local/disposable backend. Explicit owner RLS, grants, function execution privileges, composite ownership and indexes join the schema review. Do not treat a mocked Supabase chain as RLS proof.
3. Verify new and legacy decode/import matrices, owner mismatch, Scope-6/7, settings versions and Portable V1 byte-level checksum stability. New operational upload state is excluded from user backup and owner rebinding.
4. Capture/export synthetic old databases and legacy backup fixtures; run upgrade, kill/resume and rollback experiments. Rollback disables new writes/feature capability and leaves immutable generations readable; do not drop uploaded snapshots or rewrite the stored schema version backward.
5. Produce a separate rollout/rollback packet naming migrations, compatibility order, recovery point requirements, old-client behavior, storage limits, manual checks and cleanup. No production application/deployment occurs in this campaign without explicit separate authorization.
6. Release remains blocked until security and required exact-source platform/backend evidence are satisfied. A local implementation-ready state is not an external migration success.

## Deferred Decisions and Evidence Gates

No user-facing requirement choice is delegated to guesswork. Internal chunk layout, new file names, test naming and bounded batch budgets can be chosen within the contracts after measurements. Recurrence inheritance is explicitly deferred outside the confirmed findings. Dependency fix availability, actual cloud configuration and device resources are external facts to recheck, not assumed approvals. If new evidence would change the normative contracts or invalidate this architecture, update proposal/design/specs coherently and record the decision before implementation proceeds on that affected package.
