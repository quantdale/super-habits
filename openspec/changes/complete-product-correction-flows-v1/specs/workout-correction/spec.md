# Workout Correction Specification

## ADDED Requirements

### Requirement: Workout routines are editable after creation

The user SHALL be able to rename a routine and change its description/goal tag from the routine surface; template edits SHALL NOT alter any existing logged workout.

#### Scenario: Rename does not touch history

Given a routine with completed logged sessions,
When the user renames the routine,
Then the routine title changes going forward,
And previously logged sessions keep their recorded history.

### Requirement: Custom exercises support edit, archive, and restore

Custom exercises SHALL be renamable/editable, archivable, and restorable through the UI, with archived exercises excluded from selection for new routine editing while historical session references remain intact.

#### Scenario: Archive hides from pickers but history survives

Given a custom exercise used in past logged sessions,
When the user archives it,
Then it no longer appears for new routine configuration,
And historical logs referencing it remain unchanged,
And restoring it makes it selectable again.

### Requirement: An accidentally logged workout can be deleted, not silently rewritten

A completed workout log that was created by mistake SHALL be deletable through an explicit, confirmed action that cascades to its nested session rows and records durable delete intents; completed numeric performance data (reps, load, duration, RPE) SHALL remain immutable after completion.

#### Scenario: Delete accidental quick-complete

Given a workout completed by mistake today,
When the user confirms deletion of that log,
Then the log and its session exercise/set rows are gone from history and progress rollups,
And durable delete intents exist for each removed row,
And the routine template itself is untouched.

#### Scenario: Completed sets are not editable

Given a completed logged session,
When the user opens it,
Then no control offers to rewrite completed reps/load/duration values.
