## Context

See proposal.md for why this successor exists. Planning-time `main` and `origin/main` are `575c4035e7b48e9d84df47f7a5f28dfcb14d7e27`. The fast-forward from `23ded6e` preserved stash `pre-recovery-local-changes` and left only the untracked local extract `.tmp-ios36423379932/`. GitHub run `36449656365` on that SHA has completed: `quality` success, full `e2e` success including deterministic scenarios and `dist-sync`, `nightly` skipped as expected for a push. That run does not contain a new iOS, Android, J8, or production-schema result.

`external-blocker-closure` remains the active predecessor: 27/27 tasks checked, ExecPlan `ACTIVE`, report `NOT CERTIFIED`, intentionally unarchived. Product and Maestro files are unchanged from iOS source `e9b42a3f31984f86dd50e0b337300df74898f422` to current `HEAD`. The latest iOS evidence is run `36423379932`: 10/13, artifact `10980993163`, executable SHA-256 `ef22674b03518115bd465ac7a1293a7ad9e5439238a5af1ac9a6ac6085be9010`. The three failures are `native-smoke`, `workout-gym-v2-persistence`, and `workout-gym-v2-session-lifecycle`.

The production hypothesis, last read on 2026-09-28 and not re-queried in this planning session, is project `superhabits` / `kruubbynsmxzxfdunaal`, 12 migrations through `20260822000000`, exactly three repository migrations missing, four Gym V2 backup tables absent, targeted numeric columns still `REAL`, and about 41 manifests. The disposable authenticated Scope-7 battery already passed after `20260925125655_backup_numeric_precision.sql`. That is not historical production proof.

## Goals / Non-Goals

**Goals:**

- Give later execution one residual path that can close executable red gates without reopening finished workstreams.
- Keep production writes, incident deletion, provider spend, signing, and store submission behind explicit approval.
- Preserve the 800 ms J8 ceiling and the fail-closed Restore V2 checksum.

**Non-Goals:**

- Implementing product, test, or schema changes in this planning change.
- Re-running the disposable authenticated battery, the AI deterministic corpus, or store-doc preparation unless a later source change invalidates them.
- Choosing gap 21 option B or C, enabling anonymous production auth, tagging `v1.0.0`, or raising J8/D14 ceilings.
- Archiving `external-blocker-closure` from this design alone.

## Decisions

### 1. A successor change, not a rewrite of the predecessor

`external-blocker-closure` stays the historical evidence record. This change owns only the residuals. Its apply step creates a new Plan-Version 2 ExecPlan in this change directory and does not flip the predecessor to completed or archived until the archival predicate in the new spec is met.

Alternative: uncheck the predecessor tasks and continue that change. Rejected. OpenSpec already reports it complete, and the prompt forbids treating those checkboxes as certification or restarting the campaign. Alternative: archive it now and start clean. Rejected. The report is still `NOT CERTIFIED`.

### 2. Later execution stays on main

The predecessor decision to use `codex/external-blocker-closure` is historical. This successor follows the current operator instruction: `main` only, fast-forward pulls, no feature branch, no worktree, no force-push, no `git reset --hard`. The foreign stash is not a worktree and is not an edit target. The untracked iOS extract is local evidence residue, not a commit target.

Alternative: resume the old feature branch. Rejected. `origin/main` already contains that campaign's commits, and the operator required `main`.

### 3. CI 36449656365 is closed and insufficient

Apply does not wait on that run. It records quality success, full E2E success, deterministic scenario success, dist-sync success, nightly skipped, and exact SHA `575c403`. A new red found on a later exact head becomes part of this change. A green docs-only run does not clear P2, iOS, Android, or J8.

Alternative: push a no-op commit to obtain a fresh run before triage. Rejected. It would cancel nothing now, but it also would not test a fix and would churn `main`.

### 4. Production DDL is a gated procedure, not an inferred authorization

