# Closure report — DRAFT, not yet the final published report

Change: `final-certification-closure` · Prepared: 2026-09-29 · Updated: 2026-10-01 · Schema: `spec-driven`

> **Task 6.4 is not checked.** This draft is not yet the final published report because the linked successor `windows-closure-reconciliation` still holds the Android smoke qualification, the full ten-surface adversarial review (task 6.1), the final source candidate, and the exact-head CI attestation for that candidate. Task 6.2 is now **closed** for the verified candidate `210afd39a99e2b2dbf5026b58a1191182e05f368` (run `36824132137`); any later commit is a new tip and is re-attested through the successor's commit-linked final attestation rather than reused parent-SHA CI. The residual blocks below are the part that does not depend on the missing evidence. This draft deliberately keeps superseded events visible as history instead of deleting them.

## Terminal state

# NOT CERTIFIED

A substantive unresolved product/recovery gate keeps this state red. Production Scope-7 backup integrity is substantively red and, for the catalog read, still unverified — but its recovery-point limb is now **proven absent** from a direct read-only observation (`pitr_enabled: false`, `backups: []`), which is a `FAIL`, not an open question. Current-source iOS has three classified flow failures with edits applied but no recertification. J8's preserved 878 ms section-switch result is reclassified as an `ENVIRONMENT` host-load excursion, not an open product gate: `docs/testing/known-gaps.md` records `CG-4` and `CG-5` as CLOSED (2026-08-10, unchanged thresholds) and gap 15 as CLOSED with a 2026-09-24 root-cause fix. `external-blocker-closure` stays **unarchived**.

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

Confirmed read-only facts: project `kruubbynsmxzxfdunaal` is named `superhabits` and is the linked project; the repo `.env` points at it; the IPv4 pooler is reachable from this host. A live query is **impossible without the database password** — `psql` returns `fe_sendauth: no password supplied`, the Supabase CLI SQL paths require an interactive password, and no Supabase MCP server is configured. The predecessor's "AAAA-only host" blocker is specific to the direct database host, not the pooler.

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

## 6. Android — current source and binary identity

| Item              | Value                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Source SHA        | `68db684d0915d8cd781d52b282a3934ca214171b` (clean tree, detached exact-source checkout)                                                        |
| Target            | `Nitro_API_36`, `emulator-5554`, API 36, `x86_64`                                                                                              |
| Package / version | `com.dale16.superhabits`, versionName `1.0.0`, versionCode 1                                                                                   |
| APK SHA-256       | `5DF9D5DC72EF13B4B88DF32527244C50BD750D1C48EF79EB0CA3B6D2ADFA1014`                                                                             |
| Provisioning      | **PASS** — hermetic build (`EXPO_NO_DOTENV=1`, no ambient `EXPO_PUBLIC_*`), 0 bundle-scan matches for `supabase.co`                            |
| Smoke             | **1/2** — `native-smoke` PASS, `command-center-v2` `FAILED_NEEDS_TRIAGE`                                                                       |
| Persistence       | **11/11 PASS** (coverage verdict `OK`)                                                                                                         |
| Lifecycle         | **6/6 PASS** (coverage verdict `OK`)                                                                                                           |
| Residual          | `command-center-v2` step 14 `tapOn: 'Create'` — the ordinary build never mounts the rollout-gated mode selector, so no `Create` element exists |

