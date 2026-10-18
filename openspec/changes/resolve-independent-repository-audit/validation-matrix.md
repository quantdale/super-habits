# Regression and review acceptance matrix

## Evidence contract

Give test cases stable labels `AUD-SH01-A`, etc., in titles or evidence mapping. Test filenames below are suggestions; extend suitable existing suites rather than duplicating them. Capture the failure on the affected source before the fix, then the same assertion after it. When the selected successor base is already fixed, prove the regression discriminates the specific missing guard/transaction in an isolated temporary checkout or controlled test mutation. Do not alter the live worktree just to obtain a red result.

For each case record source SHA (or base SHA plus diff identity for uncommitted source), toolchain, command, result, actual test/assertion inventory and artifact paths. For a filesystem artifact also record a content hash. Database evidence must distinguish authoritative feature rows, durable outbox revisions/owners, events/executions, local operational state and remote generation content. Screenshots supplement assertions; they do not substitute for them.

Do not use the simulation platform as decisive evidence until SH-18/19 are repaired. Do not use only domain helpers for screen lifecycle claims. Avoid DB-harness navigation that unmounts the state under test; use an isolated credential-free test seam or controlled fault at the real API boundary. Keep raw fixture setup separate from mutations being validated.

## Finding-specific cases

### SH-01 — Imported ownership (W2)

- **A:** Import a valid owner-A file onto pristine provisional-B device; edit an imported Todo via the actual data API; refresh coordinator and restart. Assert local content saved, source fingerprint unchanged, no B binding, no adopted B-owned intents and no adapter upload under B.
- **B:** Recover verified A and prove coherent durable binding/adoption/backfill. Repeat refresh/restart without duplicate owner promotion or intents.
- **C:** Repeat with protected unrelated B, no Auth session, malformed origin metadata, old owned outbox work and a local-only file without source fingerprint. Fail closed where required; preserve the disclosed local-only adoption case.
- **Required boundary:** portable import + real SQLite mutation + coordinator + adapter gate. Extend account/portable-owner integration suites and an isolated recovery journey.

### SH-02 — Published generations (W3)

- **A:** Publish G1 with every recoverable family, settings and tombstones. For G2 update Todo and settings, hard-delete a saved meal/workout log family and add nested workout/plan data. Kill/fail after each entity/chunk, after settings upload, before/during pointer commit, after commit before response and after response before local ack. A second client restores exactly G1 until G2 is published, then exactly G2; never a mix. Verify rows/references/checksums and semantic equality, not just counts.
- **B:** Concurrent publishers/readers and lost-response retries cannot regress the head, duplicate publication, lose newer outbox revisions or collect the generation a reader is restoring. Retry the identical upload ID/chunk and reject mutated bytes under that ID.
- **C:** Wrong owner cannot inspect, replace, publish or delete A's chunks/head. Incomplete/tampered/future-protocol generations are refused with zero local writes.
- **D:** Valid V1, schema-2 Scope-6/7 and Portable V1 still decode/import as supported; missing generation capability pauses unsafe new publication and preserves old restore. Legacy writers cannot mutate new published data.
- **E:** Kill/reopen source during a mature-corpus upload; durable upload identity resumes. Measure chunk/request sizes, local capture duration, memory and UI responsiveness; no giant transaction/network-in-transaction.
- **Required boundary:** real SQLite plus actual Postgres transaction/RLS against an isolated disposable backend. Mocks supplement fault permutations but do not certify server atomicity. External backend absence remains BLOCKED_EXTERNAL.

### SH-03 — Retry classification (W2)

