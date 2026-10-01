## Context

See [proposal.md](proposal.md) for motivation and [exploration.md](exploration.md) for the read-only investigation. The input brief is `D:\Downloads\superhabits.md`, SHA-256 `2bdfd5f1a5f745943b20dfb86b8950d474d06c1a6f102a849bc7d9a463c4471a`. This is a **proposal**, not execution of that campaign.

Exploration began on `main` == `origin/main` at `210afd39a99e2b2dbf5026b58a1191182e05f368`. CI `36824132137` is completed success on that exact SHA, with quality/e2e successful, nightly expected skipped, no strict retry-dependent passes, and deterministic 23/23. The canonical change is 14/22; native hardening is 25/26. Nine changes are present locally, including seven untracked prior planning directories. Foreign stash object `c35e281d740df1e367c1be0f38383237ca080239` (`pre-recovery-local-changes`) and the iOS extract must remain intact.

The durable full-QA record is at `c2ec475`, while native artifacts are at `68db684d0915d8cd781d52b282a3934ca214171b`. Relevant runtime/config/flow source diffs to the current head are empty, but these are still historical command identities. Native artifacts prove provisioning PASS, smoke 1/2, persistence 11/11, lifecycle 6/6 on the same API-36 x86_64 APK; the report's raw `PRODUCT_BUG` label differs from later `TEST_BUG` triage. Canonical reporting has not caught up.

## Goals / Non-Goals

**Goals:**

- Preserve one canonical 22-task ledger while finishing the actual local residuals and making every status evidence-traceable.
- Separate repository review, Android qualification, read-only production inspection, and overall release certification so an external blocker cannot stall independent work.
- Preserve default-off AI and iOS behavior while correcting an ordinary-Android test/profile mismatch.
- Finish with truthful published evidence, final-tip CI, port hygiene, and exact external resume actions.

**Non-Goals:**

- Broad repository redesign/audit, feature expansion, new dependencies, broad test refactoring, or an unearned local schema migration.
- Any iOS execution, certification, iOS-specific edit, or shared-flow change that changes the iOS command sequence/assertions.
- Production data deletion, inferred DDL authority, enabled anonymous production auth, paid AI, signing changes, store submission, release tag, destructive Git operations, or foreign state cleanup.
- Executing campaign tasks while only this proposal is requested.

## Decisions

### 1. A linked successor, not a second canonical ledger

This change owns the bounded execution checklist and review evidence. `final-certification-closure/tasks.md` continues to own the 22 canonical dispositions; its current ExecPlan/report are reconciled during apply. A reviewed new Android result also reconciles native hardening's task 5.3/current checkpoint, leaving its dated validation history intact. Completed historical campaign plans are evidence sources, not rewrite targets.

Alternative: rewrite or restart `external-blocker-closure`. Rejected: its checked tasks describe earlier investigations and its archive predicate is still unmet. Alternative: create a second copy of all 22 tasks. Rejected: duplicate status stores drift.

Planning uses the ordinary branch-per-task workflow (`docs/windows-closure-proposal`). Later canonical implementation returns to the then-current `main` baseline, with fast-forward-only commits/pushes. Evidence-only native worktrees are clean checkouts of the exact committed candidate, not independent product branches or exemptions from provenance.

### 2. Evidence reconciliation precedes new fixes

Re-fetch and inspect refs, changes, stash/worktrees, current CI, and post-handoff work before apply. Read `tasks.md`, current checkpoints, raw artifacts, and the accepted registers. Record historical/source/applicability separately from current outcome.

