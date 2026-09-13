## ADDED Requirements

### Requirement: Pomodoro defaults changes propagate to the mounted Focus section

A change to the Pomodoro defaults saved in Settings SHALL reach the already-mounted Focus section without a reload — by re-reading `pomodoro_settings` when the section becomes active or via a settings-change signal the section consumes. After the save, the next activation of the Focus section SHALL show the new default durations for a fresh idle timer.

#### Scenario: Defaults changed in Settings appear on the live Focus section

- **WHEN** the user changes the focus/break defaults in Settings while the Focus section is already mounted, then returns to the Focus section
- **THEN** the idle timer displays the newly saved default durations without requiring an app reload.

#### Scenario: Defaults survive reload as before

- **WHEN** the user changes the Pomodoro defaults in Settings and reloads the app
- **THEN** the Focus section shows the saved defaults, read from `app_meta.pomodoro_settings` (existing behaviour, must not regress).

### Requirement: A running or paused session is not disturbed by a defaults change

Propagating a defaults change SHALL update only the _default_ durations used for a fresh idle timer. An in-flight session's retained state — remaining time and running/paused status — SHALL be left untouched, and no session SHALL be logged as a side effect of the propagation.

#### Scenario: Paused session retains its remaining time

- **WHEN** a focus session is paused and the user changes the default focus duration in Settings
- **THEN** the paused session still shows its original remaining time and remains paused, and no pomodoro session row is logged from the interruption.
