# ExecPlan: Post-Gym V2 Release Convergence and Native Certification

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Produce one canonical, reviewable post-Gym V2 release-candidate branch that
preserves current `main` governance and the complete Gym implementation,
truthfully documents schema v23 / migration slot 24 / Backup Scope 7 with
frozen Scope-6 compatibility, provisions Android native E2E from source,
qualifies platform-sensitive Gym persistence, re-proves recovery contracts,
and records exact-source local/remote certification.

## Context

- Repository: `C:\Users\Michael Roy\Documents\super-habits`.
- Convergence branch: `codex/post-gym-release-convergence-v1`, created from
  `origin/main` at `3e2c8aa0259ec01bce183049694928f0314c956f`.
- Gym source branch: `origin/codex/add-gym-training-system-v2` at
  `f5e9678b7f2346736e9d7326b4fc79b0cf7c53d4`.
- Merge base: `d0a9d84e7829efdf002f2ed6a8de3462b2e9bfbe`.
- The Gym branch is 10 commits ahead of `origin/main`; `origin/main` is one
  planner/handoff commit ahead of Gym. Neither historical branch will be
  rewritten.
- Runtime authority is `core/db/client.ts` plus executable backup/portable and
  Supabase validators. Current integrated expectations are schema 23, next
  append-only migration 24, Backup Scope 7, independently versioned backup
  schema, frozen Scope-6 compatibility, empty-device-only Restore V2, local
  owner binding, portable file import/export, and push-only Supabase backup.
- Required orientation was completed from repository files. The requested
  `.agent/PLANNER_HANDOFF.md` is absent from this checkout; no replacement
  file was invented. Existing `.agent/PLANS.md`, OpenSpec plans, Git, and QA
  artifacts are the recovery authorities.
- Native documentation records a working Windows/Nitro Android toolchain but
  the existing local runner does not build/install an absent E2E APK. Windows
  cannot claim local iOS/Xcode execution.

## Scope

- Git convergence and subsystem-preservation proof.
- Runtime-contract/documentation truth sweep with historical-vs-current scope
  classification.
- Android E2E build/install/identity provisioning and focused native Gym V2
  persistence/durable-session flows.
- Backup/portable/restore/Supabase revalidation, timing investigation, local
  regression ladder, exact-head push/CI inspection, and closure evidence.

## Non-Goals

- No migration 24 unless a real defect requires a schema change.
- No two-way sync, conflict-resolution model, new navigation architecture,
  social/AI/paywall/telemetry features, or unrelated Gym V3 breadth.
- No production secrets, destructive remote reset, copied external dataset, or
  user-specific absolute machine path.

## Current Checkpoint

- Current milestone: Git convergence and subsystem preservation audit are
  complete; the convergence plan/artifacts are being committed and pushed.
- Completed: Read `AGENTS.md`, `.agent/PLANS.md`, `.agent/PLANNER_HANDOFF.md`
  after integration, project/rule/Codex/QA/native guidance, DB/RN skills, Gym
  OpenSpec ExecPlans, and current Git/OpenSpec state. Fetched all refs. Created
  proposal, two normative specs, design, tasks, and this Plan-Version 2
  ExecPlan. Created the convergence branch from `origin/main` and merged the
  Gym branch with merge commit `336f59e` (parents `3e2c8aa` and `f5e9678`).
- In progress: Commit/push the convergence milestone, then begin the runtime
  truth sweep.
- Important modified files: `openspec/changes/harden-post-gym-release-convergence-v1/**`
  is currently uncommitted; the merge commit contains the 109-file Gym diff
  plus main's five adapter files. No conflict markers were reported.
- Last successful validation: clean pre-merge status; normal `--no-ff` merge;
  `git diff --stat origin/codex/add-gym-training-system-v2..HEAD` reports only
  the five main-side adapter files; all 109 Gym-changed paths are represented
  by that unchanged diff and major migration/backup/workout/recovery/
  Supabase/simulation/E2E paths are present.
- Current failures: none. The earlier missing `.agent/PLANNER_HANDOFF.md`
  discrepancy was resolved by integrating current main.
- Relevant quarantines: none introduced. Existing native/iOS and remote-access
  limitations remain to be re-evaluated after integration.
- Blockers: none for merge or local implementation. Android/iOS/Supabase/CI
  availability is not yet known on the convergence branch.
- Condition required to unblock: none.
- Exact resume action after unblock: none.
- Exact next action: stage and commit the convergence OpenSpec/ExecPlan
  artifacts, push the branch, verify remote equality, then inspect and patch
  current runtime/documentation drift (starting with README and AGENTS Scope-6
  statements).
- Remaining definition of done: all OpenSpec tasks complete; integrated Gym
  subsystems present; current docs/contracts coherent; native provisioning and
  focused flows executed or precisely blocked; affected and broad gates run;
  exact final SHA pushed and CI status inspected; working tree clean.

