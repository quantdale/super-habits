# SuperHabits ExecPlan Protocol

This document is the canonical protocol for durable state in substantial,
multi-step agent work. It defines how a task's intent, reasoning, progress, and
validation survive context compaction and session handoff. It does not replace
OpenSpec requirements or Git's record of actual files.

## When an ExecPlan is required

Create an ExecPlan for substantial feature work, architectural or multi-system
changes, migrations, complicated investigations, significant refactors,
QA/test-infrastructure work, delegated work, or any task expected to cross
multiple implementation and validation milestones or survive context loss.

Use judgment for tiny local fixes. If continuity, coordination, or recovery
would matter, prefer a plan. Do not create one global active-task file: each
task owns an independent plan.

## Where the plan lives

- OpenSpec-backed task: `openspec/changes/<change-slug>/execplan.md`.
- Non-OpenSpec task: `.agent/execplans/<task-slug>.md`.

OpenSpec remains the source for required behavior, rationale, and normative
requirements. The ExecPlan is the source for implementation strategy, current
state, decisions, discoveries, validation evidence, and resume instructions.
Link to the related OpenSpec artifacts rather than copying them wholesale.

## Required plan shape

Use Markdown and keep the plan concise enough to update frequently. Every
active plan must contain these sections:

1. **Purpose / User Outcome** — why the task exists and what observable success
   looks like.
2. **Context** — architecture, constraints, and relevant repository areas a
   zero-context agent needs.
3. **Scope** and **Non-Goals** — the intended boundary.
4. **Current Checkpoint** — the authoritative snapshot of NOW. Replace stale
   text instead of appending repeated summaries. Include current milestone,
   completed work, in-progress work, important modified files, last successful
   validation, current failures, relevant quarantines, blockers, exact next
   action, and remaining definition-of-done conditions.
5. **Progress** — concrete milestone checklist, dated when useful.
6. **Surprises & Discoveries** — only findings that change implementation or
   future reasoning.
7. **Decision Log** — significant decisions and why they are settled.
8. **Validation Ledger** — command, concise outcome, and date; do not paste raw
   logs.
9. **Changed Files / Areas** — important task files and why; Git remains the
   authority for the actual diff.
10. **Recovery / Resume Instructions** — exact zero-context startup procedure.
11. **Outcomes & Retrospective** — complete at the end; summarize changes,
    proof, remaining work, follow-ups, and lessons.

An active plan must always have one unambiguous `Exact next action`. A completed
plan must explicitly mark its milestone as complete, record final validation,
and fill in Outcomes & Retrospective. If blocked, record the blocker and safe
alternatives; do not claim completion without evidence.

## Waypoint protocol

The agent that owns the task must update the plan continuously:

- after each milestone;
- after a major design decision or a discovery that changes the approach;
- after an important failure or new known gap;
- after meaningful validation;
- before a large/context-heavy phase;
- before delegating substantial work, including scope and expected output;
- after integrating delegated findings; and
- before finishing.

The checkpoint is a replace-in-place waypoint, not a terminal transcript.
Record enough evidence to resume, but keep large logs in the normal QA
artifacts and link or name their paths.

## Compaction recovery

If context may have been compacted, confidence in earlier details is low, or a
long task is resumed after substantial context churn, do not guess. In order:

1. Read `AGENTS.md`.
2. Read `.agent/PLANS.md` completely.
3. Read the task's ExecPlan completely.
4. Run `git status --short`.
5. Run `git diff --stat` and `git diff --name-only`; inspect relevant diffs.
6. Reconcile the plan's Current Checkpoint with the working tree. Git state
   wins over stale narrative; update the plan before continuing when they
   disagree.
7. Inspect recent validation artifacts or rerun focused checks as needed.
8. Run `npm run qa:affected` (or `npm run qa:impact -- --files ...`) for task
   changes when applicable, then follow the gates it resolves.
9. Continue only from the plan's `Exact next action`, updating the waypoint
   first if the actual state differs.

## Fresh-session handoff

A new agent assumes it has no reliable conversation memory. It reads the
repository instructions, locates the task-specific ExecPlan, inspects Git,
verifies important completed claims against files and validation evidence, and
continues from the checkpoint. It does not redo completed research merely
because chat history is absent. If no plan exists for substantial work, create
one before implementation.

## Delegation and parallel safety

The primary agent owns and updates the ExecPlan. Before delegating, record the
subtask, file/scope boundaries, and expected output. Do not let subagents
concurrently mutate overlapping files unless ownership is explicitly
coordinated. After return, evaluate and externalize material findings in the
plan. Separate tasks use separate plan files, so concurrent work never fights
over one mutable global state file.

## QA and completion

Use `docs/testing/autonomous-qa.md` and `qa/impact-map.json` as the QA source
of truth; reference their escalation guidance rather than duplicating it here.
Record commands and concise outcomes in the Validation Ledger, including
`ENVIRONMENT`, known-gap, or skipped results. Preserve failures and artifacts,
classify them using the repository's QA taxonomy, and never weaken or delete a
meaningful test to get green. A task is complete only when the plan's
definition-of-done conditions are validated and its Outcomes & Retrospective is
filled in.

## Minimal template

Copy this shape into a task-specific file and adapt it:

```md
# ExecPlan: <task>

## Purpose / User Outcome

...

## Context

...

## Scope

...

## Non-Goals

...

## Current Checkpoint

- Milestone: ...
- Completed: ...
- In progress: ...
- Important modified files: ...
- Last successful validation: ...
- Current failures: none / ...
- Relevant quarantines: none / ...
- Blockers: none / ...
- Exact next action: ...
- Remaining definition of done: ...

## Progress

- [ ] ...

## Surprises & Discoveries

- None yet.

## Decision Log

- YYYY-MM-DD — Decision — Why.

## Validation Ledger

- YYYY-MM-DD — `command` — NOT RUN / PASS / FAIL / ENVIRONMENT — concise evidence.

## Changed Files / Areas

- `path` — reason.

## Recovery / Resume Instructions

1. ...

## Outcomes & Retrospective

- Status: Active.
- Summary: ...
- Follow-up: ...
```
