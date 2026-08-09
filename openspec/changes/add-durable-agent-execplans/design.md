## Context

SuperHabits has stable repository instructions in `AGENTS.md`, Codex-specific
workflow guidance in `docs/codex-workflow.md`, OpenSpec requirements under
`openspec/`, and an impact-aware QA workflow under `docs/testing/` and `qa/`.
Those documents explain how to work, but there is no task-scoped, living state
file that records what a long-running agent has already done or exactly where
to resume. The worktree may also contain multiple unrelated tasks, so one
global current-task file would create ownership and merge hazards.

The change must be documentation-first, repository-native, and safe to add to
the already dirty worktree. `AGENTS.md` needs only stable discovery rules;
volatile progress belongs in each task's plan.

## Goals / Non-Goals

**Goals:**

- Define one concise ExecPlan schema and waypoint update protocol.
- Give OpenSpec-backed and non-OpenSpec tasks independent, discoverable plan
  locations.
- Make compaction recovery and fresh-session handoff explicit and executable.
- Preserve the distinction between OpenSpec requirements, ExecPlan state, Git
  file truth, and autonomous-QA evidence.
- Demonstrate the protocol with this change's own plan and dogfood scenarios.

**Non-Goals:**

- No application runtime, database, sync, or product behavior changes.
- No global task manager, automatic state database, or mandatory CLI.
- No duplicate QA manual; `docs/testing/autonomous-qa.md` remains authoritative.
- No rewrite of existing `.agents/`, `.mcp.json`, or unrelated dirty files.

## Decisions

### 1. Use per-task Markdown ExecPlans

Each substantial task gets one Markdown plan with a required current
checkpoint, milestone progress, discoveries, decisions, validation ledger,
changed-area inventory, recovery steps, and final retrospective.

Alternative considered: one `.agent/CURRENT_TASK.md`. Rejected because
parallel agents or worktrees would overwrite each other's state.

### 2. Put plans beside OpenSpec changes when applicable

OpenSpec-backed tasks use `openspec/changes/<slug>/execplan.md`; other tasks use
`.agent/execplans/<slug>.md`. The OpenSpec artifacts define what is required;
the ExecPlan records how the implementation is proceeding and what remains.

Alternative considered: put every plan under `.agent/execplans/`. Rejected
because colocating an OpenSpec task's implementation state with its proposal,
design, specs, and tasks makes handoff more discoverable.

### 3. Make the checkpoint replace-in-place

The plan has one authoritative `Current Checkpoint` with an `Exact next
action`. Agents update it after milestones, decisions, discoveries, failures,
delegation, validation, and before finishing. Detailed logs remain in QA
artifacts rather than accumulating in the plan.

Alternative considered: append-only journals. Rejected because a new agent
would have to reconstruct NOW from stale summaries; the validation ledger and
decision/discovery sections retain only durable evidence.

### 4. Keep recovery procedural and verify against Git

Recovery always rereads the stable instructions, the protocol, and the current
plan, then inspects `git status --short`, `git diff --stat`, and changed files.
Git wins when the narrative is stale. `npm run qa:affected` is the standard
impact entry point for changed files.

Alternative considered: trust the plan as a complete file manifest. Rejected
because plans are human-maintained and Git is authoritative for actual files.

### 5. Do not add optional tooling yet

No helper command or new repository skill is added in this change. The existing
`.agents/` tree contains user-owned mirrored agent skills, and adding another
operational layer would duplicate the concise Markdown procedure before it has
been proven necessary. The protocol remains usable with ordinary repository
commands.

## Risks / Trade-offs

- **[Risk] Agents may stop updating the plan.** → `AGENTS.md` makes the plan
  mandatory for long-running work and names waypoint moments; the task's own
  plan demonstrates the behavior.
- **[Risk] A checkpoint may become stale or contradict Git.** → Recovery
  explicitly reconciles the checkpoint with `git status` and diffs, and the
  protocol says to update the plan before continuing.
- **[Risk] Protocol duplication with QA/OpenSpec docs.** → `.agent/PLANS.md`
  references those sources and only defines continuity concerns.
- **[Risk] Concurrent work still edits shared stable docs.** → Per-task plans
  isolate volatile state; shared-file edits remain normal Git coordination work.
- **[Risk] Markdown has no automatic enforcement.** → The protocol is
  intentionally lightweight; validation is documentation review and
  dogfooding, with future tooling left as a follow-up if repeated failures
  justify it.

## Migration Plan

1. Add `.agent/PLANS.md` and this change's `execplan.md`.
2. Add concise discovery/recovery rules to `AGENTS.md` while preserving its
   existing autonomous-QA/native-E2E changes.
3. Validate the OpenSpec artifacts and run focused formatting/QA checks.
4. Dogfood four scenarios: compaction recovery, fresh-session handoff,
   independent parallel plans, and completed-plan transition.
5. If the protocol is accepted, future substantial work adopts it immediately;
   no existing task state needs conversion because no prior `.agent/` protocol
   exists.

Rollback is a documentation-only revert of the task-owned files. It does not
require database or deployment migration.

## Open Questions

- None blocking. A helper command or repository skill can be proposed later if
  repeated manual recovery shows a concrete maintenance benefit.
