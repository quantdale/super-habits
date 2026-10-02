# ExecPlan: Resolve the Windows closure apply review findings

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Implement the two P2 documentation corrections from the independent review of
`windows-closure-reconciliation` (reviewed range
`210afd39a99e2b2dbf5026b58a1191182e05f368...7a6aeb22b31d6d70935c77d5ff6c4cacff2a7e94`,
review output `simulation-output/reviews/windows-closure-apply/review.md`):

- **Standards P2** — the canonical `final-certification-closure` Current
  Checkpoint still directs validation, commits, publication and final-tip
  device qualification that the successor already completed, so a resumed
  agent would redo certified work.
- **Spec P2** — the canonical closure report presents only the historical
  `c2ec475` full-QA record, omitting the fresh campaign validation that
  followed the Maestro/test change; brief section 13 requires a Final
  validation section with actual gate evidence.

This task is documentation-only. It is not authorization to restart the closure
campaign or to execute any remaining certification work.

## Context

- Repository truth at task start: `HEAD == main == origin/main ==
7a6aeb22b31d6d70935c77d5ff6c4cacff2a7e94` (the reviewed tip), tracked tree
  clean, one worktree, foreign state preserved (stash `pre-recovery-local-changes`
  at `c35e281d740df1e367c1be0f38383237ca080239`, `.tmp-ios36423379932/`, seven
  prior change directories, `.agent/prompts/`, the review ExecPlan and
  `simulation-output/reviews/windows-closure-apply/`).
- The reviewed anchors `210afd3` / `7a6aeb2` are historical review anchors, not
  an assumption that HEAD is unchanged; preflight verified HEAD is still
  `7a6aeb2` with no tracked edits, so no reconciliation of later changes was
  needed and neither finding is already resolved.
- The prompt is `.agent/prompts/resolve-windows-closure-review.md`; it names the
  two target documents, the boundaries, the validation policy and the handoff
  format.
- Evidence to cite (inspected, not copied blindly):
  - successor `windows-closure-reconciliation/execplan.md` validation ledger
    (fresh `qa:full` on 2026-10-02, pinned Node 22.23.2: 250 files passed /
    1 skipped, 2457 tests passed / 2 skipped, OpenSpec 69/69, E2E 235 passed /
    49 skipped / 0 failed in 28.3 m, deterministic simulation 23/23);
  - hosted CI `36895560974` on `7a6aeb2` (quality + e2e success, nightly
    expected skip, `strictRetriedThenPassed: 0`), snapshot
    `simulation-output/reviews/windows-closure-apply/ci-36895560974.{json,log}`
    — its unit/integration counts are 250 files passed / 1 skipped and
    **2456 tests passed / 3 skipped**, which differ from the local run;
  - scheduled CI `36929337894` on the same tip (completed success);
  - the commit-linked attestation
    (`https://github.com/quantdale/super-habits/commit/7a6aeb22b31d6d70935c77d5ff6c4cacff2a7e94#commitcomment-202986711`);
  - the independent review's fresh `qa:fast` at the tip
    (`simulation-output/reviews/windows-closure-apply/qa-fast-sequential.log`:
    170 unit files / 2060 tests, parity + release-profile guards, exit 0) — a
    review-time check, never relabelled as a campaign-time check;
  - the campaign's raw `qa:full` log, preserved during this task at
    `simulation-output/campaign/windows-closure-2026-10-01/qa-full-campaign-2026-10-02.log`
    (SHA-256 `ef4691ff851593dcf28043d6d088530a20f796cf99eef584e27f4290941a74bd`);
  - the final-tip native reports (`E6E55ED5…` at `7a6aeb2`, 2/2 + 11/11 + 6/6)
    and the historical `80b0b33` battery (`E2F43FBB…`).

## Scope

Edit exactly two tracked documents —
`openspec/changes/final-certification-closure/execplan.md` and
`openspec/changes/final-certification-closure/closure-report.md` — plus this
resolution ExecPlan. Documentation corrections only.

## Non-Goals

These boundaries apply to the original correction request. The subsequent owner
request authorizes a separate documentation finalization and push, tracked in
`.agent/execplans/windows-closure-publication.md`; it grants no certification,
production or release authority. This completed plan is not publication state.