The historical APK was not reused. The `command-center-v2` failure is a stale flow step against the intentional default-off render boundary (`features/command/commandSurface.ts`, `CommandScreen`'s `if (!AI_ASK_EXPERIMENT_ENABLED) return commandContent` branch); the raw report labels it `PRODUCT_BUG` while the hierarchy shows no `Create`, `Ask`, or `Auto` element at all. The scoped Android repair, its regression guard, and the current-source re-qualification are the successor's task 3 and are recorded there; this section is superseded by that result when it lands.

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

| Item                                   | Value                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| This change                            | `final-certification-closure`, **15/22 tasks recorded** (2.1, 2.4, 3.2, 3.3, 4.3, 6.1, 6.4 open) |
| This ExecPlan                          | `Plan-Version: 2`, `Status: BLOCKED`, validates PASS                                             |
| Predecessor `external-blocker-closure` | 27/27, ExecPlan `ACTIVE`, report `NOT CERTIFIED`, **unarchived**                                 |
| Successor this campaign runs           | `windows-closure-reconciliation`, 42-task apply checklist; owns the seven open tasks below       |

The successor's review and reporting checkpoints do **not** depend on the production SQL credential. Live production facts stay explicitly blocked; the repository-level review of all ten certification-critical surfaces proceeds independently, and only the live catalog assertions remain unverified. Task 6.1 is therefore in progress rather than gated behind 2.1.

## 9. Archive decision

**`external-blocker-closure` is NOT archived.** Its closure predicate is not met. Unmet gates, by name:

1. **Production Scope-7 backup integrity** — substantively red and now additionally unverified, because no read-only credential was available.
2. **Current-source iOS** — three executable flow failures were classified and their flows edited, but no 13/13 run exists at any current SHA, and the persistence replacement has no artifact support.
3. **J8** — **removed from the unmet set.** The 878 ms miss no longer stands as a product gate: the register classifies the residual as an `ENVIRONMENT` host-load excursion, `CG-4`/`CG-5` are CLOSED (2026-08-10) and gap 15 is CLOSED with a 2026-09-24 root-cause fix, with every ceiling (800 ms), floor (15 %), fixture, and assertion unchanged. The archive predicate's third limb — a reproducible product performance regression against an unchanged ceiling — is therefore not met.

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

- **WHY:** The `command-center-v2` smoke flow failed at `tapOn: 'Create'` on the current-source hermetic APK.
- **CLASSIFICATION:** `TEST_BUG` (successor task 3.1) — the ordinary build never mounts the rollout-gated mode selector, so the stale step can never match; the raw report's `PRODUCT_BUG` label is reconciled as raw-machine triage, not a product defect. Provisioning PASS, persistence 11/11, lifecycle 6/6, smoke 1/2 at `68db684`.
- **WHAT IS REQUIRED:** The scoped platform-aware flow correction plus regression guard, then the complete smoke/persistence/lifecycle batteries from a clean exact-source checkout at the final candidate, with source/APK identity recorded. This is successor task 3.4/3.5 work; this draft is superseded by its result.
- **EXACT RESUME ACTION:** `node scripts/qa-native.mjs --platform android --tag smoke --serial <verified-serial>`, then `--tag persistence`, then `--tag lifecycle`, from a clean checkout of the committed candidate with pinned Node 22.23.2 and ambient Supabase variables unset. Do not reuse the historical APK and do not add app test IDs or expose the hidden AI controls to satisfy the flow.

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

`NOT CERTIFIED` cannot become `LOCALLY COMPLETE — EXTERNAL ACTIONS REQUIRED` on the native lanes alone. Closing R1 (iOS) and R7 (Android) would still leave production Scope-7 substantively red, and a red recovery gate keeps the terminal state `NOT CERTIFIED` on its own. Native closure is necessary, never sufficient. R6 is already closed as a product gate (the 878 ms result is an `ENVIRONMENT` excursion).

The order that actually matters:

1. **R2 first** — obtain the read-only credential and establish the real production posture. Everything production-related is unverified until this happens, and the 2026-09-28 hypothesis must not be used to justify a write.
2. **R3 second** — prove a recovery point, then apply only the four named migrations under the amended four-part approval. R3 may not be granted from a stale hypothesis, and its fourth migration is not yet authorized by the owner's three-migration grant.
3. **R1, R6, R7** — iOS 13/13 at a real candidate SHA, the closed J8 product gate (R6 requires nothing further), and current-source Android. These are independent of production and can proceed in parallel, but they cannot promote the terminal state alone.
4. **R4, R5** — historical precision and incident deletion remain separate owner decisions even after R3 succeeds.

Archiving `external-blocker-closure` requires R1 and R2/R3 closed together. No single one of them is sufficient; R6 no longer blocks it.
