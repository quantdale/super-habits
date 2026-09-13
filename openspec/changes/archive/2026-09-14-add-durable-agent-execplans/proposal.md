## Why

Long-running Codex work currently depends too heavily on conversation context:
compaction, session restarts, and handoffs can make an unfinished task's intent,
decisions, validation, and next action difficult to recover. SuperHabits already
has substantial OpenSpec and autonomous-QA workflows, so a small repository-native
waypoint protocol can make continuity an explicit, verifiable project artifact.

## What Changes

- Add a concise canonical ExecPlan protocol in `.agent/PLANS.md`.
- Require independent task plans for substantial work, stored with OpenSpec
  changes or under `.agent/execplans/` for non-OpenSpec work.
- Define living checkpoints, waypoint updates, compaction recovery, fresh-session
  handoff, delegation boundaries, QA evidence, and completion/retrospective rules.
- Update `AGENTS.md` with stable discovery and recovery rules that point to the
  protocol without turning it into a dynamic task log.
- Provide this change's own `execplan.md` as a dogfooding example and validate
  that parallel tasks do not share one mutable state file.

## Capabilities

### New Capabilities

- `durable-agent-execplans`: Repository-native task continuity using independent,
  living ExecPlans and explicit recovery/waypoint procedures.

### Modified Capabilities

- None.

## Impact

- Documentation and agent workflow files: `AGENTS.md`, `.agent/PLANS.md`, and
  task-specific ExecPlans.
- OpenSpec change artifacts gain an optional `execplan.md` companion for
  implementation state; existing requirements and QA documentation remain the
  authorities for their respective concerns.
- No product runtime code, application APIs, dependencies, database schema, or
  user data are changed.
