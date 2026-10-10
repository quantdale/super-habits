## ADDED Requirements

### Requirement: The live session is set-logging first

The active session SHALL present, in order: a session top bar (routine name,
accurate set progress, elapsed active time, end), the current exercise header
(name, set progress, modality, target), the flat set table for that exercise
with inputs and a done control per set, and contextual rest. A giant countdown
or rest-adjust controls SHALL NOT sit between the user and the next set's
inputs.

#### Scenario: Set entry is reachable immediately

- **GIVEN** an active weighted-strength session
- **WHEN** the session renders
- **THEN** the current exercise's set inputs and done control are visible without scrolling past a dominating countdown
- **AND** the timer is a compact contextual readout

### Requirement: Set rows preserve disposition semantics

The set table SHALL render one row per prescribed set of the current exercise
with its number, previous-performance context, modality-correct inputs, and a
done control. Completed, skipped, and upcoming sets SHALL be visually distinct
without relying on color alone. Only the phase at the session cursor is
actionable; completed and skipped rows are read-only records of what was
entered. Advancing remains strictly sequential: a completion tap SHALL NOT
create duplicate logged sets.

#### Scenario: Skipped sets never look completed

- **GIVEN** a set skipped via the skip control
- **WHEN** the table re-renders
- **THEN** the skipped row is distinct from completed rows by more than color
- **AND** it is excluded from completed-set counts at finish

### Requirement: Every modality keeps its input contract

The session SHALL choose inputs from the phase modality: weight + reps for
weighted strength; reps with an optional additional-load field for bodyweight;
duration for timed work; duration with distance and pace for cardio; per-side
labels for unilateral exercises; and weight/reps for legacy free-text
exercises. RPE/RIR entry SHALL appear only when the effort scale is enabled.
Previous-performance context SHALL use the unchanged lookup semantics.

#### Scenario: Cardio keeps duration, distance, and pace

- **GIVEN** a cardio phase with target distance and pace
- **WHEN** the set row renders
- **THEN** duration, distance, and pace inputs are available with accurate labels and units

### Requirement: Rest is a dock, not a blocker

While the current phase is rest, the session SHALL show a compact rest dock
with the remaining time, adjust controls, and a skip control. The dock SHALL
remain visible and accessible without overlaying set-entry inputs, and the
seconds readout SHALL NOT be announced every second to screen readers.
Zero-rest semantics (`rest_seconds = 0` emits no rest phase), superset rest
behavior, and per-set rest prescriptions SHALL be unchanged, and a rest timer
reaching zero SHALL NOT complete or skip a set.

#### Scenario: Rest never covers the inputs

- **GIVEN** a rest phase follows a completed set
- **WHEN** the rest dock is visible
- **THEN** set-entry controls for the upcoming set remain usable and unobscured
- **AND** the countdown, adjust, and skip controls are available in the dock

### Requirement: Add set works inside the session

The session SHALL offer an Add set affordance for the current exercise that
appends a session-local set: correctly numbered after the prescribed sets,
with a coherent rest rule (inheriting the exercise's last prescribed rest, so
zero stays zero), persisted through the draft, restored on resume, and logged
with correct set numbers and completion state at finish. The recurring routine
SHALL NOT be modified by an in-session Add set.

#### Scenario: Added set survives resume and lands in the log

- **GIVEN** a session where the user adds a set to the current exercise
- **WHEN** the draft is resumed and the added set is completed and the session finished
- **THEN** the log contains the prescribed sets plus the added set with correct set numbering
- **AND** the routine's prescribed sets are unchanged

### Requirement: Finish saves exactly once and tells the truth on failure

Finishing SHALL preserve the synchronous exactly-once submit guard and award
XP only after the log write is durably committed. A failed save SHALL surface
a truthful error with a retry path instead of a silent no-op or a false
summary. The summary SHALL show session duration, completed sets, skipped
sets, exercises, volume, and any new personal records, with one Done action.

#### Scenario: Save failure is visible and retryable

- **GIVEN** the session log write fails
- **WHEN** the user activates the finish action
- **THEN** an error message explains the failure and the finish action remains available to retry
- **AND** no XP is awarded and no success summary is shown

### Requirement: Personal-record feedback is brief and nonblocking

A new personal record SHALL be surfaced as a brief, dismissible notice tied to
the specific exercise, without obscuring set inputs or blocking progression,
announced politely, and honoring reduced motion. The same record SHALL NOT be
re-celebrated on rerenders, and skipped sets SHALL NOT qualify as personal
records. `findNewPersonalRecords` semantics are unchanged.

#### Scenario: PR notice does not block the next set

- **GIVEN** a completed set establishes a new personal record
- **WHEN** the notice appears
- **THEN** the next set's inputs and controls remain usable
- **AND** the notice auto-dismisses or can be dismissed without side effects

### Requirement: Progress labels are accurate

The session SHALL distinguish completed sets, total prescribed sets, skipped
sets, current exercise progress, elapsed active time, and rest remaining with
accurate labels. Rest phases SHALL NOT be counted as completed sets.

#### Scenario: Skipped sets are reported separately

- **GIVEN** a session with four completed sets and one skipped set out of fifteen prescribed
- **WHEN** the progress readout renders
- **THEN** it reports the completed count against prescribed total and the skipped count separately

### Requirement: Cancellation copy tells the truth about drafts

Leaving a session SHALL preserve the resumable draft and say so; discarding the
draft SHALL require an explicit destructive confirmation. The copy SHALL match
actual persistence behavior and the confirmation SHALL work on web and native.

#### Scenario: Leaving keeps the draft

- **GIVEN** an in-progress session with entered sets
- **WHEN** the user chooses to leave the session
- **THEN** the draft is preserved and the landing offers Resume
- **AND** the session is not logged as a completed workout
