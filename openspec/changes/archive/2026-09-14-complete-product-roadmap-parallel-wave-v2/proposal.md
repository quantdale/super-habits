# Proposal: Complete Product Roadmap Parallel Wave V2

## Why

The SuperHabits core (Todos, Habits, Pomodoro, Workout, Calories) plus the
productivity expansion layer (Projects, Goals, Daily Plan, Planning Hub,
Weekly Review, Activity Timeline, Progress Insights, Quick Capture) are
implemented but unevenly deep. The expansion modules are thin single-view
surfaces (84–820 lines each) compared with the mature core modules
(1,400–6,200 lines). Cross-feature intelligence (progress rollups, planning
adherence, command-center coverage of planning entities, reminders beyond
habits, PWA/offline affordances) is largely absent. This wave closes the
largest product gaps in one massively parallel implementation pass.

## What Changes

### New Capabilities

- Projects: computed progress rollups from linked todos/goals/habits, enriched
  project detail (linked entities, completion stats, target countdown),
  lifecycle flows (complete/archive with confirmation), list filtering/sorting.
- Goals: progress editing with history-friendly semantics, linked-entity
  rollups, horizon-aware status presentation, list filtering/sorting.
- Daily Plan: carry-forward of unfinished priorities, past-plan history
  navigation, adherence streaks, quick-add from existing todos.
- Planning Hub Today dashboard: cross-surface "today" briefing (overdue, due
  today, focus, plan progress).
- Weekly Review: actionable outputs (carry-forward actions into the next
  daily plan) and review history browsing.
- Activity Timeline: filtering by entity type and date range.
- Progress Insights: 7/30/90-day domain comparisons and trend cards.
- Quick Capture: due-date/priority parsing, project/goal assignment, recent
  captures.
- Overview: customizable dashboard cards with persisted ordering, cross-surface
  summaries, deep links into sections.
- Command Center: planning-entity intents (project creation, goal progress,
  daily-plan insertion) and ask-mode retrieval over planning data, command
  history, suggestion chips.
- Pomodoro: session-task/project/goal association where the existing schema
  allows, session notes, configurable presets, long-break cycles, focus stats.
- Workout: workout-log history detail, personal-record detection, routine
  duplication as templates, rest controls, volume summaries.
- Calories: macro trend views, target progress, copy-day logging, saved-meal
  organization improvements.
- Platform: todo due-date local reminders (native-guarded), daily-plan reminder
  option, PWA offline/update indicators, notification preference surfaces.

### Modified Capabilities

- Todos/Habits gain search/filter/sort, bulk operations, and richer detail/edit
  surfaces without changing existing persistence semantics.
- Settings gains new preference entries inside its existing six-bucket IA.
- No changes to sync scope, backup scope, restore semantics, ownership
  binding, RLS posture, or migration history (schema stays at v15 this wave;
  schema requests are recorded for a later hardening-approved migration).

## Impact

- Affected specs: navigation (new overview card contract), ai-ask (planning
  retrieval), plus a new product-completion-wave capability spec.
- Affected code: `features/*` (all modules), `core/ui`, `core/notifications`,
  `core/pwa`, `lib/notifications.ts`, `features/settings`.
- Out of scope this wave: schema migrations, sync/backup scope changes, E2E
  suite expansion, native runtime QA, performance campaigns (next hardening
  campaign owns these).
