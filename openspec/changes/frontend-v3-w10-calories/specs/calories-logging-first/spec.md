## Purpose

Defines the observable contract of the reconstructed Calories surface: the
logging-first hierarchy, the elimination of duplicate daily facts and
doc-copy, the meal-grouped day log with immediately accessible actions, the
adaptive food chips, and the collapsed history disclosure. Both the Form and
Diary modes implement this contract; they differ only in entry affordances
(manual macro form for today vs day navigation and search-first add).

## ADDED Requirements

### Requirement: Remaining calories is the single dominant daily indicator

The Calories surface SHALL render the remaining-calories number as its screen
title (or, when over goal, the over-goal amount), and SHALL render each daily
fact exactly once: the consumed total appears once, the goal once, and the
remaining/over amount once. A second rendering of the same number
(StatBlock trio, donut centre, feature-stat note, or consistency strip) SHALL
NOT exist on the surface.

#### Scenario: One remaining-kcal indicator

- **GIVEN** a goal of 2000 kcal and 147 kcal logged today
- **WHEN** the Calories section renders
- **THEN** the screen title states the remaining amount (`1,853 kcal left`)
- **AND** exactly one progress indicator reflects goal progress
- **AND** no other element on the surface repeats the remaining, consumed, or goal number as a separate statistic

#### Scenario: Over goal is factual, never shame copy

- **GIVEN** more calories logged than the goal
- **WHEN** the surface renders
- **THEN** the title states the over-goal amount
- **AND** the caption beside the progress bar states the over-goal amount factually in a neutral-caution tone
- **AND** no copy scolds, rates, or judges the user

### Requirement: Macro summary is compact and legible

The macro summary SHALL render protein, carbs and fats as one compact group
with the logged amount, the daily target, and a progress indicator per macro.
A macro whose target is unset or zero SHALL NOT render a bar. The summary
SHALL expose one quiet action to edit daily targets.

#### Scenario: Macro rows render totals and targets

- **GIVEN** daily targets of protein 180g / carbs 220g / fats 70g and 0g logged
- **WHEN** the macro summary renders
- **THEN** each of the three macros shows its logged amount and target on one line with its progress indicator
- **AND** the summary renders no donut, pie, or proportional chart repeating the same three values

### Requirement: Meal-grouped day log with immediately accessible actions

The day's entries SHALL be grouped by meal type in both modes. Each group
SHALL show its item count and calorie total. Each entry row SHALL expose its
food name, calories and macro grams, and SHALL expose Edit and Delete actions
that are visible and operable without a swipe gesture, with accessible names
that identify the entry.

#### Scenario: Editing an entry from the grouped log

- **GIVEN** two entries logged under Lunch
- **WHEN** the user activates Edit on one entry
- **THEN** the entry edit modal opens prefilled with that entry's values
- **AND** the lunch group shows its total including both entries

#### Scenario: Deleting an entry from the grouped log

- **GIVEN** two entries logged under Lunch
- **WHEN** the user activates Delete on one entry
- **THEN** the entry is soft-deleted and the lunch total decreases by that entry's calories

### Requirement: Quick entry paths sit directly under the daily summary

The surface SHALL offer, above the day log and beside/below the summary:
recent foods, frequent foods, saved-meal browsing/search, manual entry, and
kcal-only quick add. A quick-add of a kcal-only entry SHALL NOT create a
saved meal, SHALL NOT inflate any saved-meal usage count, and SHALL NOT
require macro input.

#### Scenario: Kcal-only quick add writes one entry

- **GIVEN** an empty day
- **WHEN** the user quick-adds 200 kcal
- **THEN** exactly one calorie entry exists with 200 kcal and zero macros
- **AND** no saved meal named "Quick add" exists
- **AND** the saved-meal usage counts are unchanged

### Requirement: Historical trends are progressively disclosed

Year trend, macro trends, the 53-week activity heatmap, and the
days-logged/goal-progress facts SHALL live behind one collapsed disclosure
below the day log. While collapsed, the surface SHALL NOT render those
charts or run their rolling derivations.

#### Scenario: History is collapsed by default

- **GIVEN** a populated Calories surface
- **WHEN** it first renders
- **THEN** no trend chart or heatmap is visible
- **AND** one disclosure control names the history section

#### Scenario: Opening the disclosure renders the trends

- **WHEN** the user opens the history disclosure
- **THEN** the year trend, macro trends and 53-week heatmap render for the logged history

### Requirement: No doc-copy subtitles on the Calories surface

The Calories surface SHALL NOT carry explanatory subtitles restating
implementation detail (how the view modes differ, how the macro form is
reused, what a chart window is, or how calories are computed). Where a
control needs a hint, the hint SHALL be a caption beside that control.

#### Scenario: Screen header carries the number, not documentation

- **WHEN** the Calories section renders on a 390-wide viewport
- **THEN** the header consists of a quiet section eyebrow and the remaining-kcal title
- **AND** no subtitle paragraph describes the Form/Diary modes, the macro form, or the calculation

### Requirement: Food chips are adaptive and never truncated

Recent-food and frequent-food chips SHALL size to their content and wrap
instead of truncating inside a fixed-width horizontal scroller. A chip's
accessible name SHALL identify the food and its energy.

#### Scenario: A long food name is not truncated

- **GIVEN** a recent food with a long name
- **WHEN** the recent-foods row renders at 360px
- **THEN** the full food name is visible (wrapped or scrolled into view), never clipped with an ellipsis
- **AND** the chip's accessible name still identifies the food and its calories

### Requirement: No floating control overlaps the entry form

The Calories surface SHALL NOT render a floating action button or any
absolutely positioned control that overlaps an input field, in either mode,
at 360–412px widths. The form's submit action SHALL be part of the form.

#### Scenario: Form entry at 360px

- **WHEN** the Form mode renders on a 360-wide viewport
- **THEN** every input field is fully visible and unobstructed
- **AND** the entry submit action is inside the form, not floating over it