No application code, Maestro flow, test, migration, dependency, CI
configuration, OpenSpec requirement or `tasks.md` checkbox change. No
production SQL/credential access, DDL or data mutation, native or iOS run, AI
activation, signing, release tag, archive, commit, push or external attestation
publication. Do not re-run full QA, E2E, simulation or native qualification for
a source-inert documentation correction. Do not change `NOT CERTIFIED`, the
canonical `BLOCKED` posture, the five deliberate open canonical tasks or their
classifications (2.1 credential/external, 2.4 blocked production
prerequisites, 3.2/3.3 owner-deferred iOS/environment, 4.3 conditional
`NOT_TRIGGERED`). Do not touch J8's 800 ms ceiling, 15 % floor, the historical
878 ms excursion, the accepted 622/800 result, gap-21 fail-closed posture or
default-off AI.

## Current Checkpoint

- Current milestone: COMPLETE — the original two P2 documentation findings were corrected locally and validated, and their handoff was prepared. The later recheck's publication-status P2 is corrected by the separately authorized follow-up in `.agent/execplans/windows-closure-publication.md`; the original campaign publication must not be confused with this documentation revision.
- Completed: preflight and evidence verification (HEAD still the reviewed tip `7a6aeb2`, neither finding pre-resolved; every cited count re-verified against raw logs/CI snapshots); the campaign raw `qa:full` log preserved byte-identically to `simulation-output/campaign/windows-closure-2026-10-01/qa-full-campaign-2026-10-02.log`; Standards P2 applied to `final-certification-closure/execplan.md` (checkpoint synchronized, stale redo-instructions replaced by a single hold action, progress entries 6.1/6.2/6.4 closed with evidence, Android identities differentiated, changed-files/recovery/outcomes refreshed, one ledger row appended); Spec P2 applied to `closure-report.md` (new **Final validation** section with per-gate command/result/applicability/date/evidence level, `qa:full` deferral → `c2ec475` → fresh campaign chronology, R8 refreshed, published-candidate vs repair-commit vs current-tree identities separated); and the proportionate gates all passed.
- In progress: nothing.
- Important modified files: `openspec/changes/final-certification-closure/execplan.md`, `openspec/changes/final-certification-closure/closure-report.md`, `.agent/execplans/windows-closure-review-resolution.md` (this plan), plus the ignored evidence copy above.
- Last successful validation: `npx vitest run tests/agent-execplan.test.ts tests/agentDocConsistency.test.ts` 20/20 PASS; `npm run qa:fast` PASS (typecheck 0 errors, `eslint . --max-warnings 0` clean, `test:unit` 170 files / 2060 tests, journey-label + quarantine-register parity, release-profile guard 3 profiles clean); `npx openspec validate --all --strict` 69/69 PASS; `npm run agent:plan:validate:all` PASS (including this plan and the canonical `BLOCKED` plan); `npx prettier --check` on all three files PASS; `git diff --check` clean.
- Current failures: none in this task.
- Relevant quarantines: none added, widened or removed; J8/gap-21/AI defaults untouched.
- Blockers: none for this task.
- Condition required to unblock: not applicable — this task is complete.
- Exact resume action after unblock: not applicable — this task is complete.
- Exact next action: None — the original correction task is complete. The owner's subsequent publication request has its own state in `.agent/execplans/windows-closure-publication.md`.
- Remaining definition of done: Complete — every item in the prompt's definition of done is satisfied and evidenced below.

## Progress

- [x] Read instructions, establish current state, and reconcile the reviewed anchors against actual HEAD.
- [x] Read every named context file and the review artifacts completely.
- [x] Verify each cited evidence claim against raw/hosted sources; preserve the campaign raw `qa:full` log into the ignored evidence tree.
- [x] Resolve Standards P2 in `final-certification-closure/execplan.md`.
- [x] Resolve Spec P2 in `final-certification-closure/closure-report.md`.
- [x] Run the proportionate documentation gates and validate this plan.
- [x] Inspect the final diff, verify foreign-state preservation, and produce the per-finding handoff.

