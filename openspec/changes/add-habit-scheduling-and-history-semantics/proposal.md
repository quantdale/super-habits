## Why

Habits currently behave as daily trackers: every calendar day is treated as an obligation, statistics use the current target for all history, and streak calculation only inspects a short recent window. This makes a weekly habit impossible to model and lets an edit today rewrite what past completion data meant.

## What Changes

- Add weekly schedules for every habit: every day, weekdays, weekends, or any non-empty custom weekday set.
- Store effective-dated habit rules containing the schedule and target so historical dates resolve the rule that was active on that date.
- Migrate existing habits to an initial every-day rule at their local creation date without changing completion rows or current target behavior.
- Make scheduled-day status explicit in the domain: unscheduled dates are neutral, pre-creation dates are ineligible, and future dates do not count in reporting.
- Make current and longest streaks operate over scheduled occurrences with local-date today grace and no arbitrary lookback cap.
- Make consistency, today progress, Overview summaries, and the fixed 52-column habit heatmap use only eligible scheduled occurrences.
- Add compact accessible schedule controls to habit creation/editing and a neutral off-day habit-card state.
- Preserve Linked Actions behavior on off-days without making an off-day scheduled or allowing recursive/repeated effects to corrupt counts.
- Preserve schedule and target history in the synced habit payload and restore it with a backward-compatible fallback for older remote rows; update the disposable Supabase reference schema.
- Add migration, domain, real-SQLite, timezone, web journey, simulation, and native persistence coverage without changing existing performance contracts.

## Capabilities

### New Capabilities

- `habit-scheduling-and-history-semantics`: Weekly schedules, effective-dated rule history, local-calendar expectation semantics, and historically correct habit reporting.

### Modified Capabilities

- None.

## Impact

- SQLite schema version 12 adds the synced `habits.rule_history` JSON column; `core/db/schema.sql` and `simulation/backend/schema.sql` remain synchronized reference snapshots.
- `features/habits/habits.data.ts` gains rule-history persistence and restore normalization; `features/habits/habits.domain.ts` becomes the schedule/streak/consistency/heatmap authority.
- Habits, Overview, command retrieval, linked-action compatibility tests, simulation fixtures, Playwright journeys, and Maestro habit persistence flows are updated.
- Existing completion storage remains per habit/local date and local-only; no full two-way sync or completion-history restore is introduced.
