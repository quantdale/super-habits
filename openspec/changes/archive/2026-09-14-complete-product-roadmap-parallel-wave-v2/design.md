# Design: Complete Product Roadmap Parallel Wave V2

## Context

Schema v15 already carries the associations this wave needs: `todos.project_id`
/ `todos.goal_id`, `habits.project_id` / `habits.goal_id`,
`goals.project_id` / `goals.progress_percent`, `projects.status` /
`target_date`. The wave therefore emphasizes computation, orchestration, and UI
depth over new persistence. Ten delegated workers implement in parallel under
strict path ownership; the orchestrator owns shared hotspots (`app/`,
`core/db/**`, `core/providers/**`, `core/sync/**`, `core/backup/**`,
`package.json`, campaign artifacts) and performs integration.

## Goals / Non-Goals

- Goals: maximum coherent product implementation in parallel; every feature
  module gains real user-visible capability; pure logic lands in
  `{feature}.domain.ts` with Vitest coverage; no regression of data
  invariants.
- Non-Goals: schema migrations, sync/backup/portable scope changes, E2E or
  native QA, performance work, CI repair.

## Work Decomposition

Ten non-overlapping packets (details and ownership in `execplan.md`
SUB-AGENT ASSIGNMENT MATRIX):

1. Todos + Habits depth
2. Projects + Goals depth
3. Daily Plan + Planning Hub + Weekly Review continuity
4. Activity Timeline + Progress Insights + Quick Capture
5. Overview dashboard
6. Command Center planning coverage
7. Pomodoro depth
8. Workout depth
9. Calories/Nutrition depth
10. Platform: notifications beyond habits, PWA/offline UX, settings depth

## Coordination Model

- Shared tree, owned-path commits: workers `git add` only their owned paths and
  commit directly to local main with English messages; branch isolation via
  worktrees was rejected because harness subagents share one filesystem and
  `node_modules`, making Windows junction setup the dominant failure risk.
- Schema freeze: no `core/db` edits. Workers needing durable shape changes
  return a SCHEMA_REQUEST (tables/columns/indexes/types rationale) recorded in
  HARDENING_HANDOFF for a later approved migration.
- Shared-file needs (shell wiring, providers, package.json) are reported as
  INTEGRATION_NEED entries with a proposed patch; the orchestrator applies them
  serially after review.

## Risks / Trade-offs

- Interleaved commits on local main from ten workers → mitigated by strict
  pathspec discipline and orchestrator review of every commit before push.
- Concurrent `tsc --noEmit` sees other workers' transient errors → workers
  gate only on their owned paths and targeted Vitest files.
- Feature-local settings instead of central settings entries where a bucket
  edit would collide → Worker 10 alone edits `features/settings`.

## Migration Plan

None (schema frozen at v15). SCHEMA_REQUESTs are documentation for the next
campaign, not code.

## Open Questions

None — dynamic reassignment during the wave is authorized if a packet's area
proves already complete.
