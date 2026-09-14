## 1. Classify and route

- [x] 1.1 Extend `classifyNotificationResponse` to recognize `data.kind === 'workout-day-reminder'` and return an `open` action. Keep unknown kinds as `unknown`.
- [x] 1.2 Add `openWorkout` to `NotificationResponseHandlers` and dispatch it for that classification.
- [x] 1.3 Wire `NotificationResponseHost` in `app/_layout.tsx` to `closeSettings()` (if weekly-review already does) and `setActiveSection('workout')`. Do not start or complete a session.

## 2. Tests

- [x] 2.1 Add unit tests next to the existing dispatcher tests: workout-day default action classifies as open; unknown kind stays unknown; habit/todo/weekly-review classifications remain unchanged.
- [x] 2.2 If a host-level test exists for weekly-review open, add the analogous workout assertion; otherwise unit classification is sufficient for this change. (No host-level test exists; dispatcher classification + dispatch coverage added.)

## 3. Verification

- [x] 3.1 Run the dispatcher unit tests and `npm run typecheck` / `npm run lint`.
- [x] 3.2 Confirm `openspec validate route-workout-day-reminder-taps --strict` still passes.
