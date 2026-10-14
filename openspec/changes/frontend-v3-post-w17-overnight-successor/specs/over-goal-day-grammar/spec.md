## Purpose

Defines the Calories day summary when logged calories are under, exactly at, or above the saved daily goal. This is the shipped W10 grammar, now required in the standard test lane.

## ADDED Requirements

### Requirement: Over-goal days state the excess once

When calories logged on the selected local day exceed the saved calorie goal, the Calories title SHALL state the excess as `N kcal over`. The daily context SHALL state the consumed amount of the goal. The hero SHALL state the same excess as `N kcal over goal`. The surface SHALL NOT say `kcal left` for that day and SHALL NOT render a separate `Goal N` statistic.

#### Scenario: One kilocalorie over the goal

- **WHEN** the saved goal is 2000 kcal and the selected local day has 2001 kcal logged
- **THEN** the title states `1 kcal over`
- **AND** the context states that 2,001 of 2,000 kcal are logged
- **AND** the hero states `1 kcal over goal`
- **AND** no `kcal left` string and no `Goal 2,000` statistic are shown

#### Scenario: Deleting the crossing entry restores kcal left

- **WHEN** a day that was over the goal loses the entry that crossed the goal
- **THEN** the title states the remaining kilocalories as `N kcal left`
- **AND** the over-goal title and hero caption for the previous excess are gone
- **AND** the remaining rows still match the browser-local consumed-on date

### Requirement: An exact goal is not an over-goal day

When logged calories equal the saved goal, the title SHALL state `0 kcal left` and SHALL NOT state `0 kcal over`.

#### Scenario: Logged calories equal the goal

- **WHEN** the saved goal is 2000 kcal and the selected local day has 2000 kcal logged
- **THEN** the title states `0 kcal left`
- **AND** the context states that 2,000 of 2,000 kcal are logged
- **AND** no `0 kcal over` caption is shown
