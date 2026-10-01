# Closure report — DRAFT, not yet the final published report

Change: `final-certification-closure` · Prepared: 2026-09-29 · Schema: `spec-driven`

> **Task 6.4 is not checked.** The final candidate SHA now exists — `4fa769e` — but this draft is still not the final published report for two reasons: exact-head CI run `36515101194` has not completed, and the spec's required review (task 6.1) is still gated behind the production read-only verification (2.1, 2.2) that this change's own ordering places first. Both must close before this is the published report. The residual blocks below are complete and are the part that does not depend on the missing evidence.

## Terminal state

# NOT CERTIFIED

A substantive unresolved product/recovery gate keeps this state red. Production Scope-7 backup integrity is substantively red and, for the catalog read, still unverified — but its recovery-point limb is now **proven absent** from a direct read-only observation (`pitr_enabled: false`, `backups: []`), which is a `FAIL`, not an open question. Current-source iOS has three classified flow failures with edits applied but no recertification. J8's preserved 878 ms section-switch result is reclassified as an `ENVIRONMENT` host-load excursion, not an open product gate: `docs/testing/known-gaps.md` records `CG-4` and `CG-5` as CLOSED (2026-08-10, unchanged thresholds) and gap 15 as CLOSED with a 2026-09-24 root-cause fix. `external-blocker-closure` stays **unarchived**.

## 1. Identities

| Item                        | Value                                                                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Final candidate SHA         | `16cb41a25cced14ba1f3c20b1815dc17c8506bc6` — committed, pushed, and pinned as the head both open runs certify                           |
| `main` == `origin/main`     | `16cb41a` (fast-forward `575c403..4fa769e..16cb41a`, 0 ahead / 0 behind)                                                                |
| Superseded head             | `4fa769e4c12b78a47f42f2137be1204b1725e705` — carried the three iOS flow fixes; its CI `36515101194` was cancelled by the follow-up push |
| Base this change applied on | `575c4035e7b48e9d84df47f7a5f28dfcb14d7e27`                                                                                              |
| Branch                      | `main` only; one worktree; no branch, tag, stash, or history rewrite was created                                                        |
| Foreign stash               | `stash@{0}` `pre-recovery-local-changes` — preserved, never applied or dropped                                                          |
| Tree state                  | clean at `16cb41a`; only `.tmp-ios36423379932/` is untracked, and it is gitignored at `.gitignore:81`                                   |
| `.tmp-ios36423379932/`      | untracked, never staged, never committed, never deleted                                                                                 |
| Integration Node            | pinned `v22.23.2` used for every gate; ambient `v24.3.0` never ran a gate                                                               |

## 2. CI

**Green run — `36518073584` on `c1dc252` (push): completed SUCCESS.**

| Job       | Status    | Conclusion  | Verdict                                         |
| --------- | --------- | ----------- | ----------------------------------------------- |
| `quality` | completed | **success** | pass                                            |
| `e2e`     | completed | **success** | pass                                            |
| `nightly` | completed | skipped     | not a pass, not a failure — expected for a push |

`c1dc252` is the tip that carries every product change in this change: the three iOS flow fixes, the regression test, and the `workflow_dispatch` lane. This run is **not** the exact-head record for whatever tip exists after this report is committed, because `ci.yml` declares `concurrency: ${{ github.workflow }}-${{ github.event_name }}-${{ github.ref }}` with `cancel-in-progress: true`, so the push that lands these documents starts a new run. Task 6.2 therefore stays **open**: it requires exact-head CI to complete on the final candidate SHA.

**In flight — `36516000163`, iOS simulator E2E, `workflow_dispatch` on `16cb41a`.** This run is the task 3.3 recertification attempt. It was still `in_progress` when active monitoring was stopped at the operator's request, so **no iOS result exists and iOS is not certified**. `ios-native-e2e.yml` declares no concurrency group, so this run was never affected by later pushes and will still complete on its own; its result is simply not being awaited.

