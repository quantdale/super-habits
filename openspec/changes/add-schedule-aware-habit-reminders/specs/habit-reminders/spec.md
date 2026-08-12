## Purpose

Give users one reliable, local-time reminder per habit that follows the habit's effective weekly schedule, remains opt-in and permission-aware, and reconciles safely across edits, restarts, and local calendar changes.

## ADDED Requirements

### Requirement: One persisted reminder configuration

Each habit MUST have at most one reminder configuration represented as disabled (`NULL`) or an enabled canonical local wall-clock time in `HH:MM` 24-hour form. Existing habits and habits created without explicit opt-in MUST remain disabled.

#### Scenario: Legacy habits remain quiet

- **WHEN** an existing database is opened after this capability is installed
- **THEN** every habit whose reminder was not explicitly enabled remains disabled and no reminder is scheduled for it

#### Scenario: One reminder is saved

- **WHEN** a user enables a habit reminder and saves `18:00`
- **THEN** the habit reloads with exactly that canonical reminder time and no second reminder configuration exists

### Requirement: Habit Engine V2 schedule eligibility

Reminder scheduling MUST use the habit's effective-dated Habit Engine V2 rule for each local date. A notification MUST be desired only when that rule schedules the date; off-day completion rows MUST NOT make a date eligible.

#### Scenario: M/W/F reminder window

- **WHEN** Gym is scheduled Monday, Wednesday, and Friday with a reminder at `18:00`
- **THEN** the future schedule contains Monday, Wednesday, and Friday occurrences only and contains no Tuesday, Thursday, Saturday, or Sunday occurrence

#### Scenario: Historical schedule edit affects only future dates

- **WHEN** a habit changes from M/W/F to weekdays on a local date
- **THEN** future reminders use weekdays while the prior Habit Engine V2 rules and historical completion meaning remain unchanged

#### Scenario: Off-day completion does not create a reminder

- **WHEN** a completion exists on a date that the effective rule does not schedule
- **THEN** no notification is scheduled for that date

### Requirement: Local wall-clock scheduling

Reminder times MUST represent local wall-clock time in the device's current timezone. The system MUST construct each future occurrence using local calendar date and time semantics rather than persisting an indefinitely recurring UTC instant.

#### Scenario: Local time remains local

- **WHEN** a habit reminder is `07:30` and the device timezone changes from Manila to Tokyo
- **THEN** the next reconciliation schedules the reminder at `07:30` Tokyo local time rather than silently shifting its wall-clock time

#### Scenario: DST observes wall-clock intent

- **WHEN** a reminder is evaluated in `America/New_York` across a daylight-saving transition
- **THEN** each eligible occurrence remains at the configured local hour and minute with the platform's timezone-aware date construction

### Requirement: Bounded future reconciliation

The reminder service MUST maintain only a bounded rolling future window beginning today and extending fourteen local calendar days. Reconciliation MUST occur on app startup, foreground activation, local day rollover, reminder/schedule/target changes, relevant completion changes, and habit deletion or restore.

#### Scenario: Startup repairs missing future entries

- **WHEN** the app starts with an enabled scheduled habit and a missing future notification
- **THEN** reconciliation schedules the missing eligible occurrence within the rolling window without blocking initial app rendering

#### Scenario: Day rollover advances the window

- **WHEN** the local date rolls over while the app remains mounted
- **THEN** the service drops yesterday's irrelevant desired state and evaluates the new fourteen-day local window

#### Scenario: Repeated reconciliation is bounded

- **WHEN** reconciliation runs repeatedly during foreground refresh
- **THEN** it evaluates only the rolling window and does not scan or schedule historical dates or an unbounded annual recurrence

### Requirement: Idempotent minimal diff

Reconciliation MUST use a deterministic identity for each habit/date occurrence and compare desired entries with the native scheduler inventory. Existing correct entries MUST be preserved, stale or duplicate entries MUST be cancelled, and missing desired entries MUST be scheduled.

#### Scenario: Correct entry is preserved

- **WHEN** the native scheduler already contains the deterministic notification for a desired habit/date with matching time and content metadata
- **THEN** reconciliation does not schedule a duplicate or cancel the correct entry

#### Scenario: Stale entry is removed

- **WHEN** a reminder time or schedule edit makes an existing future habit/date notification undesired
- **THEN** reconciliation cancels the stale entry and schedules only the new desired entries

#### Scenario: Duplicate entries collapse

- **WHEN** the native inventory contains more than one reminder identity for the same habit/date
- **THEN** reconciliation keeps one canonical entry and cancels the extras

#### Scenario: Habits remain isolated

- **WHEN** Gym is edited or deleted while Read has an enabled reminder
- **THEN** only Gym's future entries are changed and Read's entries remain intact

### Requirement: Completion-aware suppression

For a scheduled date, the reminder MUST be suppressed when the historical target for that date is already satisfied before the reminder fire time. A target greater than one MUST remain eligible until the count reaches that date's historical target. If the app cannot reliably cancel a same-day native entry after it fires, the service MUST document and test that limitation rather than claim suppression retroactively.

#### Scenario: Completed target suppresses today

