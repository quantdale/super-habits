# Linked Actions Policy Truth Specification

## ADDED Requirements

### Requirement: Policy labels describe the shipped engine

Each Linked Actions policy entry SHALL report `engineSupport` consistent with whether the engine actually executes that trigger/target/effect, and the editor SHALL offer exactly the authorable, executable paths.

#### Scenario: Executed effects are not labeled deferred

Given the engine executes `calorie.log` and `pomodoro.log` effects,
When the policy is inspected,
Then those effect entries are labeled `implemented`,
And their authorability matches what the editor actually offers.

#### Scenario: Hidden paths are honestly hidden

Given a trigger whose event is never emitted by any data layer,
When its policy is inspected,
Then it is not offered in the editor,
And its recorded rationale reflects the real reason (not a false "engine deferred" claim over executed code).

### Requirement: Exposure requires end-to-end proof

A deferred trigger/target/effect path SHALL only be flipped to authorable after an integration-level proof shows: rule authored through the normal editor model, trigger event emitted by the real data-layer path, and the effect executed exactly once (replays suppressed).

#### Scenario: Author and observe a calorie-log rule

Given exposure criteria are met for the calorie path,
When a user authors a rule completing a todo that logs a fixed calorie entry,
Then completing that todo inserts the entry exactly once,
And re-completion or replay does not duplicate it.

### Requirement: Recurring-source blocking copy is honest

While recurring Todos cannot be Linked Action sources, the UI copy SHALL explain the real reason (each generated copy is a new task row that rules do not follow) instead of a dead-end sentence.

#### Scenario: Recurring source explanation

Given a recurring todo's Linked Actions section,
When it renders,
Then the copy explains that rules bind to one task copy and recurrence is unsupported,
And no control suggests the capability is imminent unless shipped.
