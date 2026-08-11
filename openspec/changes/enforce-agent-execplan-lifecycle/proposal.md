## Why

The repository has a durable Markdown ExecPlan protocol, but a fresh Codex
session still has to interpret that protocol manually and compare its narrative
with Git by hand. Lightweight structural checks and a read-only resume command
will make lifecycle state, recovery, and QA escalation immediately actionable
without creating a second task-state system.

## What Changes

- Add a schema-aware ExecPlan validator for ACTIVE, BLOCKED, and COMPLETED plans.
- Add repository-native plan discovery and a read-only resume report.
- Reconcile plan file claims with actual Git changes and show ownership-neutral
  warnings for stale or unaccounted working-tree paths.
- Reuse the existing QA impact-map implementation in resume reports.
- Add a compact template and canonical lifecycle/checkpoint guidance.
- Add focused tests, a long-running implementation loop, and narrow CI
  enforcement for plans that opt into the versioned schema.

## Capabilities

### New Capabilities

- `agent-execplan-lifecycle`: Structural ExecPlan validation, discovery,
  read-only resume orientation, lifecycle rules, and Git/QA reconciliation.

### Modified Capabilities

- None.

## Impact

- Node tooling in `scripts/`, npm scripts, focused Vitest coverage, and a small
  CI quality step.
- Canonical workflow guidance in `AGENTS.md` and `.agent/PLANS.md`, plus one
  initialization template.
- Existing QA impact behavior is refactored for reuse but its CLI output and
  `qa/impact-map.json` contract remain unchanged.
- No product runtime, database, sync, user-data, or task-database changes.
