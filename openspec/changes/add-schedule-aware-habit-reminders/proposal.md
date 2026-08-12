## Why

Habit Engine V2 now knows which local calendar days a habit is scheduled on, but the app does not yet turn that schedule into reliable native reminders. Users need one opt-in local reminder per habit that survives restart, follows future schedule changes, and never creates reminders for rest days or deleted habits.

## What Changes

- Add an opt-in habit reminder time stored as canonical local `HH:MM`; existing and migrated habits remain disabled (`NULL`).
- Add a bounded, idempotent native notification reconciliation service that derives future eligible dates from Habit Engine V2 and diffs deterministic habit/date identifiers against scheduled notifications.
- Reconcile on bootstrap, foreground, day rollover, reminder/schedule/target/completion changes, and deletion, while preserving Pomodoro notifications.
- Add Android permission/channel handling, concise habit notification content, and explicit unsupported-web/denied-permission states.
- Add compact accessible reminder controls to habit creation/editing, including time selection and permission guidance.
- Suppress a scheduled reminder for today when the historical target for that date is already satisfied before its fire time; retain reminders for partially completed targets.
- Preserve reminder configuration through existing habit sync/restore payloads and soft-delete behavior without adding reminder history or changing Habit Engine V2 rule history.
- Add deterministic domain/service, SQLite, web journey, simulation, and Android Maestro coverage, including a short-horizon native delivery attempt and honest capability classification.

## Capabilities

### New Capabilities

- `habit-reminders`: Schedule-aware, local-time, permission-aware habit reminders and their persistence/reconciliation behavior.

### Modified Capabilities

- None.

## Impact

- `features/habits/` data/domain/UI and `core/db/types.ts` will expose and persist the existing nullable reminder-time field.
- `lib/notifications.ts` will gain reusable channel/permission/scheduling inventory primitives while retaining Pomodoro behavior and identifiers.
- A new pure reminder planner/service boundary will integrate with `expo-notifications`, `DayRolloverProvider`, app bootstrap/foreground refresh, and completion mutations.
- Existing Supabase full-row habit sync and restore v1 will carry the field additively; no remote schema migration is expected unless the live audit finds drift.
- Tests, Playwright journeys, simulation fixtures, Maestro flows, native QA documentation, and known-gap evidence will be updated as required.
