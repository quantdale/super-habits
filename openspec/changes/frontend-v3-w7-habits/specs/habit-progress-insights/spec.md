## MODIFIED Requirements

### Requirement: Accessible Habits presentation

The Habits UI SHALL provide a clear details route for each visible habit and
show the selected habit's metrics in the existing habit detail surface. That
route SHALL NOT require a separate persistent Progress pill on every daily
row. Every metric SHALL have a textual label containing its value and
denominator where applicable. Visual bars, colors, icons, and trend styling
SHALL be supplemental only; assistive technology SHALL be able to understand
scheduled state, target, actual count, satisfaction, and trend without relying
on color.

#### Scenario: User opens progress for one habit

- **GIVEN** an active habit is visible in the Habits section
- **WHEN** the user activates that habit's details route
- **THEN** a detail surface opens for that exact habit
- **AND** it announces current streak, longest streak, 7/30/90 rates, trend,
  and recent target-vs-actual rows

#### Scenario: Progress loading and empty history are understandable

- **GIVEN** progress data is loading or has no eligible history
- **WHEN** the detail surface is open
- **THEN** the user receives a visible and semantic loading/empty message
- **AND** no misleading 0% metric is presented for an empty denominator
