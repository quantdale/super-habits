# Independent audit resolution: start here

This folder is the handoff for the owner-requested resolution of SH-01 through SH-21. Planning was prepared against main fb10d6c on 2026-10-18. It changes no product code. Do not assume the current checkout or successor status still matches that date.

## Start a separate implementation session

Give the next model this prompt from D:/Documents/tryPython/superhabits:

```text
Implement the SuperHabits independent-audit resolution campaign.

Read AGENTS.md, .agent/PLANS.md and
openspec/changes/resolve-independent-repository-audit/START-HERE.md.
Resume its execplan.md and execute tasks.md in dependency order.

This is explicit owner reactivation for the local engineering work described
by that campaign, including fixes, regression tests and planning/spec updates.
Preserve unrelated work and the approved Calm Momentum design. Do not merge
PRs, deploy, mutate production, waive security gates, trigger paid services,
or claim unavailable cloud/native verification passed.

Select and record the implementation base using W0; reuse revalidated fixes
from the successor branches without merging them. Keep a durable checkpoint
and evidence for every finding. Continue all independent work when an
external gate is unavailable. Produce the review packet specified in the
plan. I will request a separate independent review when you finish.
```

## Reading order

1. execplan.md: current checkpoint, authority and recovery procedure.
2. audit-baseline.md: immutable finding IDs, original evidence and source anchors.
3. design.md: work packages, architectural decisions, migration and compatibility rules.
4. validation-matrix.md: negative cases, observable assertions and review evidence.
5. tasks.md: small executable steps, in order; relevant specs/ documents define acceptance.

The plan and baseline are durable. The original OS temporary directory is not required. The old audit harnesses are diagnostic leads with mocked effects, not substitutes for production-path regression tests.

## Base and worktree procedure

First inspect main, PR #79 and PR #80, their current ancestry, dirty worktrees, pause handoff and security disposition. If the successor stack has merged, start a new campaign branch/worktree from updated main. If it remains open and coherent, the preferred local base is the current PR #80 tip, which includes PR #79. This is a documented exception to the ordinary main-only base: it avoids reimplementing existing dependent recovery fixes. It grants no merge authority.

Create a fresh sibling implementation worktree; never overwrite the overnight, reliability-recovery, correction or native-cert worktrees. Copy only this planning folder into the new worktree if it is not in the selected base, preserving its checkpoint. Do not move/delete the original folder or the original untracked audit-era paths. Record absolute worktree, branch, main merge-base, selected base SHA, transferred planning files, and any subsequent local commits in execplan.md. The plan remains authoritative in the implementation worktree; the original planning checkout is a snapshot, not a second live checkpoint.

If the successor tip is unavailable or materially incompatible, use a new branch from current main and selectively port the necessary coherent fixes with their tests after inspecting dependencies. Document that decision and retest; do not blindly cherry-pick a large history or treat previous reports as qualification.

The future implementer may create local task commits for durable milestones; do not create/push PRs or publish changes merely because a local package is finished. Before any destructive Git operation, reassess existing user work; force-push/reset/rebase are outside this campaign.

## Completion language

All 21 IDs must have an evidence-backed disposition. Use OPEN, REPRODUCED, ALREADY_FIXED_VERIFIED, IMPLEMENTED_NOT_CERTIFIED, RESOLVED_VERIFIED, DISPROVEN_WITH_EVIDENCE, or BLOCKED_EXTERNAL in the review packet. Reconcile the seeded live disposition table in execplan.md when execution begins; tasks.md is a work checklist. SH-21 can be disproved with relevant evidence. A security waiver is never an automatic resolution of SH-20.

The implementation session must distinguish a reviewable engineering result from a fully qualified release. If essential external evidence is missing, preserve the open task and report it. Do not archive this change before the owner's independent review.
