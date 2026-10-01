# Closure report — current, published with the campaign

Change: `final-certification-closure` · Prepared: 2026-09-29 · Updated: 2026-10-01 · Schema: `spec-driven`

> **This is the current report.** All ten required sections are present and reconciled against direct evidence: the verified CI candidate, the full-QA deferral-then-pass chronology, the J8 conditional posture, the complete Android battery, the owner-deferred iOS posture, the credential-blocked production posture with a proven-absent recovery point, both archive predicates, and four-field blocks for every residual. Task 6.4 is checked on this report. Because a committed report cannot contain the hash of the commit that carries it, its final published SHA and exact-head CI results are recorded in the campaign's immutable commit-linked post-CI attestation; the report names its **source candidate** and never relabels an ancestor as the final tip. Superseded events are kept visible as history instead of deleted.

## Terminal state

# NOT CERTIFIED

**Windows/local engineering is exhausted; overall certification is not.** The two are different statements, and this report keeps them apart. Every Windows-executable lane is now green or precisely classified: CI on the verified candidate, the full-QA chronology, J8, the ten-surface adversarial review, and the complete Android battery (provisioning PASS, smoke 2/2, persistence 11/11, lifecycle 6/6) on the current-source hermetic APK. A substantive unresolved production/recovery gate keeps the terminal state red on its own: Scope-7 backup integrity is substantively red and, for the catalog read, still unverified, while its recovery-point limb is **proven absent** from a direct read-only observation (`pitr_enabled: false`, `backups: []`, re-observed 2026-10-01). iOS stays `DEFERRED_BY_OWNER / ENVIRONMENT` and is never called certified. J8's preserved 878 ms section-switch result is an `ENVIRONMENT` host-load excursion, not an open product gate: `docs/testing/known-gaps.md` records `CG-4` and `CG-5` as CLOSED (2026-08-10, unchanged thresholds) and gap 15 as CLOSED with a 2026-09-24 root-cause fix, and task 4.3 is `NOT_TRIGGERED`. Neither `external-blocker-closure` nor this change is archived.

## 1. Identities

| Item                          | Value                                                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Base this change applied on   | `575c4035e7b48e9d84df47f7a5f28dfcb14d7e27`                                                                                                       |
| Verified candidate (task 6.2) | `210afd39a99e2b2dbf5026b58a1191182e05f368` — `main` == `origin/main`, fast-forward only, 0 ahead / 0 behind                                      |
| Superseded heads              | `4fa769e4c12b78a47f42f2137be1204b1725e705` (CI `36515101194` cancelled), `16cb41a25cced14ba1f3c20b1815dc17c8506bc6` (CI `36515963710` cancelled) |
| Branch                        | `main` only; one worktree; no branch, tag, stash, or history rewrite was created                                                                 |
| Foreign stash                 | `stash@{0}` `pre-recovery-local-changes` — preserved, never applied or dropped                                                                   |
| Tree state                    | tracked tree clean; untracked foreign evidence only (`.tmp-ios36423379932/` and prior change directories), never staged                          |
| `.tmp-ios36423379932/`        | untracked and **not** ignored by `.gitignore`; never staged, never committed, never deleted                                                      |
| Integration Node              | pinned `v22.23.2` used for every gate; ambient `v24.3.0` never ran a gate                                                                        |

**Source candidate vs publishing tip.** This report is committed as the campaign's final content commit, so it cannot contain its own commit hash: writing that hash would change it. The report therefore identifies the **source candidate** — the tree carrying this report and the campaign's verified changes — and its exact-head CI plus final SHA are published in an **immutable commit-linked post-CI attestation** (a GitHub commit comment on that commit) containing the final SHA, run id, job results, the report permalink and the residual list. The ancestor `210afd3` is recorded above as the verified candidate for task 6.2 only; it is never relabelled as the final tip. |

## 2. CI

**Exact-head record for the verified candidate — `36824132137` on `210afd39a99e2b2dbf5026b58a1191182e05f368` (push): completed SUCCESS.**

