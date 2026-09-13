## Purpose

Make one delivered Habit Reminder safely actionable while preserving the existing local schedule and Habit Engine V2 completion contract.

## ADDED Requirements

### Requirement: Stable actionable occurrence metadata

Every normal habit reminder MUST carry `kind = habit-reminder`, the habit ID, its scheduled local `dateKey`, and a stable occurrence identity based on `habit-reminder:<habitId>:<dateKey>`. A snoozed reminder MUST carry the same habit/date occurrence identity, `snoozed = true`, and a related deterministic notification identity. User-visible text MUST NOT be parsed to identify a habit.

#### Scenario: Two habits remain isolated

- **WHEN** Gym and Read have reminders on the same date
- **THEN** each notification carries its own habit ID and an action on Gym cannot mutate or focus Read

### Requirement: Exact habit body navigation

The notification body tap MUST enter the existing root response dispatcher, select the Habits section, and request focus of the exact habit ID. The pending focus MUST wait until database/navigation/section state is ready and MUST be consumed once. A missing, deleted, or inactive habit MUST clear the request and leave the normal Habits section visible without recreating the habit.

#### Scenario: Cold-start exact focus

- **WHEN** the app is terminated and the user taps a Gym reminder
- **THEN** startup recovery waits for app bootstrap, opens Habits, and opens Gym through the existing edit/details interaction when Gym is still active

#### Scenario: Deleted habit fallback

- **WHEN** Gym is deleted before its notification response is handled
- **THEN** the app opens Habits normally and safely discards the stale exact-focus request

### Requirement: Canonical Mark complete

The `Mark complete` action MUST use the canonical habit completion mutation semantics and increment exactly one count, never fill a target. Before mutation it MUST verify that the habit is active, the occurrence date is the current local date, the habit is scheduled on that date, and the historical target for that date is not already satisfied. Invalid, stale, deleted, unscheduled, or already-satisfied actions MUST be safe no-ops.

#### Scenario: Partial target increments by one

- **WHEN** the date target is 3 and its current count is 1
- **THEN** Mark complete records count 2

#### Scenario: Stale occurrence is not backdated

- **WHEN** a Monday reminder is acted on Tuesday at 00:02
- **THEN** no Monday completion is added

### Requirement: Linked Actions exactly once

When notification completion crosses the historical target, the normal `habit.completed_for_day` Linked Action path MUST run with its existing dedupe and loop protections. A replay MUST NOT add another completion or downstream effect.

#### Scenario: Completion threshold invokes downstream effect once

- **WHEN** a target-one notification action completes a habit and the same response is delivered again after restart
- **THEN** the habit count and every linked effect remain at one legitimate execution

### Requirement: Durable response idempotency

Every actionable response MUST derive a stable local action key from occurrence identity and action. The key MUST be claimed in SQLite with the completion mutation in one transaction, remain device-local, and be cleaned up after a bounded retention window. Foreground listener delivery, cold-start recovery, concurrent duplicate delivery, and restart replay MUST not double-apply a completion or snooze.

#### Scenario: Restart replay does not mutate twice

- **WHEN** the same `MARK_COMPLETE` key is received before and after a process restart
- **THEN** the second response is a duplicate/no-op and the count remains unchanged

### Requirement: Post-completion reconciliation

After a valid notification completion, the app MUST trigger the existing targeted/coalesced reminder reconciliation. If the historical target is now satisfied, the same-day normal reminder and snooze MUST be cancelled. If it remains unsatisfied, V2 MUST NOT create an additional normal reminder outside the configured schedule.

#### Scenario: Target completion cancels same-day entries

- **WHEN** Mark complete brings Gym to its historical target while its normal reminder and snooze are scheduled
- **THEN** both same-day notification identities are cancelled and no extra normal reminder is created

### Requirement: Fixed same-day snooze

The `Snooze` action MUST schedule at most one deterministic replacement exactly 15 minutes after handling, without changing `habit.reminder_time`. It MUST validate active habit, current local occurrence date, current schedule, and unsatisfied historical target. If the 15-minute time crosses local midnight, it MUST not schedule. A duplicate or replayed snooze MUST not create another replacement.

#### Scenario: Snooze is one replacement

- **WHEN** an unsatisfied reminder is snoozed twice
- **THEN** one same-day `habit-reminder-snooze:<habitId>:<dateKey>` notification exists and the configured reminder time is unchanged

#### Scenario: Snooze does not cross midnight

- **WHEN** the current local time is Monday 23:55
- **THEN** Snooze does not schedule a Tuesday notification

#### Scenario: Completion cancels snooze

- **WHEN** the user completes the habit before the snoozed notification fires
- **THEN** normal completion reconciliation cancels the snoozed notification

### Requirement: Stable category and platform behavior

Native habit reminders MUST use one stable category and the concise labels `Mark complete` and `Snooze`. Actions MUST be configured with reliable installed Expo semantics for foreground/cold-start delivery. Pomodoro categories/identities MUST remain untouched. Web MUST not pretend to provide native actionable reminders; regular web habit behavior remains available.

#### Scenario: Pomodoro and web stay isolated

- **WHEN** Habit Reminder categories are registered on native or habit UI is rendered on web
- **THEN** Pomodoro notifications remain unaffected and web does not claim native actionable delivery

### Requirement: Response dispatch safety

One centralized dispatcher MUST classify habit reminders, Pomodoro/other notifications, and unknown responses. Unknown types/actions MUST be ignored safely. The dispatcher MUST be the only place interpreting notification action identifiers and must support both listener and startup-recovered responses.

#### Scenario: Unknown response is ignored

- **WHEN** a response has an unknown notification kind or action identifier
- **THEN** the dispatcher returns safely without mutating habits, scheduling snoozes, or changing navigation

### Requirement: Observable validation

The change MUST include deterministic domain tests, real-SQLite idempotency/restart tests, linked-action regression coverage, focused web/navigation coverage where applicable, deterministic simulation coverage, and Android probes for exact tap, Mark complete, replay, and Snooze. V1 schedule, suppression, timezone, persistence, Pomodoro, and native delivery behavior MUST remain green or be explicitly classified.

#### Scenario: Replay evidence is retained

- **WHEN** the same native response is injected through the production dispatcher before and after restart
- **THEN** test evidence demonstrates one completion/Linked Action or one snooze replacement, with any platform limitation recorded using the repository QA taxonomy
