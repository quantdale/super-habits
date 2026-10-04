## Purpose

Extends the double-submit guard capability so that every inline mutation surface in the product is re-entrant-safe in the same tick, and so a destructive quick action resolves the exact row it captured rather than matching by value.

## ADDED Requirements

### Requirement: Inline quick-add inputs are re-entrant-safe in the same tick

An inline quick-add input SHALL guard its submit with a synchronous re-entry check that is entered before any asynchronous work begins and released only after that work completes. Both the button press and the keyboard submit path SHALL be covered by the guard, so two complete presses in the same tick produce exactly one row.

#### Scenario: Two Enter presses in the same tick

- **WHEN** the user submits the inline quick-add input twice within one tick
- **THEN** exactly one row with that title is persisted and the second submission starts no write

#### Scenario: A single submit behaves as before

- **WHEN** the user submits the inline quick-add input once with valid input
- **THEN** the row is created exactly as today, with validation before the write and no change to the control's disabled or loading presentation

### Requirement: A quick destructive action resolves the exact row it captured

A quick-capture action that offers an undo of the mutation it just performed SHALL carry the identity of the created row through to the undo, rather than re-deriving the target by matching values. Undoing an older capture SHALL remove the row that capture created.

#### Scenario: Two identical captures, the older is undone

- **WHEN** a user captures the same food, calorie amount, and meal type twice and then undoes the first capture
- **THEN** the row created by the first capture is deleted and the second remains

#### Scenario: A single capture is undone

- **WHEN** a user captures one entry and undoes it
- **THEN** that entry is deleted exactly as today

### Requirement: The one-row oracle covers the inline surfaces

The end-to-end coverage for the "one row or zero, never two" contract SHALL cover the inline quick-capture surfaces, not only the add/edit-todo modal.

#### Scenario: An inline surface gains a second-row path

- **WHEN** a new inline quick-capture surface is added without a synchronous guard
- **THEN** the end-to-end oracle for that surface fails rather than passing silently
