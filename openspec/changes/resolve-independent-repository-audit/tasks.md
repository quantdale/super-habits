## 0. W0 — Reconcile source, preserve work and establish the execution base

- [x] Read START-HERE.md, the ExecPlan, audit baseline, design, validation matrix and delta specs; inspect AGENTS.md, the pause handoff, current main/PR #79/PR #80 ancestry and all affected dirty worktrees. Record exact current state without changing existing work.
- [x] Create the dedicated implementation branch/worktree using design D1, transfer only this planning folder if necessary, and record implementation base, main merge-base, worktree and inherited stack dependencies in execplan.md.
- [x] Select the pinned Node/npm toolchain and record versions; install from the existing lockfile only if necessary in the owned implementation worktree, preserving any original install/provision failures.
- [x] Establish qa:fast, applicable integration, current security-gate and OpenSpec baselines; classify failures before changing them and inspect qa:affected against the actual implementation base.
- [x] Reconcile the seeded 21-row live disposition table in execplan.md and identify reused candidate commits/tests for SH-06 and SH-15. Extend rows with execution evidence; keep audit confidence separate from the current implementation status.
- [x] Reproduce ownership/outbox/backup failures SH-01/02/03/07/08 on the selected base with captured source and deterministic barriers; mark an inherited fix verified only after the corresponding matrix controls pass.
- [x] Reproduce the actual screen/data boundaries for SH-04/09/10/11/12/13/14/16/17; preserve negative results and note changed source rather than editing tests to fit a claim.
- [x] Reproduce SH-05/18/19, classify SH-21 from code/configuration evidence, and record SH-20's current graph/advisories; do not contact production or trigger cloud jobs.
- [x] Record the recurrence inheritance requirement question as excluded/SPEC_AMBIGUITY unless authoritative product evidence settles it; update the checkpoint with the first actual implementation subtask.

## 1. W1 — Make validation faithful and test builds isolated

- [x] Add negative executor tests AUD-SH18-A/B that fail for ignored attached expectations and swallowed standalone inspection failure, including scenario/final-result propagation.
- [x] Enforce attached/standalone oracle expectations and failure propagation; replace correctness claims based on unspecified outbox reads with captured-ID/state assertions, retaining clearly labeled diagnostics separately.
- [x] Run the affected oracle/runner tests and existing scenarios; preserve any newly exposed product failures as failures rather than weakening expectations.
- [x] Inventory all semantic API-leg operations and their exact production data API/argument mappings, side effects and readiness needs; record the mapping with no handwritten mutation SQL handler remaining unaccounted for.
- [x] Add the hermetic build-only typed invocation seam, app-readiness check and allowlist rejection tests; prove ordinary/release builds cannot expose callable mutation access and update release guards/QA impact rules.
- [x] Migrate Todo/Habit API-leg operations to production data functions and prove canonical IDs, nulls, validation, outbox and relevant linked effects against the real SQLite app path.
- [x] Migrate the existing Calories/Workout API-leg operations and their typed argument/return contracts, preserving their actual mutation and backup behavior.
- [x] Migrate remaining supported planning/Focus/other semantic operations after inventory; distinguish fixture setup and fault injection from API execution, and update misleading simulation documentation.
- [x] Run AUD-SH19-A/B and affected scenarios against the hermetic export without a second SQLite connection; record/fix shadow-SQL assumptions without relaxing intended invariants.
- [x] Inspect the exact EAS build-profile/environment merge and local/iOS isolation controls for SH-21. Record confirmed affected paths, counterevidence and any unavailable account-side evidence without printing values.
- [x] Enforce dotenv/backend/remote-AI isolation consistently for Android and iOS cloud test builds using existing hermetic patterns; retain ordinary release behavior.
- [x] Add hostile synthetic-environment tests and artifact/configuration isolation checks for AUD-SH21-A/B; record any real cloud/device qualification separately rather than triggering paid runs by default.
- [ ] 1.13 Investigate current compatible advisory fixes and PR #57's relevant dependency paths; apply only a supported justified remediation with lockfile evidence, or leave a precise SH-20 external blocker and continue other packages.

## 2. W2 — Protect ownership and reliable pending backup work

- [x] Add real import/edit/coordinator/restart regressions for AUD-SH01-A/B/C, including an unrelated provisional session and a local-only source control.
- [x] Enforce the imported-origin precondition on every binding/adoption/promotion path and recheck at durable commit; preserve local writes and already-owned outbox identities.
- [x] Verify actual adapter gating, matching-source recovery and a credential-free owner-recovery journey; document disposition and affected entrypoints for SH-01.
- [x] Replace aggregate-only failure evidence with structured per-entity/per-record adapter results while preserving partial-success acknowledgement and safe diagnostic codes.
- [x] Correct persistent streak resets and actual missing-local classification; add AUD-SH03-A/B through actual adapter/engine/persistence, including mixed successful/persistent/transient entities.
- [x] Implement and verify a bounded old-ledger repair/reprobe policy plus hydrate/revision/new-edit tests AUD-SH03-C; retain terminal diagnostics and prevent poison loops or silent loss.
- [x] Bound write/read-back requests and paginate verification without disabling missing-row detection; prove AUD-SH08-A/B including lower caps, long IDs and edits arriving during acknowledgement.
- [x] Add deterministic within-batch backfill race tests AUD-SH07-A/B against real SQLite for saved meals, completions, nested workout deletion and soft-delete/edit controls.
- [x] Reconcile candidate state and newer intent inside the backfill enqueue transaction, retain bounded keyset progress, and prove complete drain/remote deletion without stale creation work.
- [x] Run affected ownership/sync/backfill suites, broad integration and supported fake-backed recovery journeys; checkpoint SH-01/03/07/08 before starting the publication protocol.

