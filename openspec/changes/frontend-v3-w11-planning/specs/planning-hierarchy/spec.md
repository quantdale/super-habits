## Purpose

Defines the W11 visual/interaction contract for Goals, Projects and Daily Plan
under Frontend V3 Calm Momentum. Existing persistence and domain operations
remain normative.

## ADDED Requirements

### Requirement: Shared list-first planning grammar

Goals and Projects SHALL show objective titles, current status, contextual
next-action/date or linked-work information, and progress in a consistent,
wrap-safe row style. Decorative bullets and redundant stat badges SHALL NOT
compete with the objective.

#### Scenario: Goal and project lists are quickly scannable
- **GIVEN** existing goals and projects
- **WHEN** each list is opened
- **THEN** objective titles and statuses are readable before secondary configuration
- **AND** row-level actions expose unchanged accessible identities
- **AND** progress matches persisted manual goal percent or project rollup

### Requirement: Filtering is discoverable but not front-loaded

Each list SHALL begin with one accessible collapsed Filters & sort disclosure.
The filter state SHALL survive hiding and reopening the disclosure. Active
non-default filters SHALL be signaled even while hidden.

#### Scenario: Filtering does not silently reset
- **WHEN** the user filters Goals to a status then closes Filters & sort
- **THEN** the filtered list remains filtered
- **AND** the closed affordance signals an active filter
- **AND** reopening restores the selected controls

### Requirement: Advanced editor fields are progressively disclosed

Goal and Project detail views SHALL foreground the objective and primary
action, with secondary status/horizon/date/color/description/association
controls accessible behind labeled, expanded-state-aware disclosures. Users
SHALL still be able to edit any previously supported field.

#### Scenario: Editing a project
- **WHEN** an existing Project is opened
- **THEN** its name, progress and next up are readily discoverable
- **AND** advanced fields can be expanded without losing unsaved changes
- **AND** saving writes the same status, date, color, description and links

### Requirement: Daily Plan begins with today's intention and priorities

Daily Plan SHALL display date/status, intention, selected top priorities, and
Save Plan ahead of optional focus/notes/habit, reflection and history sections.
The add-priority candidate list SHALL remain available via explicit action
but SHALL NOT continuously render twelve candidates while closed.

#### Scenario: Add priority and save
- **GIVEN** pending todos and no selected priority
- **WHEN** the user opens Add priority and selects a todo
- **THEN** the chosen title appears in the selected top priorities
- **AND** Save Plan retains the same durable plan/outbox semantics
- **AND** closing Add priority does not discard selected items

### Requirement: Reflection and history are optional, accessible sections

Reflection, energy-score and history SHALL be individually accessible through
disclosure controls with accurate expanded state. A collapsed disclosure SHALL
NOT clear draft fields or commit a plan.

#### Scenario: Finish daily plan
- **GIVEN** an existing committed plan
- **WHEN** the user expands End-of-day reflection and completes the plan
- **THEN** the same completion, snapshot-title and sync intent rules apply
- **AND** the plan's completed status is visible without opening a disclosure
