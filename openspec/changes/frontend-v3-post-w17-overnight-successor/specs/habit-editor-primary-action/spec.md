## Purpose

Defines where the habit editor's primary action lives so a user can save without scrolling past optional linked actions.

## ADDED Requirements

### Requirement: Create and save stay in the dialog viewport

The habit editor SHALL present `Create habit` or `Save changes` in the dialog footer. That control SHALL be visible inside the dialog viewport on a 390 by 844 phone without scrolling the form. Cancel SHALL remain beside it. The labels and save behavior SHALL NOT change.

#### Scenario: New habit primary action is on screen

- **WHEN** the user opens the new-habit dialog on a 390 by 844 viewport
- **THEN** the `Create habit` button is visible inside the dialog
- **AND** its bounds lie within the viewport
- **AND** Cancel is visible in the same dialog
