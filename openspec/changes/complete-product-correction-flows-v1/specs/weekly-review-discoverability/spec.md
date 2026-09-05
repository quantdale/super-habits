# Weekly Review Discoverability and Management Specification

## ADDED Requirements

### Requirement: Weekly Review is reachable from normal in-app navigation

The Planning Hub Progress surface SHALL offer an entry that opens the existing Weekly Review modal; the notification-response entry SHALL keep working; no seventh top-level section, dedicated route, or new global floating action SHALL be introduced.

#### Scenario: Open the review from Progress

Given the app on a normal launch,
When the user opens the Plan section, switches to Progress, and activates the Weekly Review entry,
Then the Weekly Review guided flow opens and can be completed.

#### Scenario: Notification path remains intact

Given the weekly review reminder is enabled,
When the user activates the notification,
Then the review still opens through the existing dispatcher path.

### Requirement: Revisiting and correcting reviews is supported

The user SHALL be able to revisit the current period's review and re-run the flow (existing upsert semantics), and SHALL be able to delete an erroneous review from history with confirmation; deletion SHALL soft-delete the review and record a durable delete intent.

#### Scenario: Delete an erroneous review

Given a weekly review exists for a past week,
When the user deletes it from the history surface and confirms,
Then it no longer appears in review history or rollups,
And the durable outbox carries the delete intent.

#### Scenario: Re-run updates the same week

Given a completed review for the current week,
When the user completes the flow again,
Then the stored review is updated in place rather than duplicated.
