# ExecPlan: Finalize and publish Windows closure documentation

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Honor the owner's request to finalize the review corrections and push the
finished, task-owned documentation to `main`. Remove the remaining P2
publication-status error without changing certification outcomes.

## Context

- Publication starts from `main == origin/main ==
7a6aeb22b31d6d70935c77d5ff6c4cacff2a7e94`; fetch confirmed 0 ahead / 0 behind.
- The original campaign was published and qualified at that SHA. Its report
  did not contain **Final validation**; that section exists only in the local
  correction. Its CI/native attestation cannot attest this new revision.
- The two canonical documents are modified. The independent review plan,
  resolution plan and resolution prompt are task-owned untracked documents.
- Preserve stash `pre-recovery-local-changes` at
  `c35e281d740df1e367c1be0f38383237ca080239`, the iOS extract, seven foreign
  change directories and ignored evidence. No other staged changes exist.
- Goal mode is inactive. No delegation is requested or used.

## Scope

Publish exactly the six Markdown paths listed under Changed Files / Areas.
Correct the canonical report/checkpoint and resolution-plan status language;
preserve the completed independent review and prompt as historical handoffs.
Use the campaign's more-specific main-only, fast-forward publication contract.

## Non-Goals

No application, test, flow, migration, dependency, CI configuration, OpenSpec
requirement or task-checkbox changes. No production access, native/iOS runs,
AI activation, signing, release tags, archives, force-pushes, resets, stash
mutation or external attestation publication. Preserve `BLOCKED`,
`NOT CERTIFIED`, 17/22, all five non-passes, J8 thresholds and gap-21 posture.

## Current Checkpoint

- Current milestone: Validated six-file staged scope; ready to commit/push.
- Completed: Instructions/recovery orientation, fetched refs, Git inventory,
  inspected full owned documents, confirmed GitHub push permission and explicit
  six-file impact; corrected canonical/resolution wording and captured a
  SHA-256 preservation baseline (214 files/links across 11 evidence roots).
- In progress: Hook-enabled commit and fast-forward publication.
- Important modified files: The six owned Markdown paths below.
- Last successful validation: Pinned Node 22.23.2 `qa:fast` PASS with one
  worker (170 unit files / 2060 tests); combined `npm test -- --maxWorkers=1`
  PASS (250 files / 2457 tests; 1 file / 2 cloud tests skipped); focused
  documentation 20/20, strict OpenSpec 69/69, all versioned plans, six-file
  Prettier, whitespace and hygiene PASS. All 214 preserved files/links,
  stash and both canonical/successor task files unchanged (canonical 17/22).
- Current failures: None remaining. Initial portable/import timeouts are
  ENVIRONMENT under host contention (CPU 100%, 919 MB free); original log
  retained, assertions/timeouts unchanged, no unrelated process terminated.
- Relevant quarantines: None changed; existing capability gaps preserved.
- Blockers: None for documentation publication; production/iOS remain external.
- Condition required to unblock: None for this task.
- Exact resume action after unblock: Not applicable.
- Exact next action: Re-stage the final plan/report wording, verify the same
  six-file scope, commit with hooks enabled and push `main` normally; stop if
  the remote has advanced or any unintended staged path appears.
- Remaining definition of done: Correct wording, green local documentation
  gates plus `npm test`, preserved foreign state and canonical task ledger,
  explicit-path commit, successful fast-forward push and verified remote SHA.
  Observe the new SHA's hosted CI and report its actual state; do not infer
  success or native certification from ancestor runs.

## Progress

- [x] Establish authority, current refs, ownership and QA impact.
- [x] Resolve publication wording and preserve historical evidence boundaries.
- [x] Run local gates and verify the exact staged scope/preservation.
- [ ] Commit and fast-forward push the documentation to `main`.
- [ ] Verify remote identity and observe exact-head CI; record the handoff.

## Surprises & Discoveries

- The resolution checkpoint also says its handoff is published despite the
  files being uncommitted; distinguish the original local correction from
  this newly authorized publication.
- Global resume impact includes foreign evidence; it is not task ownership.
  Explicit six-file impact is the gate-selection authority for this task.
- Initial default-concurrency unit run timed out in portable export and the
  restore import hook. There is no runtime/test diff; host CPU was 100% and
  free RAM 919 MB. Installed Vitest supports `VITEST_MAX_FORKS` and
  `VITEST_MAX_THREADS`, allowing the actual wrapper to run without repo edits.

## Decision Log

- 2026-10-02 — The current owner request authorizes commit/push, superseding
  the earlier review/prompt requests' no-publication boundary only for these
  task-owned documents. It grants no production or release authority.
- 2026-10-02 — Keep the original review plan independent and completed.
  Use this separate publication plan for current implementation state.
- 2026-10-02 — Resolve publication identity from Git and Actions rather than
  inventing a self-referential commit hash in the report. The old campaign
  attestation remains source-bound to `7a6aeb2`.
- 2026-10-02 — Diagnose host contention by controlled single-worker execution,
  not blind retry. All 20 affected tests and the full 2060-test unit suite
  passed unchanged; keep Vitest worker caps at one for this resource-starved
  host. No timeout, assertion, config or unrelated process was changed.

## Validation Ledger