**Superseded — `36515963710` on `16cb41a`: completed CANCELLED, not green.** `quality` had completed success; `e2e` finished cancelled. Cancelled by the same `cancel-in-progress` rule when a later push landed. Recorded as cancelled, not as evidence.

**Superseded — `36515101194` on `4fa769e`: completed CANCELLED, not green.**

| Job       | Result                       |
| --------- | ---------------------------- |
| `quality` | success                      |
| `e2e`     | **cancelled** — not a pass   |
| `nightly` | skipped, expected for a push |

`4fa769e` carried the three iOS flow fixes. It was cancelled when `16cb41a` landed. The lesson is operational: a follow-up commit on the same branch supersedes the earlier run, so the final candidate SHA has to be fixed before its CI is treated as the record.

**Prior head — `575c403`: run `36449656365` completed success.**

| Job       | Result                                                     |
| --------- | ---------------------------------------------------------- |
| `quality` | success                                                    |
| `e2e`     | success, including deterministic scenarios and `dist-sync` |
| `nightly` | skipped, expected for a push                               |

`575c403` was a documentation-only tip and certifies no production, iOS, Android, or J8 result. The iOS workflow did not run on `575c403` or `4fa769e`: `ios-native-e2e.yml` triggered only on `pull_request` with the `ios-simulator-gha` label, so a push to `main` could not start it. It now also accepts `workflow_dispatch`, which is how `36516000163` was started against the main tip.

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

## 5. iOS — source and executable identity, fixed but NOT recertified

| Item                            | Value                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------- |
| Source SHA of the evidence      | `e9b42a3f31984f86dd50e0b337300df74898f422`                                   |
| Run / attempt                   | `36423379932` / 1, repository `quantdale/super-habits`                       |
| Executable SHA-256              | `ef22674b03518115bd465ac7a1293a7ad9e5439238a5af1ac9a6ac6085be9010`           |
| Bundle / simulator              | `com.dale16.superhabits`, iPhone 17 Pro, iOS 26.2, Xcode 26.2, Maestro 2.2.0 |
| Result                          | `NOT_CERTIFIED` at **10/13**; 10 PASS, 3 `FAILED_NEEDS_TRIAGE`               |
| Artifact                        | `10980993163`, read via the confirmed local extract                          |
| Current-source iOS at `575c403` | **unproven** — no run exists at this or any newer SHA                        |

All three failures are classified `TEST_BUG` with in-artifact evidence, and all three flows are edited (see `ios-flow-classification.md`). The edits are **unproven**, and the persistence replacement is the weakest of the three: the artifact shows the flow left the routine detail but not which gesture did it, so task 3.2 is left unchecked. All three require a new exact-SHA run to reach 13/13. `12/13` would not be certified either.

## 6. Android — current source and binary identity

`Nitro_API_36` exists and no device is attached. Classification: **`ENVIRONMENT`**. No current-source Android smoke, persistence, or lifecycle run was performed, and the historical APK was **not** reused — a historical binary cannot certify drifted source.

## 7. J8 environment and measurement

| Item                        | Value                                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Host                        | i5-13500HX, 20 logical cores, 31.73 GB total RAM, 110.3 h uptime                                                                                                                                                   |
| Available RAM               | **0.57 GB**, then 1.57 GB, then **0.26 GB** across three measurements — all non-credible                                                                                                                           |
| Repo-owned processes        | a single `pwsh.exe` shell; no lingering test, build, or emulator process                                                                                                                                           |
| Largest unrelated consumers | `vmmemWSL` 5,217 MB, `Memory Compression` 4,758 MB, `opencode` 875 MB, plus agent/editor runtimes                                                                                                                  |
| Terminated                  | nothing — no unrelated process was killed                                                                                                                                                                          |
| Preserved result            | **878 ms against the unchanged 800 ms ceiling** — recorded `ENVIRONMENT` host-load excursion, not an open product gate (register: `CG-4`/`CG-5` CLOSED 2026-08-10; gap 15 CLOSED with a 2026-09-24 root-cause fix) |
| HEAVY/J8 rerun              | **not run** — host headroom is not credible                                                                                                                                                                        |
| `qa:full`                   | **deferred**, and not marked passed from narrower gates                                                                                                                                                            |