- **A:** Four or twenty transient failures then one persistent class -> persistent streak one, not blocked. Persistent -> transient -> persistent and changes between persistent classes reset the intended streak. Success clears only that record's streak.
- **B:** Same push contains Todos missing-table, Habits 503 and a successful Calories batch. Only Todos can earn terminal status; Habits retries after healing; Calories is acknowledged once. Assert durable state and in-memory status after restart.
- **C:** Hydrate an old falsely blocked ledger, new edits and healed server under the migration/reprobe policy. Recovery is bounded and visible; permanent poison is not retried forever and rows are not silently dropped. Match the actual adapter missing-local error.
- **Required boundary:** actual adapter error envelope + SyncEngine + persistence, not only a classifier string table.

### SH-04 — Workout draft lifecycle (W4)

- **A:** Enter nonzero load/reps and typed timed/cardio values, complete final phase, reach unsaved summary, reload/kill and resume. Assert all values/dispositions/identity and pending-save summary restored with zero history logs.
- **B:** Force a throwing save and a nonthrowing skipped save from that real summary. Failure retains durable draft and entered values through restart. No XP or success outcome.
- **C:** Commit the log then interrupt before draft cleanup/ack; restart and retry -> exactly one log and one reward, no stale draft resurrection from an older pending write. Explicit discard clears it; ordinary tab/navigation does not accidentally discard.
- **Required boundary:** actual screen lifecycle plus durable data API and rendered restart journey. Existing data-only B2 is a control, not adequate closure.

### SH-05 — PWA upgrade (W6)

- **A:** Build shell A, install/visit in an isolated persistent browser profile, then serve actual build B at the same origin with changed source/asset bytes. Assert changed generated worker revision, update banner, explicit apply, correct new content and intact SQLite data.
- **B:** Network unavailable after apply -> B boots with all critical assets. Other tab does not reload unless required by the existing explicit-apply contract. Interrupted worker install leaves A usable. Keep COOP/COEP and OPFS behavior.
- **C:** Identical content yields identical revision; changing a critical asset/index yields a different revision; production export, build:e2e, sync and web:verify all execute the revision step. No test-only SW bypass is shipped to ordinary builds.
- **Required boundary:** real two-build browser worker lifecycle, beyond VM cache tests and synthetic server marker changes.

### SH-06 — Linked Action handoff/recovery (W4)

- **A:** Complete Todo/Habit with a matching rule; interrupt immediately after source commit before dispatch. Reopen DB/bootstrap -> stable source event exists and intended effect executes once.
- **B:** Two or more rules: interrupt after rule A terminal and before B; recover B without reapplying A. Repeat failures, fresh versus stale leases, duplicate startup sweeps, no-rule events and multiple app restarts.
- **C:** Newer-authored rules do not run retroactively; paused/deleted rules do not resurrect. Validate increment/ensure-target/todo-complete/created log effects and their durable outbox counts, keeping existing notification-origin guarantees.
- **Required boundary:** real source transaction, event/execution tables, recovery startup wiring and actual effect APIs. Revalidate PR #80's multi-rule matrix and independent caller entrypoints.

### SH-07 — Backfill races (W2)

- **A:** A deterministic barrier after SELECT but before enqueue commits a saved-meal delete. Assert durable delete remains or an equivalent correct deletion result, remote absence after drain, no stale create/missing-local poison and valid new checkpoint.
- **B:** Repeat for habit-completion count-to-zero and workout log/exercise/set hard-delete family, plus edits/soft-deletes and deletion between keyset pages. Verify no skipped surviving rows or rewritten newer revisions.
- **Required boundary:** real serialized SQLite transactions and outbox; no sleep-based race reproduction.

### SH-08 — Response caps (W2)

- **A:** 0, 1, exactly-cap, cap+1, 1,001 and 5,000 same-entity intents; exercise server caps 100 and 1,000 plus realistic long IDs. All accepted data verifies and drains without unbounded URL/parameter/body sizes.
- **B:** Omit one genuine ID or fail one verification page; preserve correct retry/removal semantics and diagnostics. A newer same-ID write during verification survives acknowledgement of the earlier revision.
- **Required boundary:** actual adapter and engine with realistic paginated fake API; confirm relevant behavior against disposable PostgREST when available. Never remove read-back verification to pass.