- **WHEN** a target-one habit is completed at `08:00` and its reminder is `18:00`
- **THEN** the same-day reminder is cancelled or omitted on the next completion/foreground reconciliation

#### Scenario: Partial target remains eligible

- **WHEN** a target-three habit has count one before its `18:00` reminder
- **THEN** the `18:00` reminder remains desired

#### Scenario: Historical target is authoritative

- **WHEN** a habit's target changes after a prior date was completed
- **THEN** suppression for each date uses the target from that date's effective rule, not the current target column

### Requirement: Edit, disable, and delete behavior

Reminder configuration changes MUST take effect immediately for future fire times, including today when the new date is eligible and its configured time has not passed. An already-passed time MUST be skipped rather than fired immediately. Disabling or soft-deleting a habit MUST cancel all of its future notification entries.

#### Scenario: Time edit replaces future time

- **WHEN** a reminder changes from `18:00` to `07:00`
- **THEN** obsolete future `18:00` entries are cancelled and future `07:00` entries are scheduled without duplicates

#### Scenario: Same-day edit before fire time

- **WHEN** today is eligible and the user enables or changes a reminder before its configured time
- **THEN** today's future fire time is included in reconciliation

#### Scenario: Passed time is not fired retroactively

- **WHEN** the user enables a reminder at `19:00` for today's eligible `18:00` time
- **THEN** today's occurrence is skipped and the next eligible future occurrence is scheduled

#### Scenario: Disable and delete cancel future entries

- **WHEN** the user disables a reminder or soft-deletes its habit
- **THEN** all future entries belonging to that habit are cancelled and a later app restart does not recreate them

### Requirement: Permission and platform UX

The reminder UI MUST distinguish notification permission as not determined, granted, or denied. Enabling a reminder when permission is unresolved MUST request permission; when permission is denied, the UI MUST show an explicit disabled/error state and guidance without repeatedly nagging. Web MUST remain graceful and MUST NOT pretend that native reminders are active when the platform cannot schedule them.

#### Scenario: Permission is requested on opt-in

- **WHEN** a user enables a reminder while permission is not determined
- **THEN** the app requests notification permission and enables the reminder only if permission is granted

#### Scenario: Denied permission is visible

- **WHEN** the operating system denies notification permission
- **THEN** the habit editor shows that reminders are unavailable or disabled with guidance to change system settings, and does not claim a scheduled reminder

#### Scenario: Web is explicit

- **WHEN** a user opens the habit editor on web
- **THEN** the UI either marks reminders unsupported/disabled or uses an already-supported web notification path, without creating a fake native schedule

### Requirement: Android channel and content

Android habit reminders MUST use one stable dedicated notification channel rather than a channel per habit. The channel MUST have consistent normal reminder importance, sound, and vibration configuration, and notification content MUST be concise with the habit name as title and a non-sensitive completion prompt as body.

#### Scenario: Stable channel

- **WHEN** multiple habits are reconciled on Android
- **THEN** all habit reminders use the same stable Habit reminders channel and no per-habit channels are created

#### Scenario: Concise content

- **WHEN** a Gym reminder is delivered
- **THEN** its title is `Gym` and its body is `Time to complete your habit.` or the same approved concise product phrase

### Requirement: Persistence, sync, restore, and deletion safety

Reminder configuration MUST survive app/process restart through the existing habit row and MUST be included in the existing full-row sync and phase-one habit restore contract. Missing or null remote reminder values MUST normalize to disabled. Restoring or syncing a deleted habit MUST NOT create active reminder entries.

#### Scenario: Process restart preserves configuration

- **WHEN** a user saves an enabled reminder, kills the app, and relaunches it
- **THEN** the habit still shows the same enabled `HH:MM` reminder and startup reconciliation restores its eligible future native entries

#### Scenario: Restore preserves reminder state

- **WHEN** an empty device restores a habit row with an enabled reminder
- **THEN** the restored habit retains that reminder configuration and reconciliation schedules it only if the row is active and eligible

#### Scenario: Deleted restore row stays inactive

- **WHEN** a restored or synced habit row has a non-null `deleted_at`
- **THEN** its reminder configuration remains stored for data fidelity but no active native reminder is scheduled

### Requirement: Notification tap behavior

Tapping a habit reminder MUST open the app through the existing root navigation architecture. If exact habit focus cannot be supported safely in V1, the app MUST open the Habits section without introducing a new route or navigation subsystem.

#### Scenario: Reminder tap opens Habits

- **WHEN** the user taps a delivered habit reminder
- **THEN** Super Habits opens and selects the existing Habits section, with exact habit focus optional in V1

### Requirement: Observable validation

The feature MUST have deterministic unit/service coverage for schedule windows, local time construction, timezone/DST behavior, completion targets, edits, deletion, duplicate reconciliation, day rollover, and the five required timezone matrix zones. Android native validation MUST cover reminder persistence, permission flow, disablement, schedule-aware configuration, and an explicit attempt to prove system notification delivery. Failures MUST be reported using the repository's canonical QA classifications.

#### Scenario: Native delivery result is honest

- **WHEN** the Android notification shade cannot be asserted reliably by the available harness
- **THEN** the final QA report classifies delivery as PARTIAL or NOT VERIFIED and records the exact capability limitation rather than claiming VERIFIED
