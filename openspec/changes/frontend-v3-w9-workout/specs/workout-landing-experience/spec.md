## ADDED Requirements

### Requirement: Training state is the first content on the Workout landing

The Workout section SHALL present, in order: a compact training-state line
(today's scheduled routine or rest context) with the single dominant training
action, quick-start routine rows, the collapsed weekly plan, routine
management, and the History & insights disclosure. The section SHALL NOT use a
documentation subtitle, a full-viewport rest-day hero, or stat cards above the
quick-start rows. A rest day SHALL remain accurately represented as compact
context while available routines remain immediately reachable.

#### Scenario: Rest day does not own the hero position

- **GIVEN** today is scheduled as rest and at least one routine exists
- **WHEN** the Workout section renders
- **THEN** a compact rest-day line is shown together with the quick-start rows
- **AND** no card occupies the hero position with a rest-day message
- **AND** a Start action is reachable for every listed routine without opening another surface

#### Scenario: Completed today still allows training

- **GIVEN** a session was already logged today
- **WHEN** the Workout section renders
- **THEN** the training state reflects the completed session
- **AND** starting another session remains available without changing the weekly plan

### Requirement: Quick-start routine rows

Each routine SHALL be reachable as a compact quick-start row communicating its
name, exercise count, set count, and last-performed context, with exactly one
obvious Start action per row. The rows SHALL remain correct with zero, one,
many, or long-named routines, and a persisted draft for a different routine
SHALL NOT cause a Start action to launch the draft's routine or the wrong
routine.

#### Scenario: Start launches exactly the row's routine

- **GIVEN** multiple routines and a draft exists for a different routine
- **WHEN** the user activates Start on a routine row
- **THEN** a session starts for that row's routine with its own exercises
- **AND** the existing draft is neither overwritten nor silently resumed

### Requirement: One resume authority for a persisted draft

When a valid persisted session draft exists, the landing SHALL show exactly one
dominant Resume action that names the routine and explains that entered
progress is saved. Discard SHALL be a secondary, confirmed action. A draft
whose routine is missing or has no exercises SHALL be re-validated on resume
with a truthful prompt rather than starting an empty session.

#### Scenario: Draft resume restores recorded state

- **GIVEN** a persisted draft with entered sets and a saved phase cursor
- **WHEN** the user resumes it
- **THEN** the session restores the routine, phase cursor, entered set values, dispositions, and elapsed active time
- **AND** no second draft authority is created

### Requirement: The weekly plan is a collapsed, readable strip

The landing SHALL show the recurring week as a compact strip in which each
day's assignment is readable by routine name, explicit Rest is distinct from an
unassigned day, and today is recognizable. Tapping a day SHALL open a focused
assignment sheet; for today the sheet SHALL distinguish a one-day override
from the recurring template, and a one-day override SHALL NOT change the
recurring weekly template. Long routine names SHALL NOT clip. Weekly planning
is collapsed by default and editable through the retained week editor.

#### Scenario: Override today leaves the template intact

- **GIVEN** a recurring weekly template assigns Monday to Push Day
- **WHEN** the user assigns a different routine to today as a one-day override
- **THEN** today resolves to the override routine
- **AND** the recurring Monday template row is unchanged

### Requirement: History and insights are subordinate

Training analytics (recent sessions, totals, personal records, body-area
distribution, body weight, weekly volume, heatmap, streak/day counts) SHALL
live inside one collapsed History & insights disclosure below training
actions. The landing SHALL NOT render equal-weight analytics cards that
compete with quick start. The disclosure SHALL preserve the existing detail
views and the quick-log badge semantics.

#### Scenario: Analytics load behind the disclosure

- **GIVEN** the Workout landing with the History & insights disclosure collapsed
- **WHEN** the section renders
- **THEN** no analytics card, chart, or heatmap is rendered in the training path
- **AND** expanding the disclosure reveals the same analytics content as before
