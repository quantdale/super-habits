## Why

Habit Reminders V1 schedules reliable passive notifications, but a delivered reminder cannot identify its habit precisely, complete it, or be snoozed safely. V2 must turn the existing one-shot reminder into a small, deterministic interaction without introducing a second notification lifecycle or weakening Habit Engine V2 semantics.

## What Changes

- Register one stable native `Habit Reminder` notification category with `Mark complete` and `Snooze` actions.
- Carry a stable habit ID, local occurrence date, occurrence identity, reminder kind, and snooze marker in notification metadata.
- Route body taps through the existing response path to Habits and focus the exact active habit by ID, with safe fallback for missing/deleted habits.
- Add a canonical notification completion mutation that validates current date, active habit, schedule, and historical target before incrementing exactly once and running normal Linked Actions.
- Add durable, device-local response idempotency with bounded cleanup and a deterministic linked-action event identity that survives replay/process restart.
- Add a fixed 15-minute same-day snooze with deterministic identity, duplicate protection, completion/deletion/schedule validation, and no reminder-time mutation.
- Preserve V1 reconciliation, Pomodoro isolation, web graceful behavior, sync/restore boundaries, and existing permission semantics.

## Capabilities

### New Capabilities

- `habit-reminder-actions`: Actionable local habit reminders with exact-habit routing, canonical completion, durable replay protection, and fixed snooze.

### Modified Capabilities

- `habit-reminders`: Existing reminder metadata/category and reconciliation must preserve valid same-day snoozes and cancel them when the occurrence becomes satisfied or invalid.

## Impact

- `lib/notifications.ts` and a centralized notification response dispatcher will extend the existing Expo response path and category setup.
- `features/habits/` will expose notification completion/snooze action handlers while preserving the existing data/domain/service boundaries.
- `core/providers/NavigationProvider.tsx` and `features/habits/HabitsScreen.tsx` will add bounded pending exact-habit focus state; no new route or detail screen is introduced.
- SQLite schema version 13 will add local-only processed notification action state if required by the final design; it is never synced or restored remotely.
- Tests, simulation, Maestro/native probes, and QA documentation will cover replay, cold start, exact routing, action semantics, and V1 regressions.

Supabase migration: NONE REQUIRED.