| Canonical task | Planning-time posture, subject to re-verification           | Apply treatment                                                                                         |
| -------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 2.1            | Catalog SQL credential blocked                              | Read-only if credential exists; otherwise `CREDENTIAL / EXTERNAL` with queries.                         |
| 2.2 (checked)  | Recovery point proved absent at the recorded observation    | Keep investigated/`PROVEN_FAIL`; never interpret checkbox as recovery green.                            |
| 2.4            | Recovery absent; four-file contract; old grant covers three | Remain blocked until every prerequisite actually exists.                                                |
| 3.2, 3.3       | Owner-deferred iOS                                          | Leave unchecked with `DEFERRED_BY_OWNER / ENVIRONMENT`; preserve evidence and no active iOS monitoring. |
| 4.3            | Already labeled `NOT_TRIGGERED`, active delta contradictory | Preserve unchecked conditional disposition and reconcile the delta/report to the accepted chronology.   |
| 4.4 (checked)  | Later full-QA pass supersedes earlier deferral              | Corroborate and record source applicability; refresh if affected changes invalidate it.                 |
| 5.1 (checked)  | Android ran, one smoke flow red                             | Record actual 1/2, 11/11, 6/6; do not misread completed investigation as all-green certification.       |
| 6.1            | Actual local review still required                          | Execute independent repository review, with live facts explicitly blocked if unavailable.               |
| 6.2            | Exact-head green already verified at 210afd3                | Close for the relevant baseline, then require new CI for the actual final pushed tip.                   |
| 6.4            | Canonical report materially stale                           | Replace current narrative and publish final post-CI attestation.                                        |

Inspect all other tasks too; the table is not permission to skip them. Expected bookkeeping after local targets close is **17/22 checked**, with 2.1/2.4 blocked, 3.2/3.3 deferred, 4.3 non-triggered. That is a forecast, not a quota: actual credential, evidence, or regression changes determine the count. Native hardening becomes 26/26 only if its complete smoke requirement is proven.

Alternative: mechanically check every residual. Rejected: conditional/deferred/failure dispositions are not passes.

### 3. Amend the J8 record precisely, not the performance contract

Preserve the 878 ms sample as a failed historical result, classified by evidence as a host-load excursion. Link the measurement-start root cause, `waitForSectionTransitionsSettled`, accepted post-fix 622/800 ms and per-switch samples, and source applicability. CG-4/CG-5/gap 15 stay CLOSED; the 800 ms ceiling, 15% floor, 500 ms diary budget, fixtures and assertions remain untouched.

During apply, amend `final-certification-closure/specs/release-candidate-closure/spec.md`'s requirement **The preserved J8 miss is not closed by moving the ceiling** to distinguish the historical failure from the current conditional posture. It currently demands a future rerun while its own proposal/tasks allow accepted root-cause evidence. This successor explicitly supplies the scoped chronology amendment; do not leave opposing active normative records. The historical sample does not become PASS.

A credible new reproducible app-owned breach triggers 4.3 and a narrow fix/qualification. Otherwise there is no fresh optimization campaign or expensive J8 rerun for ceremony. Uncorroborated applicability requires further evidence, not convenient closure.

### 4. Repair Android's test/profile seam without exposing AI

Investigate the failed command, screenshot/hierarchy, current `CommandScreen` early return, `commandSurface`, Ask provider gate, release-profile guard, EAS/hermetic flags, and capability specs together. Preserve raw smoke output and attach a reviewed triage record explaining raw `PRODUCT_BUG` versus evidence-supported `TEST_BUG`. Test-only classification does not imply a pass.

Preferred correction: replace the unconditional `tapOn: Create` with platform-aware flow behavior. The iOS path retains that exact command and all other existing semantics. Android instead asserts the ordinary Create input and absence of Ask/Auto, then continues all existing parse/review/confirmation assertions. Confirm the supported Maestro conditional syntax before editing. If a shared file cannot preserve the iOS sequence exactly, use an Android-specific flow selected by the runner and prove coverage/tag selection remains complete; do not silently increase the number of smoke flows or leave both variants selected.

All later commands are unproven by the old aborted run; execute the complete flow after correction. Preserve `Nothing has been saved yet.`, `Ready to save`, review validity, and `Confirm and save` assertions. No optional required steps, increased timeouts, new app test IDs, exposed mode selector, rollout flag, or paid-network behavior. Add regression coverage proving Android behavior and unchanged iOS command semantics; existing `askDefaultOffSurface` and release guard remain green. A real product defect found after the selector is fixed receives a root-cause repair and separate regression coverage.