- 2026-10-02 — `git fetch origin`; refs/divergence inventory — PASS, `main`
  and `origin/main` at `7a6aeb2`, 0/0; empty staged set; stash retained.
- 2026-10-02 — `gh api repos/quantdale/super-habits` — PASS, authenticated
  repository access with push permission; no secret values inspected.
- 2026-10-02 — `npm run agent:resume -- --plan
.agent/execplans/windows-closure-review-resolution.md` — READ, structurally
  valid completed historical plan; publication wording still needs correction.
- 2026-10-02 — `npm run qa:affected -- --files <six owned paths>` — PASS,
  documentation rule, `qa:fast`, focused ExecPlan coverage, no broad regression.
- 2026-10-02 — SHA-256 preservation baseline — PASS, 214 files/links across
  the iOS extract, seven foreign changes and three ignored evidence roots;
  canonical/successor task-file blob hashes and stash object recorded.
- 2026-10-02 — Initial six-file Prettier check — TEST_BUG, only new plan
  wrapping needs formatting; no meaningful assertion or gate was weakened.
- 2026-10-02 — `npm run qa:fast` — FAIL, typecheck/lint passed, unit 168
  files passed / 2 failed; 2041 tests passed / 1 failed / 18 hook-skipped.
  Raw `qa-fast.log` retained. No parity/profile stage was reached.
- 2026-10-02 — Read both failing seams; probe host resources — READ,
  CPU 100%, free RAM 919/32488 MB; two cold-import timeouts, no assertion
  mismatch. Leading hypothesis is contention; persistent mock/import defects
  or toolchain mismatch remain alternatives until controlled execution.
- 2026-10-02 — `npx vitest run --project unit --maxWorkers=1
tests/portableExportSize.test.ts tests/restore.coordinator.test.ts` — PASS,
  20/20 in 3.41 s; portable file 239 ms, restore file 1500 ms. Log:
  `simulation-output/reviews/windows-closure-publication/timeout-diagnosis-single-worker.log`.
- 2026-10-02 — `npm run qa:fast` with `VITEST_MAX_FORKS=1`,
  `VITEST_MIN_FORKS=1`, `VITEST_MAX_THREADS=1`, `VITEST_MIN_THREADS=1` — PASS,
  typecheck/lint, 170 unit files / 2060 tests, both parity checks and release
  guard. Unit duration 213.55 s; log `qa-fast-single-worker.log` beside the
  retained first failure. Classification: ENVIRONMENT/host contention.
- 2026-10-02 — `npm test -- --maxWorkers=1` — PASS, 250 files passed /
  1 skipped; 2457 tests passed / 2 skipped (disposable-cloud external lane),
  497.83 s; `npm-test-single-worker.log` retained. No test/config change.
- 2026-10-02 — Focused documentation Vitest — PASS, 20/20, 5.42 s;
  strict workspace OpenSpec 69/69, all versioned plans, six-file Prettier,
  `git diff --check` and `web:hygiene` PASS; 8081/8082 free.
- 2026-10-02 — SHA-256 precommit preservation and semantic report checks —
  PASS, all 214 files/links, stash and both task-file blobs unchanged; 17/22
  canonical ledger, `BLOCKED`, `NOT CERTIFIED` and hold action preserved;
  published `7a6aeb2` lacks Final validation and the new wording states that.
  Receipt: `simulation-output/reviews/windows-closure-publication/precommit-verification.json`.
- 2026-10-02 — Explicit-path staging, staged set assertion and diff review —
  PASS, exactly six owned Markdown paths, no app/test/task/foreign content;
  staged whitespace clean. Clarified that `80b0b33` postdates the source
  covered by the old `c2ec475` run. Diff saved as `staged-documentation.patch`.

## Changed Files / Areas

- `openspec/changes/final-certification-closure/execplan.md` — canonical
  publication-status correction; hold and certification blockers preserved.
- `openspec/changes/final-certification-closure/closure-report.md` — final
  validation evidence and explicit campaign/documentation revision boundary.
- `.agent/execplans/windows-closure-review-resolution.md` — historical
  correction handoff with truthful publication status and follow-up link.
- `.agent/execplans/windows-closure-apply-review.md` — publish unchanged
  completed independent review context.
- `.agent/prompts/resolve-windows-closure-review.md` — publish unchanged
  historical two-finding correction prompt; it does not override current consent.
- `.agent/execplans/windows-closure-publication.md` — this publication plan.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md` and this plan completely.
2. Inspect actual Git refs/status/diffs, saved publication evidence under
   `simulation-output/reviews/windows-closure-publication/`, and exact-head CI.
3. Run `agent:resume` for this plan on pinned Node 22.23.2. Scope `qa:affected`
   to the six owned paths; do not absorb foreign evidence or redo native lanes.
4. Resume from Exact next action; inspect remote refs before repeating any push.

## Outcomes & Retrospective

- Status: ACTIVE; publication not yet performed.
- Summary: Scope/authorization reconciled and publication wording corrected.
- Proof: Local validation/preservation ledger above; historical failures kept.
- Remaining work: Scoped commit/push and remote/CI-state verification.
- Lesson: A published campaign and an uncommitted report refresh are different
  source identities even when the latter only describes historical evidence.
