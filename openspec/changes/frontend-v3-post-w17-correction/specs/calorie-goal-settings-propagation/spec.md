## Purpose

Defines how a nutrition goal saved in Settings becomes visible on Calories and durable in local metadata, without reviving a retired goal-chip statistic.

## ADDED Requirements

### Requirement: A saved calorie goal reaches the mounted Calories surface

A change to the daily calorie goal saved from Settings SHALL be visible the next time the Calories section is shown, without an app reload. The surface SHALL express that goal through the remaining-or-over title and the consumed-of-goal context. It SHALL NOT add a separate `Goal N` statistic to satisfy an older selector.

#### Scenario: Settings goal change is visible on Calories

- **WHEN** the saved daily calorie goal changes from 2000 to 2400 and the user opens Calories for a day with zero calories logged
- **THEN** the screen title states `2,400 kcal left`
- **AND** the daily context states that 0 of 2,400 kcal are logged
- **AND** the goal control is named as an edit action, not as `Goal 2,400`

#### Scenario: Over-goal days do not invent a goal chip

- **WHEN** calories logged on the selected day exceed the saved goal
- **THEN** the title states the over-goal amount
- **AND** no separate `Goal N` statistic is rendered

### Requirement: The saved calorie goal survives reload

The calorie goal saved from Settings SHALL be stored as the durable calorie-goal record and SHALL still drive the Calories title and context after a fresh mount. Saving the goal SHALL NOT create or delete calorie entry rows.

#### Scenario: Reload reads the saved goal

- **WHEN** the user saves a 2400 kcal goal with the existing macro targets, reloads, and opens Calories for a day with zero calories logged
- **THEN** the title again states `2,400 kcal left`
- **AND** the durable calorie-goal record has calories 2400 and the macro targets that were saved with it
- **AND** the calorie-entry count is unchanged by the settings save
