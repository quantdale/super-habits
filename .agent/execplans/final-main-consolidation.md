# ExecPlan: Final main consolidation

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Reconcile every completed Super Habits workstream into `main`, preserve normal
Git history, prove that no intended completed branch has unique work outside
the final main tip, run final validation directly on `main`, reconcile the
canonical documentation and OpenSpec/ExecPlan state, and update `origin/main`
normally when the remote permits it.

## Context

- Local `main` and `origin/main` both start at `15a1a9275c6ade0a016752c577c818d5b7431eaf`.
- The validated complete descendant is
  `stabilization/native-d14-closure` at `7e61aec5a1ab4985a862e4085ddf7f4a7464811c`.
- Stabilization was completed in its dedicated worktree after current-source
  Android CMake/libc++ repair, native parity, D14 closure, broad web/sync/
  simulation QA, documentation reconciliation, and Habit Progress Insights
  OpenSpec archival.
- Recovery worktrees and branches are user-owned references and must remain
  intact during this consolidation.

## Scope

- Inventory relevant local/remote branches and worktrees and classify completed
  versus scratch or obsolete work.
- Prove descendant coverage before merging and investigate any non-ancestor
  completed branch semantically.
- Merge the complete validated descendant into local `main` with normal Git
  history and no blanket conflict resolution.
- Create final consolidation evidence, validate `main` directly, audit
  stranded commits/worktrees/secrets/generated output, and push normally when
  authorized.

## Non-Goals

- No new product feature or unrelated refactor.
- No force push, reset, destructive branch/worktree cleanup, or blind
  ours/theirs conflict resolution.
- No remote Supabase mutation, dependency-major churn, or weakening of QA
  contracts.

## Current Checkpoint

- Current milestone: Branch inventory is complete; the stabilization tip is a
  single complete descendant of all five identified completed workstreams.
- Completed: Local/remote main state, all local branch refs, worktrees, graph,
  and pre-merge ancestry coverage have been inspected.
- In progress: Create this durable consolidation plan, merge the complete
  descendant into `main`, then run and record final main QA.
- Important modified files: this ExecPlan only before the merge; the main
  merge is expected to bring the validated stabilization history and its
  intentional documentation/OpenSpec changes.
- Last successful validation: stabilization tip was clean; current-source
  Android build/native matrix, D14 batches, 740 Vitest tests, 68 integration
  tests, five-zone timezone QA, 153/170 full E2E aggregate tests, 17/17
  deterministic scenarios, 19/19 sync tests, strict OpenSpec, plan validation,
  impact validation, and Expo Doctor 19/19 passed there.
- Current failures: None established in the validated stabilization tip.
- Relevant quarantines: iOS/Xcode remains unavailable on Windows; full web
  aggregate has 17 documented environment/opt-in skips; framework-transitive
  npm advisories remain deferred without a compatible fix.
- Blockers: None for local consolidation at this checkpoint; remote push may
  be blocked by branch protection or authentication and must be reported
  precisely rather than bypassed.
- Exact next action: commit this ACTIVE plan, merge
  `stabilization/native-d14-closure` into this clean consolidation worktree,
  then update the plan with the merge SHA and final main QA evidence.
- Remaining definition of done: final main QA, ancestry/content proof,
  documentation/plan reconciliation, clean main audit, and remote equality or
  an honest permission blocker.

## Progress

- [x] Recover and inventory all relevant branches, remotes, and worktrees.
- [x] Identify `stabilization/native-d14-closure` as the complete descendant.
- [x] Prove the five identified completed workstream tips are ancestors of it.
- [ ] Create the consolidation plan checkpoint commit.
- [ ] Merge the complete descendant into local `main` semantically.
- [ ] Prove every completed branch tip is an ancestor of final `main`.
- [ ] Run final static, unit/integration, web, simulation, sync, performance,
      dependency, and native validation on `main`.
- [ ] Reconcile this plan/docs, audit side branches/worktrees, and push/verify
      `origin/main` when permitted.

## Surprises & Discoveries

- The repository's actual branch graph confirms that the schedule-aware
  reminder branch is the merge base child carried through the integration
  merge, rather than a separate unmerged feature tip.
- `stabilization/native-d14-closure` is a direct descendant of the integration
  merge, campaign, hardening, and schedule-aware branches, so one final normal
  merge minimizes conflict risk and preserves all feature history.
- `origin/main` has not advanced beyond local `main` at the start of this
  session.

## Decision Log

- 2026-08-13 — Use a sibling consolidation worktree and branch from local
  `main`; preserve all existing recovery worktrees and branches.
- 2026-08-13 — Select `stabilization/native-d14-closure` as the sole final
  integration tip because Git ancestry proves coverage of all identified
  completed workstreams and stabilization validation is complete.

## Validation Ledger

- 2026-08-13 — Git inventory — PASS; branch graph, local refs, remote refs,
  worktrees, and main synchronization inspected.
- 2026-08-13 — Complete-descendant ancestry — PASS; schedule-aware reminder,
  headless hardening, integration, campaign, and stabilization tips are all
  ancestors of `7e61aec`.
- 2026-08-13 — Pre-merge stabilization evidence — PASS; see
  `.agent/execplans/native-d14-stabilization.md` and its committed ledger.

## Changed Files / Areas

- `.agent/execplans/final-main-consolidation.md` — durable consolidation state.
- `main` history and any conflict-resolved integration files — only changes
  needed to land the validated complete descendant.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, and this plan completely.
2. Work only in `C:\Users\Michael Roy\Documents\super-habits-consolidation`.
3. Run `git status --short`, `git diff --stat`, `git diff --name-only`, and
   `npm run agent:resume -- --plan .agent/execplans/final-main-consolidation.md`.
4. Reconcile this checkpoint with Git; Git wins if narrative and files differ.
5. Keep the existing native emulator/worktrees untouched unless a final main
   Android build is explicitly being run, and never run concurrent native lanes.
6. Before completion validate all ExecPlans/OpenSpec, audit final main and
   remote ancestry, and leave recovery branches/worktrees undeleted.

## Outcomes & Retrospective

Pending final main merge and validation.
