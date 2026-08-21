# Tasks: Complete Product Roadmap Parallel Wave V2

## 1. Campaign scaffolding

- [x] Create OpenSpec change with proposal, design, spec delta, ExecPlan, HARDENING_HANDOFF
- [x] Record sub-agent assignment matrix and file ownership in the ExecPlan
- [x] Validate OpenSpec artifacts and the versioned ExecPlan

## 2. Worker 1 — Todos + Habits depth

- [x] Todo list search, priority/due/project filters, and sort modes (domain + UI)
- [x] Bulk multi-select operations (complete, delete, priority change)
- [x] Habit list filtering/sorting and per-habit history detail surface
- [x] Focused Vitest coverage for new domain functions

## 3. Worker 2 — Projects + Goals depth

- [x] Project progress rollup domain functions with unit tests
- [x] Enriched project detail (linked goals/todos/habits, stats, target countdown)
- [x] Goal progress editing and linked-entity rollups; list filter/sort
- [x] Lifecycle flows (complete/archive) with confirmation

## 4. Worker 3 — Daily Plan + Planning Hub + Weekly Review

- [x] Carry-forward of unfinished priorities into today's plan (idempotent)
- [x] Past-plan history navigation and adherence streaks
- [x] Planning Hub Today briefing enrichment
- [x] Weekly Review carry-forward actions and review history browsing

## 5. Worker 4 — Activity + Progress + Quick Capture

- [x] Activity timeline entity-type/date filtering
- [x] 7/30/90-day progress comparisons and trend cards
- [x] Quick Capture parsing (due date, priority) and project/goal assignment

## 6. Worker 5 — Overview dashboard

- [x] Summary cards across existing domains with deep links
- [x] Card customization with locally persisted order
- [x] Empty/loading states and refresh behavior

## 7. Worker 6 — Command Center planning coverage

- [x] create_project / update_goal_progress / add_todo_to_daily_plan intents through parse → preview → confirm → executor
- [x] Ask-mode retrieval over projects/goals/daily plan
- [x] Command history and suggestion chips

## 8. Worker 7 — Pomodoro depth

- [x] Session association with todo/project/goal within current schema or local preferences
- [x] Session notes and configurable presets (work/break/long-break cycle)
- [x] Focus stats/history improvements preserving canonical logging semantics

## 9. Worker 8 — Workout depth

- [x] Workout log history detail view
- [x] Personal-record detection domain functions with tests
- [x] Routine duplication as template; rest controls; volume summaries

## 10. Worker 9 — Calories depth

- [x] Rolling macro trend views and daily target progress
- [x] Copy-day logging and saved-meal organization improvements
- [x] Diary navigation polish and richer summaries

## 11. Worker 10 — Platform completion

- [x] Todo due-date and daily-plan local reminders with platform guards
- [x] PWA offline/update indicators via service-worker registration bridge
- [x] Settings entries for new notification preferences

## 12. Integration and closure

- [x] Orchestrator reviews every worker commit and integrates accepted work
- [x] Shared-file integration (shell wiring, providers) applied serially
- [x] SCHEMA_REQUESTs and INTEGRATION_NEEDs recorded in HARDENING_HANDOFF
- [x] Minimal end gates: typecheck, lint, openspec validate, execplan validation, git diff --check
- [x] Campaign ExecPlan reconciled to COMPLETED with evidence
