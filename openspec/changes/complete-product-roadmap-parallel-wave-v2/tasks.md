# Tasks: Complete Product Roadmap Parallel Wave V2

## 1. Campaign scaffolding

- [x] Create OpenSpec change with proposal, design, spec delta, ExecPlan, HARDENING_HANDOFF
- [x] Record sub-agent assignment matrix and file ownership in the ExecPlan
- [x] Validate OpenSpec artifacts and the versioned ExecPlan

## 2. Worker 1 — Todos + Habits depth

- [ ] Todo list search, priority/due/project filters, and sort modes (domain + UI)
- [ ] Bulk multi-select operations (complete, delete, priority change)
- [ ] Habit list filtering/sorting and per-habit history detail surface
- [ ] Focused Vitest coverage for new domain functions

## 3. Worker 2 — Projects + Goals depth

- [ ] Project progress rollup domain functions with unit tests
- [ ] Enriched project detail (linked goals/todos/habits, stats, target countdown)
- [ ] Goal progress editing and linked-entity rollups; list filter/sort
- [ ] Lifecycle flows (complete/archive) with confirmation

## 4. Worker 3 — Daily Plan + Planning Hub + Weekly Review

- [ ] Carry-forward of unfinished priorities into today's plan (idempotent)
- [ ] Past-plan history navigation and adherence streaks
- [ ] Planning Hub Today briefing enrichment
- [ ] Weekly Review carry-forward actions and review history browsing

## 5. Worker 4 — Activity + Progress + Quick Capture

- [ ] Activity timeline entity-type/date filtering
- [ ] 7/30/90-day progress comparisons and trend cards
- [ ] Quick Capture parsing (due date, priority) and project/goal assignment

## 6. Worker 5 — Overview dashboard

- [ ] Summary cards across existing domains with deep links
- [ ] Card customization with locally persisted order
- [ ] Empty/loading states and refresh behavior

## 7. Worker 6 — Command Center planning coverage

- [ ] create_project / update_goal_progress / add_todo_to_daily_plan intents through parse → preview → confirm → executor
- [ ] Ask-mode retrieval over projects/goals/daily plan
- [ ] Command history and suggestion chips

## 8. Worker 7 — Pomodoro depth

- [ ] Session association with todo/project/goal within current schema or local preferences
- [ ] Session notes and configurable presets (work/break/long-break cycle)
- [ ] Focus stats/history improvements preserving canonical logging semantics

## 9. Worker 8 — Workout depth

- [ ] Workout log history detail view
- [ ] Personal-record detection domain functions with tests
- [ ] Routine duplication as template; rest controls; volume summaries

## 10. Worker 9 — Calories depth

- [ ] Rolling macro trend views and daily target progress
- [ ] Copy-day logging and saved-meal organization improvements
- [ ] Diary navigation polish and richer summaries

## 11. Worker 10 — Platform completion

- [ ] Todo due-date and daily-plan local reminders with platform guards
- [ ] PWA offline/update indicators via service-worker registration bridge
- [ ] Settings entries for new notification preferences

## 12. Integration and closure

- [ ] Orchestrator reviews every worker commit and integrates accepted work
- [ ] Shared-file integration (shell wiring, providers) applied serially
- [ ] SCHEMA_REQUESTs and INTEGRATION_NEEDs recorded in HARDENING_HANDOFF
- [ ] Minimal end gates: typecheck, lint, openspec validate, execplan validation, git diff --check
- [ ] Campaign ExecPlan reconciled to COMPLETED with evidence
