## 1. Main preflight and successor ExecPlan

- [x] 1.1 Confirm `main` matches `origin/main`, preserve stash `pre-recovery-local-changes`, and do not commit or delete `.tmp-ios36423379932/`
- [x] 1.2 Put pinned Node `v22.23.2` on `PATH` and record `node --version` before any integration gate
- [x] 1.3 Create `openspec/changes/final-certification-closure/execplan.md` with `Plan-Version: 2` and `Status: ACTIVE`, then validate it with `npm run agent:plan:validate`
- [x] 1.4 Record GitHub run `36449656365` as completed success for quality, full E2E, deterministic scenarios, and dist-sync, and state that it does not certify production, iOS, Android, or J8

## 2. Production schema and historical integrity

- [ ] 2.1 Re-verify project `superhabits` / `kruubbynsmxzxfdunaal` read-only, including name, ref, hosts, migration head, Gym V2 tables, numeric column types, and manifest counts
- [x] 2.2 Prove or explicitly fail a restorable `public` and `auth` recovery point, and stop DDL on drift, a missing recovery point, or any dry-run migration other than the exact four files in order — **explicitly FAILED, proven absent:** `supabase backups list --project-ref kruubbynsmxzxfdunaal` (2026-10-01, read-only Management API) returned `pitr_enabled: false`, `backups: []`, `physical_backup_data: {}`, `walg_enabled: true`. No restorable point covers `public` or `auth`, so production DDL stays stopped regardless of credential or authorization.
- [x] 2.3 If explicit approval for that project, the named migrations, the recovery point, and the verification procedure is absent, write the approval packet and mark the write `OWNER_APPROVAL_REQUIRED` without mutating production — the packet now records four migrations against a three-migration grant and the proven-absent recovery point.
- [ ] 2.4 If that approval is present, apply only the approved migrations (four as of 2026-09-30; the current grant names three), verify schema, RLS, grants, indexes, advisors, and a cleaned-up synthetic decimal Restore V2, then audit each historical manifest cohort without rewriting manifests or weakening checksums
- [x] 2.5 Keep confirmed-synthetic cleanup separate and `OWNER_APPROVAL_REQUIRED` unless exact-target deletion approval already exists; leave probable and ambiguous records untouched

## 3. iOS 13/13

- [x] 3.1 Classify `native-smoke`, `workout-gym-v2-persistence`, and `workout-gym-v2-session-lifecycle` from artifact `10980993163` before editing the app or flows
- [ ] 3.2 Fix only the classified executable defects, keep the lifecycle persistence assertion, and add regression coverage for each product or test fix
- [ ] 3.3 Run a new exact-SHA iOS workflow and require build, executable hash, install, launch, and 13/13 flow passes before calling iOS certified

## 4. J8 and deferred full QA

- [x] 4.1 Record host RAM, CPU, repo-owned processes, and unrelated heavy processes without terminating unrelated processes
- [x] 4.2 Run the HEAVY/J8 qualification only when resources are credible; otherwise preserve the 878 ms result and the 800 ms ceiling as the recorded `ENVIRONMENT` posture (the register already records `CG-4`/`CG-5` CLOSED and gap 15 CLOSED with a 2026-09-24 root-cause fix, nothing weakened)
- [ ] 4.3 If a credible rerun exceeds 800 ms, fix the app-owned cost without raising the ceiling and rerun — **NOT TRIGGERED, and no app-owned cost remains to fix:** the register records the J8 residual as CLOSED (`CG-4`/`CG-5` 2026-08-10; gap 15's 2026-09-24 `waitForSectionTransitionsSettled` root cause) with every ceiling, floor, fixture, and assertion unchanged and post-fix `maxSwitch=622/800`; the 878 ms result is an `ENVIRONMENT` host-load excursion, and no credible rerun in this campaign breached the ceiling. Task stays unchecked because its antecedent never fired in this campaign.
- [x] 4.4 Run `qa:full` only when resources are credible; if deferred, keep that deferral visible and do not mark it passed from narrower gates

## 5. Current-source Android and non-blocking residuals

- [x] 5.1 Run current-source Android smoke, persistence, and lifecycle on `Nitro_API_36` when it can start safely; otherwise record `ENVIRONMENT` and do not reuse the historical APK
- [x] 5.2 Confirm the disposable authenticated battery, default-off AI, store non-submission, gap-21 fail-closed behavior, and disabled anonymous signup remain external or already proven, without enabling production anonymous auth or repeating invalidated work

## 6. Adversarial review, exact-head CI, and archive decision

- [ ] 6.1 Review recovery, checksums, owner isolation, migration order, incident separation, current-source native evidence, test-only behavior, and store claims; fix each executable defect and review again
- [ ] 6.2 Establish the final candidate SHA, push only fast-forward on `main`, and record exact-head CI job results after the run completes
- [x] 6.3 Archive `external-blocker-closure` only if its closure predicate is met; otherwise leave it `ACTIVE` with the unmet gate named
- [ ] 6.4 Publish the evidence-backed closure report with the required identities and a `WHY` / `CLASSIFICATION` / `WHAT IS REQUIRED` / `EXACT RESUME ACTION` block for every residual