## 3. W3 — Preserve immutable published recovery generations

- [x] Turn design D5 into a concrete protocol/schema decision record: owner/snapshot identity, chunks, canonical manifest, publication head/conflict contract, capability negotiation, limits, retained generations and old-client behavior. Verify it satisfies the normative spec without weakening legacy guarantees.
- [ ] 3.2 Implement isolated generation schema and owner RLS/grants with append-only remote migration files created through the CLI; validate privilege/ownership/refusal cases against a fresh local/disposable backend, never the linked production project.
- [x] Implement the atomic idempotent publication operation with owner checks and expected-head conflict handling; prove lost-response retry, immutable-chunk replacement refusal and pointer rollback prevention.
- [ ] 3.4 Pass the thin-slice gate before app wiring: publish G1, stage changed/deleted entities and settings for G2, fail every boundary and restore G1 from a second client. Preserve the failed proof if any part remains incorrect.
- [x] Implement durable coherent local capture/upload identity and bounded payload staging; allocate an append-only local migration only if needed on the actual base, and prove capture rollback/reopen behavior with no network inside SQLite transactions.
- [x] Implement bounded idempotent chunk upload/verification and retry resumption from persisted upload state; record actual bytes/request budgets and cancellation/failure behavior.
- [x] Integrate owner-gated maintenance, head acknowledgement and exact captured-revision removal with the outbox; newer local mutations remain pending and no infinite dirty/publication loop occurs.
- [x] Implement generation-pinned read/restore while retaining full pre-import validation, atomic emptiness checks, pending theme reconciliation and side-effect suppression.
- [x] Implement safe capability-missing/upgrade-required behavior and first-generation legacy cutover; retain supported V1/V2/Scope-6/Scope-7/Portable V1 readers and refuse future protocols explicitly.
- [x] Prove concurrent same-owner publishers, another-owner access, publication during restore and old-client mutable writes cannot corrupt a retained generation; cover lost acknowledgements and kill-before-local-cleanup.
- [x] Verify retention safety with current/previous generation and active readers; keep automatic production garbage collection disabled and document staged/orphan cleanup and rollback boundaries.
- [ ] 3.12 Run AUD-SH02-A through E plus the mature-corpus performance/capture/upload measurements and schema validators. If real backend evidence is unavailable, retain that gate as blocked and continue independent local work.
- [x] Produce an additive migration/capability rollout and rollback packet with required recovery point, compatibility order, old-client behavior and exact external verification commands; do not apply it to production.

## 4. W4 — Close durable completion and composed-save boundaries

- [x] Revalidate the selected successor's SH-06 handoff/recovery source and tests; identify whether the full multi-rule correction and startup wiring are present before changing anything.
- [x] Add or port the atomic source-event handoff for every ordinary Todo/Habit completion entrypoint, preserving notification-origin contracts and transaction-aware seams.
- [x] Prove AUD-SH06-A/B/C across multiple eligible rules, crash points, historical eligibility, leases, repeated restart and each supported effect's exactly-once durable/outbox behavior.
- [x] Add a durable completed-summary/pending-save workout state and compatible old-draft normalization; reaching isComplete must retain user-entered recovery data.
- [x] Couple workout save acknowledgement to stable log identity and idempotent cleanup; throwing/skipped saves retain drafts, while kill-after-commit cannot duplicate logs/rewards or resurrect an older draft.
- [x] Prove AUD-SH04-A/B/C through actual rendered orchestration and restart, keeping existing data-only controls and covering measured/skipped/typed sets.
- [x] Implement transaction-aware composed Todo/rule saving with prevalidation, atomic intents and stable outcomes; test failures after parent and later rule writes without nested-transaction deadlocks.
- [x] Apply the equivalent composed contract to Habit creation/edit and wire both actual editors to retain drafts/errors and prevent duplicate retries or partially replaced rules.
- [x] Prove AUD-SH14-A/B through real persistence faults, double-submit and restart; an inline error alone cannot check off this task.
- [x] Revalidate or port PR #79's atomic reschedule and prove AUD-SH15-A/B for source/destination/outbox rollback, same-day semantics and calendar validation.
- [x] Run applicable linked-action/workout/Todo/Habit integration and user journeys; checkpoint reused versus newly authored fixes and unresolved external gates.

## 5. W5 — Preserve identity, association, timing and reward semantics