## Surprises & Discoveries

- Neither finding was already resolved: HEAD is still the reviewed tip and the
  two stale passages are present verbatim.
- The hosted CI run at the same tip reports `2456 passed / 3 skipped` where the
  local campaign run reports `2457 passed / 2 skipped` (same 2459 total); both
  are real counts of their own runs and must be preserved separately, not
  averaged or reconciled by editing.
- The campaign's raw `qa:full` log survived only outside the repository
  (`/d/shverify/…`); it is now preserved in the ignored evidence tree so the
  report's evidence reference is durable instead of ledger-only.
- The closure report claims "All ten required sections are present" while brief
  section 13's **Final validation** section (item 2) has no counterpart: the
  full-QA chronology sits inside §7 (J8 environment) and the campaign's fresh
  validation was never summarized in the report at all.

## Decision Log

- 2026-10-02 — Create this resolution ExecPlan rather than repurposing the
  completed independent review plan or rewriting any historical campaign plan.
- 2026-10-02 — Keep the canonical plan `BLOCKED`, the 17/22 ledger count and
  all five open-task classifications exactly as they are; only current-state
  narrative is synchronized.
- 2026-10-02 — Label every validation claim with its actual provenance level
  (raw log preserved in-repo / hosted CI snapshot / written ledger) instead of
  presenting ledger-only records as executed-at-the-tip evidence.
- 2026-10-02 — Differentiate the three source identities (qualified `7a6aeb2`
  candidate, historical `80b0b33` repair-commit battery, current uncommitted
  documentation-only tree) and state explicitly that this correction changes
  no tested SHA and that ancestor CI/native proof never certifies a future
  commit.
- 2026-10-02 — Do not commit or push during the original correction request:
  the prompt forbids it, and future publication needs separate authorization.
- 2026-10-02 — Subsequent recheck found a remaining publication-status P2:
  **Final validation** was local, not present in published `7a6aeb2`. The
  owner then explicitly requested finalization and a push to `main`. That
  separately scoped follow-up uses `windows-closure-publication.md`, preserves
  the original validation chronology and corrects the publication wording.

## Validation Ledger

| Date       | Command / source                                                                                                                 | Outcome                                                                                                                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-02 | `git rev-parse HEAD main origin/main`; `git status`; `git stash list`; `git worktree list`                                       | PASS — all three refs `7a6aeb2…`; tracked tree clean; stash `c35e281d…` intact; one worktree; foreign untracked state preserved.                                                                         |
| 2026-10-02 | Read both findings in `simulation-output/reviews/windows-closure-apply/{review,standards,spec}.md`                               | READ — one P2 per axis, both verdicts OK-with-notes; no correction applied by the review.                                                                                                                |
| 2026-10-02 | Re-verified review claims against raw logs (`qa-fast-sequential.log`, `ci-36895560974.log`, commit comment)                      | PASS — qa:fast 170 unit files / 2060 tests; CI `36895560974` quality+e2e success with `strictRetriedThenPassed: 0`; attestation comment present.                                                         |
| 2026-10-02 | `sha256sum` copy of the campaign raw `qa:full` log into `simulation-output/campaign/windows-closure-2026-10-01/`                 | PASS — copy byte-identical (`ef4691ff…`); durable reference now available for the Final validation section.                                                                                              |
| 2026-10-02 | `node scripts/qa-impact.mjs --files <two target docs + this plan>`                                                               | READ — matched `agent-workflow-and-documentation`; required gate `qa:fast`; focused `tests/agent-execplan.test.ts`; no broad regression.                                                                 |
| 2026-10-02 | `npx vitest run tests/agent-execplan.test.ts tests/agentDocConsistency.test.ts` (Node `v22.23.2`)                                | PASS — 2 files, 20/20 tests.                                                                                                                                                                             |
| 2026-10-02 | `npm run qa:fast` (Node `v22.23.2`)                                                                                              | PASS — typecheck 0 errors; `eslint . --max-warnings 0` clean; `test:unit` 170 files / 2060 tests; journey-label + quarantine-register parity OK; release-profile guard OK (3 profiles).                  |
| 2026-10-02 | `npx openspec validate --all --strict`                                                                                           | PASS — 69/69 items, 0 failed.                                                                                                                                                                            |
| 2026-10-02 | `npm run agent:plan:validate:all`; `npm run agent:plan:validate -- --plan .agent/execplans/windows-closure-review-resolution.md` | PASS — every versioned plan valid, including this plan and the canonical `BLOCKED` plan.                                                                                                                 |
| 2026-10-02 | `npx prettier --check` on the three changed files; `git diff --check`                                                            | PASS — Prettier clean; no whitespace or conflict-marker diagnostics (git autocrlf notes only).                                                                                                           |
| 2026-10-02 | `npm run web:hygiene`                                                                                                            | PASS — 8081/8082 free; no task-owned listener.                                                                                                                                                           |
| 2026-10-02 | Cross-document verification: counts/identities/provenance vs raw logs; `git diff -w` chronology check                            | PASS — every reported count matches its source run (2457/2 local vs 2456/3 hosted preserved separately; 170/2060 review-time; 249/1 `c2ec475`); historical ledger rows content-identical (padding only). |