The ceiling stays 800 ms and the 15 % floor stays 15 %. No app-owned cost was profiled or changed because no credible measurement was possible in this session — and none is required: the register's 2026-09-24 resolution already removed the app-owned/measurement contribution (`waitForSectionTransitionsSettled` before the measured round), with post-fix evidence persona 7/7, `maxSwitch=622/800` (22.3 % headroom), per-switch `619/407/395/500/622/457`, `diarySearch=396/500`, `pickerSearch=186/500`. The 878 ms result is retained verbatim as an `ENVIRONMENT` excursion under full-battery host load. Broad `qa:fast`/`qa:full` were not run for the same reason; the gates that were run are listed in the ExecPlan ledger.

## 8. OpenSpec and ExecPlan status

| Item                                   | Value                                                                                                 |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| This change                            | `final-certification-closure`, 14/22 tasks recorded; 8 remain: 2.1, 2.4, 3.2, 3.3, 4.3, 6.1, 6.2, 6.4 |
| This ExecPlan                          | `Plan-Version: 2`, `Status: BLOCKED`, validates PASS                                                  |
| Predecessor `external-blocker-closure` | 27/27, ExecPlan `ACTIVE`, report `NOT CERTIFIED`, **unarchived**                                      |

## 9. Archive decision

**`external-blocker-closure` is NOT archived.** Its closure predicate is not met. Unmet gates, by name:

1. **Production Scope-7 backup integrity** — substantively red and now additionally unverified, because no read-only credential was available.
2. **Current-source iOS** — three executable flow failures were classified and their flows edited, but no 13/13 run exists at any current SHA, and the persistence replacement has no artifact support.
3. **J8** — **removed from the unmet set.** The 878 ms miss no longer stands as a product gate: the register classifies the residual as an `ENVIRONMENT` host-load excursion, `CG-4`/`CG-5` are CLOSED (2026-08-10) and gap 15 is CLOSED with a 2026-09-24 root-cause fix, with every ceiling (800 ms), floor (15 %), fixture, and assertion unchanged. The archive predicate's third limb — a reproducible product performance regression against an unchanged ceiling — is therefore not met.

## 10. Residuals

Every residual below carries `WHY`, `CLASSIFICATION`, `WHAT IS REQUIRED`, and `EXACT RESUME ACTION`.

### R1 — iOS recertification

- **WHY:** The three classified fixes are unproven, and no current-source iOS run exists.
- **CLASSIFICATION:** BLOCKED — NO CERTIFIED iOS RESULT AT AN EXACT SHA (task 3.2 also remains open on the persistence fix). The trigger blocker is resolved: the owner chose the `workflow_dispatch` route, it was added to `.github/workflows/ios-native-e2e.yml` and pushed as `16cb41a`, and run `36516000163` was dispatched against the `main` tip. No completed artifact exists for it, so iOS is not certified.
- **WHAT IS REQUIRED:** The commit and push are DONE: 16 files as `4fa769e`, fast-forwarded, `main` == `origin/main`. What is still required is a runnable path. `.github/workflows/ios-native-e2e.yml` declares only `on: pull_request: types: [labeled, synchronize]`, its job is gated on the `ios-simulator-gha` label, and it has no `workflow_dispatch`; run `36423379932` was likewise a `pull_request` run from `codex/external-blocker-closure`. A push to `main` therefore cannot start it. Either a labelled PR is opened (needs a head branch, and would certify a SHA that is not the `main` tip) or a `workflow_dispatch` trigger is added and the job gate plus `EXPECTED_SOURCE_SHA` are adapted for dispatch events, which changes a release-gate workflow and needs an owner decision. Then require build, executable hash, install, launch, and 13/13 flow passes.
- **EXACT RESUME ACTION:** Re-read the dispatched run's artifact (`36516000163`) if it completed, or dispatch a fresh exact-SHA run, and compare its flow statuses against the three classified flows before changing anything — do not assume a fix held. A first attempt may still fail, especially for the persistence scroll, which is an untested hypothesis. iOS stays deferred by the owner: do not edit `.maestro/` or chase iOS failures without an explicit owner decision.

