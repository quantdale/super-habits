## Context

See `proposal.md`. Scheduling already exists (`core/notifications/workoutReminderScheduler.ts`, `lib/notifications.ts`). Response handling is centralized in `classifyNotificationResponse` + `NotificationResponseHost` in `app/_layout.tsx`. Habit/todo/weekly-review are the template.

## Goals / Non-Goals

**Goals:**

- Classify workout-day reminder payloads and route the default action to Workout.

**Non-Goals:**

- Mark complete / snooze / start-session actions on the notification (not scheduled today).
- Changing schedule lookahead, identifiers, or permission copy.
- Web notifications.
- Fixing already-specified restore UI refresh.

## Decisions

1. **Open the Workout section only; do not auto-start a session.**
   - Rationale: the scheduled copy is "Your scheduled training session is ready." Starting a session from a shade tap would surprise users mid-commute and has no existing draft-restore handshake from a notification.
   - Alternative considered: deep-link into the planned routine. Rejected for v1; the weekly plan is already the Workout landing state. Can be a later change.

2. **Reuse the existing classifier discriminated union.**
   - Add `{ kind: 'workout-day-reminder'; action: 'open' }` next to weekly-review. Handler: `openWorkout: () => void` implemented as `setActiveSection('workout')`.
   - Match `data.kind === 'workout-day-reminder'` exactly as scheduled.

3. **No new notification category or actions.**
   - The current schedule has title/body only. Adding actions would require `setNotificationCategoryAsync` and product copy this change does not need.

## Risks / Trade-offs

- **[Risk] Inactive Workout section is mounted but stale.** → Existing `useActiveForegroundRefresh` on activation already refreshes Workout when `isActive` becomes true.
- **[Risk] Settings is open when the tap arrives.** → Follow weekly-review: close Settings if that host already does so for weekly-review; otherwise opening Workout behind Settings is acceptable. Prefer `closeSettings()` then `setActiveSection('workout')` for consistency with `openWeeklyReview`.

## Migration Plan

None. Native schedules already write `kind: 'workout-day-reminder'`; already-delivered notifications become routable as soon as the classifier ships.

## Open Questions

None.
