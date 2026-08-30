## Context

See `proposal.md` for the motivation. The fetched repository has two relevant
histories: `origin/main` at `3e2c8aa` contains the newer planner/executor
handoff work, while `origin/codex/add-gym-training-system-v2` at `f5e9678`
contains the completed Gym V2 implementation and its final evidence. The
branches share merge base `d0a9d84`; the Gym branch is ten commits ahead and
main has one commit not in Gym.

Runtime authority is the bootstrap DDL and append-only migration blocks in
`core/db/client.ts`, plus the executable backup/portable validators and
Supabase schema validator. Existing campaign documents intentionally contain
historical Scope-6, schema-22, and earlier states, so the audit must classify
references rather than perform a global replacement.

## Goals / Non-Goals

**Goals:**

- Preserve both lines of Git history in a reviewable convergence branch.
- Make current runtime and recovery metadata mechanically checkable and
  readable by current guides.
- Turn the known native APK-missing failure into a self-provisioning local
  Android path when the documented toolchain is present.
- Add a small, semantic native Gym V2 layer for persistence and durable-session
  risk, then rerun the complete applicable QA ladder.
- Preserve evidence for flakes, environment blockers, and remote-access limits.

**Non-Goals:**

- No migration 24 unless an actual schema defect requires it; this campaign
  only establishes 24 as the next append-only slot.
- No full two-way sync, merge/conflict model, new product surface, or unrelated
  workout breadth.
- No production credentials, destructive remote database operation, or
  user-specific absolute machine path.

## Decisions

### 1. Preserve histories with a normal merge

Create the branch from `origin/main` and merge the Gym branch with a normal
non-squashed merge. Resolve overlaps semantically, especially agent guides,
backup contracts, and QA documentation. This preserves both campaign histories
and makes the merge itself auditable. Rebasing or cherry-picking every Gym
commit would obscure the existing branch relationship and risks dropping
cross-commit context.

### 2. Derive current metadata from executable sources

Audit scripts will read the highest runtime migration block, current backup
scope constants, settings/manifest versions, and Supabase migration ledger
before changing prose. Tests will continue to assert the actual contracts. A
small documentation truth sweep will update current statements while leaving
historical specs, fixtures, and closure evidence intact.

### 3. Compose native provisioning with the existing runner

Inspect `scripts/qa-native.mjs`, `eas.json`, Expo prebuild plugins, and existing
PowerShell/Node conventions first. Extend the runner or add one narrow
repository-owned provisioning helper only where needed. The path will discover
JDK/SDK/ADB/Maestro through portable environment/PATH mechanisms, validate the
selected ADB serial and API/ABI, build the credential-free E2E profile from a
clean/generated native project, install the APK, and then delegate flow
execution to the existing reporting runner.

The build provenance will use the current Git SHA and app/package metadata
available from the generated artifact and ADB. A local report may include the
APK hash and build command, but no secrets or generated native output will be
committed.

### 4. Add native coverage at the smallest risk boundary

Use existing `.maestro` flow style, semantic text/accessibility labels,
`extendedWaitUntil`, and lifecycle operations. Add only the routine typed-data
relaunch and active-session draft/resume journeys needed to cover platform-
sensitive persistence. If a real control lacks a semantic hook, add a stable
accessibility label in the UI and cover that contract in the flow; coordinate
fallback is reserved for existing system-UI policy, not app content.

### 5. Treat timing evidence as a classification problem

Keep the 800 ms section-switch ceiling and portable-owner recovery assertions
unchanged. Reproduce failures in the exact file, preserve artifacts, run
controlled repeated measurements (at least ten for the HEAVY switch when
needed), and fix implementation or synchronization only when evidence points
to a repository cause. A passing focused rerun is recorded alongside the
original failure and does not erase it.

### 6. Validate Supabase locally, remotely only with explicit authority

Run the repository schema validator and inspect the additive Gym migration
ledger locally. If an authenticated linked project is unambiguously available,
perform only the repository-approved read-only or additive workflow. Otherwise
record the remote comparison as an external/access blocker and do not guess a
project or reset a database.

## Risks / Trade-offs

- [Merge conflict in governance or backup docs] → resolve from current code and
  the two branch histories, then compare the full Gym diff and run affected QA.
- [Native build is slow or workstation-specific] → keep generated projects and
  APKs ignored, use portable discovery, record exact commands and target
  identity, and retain an honest environment result when prerequisites fail.
- [Native UI lacks stable selectors] → add semantic accessibility labels only
  for real user-visible controls; do not weaken flows with arbitrary sleeps or
  coordinates.
- [Scope metadata appears in historical artifacts] → classify each reference
  as current, frozen compatibility, or historical evidence before editing.
- [Remote Supabase access is unavailable] → complete local schema/round-trip
  validation and document the precise external blocker instead of claiming live
  convergence.

## Migration Plan

1. Create the convergence branch from current `origin/main` and merge the
   completed Gym branch without rewriting either source branch.
2. Reconcile executable contracts, documentation, and OpenSpec/ExecPlan state;
   no runtime migration is added solely for this campaign.
3. Implement native provisioning and focused flows, then build/install and run
   Android lanes against the current source.
4. Run affected recovery/backup/Supabase checks, browser/sync timing probes,
   and the broad local ladder.
5. Commit coherent milestones, push the branch, and inspect GitHub Actions for
   the exact final SHA. If a change is rejected before release, delete only the
   convergence branch after preserving reports; historical source branches are
   never rewritten by this change.

## Open Questions

None. Whether Android/iOS/Supabase/CI can execute is an evidence outcome, not a
design choice; the task and reporting paths are fixed above.
