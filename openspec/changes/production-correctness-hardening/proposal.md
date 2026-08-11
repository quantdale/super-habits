## Why

SuperHabits has several independently proposed production-correctness fixes that remain unfinished or quarantined at the current HEAD. This umbrella change coordinates their verification and implementation in dependency order so data-integrity, state-freshness, and explicit performance contracts are closed without weakening regressions or duplicating work.

## What Changes

- Re-audit the historical correctness backlog against the current source, tests, quarantines, and companion OpenSpec changes.
- Implement and validate each confirmed in-scope fix through its existing companion change, one issue at a time.
- Preserve real-SQLite, Playwright, deterministic simulation, timezone, and sync-boundary evidence appropriate to each risk.
- Remove quarantine markers only after the unchanged regression contract passes reliably; update the known-gap register and companion task state to match.
- Maintain a versioned ExecPlan in this change as the durable implementation and recovery record.

## Capabilities

### New Capabilities

None. Product requirements are already specified by the individual companion changes listed in the ExecPlan; this change is their coordinated hardening campaign.

### Modified Capabilities

None.

## Impact

The campaign may touch the Todos, restore/sync, Linked Actions, Pomodoro, day-rollover provider, service-worker, and Calories diary/recurrence performance paths, together with their existing regression tests, known-gap documentation, and OpenSpec task checkboxes. It must preserve SQLite singleton, soft-delete, sync enqueue, ID/date-key, append-only migration, and layer-boundary invariants. No sync-v2, product redesign, or unrelated feature work is in scope.