### R2 — Production read-only verification

- **WHY:** The 2026-09-28 production posture is unconfirmed, and a stale hypothesis must not drive a write.
- **CLASSIFICATION:** BLOCKED — MISSING CREDENTIAL
- **WHAT IS REQUIRED:** The production database password, or a configured read-only SQL credential. Read-only access alone is sufficient and is **not** DDL authorization. The recovery-point half of this workstream is already **proven absent** from the Management API (`supabase backups list --project-ref kruubbynsmxzxfdunaal` → `pitr_enabled: false`, `backups: []`, `physical_backup_data: {}`, `walg_enabled: true`), so task 2.2 is closed as an explicit `FAIL`; this entry now covers task 2.1's catalog read only.
- **EXACT RESUME ACTION:** Set the credential, then run read-only `supabase_migrations.schema_migrations`, `information_schema.tables` for the four Gym V2 tables, `information_schema.columns` for the targeted numeric columns, the `habit_completions` constraint/index inventory, and a `backup_manifest` count against project `kruubbynsmxzxfdunaal`. Record actual values, not the hypothesis. Separately, PITR or a physical backup must be enabled before any DDL consideration.

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
- **CLASSIFICATION:** CLOSED as a product gate; the recorded result is an `ENVIRONMENT` host-load excursion. `docs/testing/known-gaps.md` records `CG-4` and `CG-5` as **CLOSED** (2026-08-10, `close-cg4-cg5-performance-gaps`) and gap 15 as **CLOSED (TEST_BUG; residual `ENVIRONMENT` ceiling excursions stay recorded)** with a 2026-09-24 root-cause resolution: the measured round began while the warm-up's six back-to-back section transitions were still settling, and `waitForSectionTransitionsSettled(page)` corrected the measurement at the source. Post-fix evidence: persona 7/7 green, `maxSwitch=622/800` (22.3 % headroom), per-switch `619/407/395/500/622/457`, `diarySearch=396/500`, `pickerSearch=186/500`. Every ceiling, floor, fixture, and assertion is unchanged, and the 878 ms number is preserved verbatim.
- **WHAT IS REQUIRED:** Nothing to close the product gate. The `ENVIRONMENT` residual stays recorded: a future ceiling breach is re-verified standalone on an idle host before any product code is touched.
- **EXACT RESUME ACTION:** None. Do not raise the 800 ms ceiling and do not treat the older release-candidate headroom scenario as a waiver. If a future run breaches the ceiling, run `npx playwright test --project=journeys e2e/journeys/three-months-in.spec.ts -g "Tom"` on an idle host and classify with the recorded per-switch numbers before touching product code.

### R7 — Current-source Android

- **WHY:** `ENVIRONMENT`; the historical APK cannot certify drifted source.
- **CLASSIFICATION:** ENVIRONMENT
- **WHAT IS REQUIRED:** Enough host memory to boot `Nitro_API_36` safely, then current-source smoke, persistence, and lifecycle.
- **EXACT RESUME ACTION:** On a host with credible headroom, run `npm run qa:native:android -- --tag smoke`, then persistence, then lifecycle, at the candidate SHA. Do not reuse the historical APK.

### R8 — `qa:full`

- **WHY:** Deferred for host memory; it is not passed.
- **CLASSIFICATION:** ENVIRONMENT / DEFERRED
- **WHAT IS REQUIRED:** A credible host.
- **EXACT RESUME ACTION:** Run `npm run qa:full` on pinned Node 22.23.2. Until then this stays visibly deferred and is never inferred from `qa:fast` or CI.

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
