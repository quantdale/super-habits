# Projects Manual Order Management Specification

## ADDED Requirements

### Requirement: Manual project order is authorable in-app

The Projects list SHALL let the user change the manual order of projects from the list itself while the Manual sort is active with no status filter, persisting the new order durably; the ordering SHALL not introduce a new route, section, or gesture-only interaction.

#### Scenario: Move a project up and back after restart

Given at least two projects exist,
When the user activates the move-up control on the second project while Manual sort is active,
Then the two projects swap position immediately,
And after a fresh app mount the swapped order still renders,
And the durable outbox carries exactly one update intent per reordered project.

#### Scenario: Order editing is only offered where it is meaningful

Given the Projects list is sorted by anything other than Manual or a status filter is active,
When the list renders,
Then no move controls are offered, because the displayed order is not the persisted manual order.