Apply re-verifies production read-only before using the 2026-09-28 hypothesis. Drift stops the write path and updates the ExecPlan. No recovery point, or any dry-run surprise, also stops the write. This planning session contains no explicit DDL approval, so apply prepares the approval packet and continues other lanes unless a later operator message names project `kruubbynsmxzxfdunaal`, the exact named migration set (four files as of 2026-09-30; the owner's grant names three), the recovery point, and the verification procedure. Incident deletion is never implied by schema approval. The other 347 probable or ambiguous records stay untouched. No other Supabase project is queried or mutated.

Alternative: treat the continuation prompt as DDL approval. Rejected. The prompt explicitly says not to infer that approval.

### 5. iOS edits wait on classification of artifact 10980993163

The three failures are not pre-classified as product bugs. Apply reads the uploaded artifact, and may use `.tmp-ios36423379932/` only after confirming it is that artifact, before editing. Likely seams, not prescribed fixes: Focus sequence visibility versus text matching for `native-smoke`; Workout card scroll, virtualization, or persistence for the custom press progression row; a platform-safe keyboard dismissal that still asserts weight survival for session lifecycle. Do not change user-facing copy to satisfy Maestro. A fix requires a new exact SHA and a new 13/13 run. `12/13` is not certified.

Alternative: replace `hideKeyboard` immediately because the prompt names it. Rejected until the artifact shows that command is the actual failure and the weight assertion remains.

### 6. J8 is rechecked only when the host can make the number meaningful

Record total RAM, available RAM, CPU, repo-owned processes, and unrelated heavy processes. Do not kill unrelated processes. If resources are not credible, keep the 878 ms result and the deferred `qa:full` classification. The register already records `CG-4` and `CG-5` as CLOSED (2026-08-10, unchanged thresholds) and gap 15 as CLOSED with a 2026-09-24 root-cause resolution (`waitForSectionTransitionsSettled` before the measured round; post-fix `maxSwitch=622/800`, persona 7/7, floor unchanged), so the 878 ms result is an `ENVIRONMENT` host-load excursion rather than an open product miss. If a credible rerun still exceeds 800 ms, profile the app-owned path and fix it without moving the ceiling. The older release-candidate headroom scenario is not a waiver for this preserved result.

Alternative: raise the ceiling to 878 ms and cite harness load. Rejected by the prompt and by the new requirement.

### 7. Android, anonymous bootstrap, AI, store, and gap 21 stay bounded

Current-source Android uses the repository native qualification on `Nitro_API_36` when that emulator can start safely. Otherwise the lane is `ENVIRONMENT`; the historical APK is not reused. The passing disposable battery is not repeated unless backup or schema code changes. Anonymous bootstrap is classified against the release contract; disabled anonymous signup is not fixed by enabling production anonymous auth. AI remains default-off and is not a certification dependency. Store submission, signing, and `v1.0.0` stay unauthorized. Gap 21 stays fail-closed at option A until the owner selects B or C in a separate change.

Alternative: block the whole successor on anonymous-auth or AI rollout. Rejected. Those are not the substantive red product gates named by the predecessor report.

### 8. Adversarial review and archival happen after executable work

After P2, iOS, and J8 are as far as authorization allows, a skeptical review tries to invalidate recovery, checksums, owner isolation, migration order, incident separation, current-source native evidence, test-only code, and store claims. An executable defect is fixed with regression coverage and reviewed again. Final certification names one candidate SHA and waits for exact-head CI. Archive the predecessor only when the new spec's predicate holds; otherwise leave it `ACTIVE` and say why.

## Risks / Trade-offs

- [The 2026-09-28 production catalog is stale] → Re-verify read-only before any dry run. Stop on drift.
- [A local iOS extract may not be artifact 10980993163] → Confirm identity before using it. Do not commit the extract.
- [A green iOS rerun could be mistaken for campaign closure] → P2 and J8 remain independent gates. Do not archive on 13/13 alone.
- [Historical `REAL` values cannot be un-rounded by `NUMERIC`] → Classify those cohorts honestly. Recapture only from an authoritative source device.
- [Low host memory makes J8 and `qa:full` churn] → Do not loop the expensive gate indefinitely. Preserve `ENVIRONMENT` when resources stay inadequate.
- [Main-only work can collide with the operator's other edits] → Apply starts with status, fetch, and a fast-forward check. Stop if `main` has diverged or the stash was disturbed.

## Migration Plan

No user-data migration is authorized by these artifacts. Apply order is: new ExecPlan and main preflight; record CI `36449656365`; read-only production identity and recovery check; exact four-file dry run; approval packet or, only with explicit approval, controlled rollout and historical audit; iOS classification and fix; exact-SHA 13/13 rerun; resource-gated J8/`qa:full`; current-source Android or honest environment block; adversarial review; exact-head CI; archive decision and closure report. Rollback of this planning change is removing `openspec/changes/final-certification-closure/`. Rollback of a later product fix is a normal revert. A failed production migration is fix-forward from the actual catalog, not a routine drop of newly created tables.

## Open Questions

None that change the specs or task split. Live production drift, artifact-byte identity, and host resources are execution observations with required stop or branch behavior already specified.
