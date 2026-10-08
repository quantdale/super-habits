## MODIFIED Requirements

### Requirement: Habits selection controls are semantically clarified

Habits SHALL distinguish current filter, management action, date
selection, and habit state visually. A single-select status view SHALL
use the shared segmented treatment when it is presented. The status view
and sort choices MAY live in one compact filter sheet instead of a
permanently expanded stack. Multi-select filters, management
actions, the day strip, and status badges SHALL remain visually distinct
treatments from each other and from the check-in control.

#### Scenario: Habits status filter and management action look different

- **GIVEN** the Habits screen with a status selector and a sort control
- **WHEN** those controls are presented
- **THEN** the status selector uses the shared segmented treatment
- **AND** the sort control uses a different visual treatment so a user can tell the current filter from sort

#### Scenario: Day selection is not a status filter

- **WHEN** the Habits day strip and the status selector are both available
- **THEN** the day strip remains a date selector
- **AND** it is not styled as the status segmented control