Alternative: expose Create's chip or enable Ask/Auto in the E2E APK. Rejected: ordinary-build availability is the product contract, not a test convenience. Alternative: delete the failing step without profile/absence assertions. Rejected: loses feature-state proof and changes iOS behavior.

### 5. Qualify the final native candidate from a clean checkout

Use pinned Node 22.23.2, unset ambient Supabase variables, preflight SDK/JDK/ADB/Maestro and credible host headroom. Do not await persistent Metro or kill unknown emulator processes. Preserve an existing target unless exact ownership/remediation is established. Saved-snapshot boot previously worked; a failed forced cold boot is not by itself proof the AVD is unusable.

After executable fixes are committed, create a clean detached checkout of the candidate; require empty porcelain including untracked files and keep the same source SHA. Do not delete the main tree's preserved evidence. From that checkout:

```bash
export PATH="/c/Users/palac/AppData/Local/tools/node-v22.23.2-win-x64:$PATH"
node --version
unset EXPO_PUBLIC_SUPABASE_URL EXPO_PUBLIC_SUPABASE_ANON_KEY
npm run qa:native:provision -- --serial <verified-serial>
node scripts/qa-native.mjs --platform android --tag smoke --serial <verified-serial>
node scripts/qa-native.mjs --platform android --tag persistence --serial <verified-serial>
node scripts/qa-native.mjs --platform android --tag lifecycle --serial <verified-serial>
```

Target the complete batteries (currently smoke 2/2, persistence 11/11, lifecycle 6/6), verifying expected/executed sets and per-flow results rather than relying on numeric totals or exit 0 alone. Record source SHA, build clean state, AVD/serial/API/ABI, package/version, APK SHA-256, provisioned flag, remote configuration, bundle scan, report/debug paths, replay command, and exact classification. `--no-provision` reproduction is diagnostic, not final-source qualification.

If docs change after an interim run, retain its real APK/source identity as historical source-applicable evidence, not qualification at the final Git tip. Qualify the actual final committed tip once repository content is stable, attaching its complete native evidence to the final post-CI attestation without another repository commit. Any later candidate change requires source-matching qualification again; missing tooling/device stays an explicit environmental residual, never fake green.

### 6. Conduct the ten-surface adversarial pass independently

Produce `adversarial-review.md` during apply with evidence, severity, classification, disposition, regression proof and second-pass conclusion per finding. This is a certification-critical second pass, not another broad audit. Direct execution is the default; no delegation is authorized by this planning request.

| Surface                | Focus / representative repository anchors                                                                                                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Recovery/restore    | `core/backup/{backupRestore,backupCheckpoint,backupValidators}.ts`, manifest/canonical integrity, malformed/partial manifests, restore counts, numeric precision; `tests/backupManifest.test.ts`, `tests/integration/backupRestore.test.ts`. |
| B. Ownership/isolation | `core/auth/accountCoordinator.ts`, local binding, remote adapter/RLS, habit completions, account transitions, distinct-owner probes and unprimed caches; account-ownership integration suites.                                               |
| C. Migrations          | `core/db/client.ts`, reference mirror, `supabase/migrations/`, `tests/migrationChainIntegrity.test.ts`; exact local head, corrupted versions, append-only chain and exact four-file remote contract, no surprise fifth.                      |
| D. Sync/outbox         | `core/sync/sync.engine.ts`, `core/sync/supabase.adapter.ts`, checkpoint behavior; durable attempts, terminal blocked records, retries/idempotency, skipped pushes/read-back and certified scope; sync/checkpoint suites.                     |
| E. Native release      | Hermetic envelope, APK scanner/provenance, release-profile guard, `app.json`/EAS; endpoint leakage, `allowBackup`, real merged permissions and seam confinement; native hermeticity/release tests.                                           |
| F. CI                  | `.github/workflows/ci.yml`, retry report, `tests/ciLaneIntegrity.test.ts`; valid contexts, required jobs, nightly report-only lane, strict retry false-greens, concurrency/cancellation and quarantine parity.                               |
| G. Store/privacy       | `docs/release/`, `public/privacy.html`, real permission inventory; declarations match artifact, no supported submission/signing claim without evidence.                                                                                      |
| H. AI                  | `features/command/commandSurface.ts`, `askParser.ts`, default-off tests; no accidental paid/network dependency or availability gate for certification.                                                                                       |
| I. Test-only behavior  | Native test seam, auth mocks, test/public environment flags and release profile; no production bypass, leaked mocks, or permission weakening.                                                                                                |
| J. Documentation       | Current source vs guides, CI, Android raw/reviewed results, production facts and OpenSpec checkpoints/counts; preserve history while removing stale current claims.                                                                          |