## Progress

- [x] Required orientation, Git fetch, branch/ref reconciliation.
- [x] Create convergence branch from current `origin/main`.
- [x] Create OpenSpec proposal, normative specs, design, and tasks.
- [x] Create this Plan-Version 2 ExecPlan.
- [x] Merge completed Gym branch and prove no subsystem loss.
- [x] Compare integrated paths/content and verify major Gym/governance
      subsystems.
- [ ] Reconcile runtime truth, docs, QA map, and recovery/Supabase contracts.
- [ ] Implement Android build/install/identity provisioning.
- [ ] Add and execute focused native Gym V2 flows.
- [ ] Investigate timing-sensitive gates without weakening assertions.
- [ ] Run affected and full regression ladders; classify all failures.
- [ ] Push final exact SHA, inspect CI, reconcile artifacts, and close plan.

## Surprises & Discoveries

- The working checkout started on the completed Gym branch rather than `main`;
  the fetched `origin/main` was the correct current base and was used directly.
- `.agent/PLANNER_HANDOFF.md` was absent on the Gym checkout but is present on
  current main and is now preserved in the convergence tree.
- The planning-time branch counts and SHAs match the fetched repository,
  including the one newer main commit and ten Gym commits.
- OpenSpec currently reports several unrelated historical changes as
  `in-progress`; they must not be rewritten unless their state is directly
  affected by this campaign.

## Decision Log

- 2026-08-24 — Create a new branch from `origin/main` and merge the Gym branch
  normally — preserves both histories and current planner/executor changes.
- 2026-08-24 — Treat source/validators as authority for schema/scope wording —
  prevents global replacement from corrupting frozen Scope-6 evidence.
- 2026-08-24 — Add only focused native Gym flows and provisioning — covers
  platform-sensitive risk without duplicating the web suite.

## Validation Ledger

- 2026-08-24 — `git status --short` — PASS; initial Gym checkout clean.
- 2026-08-24 — `git fetch --all --prune` — PASS; fetched current `origin/main`
  and refs.
- 2026-08-24 — ref/merge-base inventory — PASS; expected `3e2c8aa`, `f5e9678`,
  and `d0a9d84` relationship confirmed.
- 2026-08-24 — `npm run agent:plans` — PASS; existing plans discovered.
- 2026-08-24 — `openspec list --json` — PASS; current change inventory read.
- 2026-08-24 — OpenSpec proposal/design/spec/tasks creation — PASS; planning
  artifacts exist and are ready for validation after status refresh.
- 2026-08-24 — `git merge --no-ff origin/codex/add-gym-training-system-v2` — PASS;
  clean merge commit `336f59e`, parents are current main and Gym HEAD.
- 2026-08-24 — `git diff --stat origin/codex/add-gym-training-system-v2..HEAD` —
  PASS; only five main-side planner/executor adapter files differ from Gym.
- 2026-08-24 — changed-path/subsystem audit — PASS; 109 Gym-changed paths are
  present, required source/spec/schema/test/native-governance paths are present,
  and no Gym file differs from the Gym tip.

## Changed Files / Areas

- `openspec/changes/harden-post-gym-release-convergence-v1/proposal.md` — why,
  scope, capabilities, and impact.
- `openspec/changes/harden-post-gym-release-convergence-v1/specs/**` — release
  contract and native qualification requirements.
- `openspec/changes/harden-post-gym-release-convergence-v1/design.md` — merge,
  metadata, provisioning, native, timing, and remote-boundary approach.
- `openspec/changes/harden-post-gym-release-convergence-v1/tasks.md` — ordered
  implementation/validation checklist.
- `openspec/changes/harden-post-gym-release-convergence-v1/execplan.md` —
  resumable campaign state.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this ExecPlan, and the OpenSpec
   proposal/spec/design/tasks.
2. Run `git status --short`, `git diff --stat`, `git diff --name-only`, and
   `git branch -vv`; Git wins over stale checkpoint prose.
3. Run `npm run agent:resume -- --plan
openspec/changes/harden-post-gym-release-convergence-v1/execplan.md` and
   reconcile any discrepancy warnings.
4. Continue only from `Exact next action`, updating this checkpoint before a
   major command, failure, fix, or validation milestone.
5. Preserve original QA artifacts and classify failures with
   `PRODUCT_BUG`, `TEST_BUG`, `FLAKY_TEST`, `ENVIRONMENT`,
   `EXPECTED_KNOWN_GAP`, or `SPEC_AMBIGUITY`.

## Outcomes & Retrospective

- Status: Active; implementation and certification are in progress.
- Summary: Not yet complete.
- Proof: Final local gates, native evidence, remote state, and exact-head CI
  will be recorded here before marking the plan COMPLETED.
- Follow-up: None decided; do not invent new product scope after the defined
  release-candidate conditions are satisfied.