- [x] Carry stable routine-exercise instance identity through phases, entered sets, grouping and saved payloads; preserve distinct same-name/same-catalog entries and legacy free-text snapshots.
- [x] Verify draft/history/analytics/progression compatibility with added/skipped sets and repeated instance positions using AUD-SH09-A/B; report unprovable historical identity rather than inventing it.
- [x] Centralize transactional association resolution and use it for Todo/Habit/Goal create/update/bulk/command/assignment entrypoints; enforce the documented project-only versus explicit-goal policy.
- [x] Verify missing/deleted-parent refusal, move/delete cascades and concurrent-parent changes through AUD-SH12-A/B, including unchanged outbox on refusal.
- [x] Implement the documented non-destructive policy for provably inconsistent existing local associations with synced repair intents; test idempotent restart and strict remote import validation using AUD-SH12-C.
- [x] Pass selected Project/Goal fields through new Todo creation and prove real-dialog create/edit/cancel/reset/reload membership with AUD-SH13-A/B.
- [x] Persist Focus running countdown deadline/active time independently of stable session identity, with ordered pause/resume writes and compatible legacy intents.
- [x] Prove AUD-SH10-A/B/C through actual screen persistence/reconciliation, repeated pauses, stale writes, midnight/clock policy and exactly-once completion/metadata/reward.
- [x] Release all synchronous/rendered/durable startup claims on rejected Focus start and prove AUD-SH11-A/B via UI and command bridge without changing denied-permission/web success semantics.
- [x] Separate paid quest identity from derived eligibility and atomically award quest rows/events/XP using post-action canonical facts; retain local-only and successor historical-attribution behavior.
- [x] Prove AUD-SH16-A/B for plan/non-XP quests, XP-hunter, concurrency/replay/undo/restart/backdating without manually forcing pre-action completion flags.
- [x] Correct host delivery fingerprinting/retry behavior while retaining durable business-action idempotency; include weekly repetition, Todo rescheduling and repeated snooze.
- [x] Prove AUD-SH17-A/B through actual host queue/dispatcher/action persistence, then record native notification delivery qualification separately.
- [x] Run affected integration/UI suites and the five-zone timezone matrix; checkpoint identity/relationship/time compatibility and all finding dispositions.

## 6. W6 — Complete delivery and integrated production-path proof

- [x] Add the shared deterministic post-export content manifest/revision step and wire every production/hermetic/sync/verification export path without worker hash cycles or shipped test transformations.
- [x] Prove content determinism/change sensitivity and preserve precache/install failure, explicit update apply, cross-tab behavior and isolation headers.
- [x] Run AUD-SH05-A/B/C using two actual builds at one isolated persistent origin/profile, including offline boot and unchanged SQLite data; do not substitute synthetic worker markers for this proof.
- [x] Complete API-leg migration coverage and run the full deterministic scenario library under repaired oracle semantics; document every changed fixture expectation with production row evidence.
- [x] Execute the imported-ownership/offline/backup/restore composite journey and record canonical state plus absence of B-owned upload.
- [x] Execute interrupted-publication/concurrent-edit/second-client restore across actual generation storage, including newer revision survival and acknowledged head identity.
- [x] Execute unsaved same-name typed workout/failure/restart/save/backup/restore with exact history, identity, active duration and reward counts.
- [x] Execute completion/multi-rule interruption and Focus/notification/reload composites with exact source/effect/session/reward assertions.
- [x] Update affected architecture/backup/runtime documentation and qa/impact-map.json to describe actual contracts and qualification gaps without changing unrelated historical reports or primary style direction.

## 7. W7 — Validate the candidate and prepare independent review

- [x] Reconcile all 21 dispositions with source and case evidence; leave external or unverified requirements open and explain disproved/conditional findings precisely.
- [x] Run pinned-toolchain typecheck/lint/full Vitest and applicable schema/OpenSpec/plan/impact validation; preserve initial failures and exact test inventory, not just totals.
- [x] Build the hermetic current source and run the full Playwright projects including PWA/visual, full deterministic simulations and required timezone matrix. Do not mask regressions through blanket goldens, skips, threshold changes or retry assembly.
- [ ] 7.4 Run guarded disposable-backend generation/owner/compatibility certification when authorized resources are available; otherwise retain the specific external gate, evidence and exact resume command.
- [ ] 7.5 Qualify Android smoke/persistence/lifecycle/notification paths and iOS equivalents on campaign-owned current-source targets when available; keep unavailable/deferred results explicit and avoid foreign devices or unapproved paid workflows.
- [ ] 7.6 Re-run the dependency security gate and verify genuine remediation on the final graph; if still blocked, retain the release block and exact upstream/governance condition with no waiver by implication.
- [x] Write resolution-report.md containing the full review packet required by validation-matrix.md, including source/base/diff provenance, each regression case, migrations/rollback, skipped/external evidence, and separate engineering/platform/security/release dispositions.
- [x] Review the actual complete campaign diff and inherited stack for unintentional changes, preserve unrelated paths, stop only owned servers and run web:hygiene; record final Git/process state.
- [x] Validate the reconciled ExecPlan and choose its honest lifecycle state. Mark COMPLETED only if all required work/evidence is satisfied; otherwise keep open tasks and an exact resumable state for blocked external requirements. Do not archive or claim independent acceptance before the owner's separate review.