Do not claim live RLS/production schema from repository fixtures. Fix safely executable issues with regression coverage and rerun affected gates, then briefly review those repairs and cross-surface implications again. Authorization gaps remain visible but do not stop other sections.

### 7. Read-only production and exact resume procedure

Do not read or print secret values to discover access. Use established credential availability/tool configuration. If no credential is available, stop SQL attempts once and record task 2.1's required access. A safe resume is `psql -X --no-password -v ON_ERROR_STOP=1` with owner-provided connection environment, executing bounded read-only SQL against the verified project. The resume query set includes:

```sql
BEGIN READ ONLY;
SET LOCAL statement_timeout = '15s';
SELECT current_database(), current_user, inet_server_addr(), inet_server_port();
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN ('custom_exercises', 'workout_weekly_plan',
                      'workout_schedule_overrides', 'body_weight_entries');
SELECT table_name, column_name, data_type, udt_name
 FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name IN ('calorie_entries', 'saved_meals', 'routine_exercises',
                      'routine_exercise_sets', 'workout_session_sets', 'body_weight_entries')
 ORDER BY table_name, ordinal_position;
SELECT conname, pg_get_constraintdef(oid)
 FROM pg_constraint WHERE conrelid = to_regclass('public.habit_completions');
SELECT indexname, indexdef FROM pg_indexes
 WHERE schemaname = 'public' AND tablename = 'habit_completions';
SELECT count(*) AS manifests, count(DISTINCT user_id) AS manifest_owners
 FROM public.backup_manifest;
ROLLBACK;
```

Confirm project ref/host separately before connecting; generic `postgres` database naming is not project identity. Read policy/grant/index validity using catalog queries if access exists, bounded similarly. A missing table/query failure is evidence of drift, not a reason to write. Keep owner IDs and row contents out of public evidence; revalidate incident cohorts only against the preserved exact-ID runbook if permitted, publishing aggregate results.

The recorded Management API inventory (`pitr_enabled: false`, `backups: []`, `physical_backup_data: {}`, `walg_enabled: true`) proves recovery absent **at that time**. If a fresh authorized read-only inventory is accessible, record its exact observation date without creating backup infrastructure. Absent or unproven `public`+`auth` restoration keeps DDL stopped.

Known four-file contract:

1. `20260824010000_add_gym_training_v2_backup_scope.sql`
2. `20260824020000_add_gym_workout_deep_expansion.sql`
3. `20260925125655_backup_numeric_precision.sql`
4. `20260930000000_habit_completions_owner_scoped_uniqueness.sql`

The fourth is independent of Gym V2 but stays last to preserve filename order and the historical granted prefix. Catalog drift, a fifth file, unavailable recovery, incomplete grant, or unaccepted verification procedure stops the write. Do not repeatedly dry-run without SQL prerequisites. If every prerequisite later exists, apply only the approved set and verify the procedure in the canonical packet §6, including unchanged checksums and a cleaned-up approved synthetic decimal Restore V2. No manifests are rewritten; past `REAL` rounding needs source-device recapture, not pretend repair. Incident cleanup remains outside this campaign even if DDL approval arrives.

