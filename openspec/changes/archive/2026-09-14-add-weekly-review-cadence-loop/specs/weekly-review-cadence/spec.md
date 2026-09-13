# Weekly Review Cadence Loop Specification

## ADDED Requirements

### Requirement: Weekly review reminder honors a user-chosen weekly cadence

The user SHALL be able to enable a repeating weekly review reminder with a chosen day-of-week and time-of-day; occurrence computation SHALL use the local calendar and be DST-safe.

#### Scenario: Reminder fires on the chosen weekday

Given the reminder is enabled for Wednesday 18:00,
When the device crosses into Wednesday 18:00 local time,
Then the native notification loop posts the weekly review nudge,
And the next occurrence recomputes to the following Wednesday without duplication.

#### Scenario: Preference change replaces, never duplicates

Given an enabled reminder exists,
When the user changes day, time, or disables it,
Then exactly one scheduled notification for the loop exists afterward,
And disabling removes it entirely.

### Requirement: The preference survives backup/restore

The weekly-review reminder preference SHALL ride the existing allowlisted recoverable settings snapshot without breaking settings-version compatibility.

#### Scenario: Restore onto an empty device

Given a backup captured with a customized weekly-review preference,
When Restore V2 imports it on an empty device,
Then the reminder preference is restored alongside sibling settings,
And the scheduler reflects it on next launch where notifications are supported.

### Requirement: Web degrades honestly

Where notifications are unsupported, the loop SHALL be presented as unavailable rather than silently dead, matching the documented degradation of sibling loops.

#### Scenario: Web user opens the notification settings

Given the app runs on web,
When the Notifications settings bucket renders,
Then the weekly-review control states its native-only availability honestly,
And enabling it persists the preference without promising delivery.

### Requirement: The nudge leads directly to the review

Tapping the native notification SHALL open the Weekly Review surface; on web an in-app notice SHALL offer the same entry.

#### Scenario: User acts on the nudge

Given a delivered weekly review nudge,
When the user activates it,
Then the Weekly Review surface is open and ready to execute,
And no duplicate review execution can result from repeated activation.