### SH-09 — Exercise identity (W5)

- **A:** Two custom exercises with identical names but distinct IDs/modalities; also two occurrences of one catalog exercise in a routine. Complete/skip/add sets, save, reload history. Assert distinct instance groups, correct metadata and noncolliding set positions.
- **B:** Old free-text routines/drafts/history still work without invented catalog mapping. Analytics/progression select correct catalog identity; units/effort/timed values are unchanged.
- **Required boundary:** timer sequence -> screen-entered values -> log payload -> actual persisted/history rows, not only grouping output.

### SH-10 — Paused Focus recovery (W5)

- **A:** 01:00 start25, run5, pause20, resume01:25, kill01:26 -> unfinished with 19 minutes of active countdown unperformed, not complete-unlogged. Preserve the documented interrupted/abandoned-session UX instead of adding post-kill timer resumption. Repeat several pause/resume cycles and kill while paused.
- **B:** Cross the real active-time completion boundary, restart/reconcile twice -> one accurate session and reward. Preserve original session identity, associations/notes and duration.
- **C:** Delayed/out-of-order intent writes, legacy intents, midnight and timezone transitions follow documented policy; clock adjustment must not manufacture completed active time. Exercise actual screen persistence/reconcile wiring.

### SH-11 — Focus startup claims (W5)

- **A:** Scheduler rejects first attempt -> all claims idle, no orphan intent/alert, next Start succeeds. Repeat through command bridge and UI.
- **B:** Denied permission/null is warning-success; web unsupported is success; two starts while scheduling unresolved conflict and create one session. Failure cleanup does not cancel a later attempt's notification.
- **Required boundary:** actual screen start/recovery callback and existing startup helper together.

### SH-12 — Authoritative associations (W5)

- **A:** Every Todo/Habit/Goal create/update/bulk/command association entrypoint rejects missing/soft-deleted parents with unchanged child/outbox. Assign a Project-backed Goal and verify aligned Project.
- **B:** Project-only move/clear clears conflicting Goal; explicit Goal selection in the same call aligns Project. Goal move/delete and Project soft-delete preserve documented cascades; Goal without a Project permits an independent valid Project.
- **C:** Concurrent parent delete, repeated mutation, old inconsistent rows and repair restart have deterministic non-destructive outcomes and exactly the necessary backup intents. A malformed remote reference still fails validate-before-import, rather than being silently repaired during restore.
- **Required boundary:** real-SQLite data APIs plus cross-surface/recovery assertions.

### SH-13 — Todo creation selections (W5)

- **A:** Create through the actual dialog with both associations; inspect persisted IDs and Project/Goal membership after reload. Goal-backed Project alignment matches SH-12.
- **B:** Cancel/reset/new-task and edit flows do not leak prior selection or drop valid choices. Failure retains typed values and displays the actual reason.
- **Required boundary:** rendered dialog to real data API. A standalone payload mock is supplemental only.

### SH-14 — Composed parent/rule saves (W4)

- **A:** Fail rule 1 and a later rule after parent write; assert atomic rollback or the explicitly designed durable partial result. Retrying twice and restarting yields exactly one parent and intended rule set, with correct outbox records.
- **B:** Existing-parent edit with failed rules preserves the specified whole-save contract; double submit, target soft-delete and invalid rule rows cannot leave half replacement or duplicate parent. Confirm both Todo and Habit UI draft/error behavior.
- **Required boundary:** actual composed transaction and screen onSave/submit path with real SQLite faults, not solely one mocked helper throwing.

### SH-15 — Atomic workout move (W4)

- **A:** Fail destination insert/update after source override runs; both source/destination and outbox revert. Missing/deleted routine has the same atomic outcome.
- **B:** Same-day move, valid different-day move, invalid calendar date and repeated move preserve intended schedule/metadata and one coherent set of intents. Revalidate the PR #79 implementation if already present.

