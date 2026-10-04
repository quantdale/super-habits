## Context

See [proposal.md](proposal.md) for motivation and [exploration.md](exploration.md)
for direct evidence. The starting published record is 61b295a; its hosted run
37176255652 fails only the audit. Both blockers retain their established
`DEPENDENCY_VULNERABILITY / UPSTREAM_BLOCKED` classification. This change
corrects documentation, not their underlying security state.

The two defects are temporal publication wording and count scope: before this
proposal, the preserved workspace validates 71 items while a clean same-commit
checkout validates 64 using the same locked CLI 1.8.0 and pinned Node/npm.
Exactly seven pre-existing untracked change items explain the difference.

## Goals / Non-Goals

**Goals:** smallest defensible corrections; reproducible item provenance;
truthful local/published/hosted identities; one documentation publication;
explicit event-driven continuation; preservation of all external residuals.

**Non-Goals:** remediation research, dependency/policy/product changes,
monitoring infrastructure, native qualification, Supabase/production access,
archives or speculative repairs elsewhere in older reports. There are no
spec-level behavior changes, so `skip_specs: true` intentionally applies.

## Decisions

### 1. Refresh observations, not the exhausted investigations

On later apply, reactivate this change's ExecPlan, fetch/prune and inventory
status, branch, full refs/history, stash/worktrees and preserved foreign roots.
Select Node 22.23.2/npm 10.9.8 before gates. Inspect the current canonical
report/plan/tasks and prior Windows record; update any moved preflight SHA
rather than copying 61b295a as permanent current truth.

Limit upstream checking to `npm view braces version` and
`npm view node-forge version`, using versions JSON only if necessary. An
unexpected new release is **UPSTREAM EVENT DETECTED**, not automatically a
proven safe fix. Stop this documentation-only path, preserve the observation
and hand off to a dedicated remediation campaign. Changed advisory patched-
version metadata or supported parent-removal evidence likewise triggers a
handoff if it becomes known. No full audit or repeated exposure/options study
is needed while there is no new upstream evidence.

Alternative: repeat the previous security campaign. Rejected because its
terminal proof is retained and this task owns only two documentation defects.

### 2. Correct chronology without rewriting historical evidence

Replace §A's unqualified local-only ending language with explicit phases:
initial local termination at 1688252, later owner-ordered review publication at
868e199, and the fetched **published pre-correction baseline** (61b295a at
exploration). Retain original starting SHA/CI and §I's publication history.
The forthcoming correction commit cannot name its own SHA in pre-commit text;
Git plus the final owner report provide that final identity.

Align the braces ExecPlan's current checkpoint/validation ledger with this
chronology and count provenance; retain its BLOCKED remediation status and
unchecked conditional tasks 8.1/8.2. If task 7.5 needs clarification, label its
no-push claim as the initial historical phase and reference later publication.
Do not edit prior proposal/spec semantics or the Windows campaign's history.
Only related wording needed for these defects and the watch handoff changes.

Alternative: delete the initial local-only history. Rejected because it was
true in its own phase and remains useful provenance.

### 3. Treat counts as inventories at a named tree/time

Carry the seven-row ledger from exploration into the necessary canonical
count explanation. Evidence combines CLI item identities, local status, zero
Git index/tree files for each delta, and the clean same-SHA validation. The
common set is 59 specs and 5 changes; local has 7 additional change items.
Multiple delta spec files inside one change are not extra validation items.

Use the same existing locked CLI in a temporary tracked-only detached worktree
if a current comparison is needed. Verify clean status and full HEAD. Borrow
only the absolute CLI binary/dependencies read-only, never workspace documents;
no npm ci is necessary when the tool already runs. Remove only the clean
worktree created by this task; preserve foreign directories and the stash.
If reproduction fails, narrow or retract the claim rather than guess.

Recommended historical wording:

> Local workspace validation: 71/71, including seven preserved non-tracked
> OpenSpec change items. Clean tracked exact-head CI: 64/64 at 61b295a.

This new proposal is **not** one of those seven. Post-proposal local validation
is expected to be 72/72. If its artifacts join the eventual single commit,
tracked CI gains this one new change (65 items if nothing else moves).
Record actual later counts separately; do not pin final acceptance to 64,
claim all 71 were tracked, or relabel new measurements as old evidence.

Alternative: call the difference a CLI-version issue or “probably untracked.”
Rejected by the identical-tool paired experiment and exact item-set delta.

### 4. Proportionate validation and explicit scope review

Resolve `npm run qa:affected -- --files <owned documentation paths>` without
adopting foreign untracked entries. At minimum run on pinned tooling:

```bash
git diff --check
npm run openspec:validate
npm run agent:plan:validate:all
npm run agent:plan:validate -- --plan openspec/changes/reconcile-security-record-upstream-watch/execplan.md
npx vitest run tests/agent-execplan.test.ts tests/agentDocConsistency.test.ts
npm run web:hygiene
```

Run the documentation map's qa:fast guard and scoped formatting as applicable;
no qa:full, build/native suite, clean reinstall for curiosity, or new audit is
justified by these documentation edits. Preserve any meaningful guard failure
and classify it; never weaken tests, counts or policy to pass.

