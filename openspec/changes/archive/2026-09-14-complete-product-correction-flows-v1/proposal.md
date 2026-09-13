# Proposal: Complete Product Correction Flows V1

## Summary

Give users the ability to correct mistakes in the four mature data domains (Todos recurrence, Calories entries, Workout templates/logs, Pomodoro presets/sessions), make the shipped Weekly Review loop reachable from normal in-app navigation, and make the Linked Actions policy truthfully describe what the engine can already execute.

## Why

The data/domain layer shipped full CRUD in multiple sections while the UI exposes only create/read: recurring Todo series cannot be stopped or re-templated; a wrong-day calorie entry must be deleted and retyped (losing entry identity); workout routines and custom exercises are frozen after creation; Pomodoro presets are read-only and past focus sessions can never be relabeled or relinked; `deleteWeeklyReview` and the whole Weekly Review surface have no in-app entry (only a notification path); and the Linked Actions policy labels shipped, exactly-once-tested `calorie.log`/`pomodoro.log` effects as `deferred`, capping cross-feature automation behind a label that misdescribes reality.

## What Changes

- **todos-recurrence-management** (new): explicit series semantics — edit this instance, edit the series template for future instances, stop recurrence (no resurrection), restart as a new series; honest recurring Linked-Action-source copy.
- **calories-entry-correction** (new): move an entry to another day in place (identity preserved, single outbox update, both day aggregates correct); same-day field edits keep existing behavior.
- **workout-correction** (new): routine rename/metadata edit; custom-exercise edit/archive/restore with archived listing; accidental completed-workout deletion with nested cascade; numeric session data stays immutable after completion.
- **pomodoro-management-correction** (new): custom-preset authoring (built-ins protected) and post-hoc session note/relink via the existing metadata contract; session duration/type remain immutable (documented, no schema change).
- **weekly-review-discoverability** (new): Weekly Review entry from the Planning Hub Progress surface (per the 2026-09-01 disposition ledger), plus erroneous-review deletion wired to `deleteWeeklyReview`.
- **linked-actions-policy-truth** (new): the policy's `engineSupport` labels SHALL describe the shipped engine; authorable exposure of mature paths is gated on end-to-end proof (rule authored → trigger fires → effect runs exactly once), otherwise labels are corrected to honest deferral with product rationale.

## Non-Goals

No new top-level section, no second Weekly Review surface, no Google-Calendar-style recurrence rules (daily chains only, as persisted), no mutation of completed-session numeric history, no migration unless an approved contract requires it, no two-way sync, no AI flag changes, no cycle-elimination work.

## Impact

- Affected specs: new capabilities only; no existing archived/live capability requirement is invalidated (Weekly Review cadence loop keeps its notification path; this adds a second entry).
- Affected code: `features/todos/*`, `features/calories/*`, `features/workout/*`, `features/pomodoro/*`, `features/weekly-review/*`, `features/planning-hub/*`, `core/linked-actions/linkedActions.policy.ts`, related tests/e2e.
- Persistence: all touched entities are already in the 21-table recoverable scope; new flows reuse `runSyncedMutation`/`runBackupMutation` + durable outbox. Schema version stays 24 unless Wave 6 proves otherwise.