### SH-16 — Quest payment (W5)

- **A:** On a deterministic date selecting plan_today, commit then award via real pipeline -> action8 + quest15 XP (subject only to the existing defined streak multiplier for action XP), exactly one quest row/event. Repeat canonical post-write facts for other non-XP metrics.
- **B:** XP-hunter, replay, undo/recheck, restart, backdated source action, rollover and concurrent awards pay once; quest bonus does not recursively satisfy itself. Keep local-only reward tables excluded from backup/owner scope.
- **Required boundary:** real action/canonical facts/award transaction; do not manually force complete=false to obtain eligibility.

### SH-17 — Reminder occurrence dedupe (W5)

- **A:** Two weekly deliveries with the same request ID/action and different delivery dates -> two opens. Replaying one via listener+cold-start -> one handling.
- **B:** Todo reschedule, base/snooze and repeat snooze distinguish deliveries while repeated Mark Done/Complete business effects remain idempotent. Dispatch exception allows the defined retry and does not poison a future distinct delivery.
- **Required boundary:** actual host queue and dispatcher/action persistence. Native delivery is a separate qualification gate, not inferred from injection tests.

### SH-18 — Oracle integrity (W1)

- **A:** Attached expected nonempty versus actual [] fails; malformed/failed query fails both attached and standalone invocation. Exercise runner result/final exit status, not only evaluator return values.
- **B:** Correct expected state passes; dynamic-ID enqueue/retention scenario captures IDs and asserts exact relevant records. Unspecified diagnostic reads cannot satisfy correctness claims by prose.

### SH-19 — API-leg fidelity (W1/W6)

- **A:** Every supported semantic mutation calls its actual feature API. Verify canonical IDs, null notes, validation rejection, local dates, outbox owners/revisions and relevant Linked Actions/rewards against comparable UI behavior.
- **B:** Ordinary/release builds expose no callable bridge; missing readiness, unknown operation, malformed args and raw SQL are rejected. Real APIs share the app singleton and respect OPFS single-writer lifecycle.
- **C:** Run the entire deterministic scenario library after migrating handlers. Fix assumptions introduced by shadow SQL with explicit before/after row evidence; preserve real product invariants. Raw fixture seeds remain clearly labeled and do not claim API fidelity.

### SH-20 — Dependency gate (W0/W1/W7)

- **A:** On the pinned toolchain record current advisory JSON, package paths, registry/advisory dates and the actual gate exit. Compare supported compatible fixes; independently inspect any larger framework candidate.
- **B:** After remediation, clean install, audit gate and relevant framework/export/native tests pass without weakening policy. If no compatible patch exists, record exact dependency/advisory and unblock condition as BLOCKED_EXTERNAL; skipped downstream CI is not a pass.

### SH-21 — Cloud isolation (W1/W7)

- **A:** Supply synthetic live-looking URL/key/remote-AI values through ambient and EAS-like environment sources. The exact build-profile path strips/refuses them and disables dotenv. Do not print secret values.
- **B:** Inspect credential-free Android/iOS artifacts/configuration for unexpected backend host exposure and prove no real service contact in tests. Ordinary release profiles retain their intended production configuration.
- **C:** If authorized/cloud resources exist, execute the exact-source cloud/device lane; otherwise retain the precise external certification gap. Account variables being empty today alone does not prove the workflow enforces isolation.

## Composite journeys

1. **Imported ownership + offline changes + backup:** A import under B, local edits while offline, reconnect with B, recover A, generation publication, empty-device restore. No B ownership/upload at any point; restored canonical state matches committed changes.
2. **Interrupted publication + concurrent change:** G1 -> update/delete/settings -> interrupted G2 -> source restart plus newer local edit -> restore from another client -> finish upload/recapture. Prove previous-point availability and newer-revision survival together.
3. **Unsaved workout + duplicate names + save retry:** Enter distinct typed exercise values, reach summary, fail save, restart, save once, publish and restore. Identities, active duration, sets, log count and reward count remain correct.
4. **Completion + multiple rules + interruption:** Complete source, kill across each rule boundary, recover, publish and restore authoritative effects without replaying historical side effects during import.
5. **Focus + notification + reload:** Fail first start, start again, pause/resume across nominal deadline, deliver distinct/replayed reminders, restart at completion. Count actual sessions, XP and action outcomes.

