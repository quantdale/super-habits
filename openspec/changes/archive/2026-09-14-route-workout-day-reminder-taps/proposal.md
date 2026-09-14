## Why

Gym V2 already schedules opt-in workout-day reminders (`reconcileWorkoutDayReminder` → `scheduleWorkoutDayReminderNotification` with `data.kind: 'workout-day-reminder'`). `classifyNotificationResponse` only understands habit reminders, todo reminders, and weekly-review reminders. A body tap on a workout-day notification classifies as `unknown`, clears the response, and does not open Workout. The user is told their session is ready and then dropped on whatever screen they left.

Habit and todo reminders already deep-link; workout-day reminders should do the same for the Workout section.

## What Changes

- Classify `kind: 'workout-day-reminder'` in the notification response dispatcher.
- A default/body tap MUST open the Workout section (`setActiveSection('workout')`).
- No Mark complete / Snooze actions are required for this change (the notification is a schedule ping, not a completion claim). Unknown kinds stay no-ops.
- Web remains a no-schedule platform; this is native response routing only.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `gym-workout-deep-expansion`: a delivered workout-day reminder tap MUST open the Workout section.

## Impact

- **Dispatcher:** `core/notifications/notificationResponseDispatcher.ts` (classify + handler type).
- **Host:** `app/_layout.tsx` `NotificationResponseHost` (handle `openWorkout` via `setActiveSection('workout')`).
- **Tests:** dispatcher unit tests (pattern already used for habit/todo/weekly-review). Optional Maestro notification-path coverage is environment-gated and is not the primary proof.
- **No schema, no backup, no new notification actions.**
- **Independent of** the backup-push and gamification changes.