## Changed Files / Areas

- `openspec/changes/final-certification-closure/execplan.md` — Standards P2: checkpoint, relevant progress entries, changed-files/recovery narrative, outcomes.
- `openspec/changes/final-certification-closure/closure-report.md` — Spec P2: new Final validation section; refreshed `qa:full` chronology and R8; source-identity differentiation.
- `.agent/execplans/windows-closure-review-resolution.md` — this execution plan.
- `simulation-output/campaign/windows-closure-2026-10-01/qa-full-campaign-2026-10-02.log` — ignored evidence preservation (never staged).

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this plan completely.
2. Inspect `git status --short`, `git diff --stat`, and the two target documents; reconcile this checkpoint against the real tree.
3. Continue from `Exact next action`; if both findings are already applied, verify and report rather than reapplying.
4. Do not reuse this completed correction plan as publication state. The later owner-authorized finalization/push is tracked in `.agent/execplans/windows-closure-publication.md`; inspect its actual Git/CI evidence.

## Outcomes & Retrospective

- Status: COMPLETED — both P2 documentation findings resolved; no commit or push performed.
- Summary: **Standards P2 (stale canonical resume checkpoint)** — `final-certification-closure/execplan.md` no longer directs a resumed agent to redo the completed validation/publication/final-tip qualification: the checkpoint records the published campaign (40/42, attestation, CI `36895560974` at `7a6aeb2`), `Exact next action` is a single hold instruction, progress entries 6.1/6.2/6.4 are closed with their evidence, the Android identities are differentiated, and Outcomes/Changed Files/Recovery reflect the published state. **Spec P2 (omitted refreshed final-validation evidence)** — `closure-report.md` now carries a **Final validation** section with every required gate (typecheck, zero-warning lint, combined `npm test` versus standalone `test:unit`, the honestly recorded not-run standalone integration invocation, `qa:fast`, `qa:full`, strict OpenSpec, the repository Supabase schema contract explicitly not live catalog, deterministic simulation), each with command, result, source applicability, date/runtime and evidence level; the `qa:full` chronology is now deferral → `c2ec475` pass → fresh campaign pass; R8 agrees; and the published-candidate `7a6aeb2`, repair-commit `80b0b33` and current edited tree identities are explicitly separated.
- Proof: the Validation Ledger above; `git diff --stat` shows exactly the two target documents changed, `git diff -w` confirms every historical chronology row is content-identical, and all canonical task checkboxes, thresholds, classifications and the `NOT CERTIFIED` / `BLOCKED` postures are untouched.
- Remaining work: none for the original correction task. The owner subsequently authorized documentation finalization/publication; its state and new source-bound evidence belong to `.agent/execplans/windows-closure-publication.md`, not this historical resolution record.
- Lesson: a reporting finding is still an evidence task — the fix is only as good as the provenance it records, so each run keeps its own counts (2457/2 local versus 2456/3 hosted) and each claim names its evidence level instead of blending raw logs, snapshots and ledgers into one pass.