## Commands and escalation

Use qa/impact-map.json and docs/testing/autonomous-qa.md against the actual campaign base, not a blanket diff against an unrelated main tip. Confirm command names against current package.json before execution. Start cheap per package; do not run every full suite after each tiny edit.

```text
npm run qa:fast
npm run qa:affected -- --base <actual-implementation-base>
npm run qa:integration
npm run qa:timezones
npm run build:e2e
npm run e2e:journeys:p0
npm run qa:simulation -- --all --mode deterministic
npm run qa:full
node scripts/audit-runtime-deps.mjs
npm run agent:plan:validate -- --plan openspec/changes/resolve-independent-repository-audit/execplan.md
npm run web:hygiene
```

Run focused Vitest/Playwright tests during each package. Final broad gates include the entire Vitest suite, full Playwright projects including PWA/visual, deterministic library and timezone matrix because shared persistence, timers, exports and test infrastructure change. Preserve visual goldens unless actual intended visual changes are evidenced; this campaign is not a redesign. Run backup schema checks and OpenSpec validation. Extend qa/impact-map.json for any new shared seam.

Use only hermetic build:e2e for browser tests; never plain build:web with local dotenv. Follow the existing guard's instructions when ambient variables cause rejection, and remove variables only from the owned child-process environment. A sync/disposable lane requires dummy or guarded disposable configuration. Never point exploratory/test writes at the production project.

Native-sensitive packages require Android smoke, persistence and lifecycle/notification-path coverage on current source, plus iOS where available. Native provisioning can install/clear an application: select a campaign-owned emulator/simulator and never disturb a foreign target. Cloud dispatch/paid resources are not implicit authorization. Unavailable platform evidence remains ENVIRONMENT/BLOCKED_EXTERNAL and cannot close that gate.

## Review packet required at handoff

Produce a committed-or-uncommitted but complete reviewable branch/worktree and `resolution-report.md` in this change. Include:

- Actual audit baseline, implementation base, current main merge-base, final code SHA/diff hash, stack dependencies, worktree, toolchain and lockfile identity.
- A 21-row finding disposition table: severity/confidence, before reproduction, source/root cause, implementing/reused commits, test case IDs, exact command/result/artifact, residual risk and external condition.
- For ALREADY_FIXED_VERIFIED, identify the source commit and prove the regression is meaningful; do not claim the campaign authored the inherited change.
- For IMPLEMENTED_NOT_CERTIFIED or BLOCKED_EXTERNAL, name the failed/missing gate, resources/authorization needed and exact next action. Disproved findings require counterevidence, not inability to reproduce.
- A separate status for local implementation, deterministic verification, real backend qualification, Android, iOS, security, deployment and release. No green composite status conceals a red required gate.
- Design/protocol/migration decisions, compatibility matrix, additive migration list, rollback and recovery notes, data-repair behavior and source/diff review instructions.
- Original failures/flaky runs and their classification; every skip/quarantine with reason. Counts are inventories, not sufficient proof.
- Known limitations, recurrence intent disposition, untouched unrelated paths and clean server/process hygiene. State explicitly that no independent reviewer has yet accepted this work.

Do not pre-fill a successful resolution-report.md in planning. Do not archive this change or mark its ExecPlan COMPLETED while required work/evidence remains. When all possible local work is reviewable but essential external proof is unavailable, leave remaining tasks open and the appropriate resumable campaign state. The owner will request the independent review separately.
