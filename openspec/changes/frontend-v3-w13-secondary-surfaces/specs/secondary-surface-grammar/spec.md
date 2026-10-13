## Purpose

Defines the W13 visual/interaction contract for Settings, the Command Center
and Achievements under Frontend V3 Calm Momentum. Settings persistence,
account/backup/portable semantics, notification permission truth, the command
parser/executor/confirmation flow and the local reward ledger remain normative.

## ADDED Requirements

### Requirement: Settings rows use one value authority

A Settings row SHALL show its label and its current value or state at most once
adjacent to the control that changes it. A row SHALL NOT repeat the same setting
value in a separate summary line elsewhere in the section.

#### Scenario: Theme selection is stated once

- **GIVEN** the Settings modal is open on the Appearance section
- **WHEN** the theme mode control renders
- **THEN** the selected mode is indicated by the control's own selected state
- **AND** no separate row restates that the same mode is the current selection
- **AND** changing the mode updates the same single indicator

#### Scenario: Motion selection is stated once

- **GIVEN** the Settings modal is open on the Accessibility section
- **WHEN** the reduce-motion control renders
- **THEN** the effective motion behaviour is visible once
- **AND** the section does not render both a current-selection row and an active-behavior row for the same preference

### Requirement: Settings explanations are progressively disclosed

A Settings setting SHALL render its control without a mandatory prose
description. Where an explanation exists, it SHALL be reachable through a
labeled disclosure whose expanded state is exposed accessibly, and any safety,
permission, or data-consequence warning SHALL remain available without
weakening its content.

#### Scenario: Explanation is collapsed until requested

- **WHEN** a Settings section renders
- **THEN** its rows show label and value without an always-visible paragraph
- **AND** a row with an explanation exposes a control whose expanded state is reported
- **AND** activating it reveals that explanation

#### Scenario: Risky actions keep their warning and confirmation

- **GIVEN** a restore, portable import, or account action
- **WHEN** the user reaches it through the new row grammar
- **THEN** its consequence text and explicit confirmation are still reachable
- **AND** no destructive action runs from a single row tap

### Requirement: Command Center begins with the input

The Command Center SHALL render the command input before examples or
documentation, SHALL render example suggestions only while the input is empty,
and SHALL NOT render a panel dedicated to restating the current section.

#### Scenario: Examples demote once the user types

- **GIVEN** the Command Center is open with an empty input
- **WHEN** the user types a command
- **THEN** the example suggestions are no longer rendered
- **AND** the input, the parsed meaning and the confirmation remain available

#### Scenario: No current-section panel

- **WHEN** the Command Center opens with a launch context
- **THEN** the launch context is presented as a single quiet caption
- **AND** no full panel is spent restating the current section

### Requirement: Command parsing and execution claims stay truthful

The Command Center SHALL distinguish a parsed intent from a committed
execution, SHALL require confirmation before executing an action, and SHALL NOT
render a success state for an action that did not commit.

#### Scenario: Parsed intent is not a completed action

- **GIVEN** a parseable command
- **WHEN** the parse result renders
- **THEN** the surface presents a preview of what would happen without claiming it already happened
- **AND** the action is not committed until the user confirms

### Requirement: Achievements lead with an earned milestone

The Achievements surface SHALL render an actually earned milestone as its
primary content, SHALL render earned tiers before locked tiers, and SHALL place
locked tiers behind a disclosure with an accurate expanded state.

#### Scenario: Earned before locked

- **GIVEN** the user has earned at least one badge
- **WHEN** the Achievements surface renders
- **THEN** the earned tiers render before any locked tier
- **AND** locked tiers are reachable through one labeled disclosure
- **AND** that disclosure reports its expanded state

#### Scenario: A locked tier is not presented as earned

- **GIVEN** a badge the user has not unlocked
- **WHEN** it renders inside the disclosure
- **THEN** it is visibly distinguished from an earned tier by more than colour alone
- **AND** no progress denominator is invented where the ledger has none
