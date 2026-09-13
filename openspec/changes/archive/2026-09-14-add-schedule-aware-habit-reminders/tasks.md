## 1. Audit and contract foundation

- [x] 1.1 Record the recovered notification architecture, existing dirty-file overlap, Habit V2 authority, and settled reminder semantics in the ExecPlan.
- [x] 1.2 Verify the existing nullable `habits.reminder_time` column across runtime SQLite, TypeScript, reference Supabase schema, sync serialization, and restore fixtures; add only the smallest additive migration if live drift is proven.
- [x] 1.3 Validate the new OpenSpec artifacts and create the Plan-Version 2 task ExecPlan before implementation.

## 2. Pure reminder planning

- [x] 2.1 Add validated `HH:MM` reminder-time parsing/formatting and local wall-clock occurrence construction with deterministic clock injection.
- [x] 2.2 Add a pure bounded planner that resolves Habit Engine V2 rules, target counts, off-days, passed same-day times, deleted/disabled state, and the fourteen-day desired notification window.
- [x] 2.3 Add unit coverage for daily, weekdays, weekends, M/W/F, custom schedules, off-day completions, target-one/target-greater-than-one suppression, changed schedule/time, delete/disable, rollover, local time, DST, five timezones, and window bounds.

## 3. Native notification service

- [x] 3.1 Extend the shared notification wrapper with permission-state classification, stable Habit reminders Android channel setup, scheduled-inventory access, deterministic one-shot scheduling, and isolated cancellation primitives while preserving Pomodoro behavior.
- [x] 3.2 Implement serialized idempotent Habit reminder reconciliation that preserves correct entries, cancels stale/duplicate entries, schedules missing entries, and never cancels Pomodoro notifications.
- [x] 3.3 Add service tests using a fake native adapter for minimal diff operations, duplicate collapse, multiple-habit isolation, unsupported platform behavior, and permission denial.
- [x] 3.4 Add notification response routing through the existing navigation context so a habit reminder tap opens Habits without a new route.

## 4. Persistence and Habit integration

- [x] 4.1 Extend habit create/edit data contracts to persist canonical reminder time, retain null-by-default legacy behavior, enqueue synced habit writes, and trigger one coalesced reconciliation after mutations.
- [x] 4.2 Trigger same-day completion-aware reconciliation after user and linked-action completion mutations, including target-history lookup and deleted-habit safety.
- [x] 4.3 Trigger reconciliation after restore completion and prove deleted/restored rows cannot create active reminders.
- [x] 4.4 Add real-SQLite integration coverage for create/update/disable/delete/restore/reload and legacy null fallback, plus sync/restore full-row contracts.

## 5. Habit UI and permission UX

- [x] 5.1 Add compact accessible reminder enable/disable and time controls to Habit create/edit using the installed native time picker and explicit web fallback.
- [x] 5.2 Expose not-determined/granted/denied/unsupported states without repeated permission nagging; keep save semantics atomic across schedule and reminder edits.
- [x] 5.3 Add a small reminder indicator/time to the existing habit presentation only where it fits without redesigning cards; preserve off-day neutral behavior and semantic labels.
- [x] 5.4 Add focused Playwright coverage for reminder configuration persistence, denied/unsupported web state, schedule-aware UI, same-day passed time, edit replacement, disable, delete, and reload.

## 6. Lifecycle, simulation, and native validation

- [x] 6.1 Add non-blocking startup, foreground, day-rollover, timezone-change-on-activation, and process-restart reconciliation integration using existing lifecycle providers.
- [x] 6.2 Extend deterministic simulation minimally with representative daily, M/W/F, disabled, and completed-before-reminder cases and persisted-row oracles.
- [x] 6.3 Add Maestro Android flows for reminder persistence, permission grant/denial path, disablement, M/W/F configuration, multiple-habit isolation, and Pomodoro regression.
- [x] 6.4 Add a test-only short-horizon Android delivery attempt that backgrounds/terminates the app and inspects the system notification surface when reliable; record exact capability classification otherwise.
- [x] 6.5 Run and record Android background/process-death behavior, notification channel/ID isolation, and actual delivery evidence without claiming unproven tray results.

## 7. QA and handoff

- [x] 7.1 Run affected fast, integration, timezone, focused web journeys, simulation, sync/restore, and OpenSpec/impact validation; classify and fix failures without weakening contracts.
- [x] 7.2 Run web build and impacted/broad Playwright regression, preserving CG-4, CG-5, J8, heatmap, and existing Habit V2 evidence.
- [x] 7.3 Run Android smoke/targeted/lifecycle/native reminder lanes and document Windows iOS as environment-limited if applicable.
- [x] 7.4 Update native testing/known-gap/architecture documentation and ExecPlan validation ledger with exact commands, artifacts, and remaining limitations.
- [x] 7.5 Mark the implementation tasks complete only after the definition of done is proven, validate the COMPLETED ExecPlan, and prepare the final verdict report.