| Job       | Status    | Conclusion  | Verdict                                                                                                                                                                      |
| --------- | --------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quality` | completed | **success** | pass                                                                                                                                                                         |
| `e2e`     | completed | **success** | pass — main lane: full E2E (feature + full journeys + simulation self-test + pwa), full deterministic scenario library 23/23, `dist-sync/` build, plus the retry-report gate |
| `nightly` | completed | skipped     | not a pass, not a failure — expected for a push (schedule-only job)                                                                                                          |

Run `36824132137` is the newest CI run for `main` at the time this draft was updated, its `headSha` is exactly `210afd3`, and no source-changing commit superseded it. Task `6.2` is therefore **closed for this verified candidate**. The run's `e2e` job also records the expected PR-lane skips (the feature/P0-scenario steps conclude `skipped` on a push, not on a PR) — expected skips, not failures.

Any later commit is a new tip: `ci.yml` declares `concurrency: ${{ github.workflow }}-${{ github.event_name }}-${{ github.ref }}` with `cancel-in-progress: true`, so the push that lands a later commit starts a new run and supersedes this one. Exact-head CI for the final pushed tip of this campaign is published through the successor's immutable commit-linked final attestation; parent-SHA CI is never reused as a child commit's exact-head proof.

**Superseded — `36812850832` on `c2ec475` (push): SUCCESS.** Green `quality`/`e2e`, `nightly` skipped. Its `qa:full` record is the durable one in `.agent/execplans/apply-closure-resolution.md`.

**Superseded — `36808868543` on `a9db86d` (push): SUCCESS** — the first green run after the workflow-parse repair.

**Superseded — `36807888273` on `a019e21` (push): FAILURE with zero jobs** — GitHub rejected the workflow at parse time because a step `if:` referenced the `secrets` context. Fixed in `a9db86d`; the class-level guard now pins the valid construct.

**Superseded — `36518073584` on `c1dc252` (push): SUCCESS** — `quality` success, `e2e` success, `nightly` skipped.

**Superseded — `36515963710` on `16cb41a`: CANCELLED, not green.** `quality` had completed success; `e2e` finished cancelled when a later push landed. Recorded as cancelled, not as evidence.

**Superseded — `36515101194` on `4fa769e`: CANCELLED, not green.** `quality` success, `e2e` cancelled, `nightly` skipped. `4fa769e` carried the three iOS flow fixes.

**Superseded — `575c403`: run `36449656365` SUCCESS.** `quality` success, `e2e` success including deterministic scenarios and `dist-sync`, `nightly` skipped. `575c403` was a documentation-only tip and certifies no production, iOS, Android, or J8 result.

**iOS lane — `36516000163`, `workflow_dispatch` on `16cb41a`.** The task 3.3 recertification attempt; active monitoring was stopped at the operator's request, so **no iOS result exists and iOS is not certified**. With the owner's 2026-10-01 deferral the lane is no longer chased; iOS stays `DEFERRED_BY_OWNER / ENVIRONMENT`.

The lesson is operational and preserved: a follow-up commit on the same branch supersedes the earlier run, so the final candidate SHA has to be fixed before its CI is treated as the record.

## 3. Production schema and historical manifests — RED, and the stated posture is unconfirmed

The 2026-09-28 hypothesis (12 migrations through `20260822000000`; three missing; four Gym V2 tables absent; numeric columns still `REAL`; ~41 manifests) **was not re-verified** in this session and must not be treated as current state.

Confirmed read-only facts: project `kruubbynsmxzxfdunaal` is named `superhabits` and is the linked project; the repo `.env` points at it; the IPv4 pooler is reachable from this host. A live query is **impossible without the database password** — `psql` returns `fe_sendauth: no password supplied`, the Supabase CLI SQL paths require an interactive password, and no Supabase MCP server is configured. The predecessor's "AAAA-only host" blocker is specific to the direct database host, not the pooler. The 2026-10-01 campaign re-checked credential availability once and found no `SUPABASE_DB_PASSWORD` / `DATABASE_URL` / `PGPASSWORD` / `SUPABASE_DB_URL` and no DB credential in `.env`/`.env.local`, so the catalog read stays `CREDENTIAL / EXTERNAL` without a passwordless retry loop.

Recovery inventory, re-observed read-only on 2026-10-01 at 15:08Z via the authenticated Management API: `{"region":"ap-northeast-1","walg_enabled":true,"pitr_enabled":false,"backups":[],"physical_backup_data":{}}` — no restorable point covers `public` or `auth`.

No production SQL was executed. No production object was created, altered, or dropped. DDL is `OWNER_APPROVAL_REQUIRED`; see `production-approval-packet.md`.

Historical `REAL` rounding already suffered cannot be reversed by the `REAL` → `NUMERIC` migration. That migration's own header says so. Exact past values require source-device recapture, which is a separate owner decision.

## 4. Incident-residue disposition

The predecessor's 2026-09-28 read-only classification reported 482 candidate records: 135 confirmed synthetic in five exact J8 cohorts, 96 probable, 251 ambiguous. **These are predecessor figures, not values re-verified in this session** — no live query was possible, for the same credential reason as §3. They are carried forward unchanged and must be re-confirmed before any deletion decision.

- The 135 confirmed-synthetic records stay `OWNER_APPROVAL_REQUIRED`. No exact-target deletion approval exists.
- The 96 probable and 251 ambiguous records were left untouched.
- Schema approval would not imply deletion approval; they are separate gates.

## 5. iOS — source and executable identity, `DEFERRED_BY_OWNER / ENVIRONMENT`

| Item                       | Value                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Source SHA of the evidence | `e9b42a3f31984f86dd50e0b337300df74898f422`                                            |
| Run / attempt              | `36423379932` / 1, repository `quantdale/super-habits`                                |
| Executable SHA-256         | `ef22674b03518115bd465ac7a1293a7ad9e5439238a5af1ac9a6ac6085be9010`                    |
| Bundle / simulator         | `com.dale16.superhabits`, iPhone 17 Pro, iOS 26.2, Xcode 26.2, Maestro 2.2.0          |
| Result                     | `NOT_CERTIFIED` at **10/13**; 10 PASS, 3 `FAILED_NEEDS_TRIAGE`                        |
| Artifact                   | `10980993163`, read via the confirmed local extract                                   |
| Current-source iOS         | **not run** — `DEFERRED_BY_OWNER / ENVIRONMENT` because this campaign host is Windows |

Tasks 3.2 and 3.3 are explicitly `DEFERRED_BY_OWNER / ENVIRONMENT`. All three failures were classified `TEST_BUG` with in-artifact evidence and all three flows carry edits (see `ios-flow-classification.md`), but the edits remain **unproven** — no iOS run exists and none is dispatched or chased by this campaign. iOS is never called certified, `12/13` would not be certified either, and the historical evidence above is preserved verbatim rather than rewritten by the deferral. Reopening iOS requires a macOS host and an explicit owner decision.

## 6. Android — current source and binary identity, FULLY GREEN

| Item              | Value                                                                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Source SHA        | `80b0b33ba9c0de2abe89d7ba57f2889be1f75e93` (clean tree, detached exact-source checkout)                                                   |
| Target            | `Nitro_API_36`, `emulator-5554`, API 36, `x86_64`                                                                                         |
| Package / version | `com.dale16.superhabits`, versionName `1.0.0`, versionCode 1                                                                              |
| APK SHA-256       | `E2F43FBBE37FFA28D31EB3379DAB7C06B352EBF456748AF958D367245C3690D2`                                                                        |
| Provisioning      | **PASS** — hermetic build (`EXPO_NO_DOTENV=1`, no ambient `EXPO_PUBLIC_*`), bundle scan 1 JS/bytecode entry / 0 matches for `supabase.co` |
| Smoke             | **2/2 PASS** — `command-center-v2` 37 s, `native-smoke` 53 s (`flowCoverage.verdict: OK`)                                                 |
| Persistence       | **11/11 PASS** in 13 m 32 s (`flowCoverage.verdict: OK`)                                                                                  |
| Lifecycle         | **6/6 PASS** in 7 m 28 s (`flowCoverage.verdict: OK`)                                                                                     |
| Artifacts         | `simulation-output/native/windows-closure-2026-10-01/` (three tag reports, the build record, and the repaired flow's debug tree)          |

The historical APK was not reused. The earlier `command-center-v2` failure at `68db684` was a stale flow step against the intentional default-off render boundary (`features/command/commandSurface.ts`, `CommandScreen`'s `if (!AI_ASK_EXPERIMENT_ENABLED) return commandContent` branch): the raw report labelled it `PRODUCT_BUG`, while the step-14 hierarchy contains no `Create`, `Ask`, or `Auto` element at all. The reviewed triage classified it `TEST_BUG`, the scoped platform-conditional flow repair landed as `80b0b33` with a non-vacuous regression guard (`tests/maestroCommandCenterFlowGuards.test.ts`), and the complete batteries were then re-run green on the current-source hermetic APK above. The previous APK `5DF9D5DC…` remains recorded as the historical `68db684` build whose smoke lane was 1/2.

## 7. J8 environment and measurement

| Item                        | Value                                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Host                        | i5-13500HX, 20 logical cores, 31.73 GB total RAM, 110.3 h uptime                                                                                                                                                   |
| Available RAM               | **0.57 GB**, then 1.57 GB, then **0.26 GB** across three measurements — all non-credible                                                                                                                           |
| Repo-owned processes        | a single `pwsh.exe` shell; no lingering test, build, or emulator process                                                                                                                                           |
| Largest unrelated consumers | `vmmemWSL` 5,217 MB, `Memory Compression` 4,758 MB, `opencode` 875 MB, plus agent/editor runtimes                                                                                                                  |
| Terminated                  | nothing — no unrelated process was killed                                                                                                                                                                          |
| Preserved result            | **878 ms against the unchanged 800 ms ceiling** — recorded `ENVIRONMENT` host-load excursion, not an open product gate (register: `CG-4`/`CG-5` CLOSED 2026-08-10; gap 15 CLOSED with a 2026-09-24 root-cause fix) |
| HEAVY/J8 rerun              | **not run** — host headroom is not credible in the original session; task 4.3 is `NOT_TRIGGERED` because its conditional antecedent never fired                                                                    |
| `qa:full`                   | **PASS at `c2ec475`** — chronology: previously resource-deferred, then completed successfully on pinned Node `v22.23.2` (`QA_FULL_EXIT=0`)                                                                         |

The ceiling stays 800 ms and the 15 % floor stays 15 %. No app-owned cost was profiled or changed because none is required: the register's 2026-09-24 resolution already removed the app-owned/measurement contribution (`waitForSectionTransitionsSettled` before the measured round), with post-fix evidence persona 7/7, `maxSwitch=622/800` (22.3 % headroom), per-switch `619/407/395/500/622/457`, `diarySearch=396/500`, `pickerSearch=186/500`. The 878 ms result is retained verbatim as an `ENVIRONMENT` excursion under full-battery host load; it is not reclassified as passing and its condition stays conditional (`NOT_TRIGGERED` for task 4.3).

**`qa:full` chronology, recorded rather than rewritten:** the gate was first deferred because host memory was not credible, and the deferral was left visible at the time. It was subsequently completed successfully at `c2ec475` on pinned Node `v22.23.2`: `QA_FULL_EXIT=0`, `npm test` 249 test files passed / 1 skipped, `openspec:validate` 68/68, `npm run e2e` 284 tests on one worker with **235 passed / 49 skipped / 0 failed** (29.7 m), deterministic simulation **23/23**. Host at run time: 3,762 MB free of 32,488 MB total, CPU 63 %, 41 h uptime. The durable record is `.agent/execplans/apply-closure-resolution.md`; its source applicability to the current tree is corroborated by the empty runtime/config diff `c2ec475..210afd3`. The counts are that run's inventory, not a fixed expectation, and the original deferral is preserved as history.

## 8. OpenSpec and ExecPlan status

| Item                                   | Value                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------- |
| This change                            | `final-certification-closure`, **17/22 tasks recorded** (2.1, 2.4, 3.2, 3.3, 4.3 open)    |
| This ExecPlan                          | `Plan-Version: 2`, `Status: BLOCKED` (production prerequisite unmet), validates PASS      |
| Predecessor `external-blocker-closure` | 27/27, ExecPlan `ACTIVE`, report `NOT CERTIFIED`, **unarchived**                          |
| Successor this campaign runs           | `windows-closure-reconciliation`, 42-task apply checklist; owns the five open tasks above |
| Sibling change at 26/26                | `harden-native-evidence-and-release-posture` — task 5.3 closed on the green battery above |

The successor's review and reporting checkpoints do **not** depend on the production SQL credential. Live production facts stay explicitly blocked; the repository-level review of all ten certification-critical surfaces proceeds independently, and only the live catalog assertions remain unverified. Task 6.1 is complete and is recorded in `windows-closure-reconciliation/adversarial-review.md`.

## 9. Archive decision

Both predecessor/active changes stay **unarchived**, evaluated on predicates rather than on checkbox counts or repository tidiness.

**`external-blocker-closure` — NOT archived.** Its closure predicate is not met. Unmet gates, by name:

1. **Production Scope-7 backup integrity** — substantively red and additionally unverified at the catalog level, because no read-only SQL credential is available.
2. **Current-source iOS** — three executable flow failures were classified and their flows edited, but no 13/13 run exists at any current SHA, and the persistence replacement has no artifact support. Owner-deferred, preserved as history.
3. **J8** — **removed from the unmet set.** The 878 ms miss no longer stands as a product gate: the register classifies the residual as an `ENVIRONMENT` host-load excursion, `CG-4`/`CG-5` are CLOSED (2026-08-10) and gap 15 is CLOSED with a 2026-09-24 root-cause fix, with every ceiling (800 ms), floor (15 %), fixture, and assertion unchanged. The archive predicate's third limb — a reproducible product performance regression against an unchanged ceiling — is therefore not met.

**`final-certification-closure` (this change) — NOT archived.** Its own predicates are unmet by construction: tasks 2.1, 2.4, 3.2, 3.3 and 4.3 remain open as `CREDENTIAL / EXTERNAL`, `BLOCKED`, `DEFERRED_BY_OWNER / ENVIRONMENT` and `NOT_TRIGGERED`, and the terminal report still records `NOT CERTIFIED`. Task 6.2's exact-head result and task 6.4's publication are complete, but a change whose remaining tasks include an unmet production prerequisite is not archived for tidiness.

**Other local changes — inventoried, not absorbed:** `windows-closure-reconciliation` (this campaign's apply change, 42-task checklist) owns the reconciliation performed here and IS committed with it. The other prior change directories — `harden-native-evidence-and-release-posture`, `harden-silent-failure-certification`, `harden-ci-lane-integrity`, `harden-interaction-idempotency`, `reduce-section-activation-render-work`, `fix-local-calendar-day-windows` and `harden-agent-guidance-truth` — are **untracked prior-work directories** preserved locally and deliberately excluded from every campaign commit by the preservation rule. The local reconciliation of the sibling's Android task 5.3 (now 26/26, ExecPlan `COMPLETED`) lives inside that untracked directory; the **published** record of the green Android battery is §6 above. No change directory was absorbed, rewritten, or archived by this campaign.

## 10. Residuals

Every residual below carries `WHY`, `CLASSIFICATION`, `WHAT IS REQUIRED`, and `EXACT RESUME ACTION`.

### R1 — iOS recertification

- **WHY:** The three classified fixes are unproven, and no current-source iOS run exists.
- **CLASSIFICATION:** `DEFERRED_BY_OWNER / ENVIRONMENT` — the campaign host is Windows, and the owner deferred iOS rather than chasing 13/13. iOS is **not certified**.
- **WHAT IS REQUIRED:** A macOS host plus an explicit owner decision to reopen iOS, then a new exact-SHA run demonstrating build, executable hash, install, launch, and 13/13 flow passes. The three flow edits are committed and their regression guards pass, but they remain unproven until that run exists. iOS deferral never waives the certification contract and never becomes an archival pass.
- **EXACT RESUME ACTION:** On a macOS host, dispatch the iOS native workflow at the then-current `main` SHA, re-read the artifact, and compare its flow statuses against the three classified flows before changing anything — do not assume a fix held, and treat the persistence scroll as the likeliest first failure. Do not edit `.maestro/` or chase iOS failures on Windows.

### R2 — Production read-only verification

- **WHY:** The 2026-09-28 production posture is unconfirmed, and a stale hypothesis must not drive a write.
- **CLASSIFICATION:** `CREDENTIAL / EXTERNAL`
- **WHAT IS REQUIRED:** The production database password, or a configured **read-only** SQL credential. Read-only access alone is sufficient for this task and is **not** DDL authorization. The recovery-point half is already **proven absent** from the Management API (`supabase backups list --project-ref kruubbynsmxzxfdunaal` → `pitr_enabled: false`, `backups: []`, `physical_backup_data: {}`, `walg_enabled: true`), so task 2.2 is closed as an explicit `FAIL`; this entry covers task 2.1's catalog read only. Missing credentials never block the independent repository review or reporting workstreams.
- **EXACT RESUME ACTION:** Set the credential, then run the bounded read-only query set in `openspec/changes/windows-closure-reconciliation/design.md` §7 (`BEGIN READ ONLY`, `statement_timeout` 15 s, migration head, Gym V2 tables, numeric column types, `habit_completions` constraint/index inventory, `backup_manifest` counts, `ROLLBACK`) against project `kruubbynsmxzxfdunaal`. Record actual values, not the hypothesis. Separately, PITR or a physical backup must be enabled before any DDL consideration.

### R3 — Production DDL rollout

- **WHY:** The three missing migrations plus the owner-scoping correction leave production backup scope behind local.
- **CLASSIFICATION:** OWNER_APPROVAL_GRANTED_BUT_NOT_EXECUTABLE
- **WHAT IS REQUIRED:** Authorization is no longer the blocker for the three migrations the owner named — the owner granted the project `superhabits` / `kruubbynsmxzxfdunaal` and the exact three migrations `20260824010000`, `20260824020000`, `20260925125655` in that order. The binding blockers are a production SQL credential (absent) and a named proven-restorable `public` + `auth` recovery point, which was **directly observed to be absent** (`pitr_enabled: false`, `backups: []`) and so cannot be named. A fourth repository migration, `20260930000000_habit_completions_owner_scoped_uniqueness.sql`, is **not covered by the grant** and must be authorized separately. The grant also omits acceptance of the verification procedure in `production-approval-packet.md` §6, which this change's own terms require alongside the project and migrations. The owner's own precondition — that the live catalog and a proven recovery point exist first — is unmet. Task 2.2's stop condition is therefore active, and task 2.2 has been closed as an explicitly failed recovery gate rather than an open question.
- **EXACT RESUME ACTION:** Supply the credential, then **prove the recovery point first** — do not apply DDL on the way in. PITR/backup enablement in the project is an owner/infrastructure action. Re-verify the live catalog read-only and compare it against `production-approval-packet.md` §3; if it has drifted from the 2026-09-28 hypothesis, stop and update the packet. Obtain an amended approval naming all four migrations. Then dry-run and confirm only those four migrations appear, in order. Apply, then verify schema, RLS, grants, indexes, advisors, and a cleaned-up synthetic decimal Restore V2 with checksums **enabled and unmodified**. Audit each historical manifest cohort without rewriting manifests or weakening checksums.

### R4 — Historical numeric precision

- **WHY:** Values already rounded by remote `REAL` are unrecoverable by type conversion.
- **CLASSIFICATION:** OWNER DECISION
- **WHAT IS REQUIRED:** A decision on whether affected cohorts are recaptured from an authoritative source device, and acceptance that they cannot be reconstructed from the database.
- **EXACT RESUME ACTION:** Classify each manifest cohort honestly as recoverable, recapturable, or lost. Recapture only from a source device. Do not rewrite manifests or relax checksums to make a cohort agree.

### R5 — Incident-residue deletion

- **WHY:** 135 confirmed-synthetic records remain in production.
- **CLASSIFICATION:** OWNER_APPROVAL_REQUIRED (separate from R3)
- **WHAT IS REQUIRED:** Exact-target deletion approval for the 135 confirmed-synthetic records only.
- **EXACT RESUME ACTION:** Use the gitignored exact-ID snapshot. Delete nothing from the 96 probable or 251 ambiguous sets. Take a fresh recovery point first.

### R6 — J8 performance residual

- **WHY:** A preserved 878 ms section-switch result sits above the unchanged 800 ms ceiling.
- **CLASSIFICATION:** `NOT_TRIGGERED` (task 4.3) — the conditional antecedent never fired, and the product gate is CLOSED by the recorded root cause. `docs/testing/known-gaps.md` records `CG-4` and `CG-5` as **CLOSED** (2026-08-10, `close-cg4-cg5-performance-gaps`) and gap 15 as **CLOSED (TEST_BUG; residual `ENVIRONMENT` ceiling excursions stay recorded)** with a 2026-09-24 root-cause resolution: the measured round began while the warm-up's six back-to-back section transitions were still settling, and `waitForSectionTransitionsSettled(page)` corrected the measurement at the source. Post-fix evidence: persona 7/7 green, `maxSwitch=622/800` (22.3 % headroom), per-switch `619/407/395/500/622/457`, `diarySearch=396/500`, `pickerSearch=186/500`. Every ceiling, floor, fixture, and assertion is unchanged, and the 878 ms number is preserved verbatim.
- **WHAT IS REQUIRED:** Nothing to close the product gate, and no current product remediation is required. The `ENVIRONMENT` residual stays recorded: a future ceiling breach is re-verified standalone on an idle host before any product code is touched.
- **EXACT RESUME ACTION:** None. Do not raise the 800 ms ceiling and do not treat the older release-candidate headroom scenario as a waiver. If a future run breaches the ceiling, run `npx playwright test --project=journeys e2e/journeys/three-months-in.spec.ts -g "Tom"` on an idle host and classify with the recorded per-switch numbers before touching product code.

### R7 — Current-source Android smoke residual

- **WHY:** The `command-center-v2` smoke flow previously failed at `tapOn: 'Create'` on the current-source hermetic APK.
- **CLASSIFICATION:** **CLOSED — `TEST_BUG` repaired and device-verified.** The ordinary build never mounts the rollout-gated mode selector, so the stale step could never match; the raw report's `PRODUCT_BUG` label is reconciled as raw-machine triage. Provisioning PASS, smoke **2/2**, persistence **11/11**, lifecycle **6/6** at source `80b0b33`, APK SHA-256 `E2F43FBB…C3690D2`.
- **WHAT IS REQUIRED:** Nothing to close the residual. The repair is platform-conditional, so iOS semantics are unchanged, and the regression guard fails if the unconditional step returns.
- **EXACT RESUME ACTION:** None. If the flow or the render boundary changes later, re-run `node scripts/qa-native.mjs --platform android --tag smoke --serial <verified-serial>`, then `--tag persistence`, then `--tag lifecycle`, from a clean checkout of the committed candidate with pinned Node 22.23.2 and ambient Supabase variables unset. Do not add app test IDs, optional steps, or exposed AI controls to satisfy the flow.

### R8 — `qa:full`

- **WHY:** The gate was originally deferred for host memory, so its result could not be inferred from narrower gates at that time.
- **CLASSIFICATION:** **PASS (later, at `c2ec475`)** — the original deferral is preserved as history and is not rewritten.
- **WHAT IS REQUIRED:** Nothing further unless a later change invalidates the run's source applicability; `npm run qa:full` completed `QA_FULL_EXIT=0` on pinned Node `v22.23.2` with `npm test` 249 files passed / 1 skipped, `openspec:validate` 68/68, `npm run e2e` 235 passed / 49 skipped / 0 failed (284 tests, 29.7 m), and deterministic simulation 23/23. Source applicability to the current tree is corroborated by the empty runtime/config diff `c2ec475..210afd3`.
- **EXACT RESUME ACTION:** None. If a later source change touches runtime, shared QA, or DB/time infrastructure, re-run `npm run qa:full` on pinned Node 22.23.2 rather than reusing this record.

### R9 — Owner-only release actions

- **WHY:** Signing, store console inputs, submission, and the `v1.0.0` tag are outside agent authority.
- **CLASSIFICATION:** EXTERNAL / OWNER ACTION
- **WHAT IS REQUIRED:** Owner-supplied signing material, console inputs, and an explicit submission decision.
- **EXACT RESUME ACTION:** None available to the agent. These are never used to claim a product gate passed.

### R10 — Gap 21

- **WHY:** Remote data can outrun the singleton backup manifest in a narrow device-loss window.
- **CLASSIFICATION:** OWNER DECISION — `PENDING_OWNER`
- **WHAT IS REQUIRED:** A recorded choice of A (fail-closed, current), B (retained generations), or C (approved degraded mode).
- **EXACT RESUME ACTION:** Keep Restore V2 fail-closed. If B or C is chosen, open a separate OpenSpec change before any implementation. J8 and D14 ceilings stay at 800 ms and 500 ms.

### R11 — AI provider evaluation and store disclosure

- **WHY:** AI stays default-off and is not a certification dependency; provider-backed evaluation needs credentials, budget, and privacy/legal review.
- **CLASSIFICATION:** EXTERNAL / OWNER ACTION
- **WHAT IS REQUIRED:** Provider credentials, budget, privacy and legal review, and explicit authorization.
- **EXACT RESUME ACTION:** Do not enable production anonymous auth, spend, or roll out AI to close a certification gate. `AI_ASK_EXPERIMENT_ENABLED` stays false by default.

## 11. What would change the terminal state

`NOT CERTIFIED` cannot become `LOCALLY COMPLETE — EXTERNAL ACTIONS REQUIRED` on the native lanes alone. R7 (Android) is now **closed and device-verified** and R6 is closed as a product gate, yet production Scope-7 remains substantively red, and a red recovery gate keeps the terminal state `NOT CERTIFIED` on its own. Native closure is necessary, never sufficient.

The order that actually matters:

1. **R2 first** — obtain the read-only credential and establish the real production posture. Everything production-related is unverified until this happens, and the 2026-09-28 hypothesis must not be used to justify a write.
2. **R3 second** — prove a recovery point, then apply only the four named migrations under the amended four-part approval. R3 may not be granted from a stale hypothesis, and its fourth migration is not yet authorized by the owner's three-migration grant.
3. **R1** — iOS 13/13 at a real candidate SHA. Independent of production, but it cannot promote the terminal state alone and it stays `DEFERRED_BY_OWNER / ENVIRONMENT` until the owner reopens iOS on a macOS host.
4. **R4, R5** — historical precision and incident deletion remain separate owner decisions even after R3 succeeds.

Archiving `external-blocker-closure` requires R1 and R2/R3 closed together. No single one of them is sufficient; R6 no longer blocks it, and R7's closure removes the Android limb from the unmet set.

## Appendix A — canonical 22-task audit (task 6.1)

Every canonical task is audited individually below, not only the previously unchecked
ones. `COMPLETE` means the task's own deliverable exists and is evidenced;
`CREDENTIAL / EXTERNAL`, `BLOCKED`, `DEFERRED_BY_OWNER / ENVIRONMENT` and
`NOT_TRIGGERED` are **not** passes and stay unchecked on purpose.

| Task | Disposition                       | Evidence / reason                                                                                                                                                                                                                                                |
| ---- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1  | COMPLETE                          | `main` == `origin/main`, stash `pre-recovery-local-changes` preserved, `.tmp-ios36423379932/` never staged; re-verified by the successor preflight at `210afd3`.                                                                                                 |
| 1.2  | COMPLETE                          | Pinned Node `v22.23.2` recorded and used for every integration gate, including the successor's Android batteries.                                                                                                                                                |
| 1.3  | COMPLETE                          | `final-certification-closure/execplan.md` exists with `Plan-Version: 2`; `agent:plan:validate` PASS.                                                                                                                                                             |
| 1.4  | COMPLETE                          | Run `36449656365` recorded as docs-only green and explicitly insufficient to certify production/iOS/Android/J8.                                                                                                                                                  |
| 2.1  | `CREDENTIAL / EXTERNAL`           | No authorized read-only SQL credential (checked once; no `SUPABASE_DB_PASSWORD`/`DATABASE_URL`/`PGPASSWORD`/`SUPABASE_DB_URL`, no DB secret in `.env`/`.env.local`). Bounded read-only resume queries recorded in `windows-closure-reconciliation/design.md` §7. |
| 2.2  | COMPLETE as `PROVEN_FAIL`         | Recovery point explicitly observed absent (2026-10-01, re-observed 15:08Z): `pitr_enabled: false`, `backups: []`, `physical_backup_data: {}`. A proven failure, never promoted to green.                                                                         |
| 2.3  | COMPLETE                          | `production-approval-packet.md` records the four-file contract, the three-file grant, the unaccepted verification procedure and `OWNER_APPROVAL_REQUIRED`; no production mutation.                                                                               |
| 2.4  | BLOCKED                           | No write: recovery absent, fourth migration unauthorized, live catalog unread, procedure unaccepted.                                                                                                                                                             |
| 2.5  | COMPLETE                          | Confirmed-synthetic cleanup kept separate and owner-gated; probable/ambiguous left untouched; no production records deleted.                                                                                                                                     |
| 3.1  | COMPLETE                          | All three iOS failures classified `TEST_BUG` in `ios-flow-classification.md` from artifact `10980993163`.                                                                                                                                                        |
| 3.2  | `DEFERRED_BY_OWNER / ENVIRONMENT` | Flow edits committed with regression guards, but unproven; iOS is deferred on a Windows host.                                                                                                                                                                    |
| 3.3  | `DEFERRED_BY_OWNER / ENVIRONMENT` | No iOS run dispatched or chased; iOS is never called certified, and the 10/13 evidence is preserved.                                                                                                                                                             |
| 4.1  | COMPLETE                          | Host RAM/CPU/processes recorded without terminating unrelated processes.                                                                                                                                                                                         |
| 4.2  | COMPLETE                          | J8 preserved as the recorded `ENVIRONMENT` posture with the 800 ms ceiling and 15 % floor unchanged.                                                                                                                                                             |
| 4.3  | `NOT_TRIGGERED`                   | Conditional antecedent never fired; the register records the root-cause fix and post-fix `maxSwitch=622/800`; no current product remediation is required.                                                                                                        |
| 4.4  | COMPLETE                          | `qa:full` chronology recorded: resource-deferred, then `QA_FULL_EXIT=0` at `c2ec475` (249 files passed / 1 skipped; e2e 235/49/0; deterministic 23/23).                                                                                                          |
| 5.1  | COMPLETE                          | Android qualified twice; final green battery at `80b0b33` (provisioning PASS, smoke 2/2, persistence 11/11, lifecycle 6/6), hermetic APK `E2F43FBB…`.                                                                                                            |
| 5.2  | COMPLETE                          | Disposable battery, default-off AI, store non-submission, gap-21 fail-closed and disabled anonymous signup confirmed external or already proven.                                                                                                                 |
| 6.1  | COMPLETE                          | Ten-surface adversarial review in `windows-closure-reconciliation/adversarial-review.md`: two findings (one fixed documentation claim, one fixed and device-verified flow defect), four withdrawn candidates, second pass recorded.                              |
| 6.2  | COMPLETE                          | Exact-head run `36824132137` on `210afd3` (quality success, e2e success with the main lane, nightly skipped as expected); the final pushed tip is re-attested by the commit-linked post-CI attestation.                                                          |
| 6.3  | COMPLETE                          | Archive predicates evaluated for both predecessors and the other local changes; nothing archived from checkbox counts or tidiness.                                                                                                                               |
| 6.4  | COMPLETE                          | This report: ten required sections, chronological superseded results, explicit production-mutation declaration, four-field residual blocks, conservative terminal state.                                                                                         |

**Actual checked count: 17/22.** Open and deliberately unchecked: 2.1, 2.4 (production),
3.2, 3.3 (owner-deferred), 4.3 (conditional, not triggered).
