# Tasks — Weekly Review Cadence Loop

## 1. Pure scheduling core

- [x] 1.1 Domain helper: next weekly occurrence (day-of-week + time-of-day, local calendar, DST-safe) with unit tests.
- [x] 1.2 Preference model + AsyncStorage key, mirroring `DAILY_PLAN_REMINDER_TIME_KEY` patterns.

## 2. Native loop

- [x] 2.1 Scheduler bridge modeled on `dailyPlanReminderScheduler` (single repeating identifier, replace-not-duplicate).
- [x] 2.2 Notification tap → Weekly Review surface entry (deep link/section route consistent with existing notification routing).

## 3. Settings surface

- [x] 3.1 Notifications bucket control: enable toggle + weekday/time selection; honest native-only copy on web.
- [x] 3.2 Wire into settings runtime validation tests.

## 4. Backup integration

- [x] 4.1 Extend the allowlisted settings snapshot (settings V4 canonical text append-only rule).
- [x] 4.2 Restore V2 + portable import coverage for the new key.

## 5. Validation

- [x] 5.1 Unit: occurrence math, preference round-trip, backup canonicalization.
- [x] 5.2 Focused journeys: settings ripple + restore equivalence where deterministic.
- [x] 5.3 qa:affected gate selection per impact map; full unit/integration/web/sync/performance evidence recorded in the ExecPlan.
