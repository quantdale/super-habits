## Purpose

Defines when a finished workout may be reported as saved, how a skipped or
failed save is surfaced truthfully, and how post-commit bookkeeping failures
are distinguished from a failed save.

## ADDED Requirements

### Requirement: A workout is saved only when its log is durably committed

Finishing a workout SHALL report success only when `logWorkoutSession()`
returns `status: 'applied'` **and** a non-empty log id. A result of
`status: 'skipped'`, or any result without a valid log id, SHALL NOT show the
saved-workout state, SHALL NOT clear the session draft, SHALL NOT award XP, and
SHALL NOT navigate away automatically. A skipped result that arrives without
throwing SHALL be handled exactly like a thrown failure.

#### Scenario: A skipped write never reports a saved workout

- **GIVEN** an active session with entered sets and a persisted draft, and the routine has become unavailable (soft-deleted) before Finish
- **WHEN** the user activates the finish action and the log write returns `skipped` with no log id
- **THEN** no workout log row exists
- **AND** the saved-workout summary is not shown
- **AND** no reward is awarded
- **AND** no draft-clearing operation runs
- **AND** the entered sets, added sets, and current exercise/phase remain intact in memory

#### Scenario: An inconsistent result fails closed

- **GIVEN** the log write returns a result without a valid log id (including `applied` with a missing id)
- **WHEN** the finish action resolves
- **THEN** the workout is not reported as saved
- **AND** the user receives a truthful explanation with the finish action still available

#### Scenario: A thrown database error keeps the session retryable

- **GIVEN** the log write throws
- **WHEN** the finish action resolves
- **THEN** the error is displayed
- **AND** the entered sets and draft survive so a retry is possible where the failure is transient

### Requirement: The failure explanation is accurate and actionable

When a finish does not save, the message SHALL name the actual cause reported
by the data layer rather than a generic retry suggestion. When the routine is
no longer available, the message SHALL say so and SHALL NOT claim the session
is resumable against a deleted routine. Retrying the same unavailable routine
SHALL NOT be presented as likely to succeed.

#### Scenario: A missing routine is reported as a missing routine

- **GIVEN** the routine for the session was deleted before Finish
- **WHEN** the save is skipped for that reason
- **THEN** the message states the workout was not saved because its routine is no longer available
- **AND** the message states the entered sets are still here
- **AND** the message does not claim the session can be resumed against the deleted routine

### Requirement: A committed save survives post-commit bookkeeping failure

A durable workout log SHALL remain reported as saved even when secondary
post-commit bookkeeping (draft cleanup, reward attribution) fails. The UI
SHALL NOT suggest the workout failed to save and SHALL NOT invite a second
database insert after a commit. The exactly-once finish guard SHALL be
preserved so a rapid double Finish commits exactly one workout log and
produces exactly one reward attribution.

#### Scenario: A reward failure after commit is not a save failure

- **GIVEN** the log write commits durably
- **AND** secondary post-commit bookkeeping fails
- **WHEN** the finish action resolves
- **THEN** the workout is reported as saved
- **AND** the user is not told the workout failed to save
- **AND** no duplicate-log retry is encouraged

#### Scenario: Double Finish stays idempotent

- **GIVEN** the user activates the finish action twice in rapid succession
- **WHEN** both presses resolve
- **THEN** exactly one workout log exists
- **AND** exactly one reward attribution references that log

### Requirement: The error path cannot erase a durable draft

The skipped or failed finish path SHALL schedule no draft-clearing
operation, and a durable draft persisted earlier SHALL NOT be erased by a
failed save. A draft write in flight while the draft is cleared SHALL NOT be
able to resurrect the cleared draft after the clear completes.

#### Scenario: A failed save does not erase the draft

- **GIVEN** a persisted draft exists for the session
- **WHEN** the finish action is skipped or fails
- **THEN** the persisted draft is still present afterwards

#### Scenario: A late draft write cannot resurrect a cleared draft

- **GIVEN** a debounced draft write is in flight
- **WHEN** the draft is cleared and the in-flight write then resolves
- **THEN** the durable draft remains cleared
