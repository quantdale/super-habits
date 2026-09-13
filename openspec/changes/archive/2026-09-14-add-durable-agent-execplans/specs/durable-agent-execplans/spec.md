## ADDED Requirements

### Requirement: Task-scoped ExecPlan locations

For substantial, multi-step, delegated, or context-loss-prone work, the
repository SHALL maintain one task-specific ExecPlan. An OpenSpec-backed task
SHALL store it at `openspec/changes/<change-slug>/execplan.md`; a task without
an OpenSpec change SHALL store it at `.agent/execplans/<task-slug>.md`. The
repository SHALL NOT require one global mutable active-task state file.

#### Scenario: OpenSpec task is colocated with its implementation state

- **WHEN** a new substantial task has the OpenSpec change slug `weekly-habit-schedules`
- **THEN** its requirements remain in the change artifacts and its living
  implementation state is discoverable at
  `openspec/changes/weekly-habit-schedules/execplan.md`

#### Scenario: Independent tasks do not overwrite state

- **WHEN** two substantial tasks are active at the same time
- **THEN** each task has a different ExecPlan path and updating one plan does
  not change the other task's checkpoint

### Requirement: Self-contained living checkpoint

Every active ExecPlan SHALL record the task purpose/user outcome, relevant
context, scope, non-goals, a replace-in-place Current Checkpoint, milestone
progress, material discoveries, significant decisions, concise validation
evidence, important changed files/areas, recovery instructions, and an
Outcomes & Retrospective section. The Current Checkpoint SHALL state the
current milestone, completed and in-progress work, important modified files,
last successful validation, current failures, relevant quarantines, blockers,
exact next action, and remaining definition-of-done conditions.

#### Scenario: A new agent can identify the next safe action

- **WHEN** an agent opens an active ExecPlan without prior conversation
- **THEN** it can determine why the task exists, what has been completed, what
  is in progress, what validation last passed or failed, and the exact next
  action without reconstructing chat history

#### Scenario: Checkpoint reflects current state rather than a transcript

- **WHEN** a milestone completes or a material decision/failure changes the
  approach
- **THEN** the agent replaces stale checkpoint facts, records the durable
  discovery or decision, and does not append raw terminal logs as the new state

### Requirement: Waypoint maintenance

The owning agent SHALL update the ExecPlan after milestones, major decisions,
material discoveries, important failures or new known gaps, meaningful
validation, before a large context-heavy phase, before delegating substantial
work, after integrating delegated findings, and before finishing. The plan
SHALL preserve concise evidence sufficient for another agent to continue.

#### Scenario: Validation evidence survives a context boundary

- **WHEN** a meaningful QA command completes before compaction
- **THEN** the plan's Validation Ledger records the command, outcome, and
  concise evidence before the agent begins the next phase

### Requirement: Explicit compaction and fresh-session recovery

The repository SHALL instruct a recovering agent to reread `AGENTS.md`,
`.agent/PLANS.md`, and the task ExecPlan; inspect `git status --short`,
`git diff --stat`, `git diff --name-only`, and relevant diffs; reconcile the
checkpoint against the working tree; inspect or rerun relevant validation; use
`npm run qa:affected` when applicable; and continue from `Exact next action`.
The instructions SHALL state that Git wins over stale plan narrative and that
conversation history is not authoritative task state.

#### Scenario: Compaction leaves a stale narrative claim

- **WHEN** the plan says a file was changed but `git status` and the diff show
  it is absent
- **THEN** the agent investigates and updates the plan before implementation,
  rather than assuming the narrative is correct or discarding the worktree

#### Scenario: A fresh session resumes existing work

- **WHEN** a new Codex session starts at the repository root for an unfinished
  task
- **THEN** it locates the task-specific ExecPlan, verifies important completed
  claims against files and validation evidence, and continues without redoing
  completed research solely because chat history is unavailable

### Requirement: OpenSpec, Git, and QA separation

The protocol SHALL define OpenSpec as the authority for required behavior and
product rationale, the ExecPlan as the authority for implementation progress,
decisions, discoveries, recovery, and validation ledger, and Git as the
authority for actual file state. ExecPlans SHALL reference the existing
autonomous-QA workflow and impact map rather than duplicating them. Completion
SHALL require validated definition-of-done conditions and a completed outcome
summary; failures, skips, environment blockers, and known gaps SHALL remain
visible.

#### Scenario: A task claims completion with an unverified requirement

- **WHEN** an ExecPlan's checklist is complete but a required QA gate has not
  run or is an unclassified blocker
- **THEN** the task remains active or explicitly blocked, and the plan does not
  claim completion

#### Scenario: QA escalation is selected from changed files

- **WHEN** a task changes files covered by `qa/impact-map.json`
- **THEN** the agent records `npm run qa:affected` and follows the resolved
  gates, preserving any `ENVIRONMENT` or known-gap result in the ledger

### Requirement: Delegation and parallel-safe ownership

The primary agent SHALL own the ExecPlan. Before delegating substantial work,
it SHALL record the subtask, scope boundaries, and expected output; subagents
SHALL NOT concurrently mutate overlapping files without explicit coordination;
and material returned findings SHALL be integrated into the plan.

#### Scenario: Delegated research survives subagent context loss

- **WHEN** a subagent investigates a repository constraint and returns a
  material finding
- **THEN** the primary agent records the finding and its consequence in the
  ExecPlan before relying on it in a later milestone

#### Scenario: Two worktrees use the same protocol safely

- **WHEN** two worktrees each implement different tasks
- **THEN** they can maintain independent task plans while normal Git ownership
  rules govern any shared stable-document edits