Adversarially check: historical versus current publication; reproducible
inventory/count scopes; no all-71-tracked implication; no green-CI/skipped-E2E
claim; unchanged verdict and upstream facts; old evidence never promoted to
new qualification; every explanation evidenced; owned documentation only.
Confirm package.json, package-lock.json, audit script, source, tests, workflows
and prior foreign material are unchanged. Stop after the two defects and their
necessary connected wording; do not turn review into a documentation-wide audit.

Alternative: rerun broad QA/native qualification for ceremony. Rejected by the
explicit owner boundary and lack of product/dependency/artifact impact.

### 5. One commit, one fast-forward push, then observe externally

During later apply, stage only the canonical report/ExecPlan, tasks if necessary,
and this change's six explicitly owned planning/checkpoint files. Never use
`git add .` or stage foreign OpenSpec roots, review plans, iOS/evidence output.
Review status, full/staged diff and whitespace; create one bounded commit:
`docs(security): reconcile publication identity and OpenSpec count provenance`.

Fetch origin again, verify the remote baseline and ancestry of the candidate,
and stop on unexpected movement/divergence rather than improvising a reset,
rebase, force push or unrelated merge. Publish once by normal fast-forward to
main; record full final SHA and confirm fetched remote equality. Do not claim
publication before it occurs.

Inspect completed CI whose `headSha` is exactly that final documentation SHA.
Verify preceding gates and the audit's actual output, not only its job label.
With unchanged upstream state, expected outcomes are quality **FAILURE** at
`Audit runtime dependencies (gates on new high/critical)` on the two named
undocumented highs, e2e **SKIPPED** behind quality, nightly **SKIPPED** on push.
A cancelled/ancestor run is not final evidence. If another substantive failure
appears, report and classify it rather than silently calling the run expected.

Freeze tracked checkpoint evidence **as of the pre-publication commit** with
publication/CI observations still pending. The explicit owner anti-loop rule
is the exception to routine post-milestone tracked-plan updates: report final
SHA/run/jobs in the owner handoff or immutable gitignored receipt, not another
repository edit/commit solely to update that checkpoint. No future SHA/run
is pre-recorded as earned; a pending-at-commit task is not retroactively green.
Repository remains unchanged afterward unless a new substantive defect is
established. If publication/CI access is blocked, report that external blocker
and do not claim the reconciliation campaign terminal verdict.

Alternative: another commit recording this commit's CI. Rejected because it
creates a new exact-head run and the self-referential bookkeeping loop.

### 6. Event-driven watch is a stop condition, not a new service

Add explicitly to the canonical report/ExecPlan:

> No further autonomous remediation campaign should run for braces or
> node-forge until an upstream unblock condition changes.

Retain the current report's §L resume matrix. Events include braces >3.0.3
published, its advisory gaining a patched version, or supported parent/toolchain
releases eliminating every audited path; node-forge >1.4.0 published with a
verified patch, its advisory gaining a patched version, or Expo removing/
replacing all affected forge paths. Mere PR movement/merge or a larger version
number is a lead, not proof of safe remediation. Use the existing matrix to
verify the event and open a separate minimal repair campaign. No scheduled
re-audit, repeated investigation, GitHub workflow or watcher deployment is added.

After verified documentation/publication requirements, the owner report uses
`SECURITY RECORD RECONCILED — DEPENDENCY SECURITY PRECISELY BLOCKED`.
Remediation classifications stay unchanged. Overall **NOT CERTIFIED**,
Android retained GREEN, J8 NOT_TRIGGERED (622/800 ms), iOS
DEFERRED_BY_OWNER / ENVIRONMENT, production catalog CREDENTIAL / EXTERNAL,
historical absent recovery and stopped production DDL are preserved, not
freshly certified or queried.

## Risks / Trade-offs

- [New artifacts change validation totals] → Separate dated 71/64 baseline,
  post-proposal count and actual final hosted inventory; never hard-code totals.
- [Publication chronology becomes self-referential] → Identify only already
  observed SHAs in committed prose; final identity stays in the owner handoff.
- [Foreign state is mistaken for campaign ownership] → Baseline inventory,
  explicit-path staging and no destructive cleanup or stash action.
- [A new upstream event invalidates blocked-state wording] → Stop and hand off;
  do not mutate dependencies or claim a new release is already proven fixed.
- [Routine checkpoint policy encourages another commit] → Record the owner's
  bounded anti-loop exception and maintain truthful pending-at-commit labels.

## Migration Plan

No application, database, dependency or policy migration. On a separate owner
apply request:

```text
fresh preflight + cheap registry sanity
  -> upstream event: STOP and dedicated remediation handoff
  -> no event: verify evidence -> minimal canonical documentation edits
       -> focused guards + adversarial diff -> one commit -> one FF push
       -> final exact-head CI observation -> external A–J handoff -> upstream watch
```

Rollback, if a substantive documentation defect is later established, is an
ordinary separately authorized correction/revert, never a forced history
rewrite. Do not delete evidence or a stash to obtain cleanliness.

## Owner Handoff / Acceptance

Report A repository (starting/final SHA, branch, push, tracked/foreign state,
stash/worktrees); B old ambiguity/corrected chronology; C local/clean counts,
seven-item cause and commands; D owned files/documentation-only proof;
E exact validation/results/skips; F final exact SHA/run/quality/audit/e2e/nightly;
G each blocker and upstream condition; H retained Android/J8/iOS/production
residuals; I no further campaign until material upstream change; J the earned
verdict and overall NOT CERTIFIED. Planning readiness alone earns none of the
apply/publication/terminal-state claims.
