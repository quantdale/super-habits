## Why

The Command Center is currently useful for only two confirmation-first create
actions, while Ask understands only a small read-only subset. Users still have
to leave the overlay to complete common Todo work, log Habit progress, record
nutrition, record a completed routine, or start focus time. Expanding the
surface is valuable only if it remains offline-first, deterministic, and
confirmation-first rather than becoming an autonomous agent.

## What Changes

- Add a strict discriminated Command Center V2 contract for the existing
  `create_todo` and `create_habit` actions plus `complete_todo`, `log_habit`,
  `log_calorie_entry`, `log_workout_routine`, and `start_focus_session`.
- Add local normalization, bounded validation, deterministic active-entity
  resolution, needs-input states, precise previews, and an execution guard.
- Route confirmed mutations through the same canonical Todo, Habit, Calories,
  Workout, and Pomodoro lifecycle entrypoints used by the feature UI.
- Expand Ask with bounded local retrieval for `pending_todos`,
  `calorie_summary`, `habit_progress`, `workout_summary`, `focus_summary`, and
  `daily_overview`; optionally include `weekly_overview` only if it remains a
  bounded extension of the same contracts.
- Keep the two-stage Ask boundary: remote classification, local retrieval of
  typed facts, and optional remote phrasing over facts only, with a deterministic
  local fallback where practical.
- Update the remote parser and Ask Edge Functions to extract/phrase the new
  strict contracts while preserving JWT validation, quotas, body limits,
  timeout behavior, and provider-error sanitization.
- Add focused unit, real-SQLite integration, web journey, deterministic
  simulation, timezone, and security coverage without adding a command-history
  table or remote analytics schema.

## Capabilities

### New Capabilities

- `command-center-v2`: Safe cross-feature mutation drafts, deterministic
  resolution, previews, confirmation, execution, and bounded cross-feature
  read orchestration in the global Command Center overlay.

### Modified Capabilities

- `ai-ask`: Expand the read-only intent contract and local fact retrieval while
  preserving the two-call, no-raw-rows, session-context architecture.

## Impact

- `features/command/` gains the V2 contracts, normalization/resolution,
  preview/execution orchestration, and expanded Ask retrieval/parser behavior.
- Feature data/domain modules receive only the smallest canonical public APIs
  needed for idempotent Todo completion, bounded Habit insights, and the shared
  Pomodoro timer lifecycle; no UI bypasses the data layer.
- `supabase/functions/parse-ai-command/` and
  `supabase/functions/user-ai-ask/` receive stricter allowlisted schemas and
  prompts. Their responsibilities remain authentication, quotas, bounded
  extraction, and phrasing—not local entity resolution or domain semantics.
- Existing Linked Actions, reminder reconciliation, sync/outbox, restore,
  ownership, and RLS behavior remain authoritative and unchanged in policy.
- No new primary database schema or Supabase table is expected.
