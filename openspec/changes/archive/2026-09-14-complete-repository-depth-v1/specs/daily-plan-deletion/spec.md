# Daily Plan Deletion Specification

## ADDED Requirements

### Requirement: A saved daily plan can be deleted from plan history

The Plan history surface SHALL let the user delete an erroneous saved daily plan through a confirmed danger action. Deletion SHALL be a soft delete carrying exactly one coalesced durable delete intent for that plan, SHALL remove the plan from history and adherence rollups, and SHALL NOT modify any other entity.

#### Scenario: Confirmed delete removes the plan from history and rollups

Given a saved daily plan for a past day exists and is visible in plan history,
When the user expands that entry, activates the delete action, and confirms,
Then the plan row is soft-deleted (`deleted_at` set),
And the entry no longer renders in plan history,
And the history adherence counts exclude the deleted plan,
And the outbox carries exactly one delete intent for that plan id.

#### Scenario: Cancel leaves the plan untouched

Given an expanded plan history entry,
When the user activates the delete action and cancels the confirmation,
Then the plan row is unchanged,
And no delete intent is enqueued,
And the entry remains in history.

#### Scenario: Deleting a plan never touches tasks or completions

Given a saved plan that references top-priority todos,
When the plan is deleted,
Then no `todos` row is modified,
And the referenced todos remain visible in their normal surfaces.
