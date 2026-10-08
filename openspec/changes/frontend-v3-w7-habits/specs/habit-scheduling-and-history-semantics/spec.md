## MODIFIED Requirements

### Requirement: Today progress and off-day experience

Today progress MUST use only habits scheduled for today. If none are scheduled, the summary MUST communicate a neutral rest/no-scheduled-habits state rather than 0% failure. A selected non-today summary MUST name that date and MUST use only that date's scheduled habits and that date's effective targets. It MUST NOT present today's completed count as the selected date's result and MUST NOT mix today's numerator with the selected date's denominator. A habit row on an unscheduled, pre-creation, or lifecycle-masked day MUST be visually neutral and non-actionable for normal check-in taps while retaining edit and lifecycle access.

#### Scenario: Today denominator excludes off-day habit

- **WHEN** a daily habit is incomplete, a Monday/Wednesday/Friday habit is not scheduled on Tuesday, and no other habit is scheduled
- **THEN** today's denominator is 1 and the off-day habit does not reduce today's progress

#### Scenario: Rest day summary

- **WHEN** all habits are scheduled for other weekdays
- **THEN** the habit summary shows a neutral rest/no-scheduled state

#### Scenario: Selected historical day is independently labeled

- **WHEN** today and a selected past day have different scheduled and completed counts
- **THEN** the visible summary for the selected day states that date's counts
- **AND** it does not reuse today's numerator or denominator
