## Why

The HEAVY recurring-todo section switch and calorie-diary saved-meal search are the last unresolved contract gaps in the production-correctness campaign. Their user-visible D14 ceilings are intentionally strict (800ms and 500ms) and must be satisfied by the actual journey path, not by changing the benchmark or hiding work.

## What Changes

- Reproduce and profile CG-4 and CG-5 using the existing HEAVY J8 journey and record repeated distributions, browser/project state, and phase timings.
- Implement the smallest evidence-backed product or data-path optimizations while preserving recurrence idempotency, search semantics, rendering behavior, fixtures, assertions, and thresholds.
- Add only targeted regression coverage required by the discovered bottlenecks; add a migration/index only when an actual query plan proves it necessary.
- Remove each quarantine only after repeated unchanged-threshold runs pass with meaningful margin, then reconcile the known-gap register and QA records.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `user-simulation-testing`: make the existing HEAVY performance contract explicit for recurring section switching and calorie-diary search, including unchanged thresholds and user-visible timing boundaries.

## Impact

Likely areas are `features/todos/`, `features/calories/`, shared foreground-refresh/navigation code, SQLite query paths, the J8 journey and its helpers, focused unit/integration tests, `docs/testing/known-gaps.md`, and this change's validation artifacts. No new runtime dependency or broad architecture rewrite is intended.
