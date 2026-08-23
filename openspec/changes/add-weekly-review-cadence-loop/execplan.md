# ExecPlan: Weekly Review Cadence Loop

Plan-Version: 2
Status: ACTIVE

## Purpose / User Outcome

Weekly Review is SuperHabits' anchor ritual — it reschedules stale todos, carries work forward, and rolls up habit/todo progress — but nothing ever prompts it. This change closes the adoption loop: a schedule-aware weekly nudge with one-tap entry into the review, persisted through backup/restore like every sibling reminder.

## Context

- Notification infrastructure already covers todo due-dates (`todoReminderScheduler`), schedule-aware habit reminders (`habitReminders.service`), and a daily-plan nudge (`dailyPlanReminderScheduler`) — the weekly loop is the missing sibling.
- Settings snapshot is at `BACKUP_SETTINGS_VERSION = 3` with an append-only canonical-text rule; new keys append last.
- Web degrades silently for native notifications; the honest-degradation pattern is established in the Notifications settings bucket.

## Scope

Pure occurrence math → preference persistence → native scheduler bridge → deep entry → settings UI → backup/restore coverage → focused validation.

## Non-Goals

- Two-way sync of any kind; changes to review executor semantics; iOS-specific delivery proof (capability gap #1 stands).

## Current Checkpoint

- Current milestone: Core wave complete → backup/settings-snapshot integration next.
- Completed: Pure occurrence math + codec (8/8 unit tests, TZ-portable); AsyncStorage preference store with cache; native scheduler bridge (`syncWeeklyReviewReminder`, single fixed identifier, replace-not-duplicate, expo weekly trigger with JS→expo weekday conversion); response dispatcher classification + `openWeeklyReview` handler wired in `_layout` (closes settings first); Notifications settings row (toggle + weekday chips + HH:mm save, honest native-only notes). Gates on the wave: typecheck 0 errors; lint 0 errors/12 warnings repo-wide; targeted suites 29/29.
- In progress: none — checkpoint boundary.
- Important modified files: features/weekly-review/weeklyReviewReminder.domain.ts (new); core/notifications/{weeklyReviewReminderScheduler.ts,new}; notificationPreferences.ts; notificationResponseDispatcher.ts; lib/{notifications.ts,notificationConstants.ts}; app/_layout.tsx; features/settings/SettingsNotificationsSection.tsx; tests/{weeklyReviewReminder.domain.test.ts,notificationResponseDispatcher.test.ts}.
- Last successful validation: typecheck PASS; lint PASS (0e/12w); vitest targeted 29/29.
- Failures: None open.
- Relevant quarantines: None.
- Blockers: None.
- Condition required to unblock: N/A.
- Exact resume action after unblock: N/A.
- Exact next action: Extend the settings V3 allowlisted snapshot with the weekly-review reminder key (append-only canonical tail) + validators + restore/portable round-trip tests (tasks 4.1–4.2).
- Remaining definition of done: tasks.md 4.x and 5.x validated.

## Progress

- [x] Gap audit + campaign selection
- [x] 1.1 Domain helper + unit tests (8/8)
- [x] 1.2 Preference model + storage key
- [x] 2.1 Scheduler bridge (single identifier, replace-not-duplicate)
- [x] 2.2 Notification tap → Weekly Review entry (dispatcher + host wiring)
- [x] 3.1 Settings control (toggle/weekday/time; honest web note)
- [ ] 3.2 Settings runtime validation test additions
- [ ] 4.1 Settings V3 allowlist extension (append-only)
- [ ] 4.2 Restore V2 + portable import coverage
- [ ] 5.1–5.3 Focused validation ladder

## Surprises & Discoveries

- None yet.

## Decision Log

- 2026-08-23 — Selected over global search / backup-nudge candidates: highest retention leverage on an already-built ritual; lowest risk; strongest test-pattern precedent (daily-plan loop).

## Validation Ledger

- 2026-08-23 — Post-RC gap audit basis — INFO — known-gaps register read; feature surface inventoried; reminder coverage mapped.

## Changed Files / Areas

- `features/weekly-review/**`, `core/notifications/**`, `features/settings/**`, `core/backup/settings allowlist`, `tests/**`.

## Recovery / Resume Instructions

1. Read AGENTS.md, .agent/PLANS.md, this plan.
2. git fetch/reconcile; run agent:resume -- --plan <this file>.
3. Continue from Exact next action.

## Outcomes & Retrospective

- Status: Active.