Alternative: use the authenticated Management API as SQL proof or execute the first three granted migrations now. Rejected: neither gives live catalog/recovery proof and the exact four-file contract is not approved.

### 8. Validate according to actual impact and retain chronology

Use `npm run qa:affected` before selecting gates and record exact commands/source/runtime. Planning-only documentation gates do not execute Android or production. For apply:

| Changed boundary                   | Sufficient escalation policy                                                                                                                                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical docs/specs only          | Formatting/diff, OpenSpec strict/all, versioned plan validation, doc consistency, `qa:fast`; preserve prior QA only after corroboration and source applicability.                                                                                                 |
| Android flow/regression tests      | Focused flow/source regression suites, default-off/release/native guards, current-source provisioning and smoke/persistence/lifecycle; impact map marks native infrastructure broad, so follow its `qa:full` escalation rather than automatically reusing old QA. |
| Recovery/ownership/sync/migrations | Unit plus real-SQLite integration, affected disaster-recovery/owner journeys and schema validation; refresh full QA where broad regression applies.                                                                                                               |
| Shared web/test infrastructure     | Hermetic build, focused journeys, deterministic simulation plus full QA.                                                                                                                                                                                          |
| CI/release guard                   | CI integrity, quarantine/journey parity, artifact/profile tests, exact-head hosted required jobs.                                                                                                                                                                 |

Do not report skips as passes. Preserve old failures and classified host-load flakes; no blind retry, deleted meaningful test, arbitrary timeout increase or widened quarantine. Keep 249/1, 235/49/0, 23/23 as historical recorded inventories, not current fixed expectations. Finish with `git diff --check`, changed-file formatting, OpenSpec/plan/schema validation where applicable, and `npm run web:hygiene` confirming no owned listener remains.

### 9. Publish without the self-referential SHA trap

Prepare the canonical repository report with all ten required sections **before** the last content push, distinguishing qualification source from publishing Git tip. Logical commits can separate reconciliation, Android/regression changes, and review/report fixes; inspect/validate each diff, stage only task-owned paths, use ordinary fast-forward publication, and avoid pushes that cancel a run still being used as evidence.

After the final push, inspect the actual run bound to the final SHA, required job results, strict retry report, expected skips and cancellation state. A bookkeeping commit after green is a new tip and requires another run, even when docs-only.

A report cannot contain its own Git content hash without changing that hash. Therefore final publication is the committed canonical report **plus an immutable commit-linked post-CI attestation** (GitHub commit comment or an equivalently durable owner-facing record containing final SHA/run/jobs, report permalink and residuals). The report clearly identifies the source candidate and points readers to the commit-linked attestation; it never mislabels the ancestor as the final Git tip. Publish the final attestation after CI without another repository edit. Final owner output includes starting/final SHA, commits, task counts, Android/QA/J8/CI, production mutation statement, iOS deferral, OpenSpec posture and exact residual resumes. This resolves the brief's exact-tip evidence requirement rather than weakening it.

Alternative: mark CI complete from a parent SHA or add endless report-only commits. Rejected: the former is false provenance; the latter never converges without an external final attestation.

### 10. Terminal and archive predicates remain conservative

Overall stays `NOT CERTIFIED` while substantive production recovery remains red, even if all authorized Windows work finishes. Report local engineering exhaustion separately. Preserve existing unresolved iOS evidence and owner deferral; never convert it into certification. Evaluate both predecessors' actual archive predicates, not checkbox counts; default expectation is both remain active. Inventory the other seven local changes without absorbing or archiving them as campaign tidying. Every residual has the four exact fields, including historical precision, confirmed-synthetic cleanup, owner release/provider/gap-21 decisions and any newly evidenced blocker.

Alternative: declare `COMPLETE` after Android and CI pass. Rejected by the active recovery predicate.

## Risks / Trade-offs

