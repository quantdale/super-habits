# Closure report — DRAFT, not yet the final published report

Change: `final-certification-closure` · Prepared: 2026-09-29 · Schema: `spec-driven`

> **Task 6.4 is not checked.** This draft is incomplete on its own terms: it cannot name the final candidate SHA, because task 6.2 (commit, fast-forward push, exact-head CI) has not run, and the spec's required identities include that SHA. It also cannot carry the full recovery / checksums / owner-isolation / migration-order / incident-separation / store-claims review that task 6.1 requires, which this change's own ordering places behind the production read-only verification (2.1, 2.2). Both must be closed before this is the published report. The residual blocks below are complete and are the part that does not depend on the missing evidence.

## Terminal state

# NOT CERTIFIED

A substantive unresolved product/recovery gate keeps this state red. Production Scope-7 backup integrity is substantively red _and_ currently unverifiable, because no read-only production credential is available. Current-source iOS has three classified flow failures with edits applied but no recertification. J8 is an open performance miss against an unchanged ceiling. `external-blocker-closure` stays **unarchived**.

## 1. Identities

| Item                        | Value                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Final candidate SHA         | **not established** — task 6.2 is open; this change is uncommitted, so no candidate exists yet                                              |
| `HEAD` at apply time        | `575c4035e7b48e9d84df47f7a5f28dfcb14d7e27`                                                                                                  |
| `origin/main` at apply time | `575c4035e7b48e9d84df47f7a5f28dfcb14d7e27` (identical, fast-forward clean)                                                                  |
| Branch                      | `main` only; one worktree; no branch, tag, stash, or history rewrite was created                                                            |
| Foreign stash               | `stash@{0}` `pre-recovery-local-changes` — preserved, never applied or dropped                                                              |
| Tree state                  | 3 modified `.maestro/flows/*.yaml`, 1 new `tests/maestroIosFlowGuards.test.ts`, 1 new untracked change directory, 1 untracked local extract |
| `.tmp-ios36423379932/`      | untracked, not committed, not deleted                                                                                                       |
| Integration Node            | pinned `v22.23.2` used for every gate; ambient `v24.3.0` never ran a gate                                                                   |

## 2. CI

GitHub run `36449656365` on `575c403` (push, "docs: record closing validation for external-blocker-closure"): **completed success**.

| Job       | Result                                                     |
| --------- | ---------------------------------------------------------- |
| `quality` | success                                                    |
| `e2e`     | success, including deterministic scenarios and `dist-sync` |
| `nightly` | skipped, expected for a push                               |

This is a documentation-only tip. It contains **no** production-schema, iOS, Android, or J8 result and certifies none of them. No exact-head CI exists for this change, because this change is not committed or pushed.

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

| Item                        | Value                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------- |
| Host                        | i5-13500HX, 20 logical cores, 31.73 GB total RAM, 110.3 h uptime                                  |
| Available RAM               | **0.57 GB**, then 1.57 GB, then **0.26 GB** across three measurements — all non-credible          |
| Repo-owned processes        | a single `pwsh.exe` shell; no lingering test, build, or emulator process                          |
| Largest unrelated consumers | `vmmemWSL` 5,217 MB, `Memory Compression` 4,758 MB, `opencode` 875 MB, plus agent/editor runtimes |
| Terminated                  | nothing — no unrelated process was killed                                                         |
| Preserved result            | **878 ms against the unchanged 800 ms ceiling**                                                   |
| HEAVY/J8 rerun              | **not run** — host headroom is not credible                                                       |
| `qa:full`                   | **deferred**, and not marked passed from narrower gates                                           |

The ceiling stays 800 ms. No app-owned cost was profiled or changed because no credible measurement was possible. Broad `qa:fast`/`qa:full` were not run for the same reason; the gates that were run are listed in the ExecPlan ledger.

## 8. OpenSpec and ExecPlan status

| Item                                   | Value                                                                                                      |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| This change                            | `final-certification-closure`, 13/22 tasks recorded; 9 remain: 2.1, 2.2, 2.4, 3.2, 3.3, 4.3, 6.1, 6.2, 6.4 |
| This ExecPlan                          | `Plan-Version: 2`, `Status: BLOCKED`, validates PASS                                                       |
| Predecessor `external-blocker-closure` | 27/27, ExecPlan `ACTIVE`, report `NOT CERTIFIED`, **unarchived**                                           |

## 9. Archive decision

**`external-blocker-closure` is NOT archived.** Its closure predicate is not met. Unmet gates, by name:

1. **Production Scope-7 backup integrity** — substantively red and now additionally unverified, because no read-only credential was available.
2. **Current-source iOS** — three executable flow failures were classified and their flows edited, but no 13/13 run exists at any current SHA, and the persistence replacement has no artifact support.
3. **J8** — the 878 ms miss stands against the unchanged 800 ms ceiling.

## 10. Residuals

Every residual below carries `WHY`, `CLASSIFICATION`, `WHAT IS REQUIRED`, and `EXACT RESUME ACTION`.

### R1 — iOS recertification

- **WHY:** The three classified fixes are unproven, and no current-source iOS run exists.
- **CLASSIFICATION:** EXECUTABLE, AWAITING OWNER PUSH AUTHORIZATION (task 3.2 also remains open on the persistence fix)
- **WHAT IS REQUIRED:** Commit the three `.maestro/flows` edits, the new regression test, and this change's artifacts; fast-forward push to `main`; run the iOS workflow at that exact SHA; require build, executable hash, install, launch, and 13/13 flow passes.
- **EXACT RESUME ACTION:** `git add .maestro/flows tests/maestroIosFlowGuards.test.ts openspec/changes/final-certification-closure && git commit`, then `git push origin main` (fast-forward only), then `gh workflow run <ios-workflow> --ref main` and `gh run watch <id>`. Compare the new artifact's flow statuses against the three classified flows. A first attempt may still fail; if it does, re-read the new artifact before changing anything.

### R2 — Production read-only verification

- **WHY:** The 2026-09-28 production posture is unconfirmed, and a stale hypothesis must not drive a write.
- **CLASSIFICATION:** BLOCKED — MISSING CREDENTIAL
- **WHAT IS REQUIRED:** The production database password, or a configured read-only Supabase credential. Read-only access alone is sufficient and is **not** DDL authorization.
- **EXACT RESUME ACTION:** Set the credential, then run read-only `supabase_migrations.schema_migrations`, `information_schema.tables` for the four Gym V2 tables, `information_schema.columns` for the targeted numeric columns, and a `backup_manifest` count against project `kruubbynsmxzxfdunaal`. Record actual values, not the hypothesis.

### R3 — Production DDL rollout

- **WHY:** The three missing migrations leave production backup scope behind local.
- **CLASSIFICATION:** OWNER_APPROVAL_REQUIRED
- **WHAT IS REQUIRED:** One explicit approval naming the project `kruubbynsmxzxfdunaal`, the exact three migrations `20260824010000`, `20260824020000`, `20260925125655` in that order, a named proven-restorable `public` + `auth` recovery point, and acceptance of the verification procedure in `production-approval-packet.md` §6.
- **EXACT RESUME ACTION:** Prove the recovery point first. Then dry-run and confirm the only three migrations appear, in order; any drift or surprise stops the write and updates the packet. Apply, then verify schema, RLS, grants, indexes, advisors, and a cleaned-up synthetic decimal Restore V2 with checksums **enabled and unmodified**. Audit each historical manifest cohort without rewriting manifests or weakening checksums.

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

### R6 — J8 performance miss

- **WHY:** 878 ms against an unchanged 800 ms ceiling.
- **CLASSIFICATION:** UNRESOLVED PRODUCT-PERF GATE, with this session's blocker being ENVIRONMENT
- **WHAT IS REQUIRED:** A host with credible free memory — the 0.57 GB observed here cannot make the number meaningful — then a HEAVY/J8 rerun. If a credible rerun exceeds 800 ms, an app-owned fix without moving the ceiling.
- **EXACT RESUME ACTION:** Free memory or run on a credible host, re-measure J8, and keep the 800 ms ceiling. Do not cite the older release-candidate headroom scenario as a waiver.

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

`NOT CERTIFIED` cannot become `LOCALLY COMPLETE — EXTERNAL ACTIONS REQUIRED` on the native lanes alone. Closing R1 (iOS), R6 (J8) and R7 (Android) would still leave production Scope-7 substantively red, and a red recovery gate keeps the terminal state `NOT CERTIFIED` on its own. Native closure is necessary, never sufficient.

The order that actually matters:

1. **R2 first** — obtain the read-only credential and establish the real production posture. Everything production-related is unverified until this happens, and the 2026-09-28 hypothesis must not be used to justify a write.
2. **R3 second** — prove the recovery point, then apply only the three named migrations under the four-part approval. R3 may not be granted from a stale hypothesis.
3. **R1, R6, R7** — iOS 13/13 at a real candidate SHA, a credible J8 measurement, and current-source Android. These are independent of production and can proceed in parallel, but they cannot promote the terminal state alone.
4. **R4, R5** — historical precision and incident deletion remain separate owner decisions even after R3 succeeds.

Archiving `external-blocker-closure` requires R1, R2/R3, and R6 closed together. No single one of them is sufficient.
