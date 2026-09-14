## ADDED Requirements

### Requirement: A workout-day reminder tap opens Workout

When the user enables workout-day reminders and a native notification for a planned workout day is delivered, activating the notification body (default action) MUST open the Workout section. The tap MUST NOT complete, skip, or otherwise mutate the planned session. Platforms that do not schedule the reminder (web, denied permission) are unchanged. Unknown notification kinds MUST continue to no-op.

#### Scenario: Body tap opens Workout

- **WHEN** a native workout-day reminder with `kind: 'workout-day-reminder'` is activated with the default action
- **THEN** the Workout section becomes the active section
- **AND** no workout log is created or deleted by the tap

#### Scenario: Unknown kinds still no-op

- **WHEN** a notification with an unrecognized `kind` is activated
- **THEN** no section switch occurs
- **AND** no workout, habit, or todo mutation runs
