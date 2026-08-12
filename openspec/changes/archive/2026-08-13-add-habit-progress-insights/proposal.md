## Why

Habit Engine V2 now preserves historically correct schedule and target meaning,
but the Habits surface only exposes today’s count, a streak, and a heatmap.
Users cannot inspect whether a habit is improving, how many scheduled
occurrences they have completed, or how target changes affected recent days.
This change adds a small local-first progress surface while that domain model
is fresh and already covered by deterministic tests.

## What Changes

- Add per-habit progress metrics for current streak, longest streak, and
  scheduled completion rates over 7, 30, and 90 calendar-day windows.
- Add recent target-vs-actual history rows and an explainable trend indicator.
- Reuse the existing effective-dated schedule/target and streak domain helpers;
  do not create a second habit-calculation model.
- Add a Habits entry point and accessible modal/detail surface with textual
  equivalents for all visual progress information.
- Load one completion history for the selected habit and add regression
  coverage for historical schedule, target, timezone, and boundary semantics.
- Remove the Habits list’s avoidable per-habit full-history reads when the
  shared completion data can provide the same result.

## Capabilities

### New Capabilities

- `habit-progress-insights`: Schedule-aware local progress metrics, recent
  target-vs-actual history, and accessible per-habit presentation.

### Modified Capabilities

None. Existing Habit Engine requirements remain authoritative; this change
consumes them.

## Impact

- `features/habits/` domain, data, screen, and a focused insights component.
- Vitest domain and real-SQLite integration tests plus a focused Playwright
  journey.
- No SQLite migration, Supabase migration, new dependency, or remote write.
- Existing Habits refresh work becomes a single shared completion read where
  practical, preserving the existing heatmap and streak results.