- [The first flow repair reveals later failures] → Execute the complete flow and diagnose each; the historical abort proves nothing after sequence 13.
- [A shared-flow branch alters iOS indirectly] → Compare parsed command semantics for iOS, keep original assertions, and use Android-specific selection if semantics cannot stay identical. Do not run iOS to force closure.
- [Historical QA lacks retained raw logs] → Disclose the limitation, corroborate with available artifacts/source-bound CI, and rerun a required gate when proof is insufficient.
- [Two active deltas contradict] → Apply explicitly updates the canonical J8 requirement under this successor's chronology contract; validate both afterward.
- [Machine resources destabilize native/performance runs] → Record resources, preserve evidence, operate only exact owned processes, and classify capability limits honestly.
- [Cleanliness/provenance is bypassed for convenience] → Use the exact committed candidate in a clean checkout, never remove foreign evidence or relax the guard.
- [Future production state changes] → Recheck read-only; stop on drift, missing recovery or incomplete approval, and update the packet without assuming the old facts remain current.
- [Report bookkeeping invalidates CI/native identity] → Keep original qualified source identity explicit; obtain final-tip CI and publish its attestation without a new commit.

## Migration Plan

No app-schema or production mutation is performed by this proposal. Apply sequence:

```text
Re-verify Git/evidence -> reconcile CI/QA/J8/ledger -> diagnose Android
        -> scoped repair + regression -> committed candidate qualification
        -> ten-surface review -> executable fixes + second review
        -> reconcile all tasks + closure report -> affected validation
        -> logical fast-forward publication -> exact-final-head CI
        -> commit-linked attestation + owner report + hygiene
```

Read-only production inventory runs when access exists and does not block independent work. DDL is a separate conditional branch requiring every explicit prerequisite; production deletion/iOS never enter this sequence. Any executable review fix returns to affected validation/native qualification before publication.

Rollback planning via removal/revert of this task-owned change only; never delete prior change directories or evidence. Later local fixes use normal revert with revalidation. Production rollback is governed by the owner-approved recovery/verification procedure, not speculative down-migrations or table drops.

## Input Coverage and Definition of Done

| Brief sections | Planned deliverable / acceptance                                                                                                                                                 |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0–1            | Verified refs/CI/local state; preserved stash/evidence/worktrees; scoped commits.                                                                                                |
| 2              | Explicit unchecked owner-deferred 3.2/3.3; no iOS action or shared-semantic change.                                                                                              |
| 3–4            | All 22 dispositions; 6.2 valid for the baseline then re-attested at actual final tip.                                                                                            |
| 5–6            | QA deferral→pass chronology, evidence applicability, J8 failed sample→accepted correction, active delta reconciliation with budgets unchanged.                                   |
| 7              | Evidence-based Android classification/fix; current-source hermetic build and complete 2/2, 11/11, 6/6 target batteries or precise non-passable residual.                         |
| 8              | All A–J review surfaces, executable fixes/regressions/affected gates/second pass; 6.1 evidence.                                                                                  |
| 9–11           | Read-only catalog/resume queries, proven-absent recovery chronology, four-file stop conditions and incomplete grant, historical incident precision/cleanup boundaries.           |
| 12–15          | Accurate counts, all report sections, local-vs-overall state, conservative archive decisions.                                                                                    |
| 16–17          | Impact-selected nonredundant QA, exact candidate provenance, logical commits, fast-forward pushes, final exact-head CI without stale parent reuse.                               |
| 18–19          | Autonomous routine Windows work during apply; true external/owner gates named; no executable high-value residual hidden as a recommendation.                                     |
| 20–21          | Published complete owner report, explicit no-production-mutation or exact approved mutation declaration, all four residual fields, final hygiene and no unpushed reconciliation. |

Planning completion means the proposal/specs/design/tasks are validated and apply-ready, with all implementation tasks unchecked. Campaign completion later requires the acceptance above, not merely valid Markdown or an all-done planning status.

## Open Questions

None blocking the proposal. Host readiness, credential availability, catalog drift, later flow behavior, and final CI result are execution observations with defined safe branches. A fix requiring iOS semantics or new production authority stays a named owner gate; this proposal does not pre-authorize either.
