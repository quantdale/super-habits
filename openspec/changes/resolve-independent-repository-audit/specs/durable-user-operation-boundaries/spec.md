## Purpose

Make complete user operations retain their intended ownership, identity and recoverable result across failures, retries and process interruption rather than proving only isolated helper behavior.

## ADDED Requirements

### Requirement: Imported origin restricts every ownership adoption path

A populated imported dataset with a source-owner fingerprint MUST be claimable only by its matching verified source account, including after local edits create unowned pending work. Unrelated sessions MUST NOT acquire the binding or upload the dataset. Local-only source imports MUST retain their disclosed adoption behavior.

#### Scenario: Local edit occurs under an unrelated temporary session

- **WHEN** account A's imported dataset is edited while an unrelated temporary account B remains signed in
- **THEN** local edits MUST persist while the dataset and pending work remain unavailable for adoption or upload by B

### Requirement: Completed unsaved workouts remain recoverable

Reaching a workout summary MUST NOT discard durable entered state before a successful saved-log acknowledgement or explicit discard. Failed or skipped saves MUST retain a recoverable pending-save result. Interruption after log commit MUST NOT create a duplicate log on retry.

#### Scenario: Saving the completed summary fails

- **WHEN** a completed workout's save fails and the app restarts
- **THEN** its entered measurements, dispositions, identities and pending-save state MUST remain recoverable without fabricated history or rewards

#### Scenario: Process stops between save and cleanup

- **WHEN** the log commits and the process stops before draft cleanup is acknowledged
- **THEN** recovery MUST recognize the committed log and MUST NOT log or reward it twice

### Requirement: Committed source completion has a durable automation handoff

A committed completion requiring Linked Actions MUST retain stable recoverable dispatch intent. Recovery MUST settle every historically eligible rule independently, with idempotent effects and no retroactive execution of rules created after the event.

#### Scenario: Interruption follows the first rule

- **WHEN** a completion commits and the process stops after rule A applies but before eligible rule B settles
- **THEN** recovery MUST settle B without reapplying A
- **AND** later-authored, paused or deleted rules MUST NOT gain eligibility through recovery

### Requirement: Composed entity and rule saves are retry safe

Creating or editing a Todo/Habit with its configured rules MUST have an atomic result or an explicitly durable resumable partial result. A failed attempt and subsequent retry/restart MUST NOT duplicate the parent or leave an undisclosed partial rule replacement.

#### Scenario: A later rule write fails

- **WHEN** saving a parent and multiple rules fails after an earlier write
- **THEN** the operation MUST roll back coherently or retain a stable disclosed retry identity
- **AND** retries and restart MUST produce exactly one intended parent and rule set

### Requirement: Workout rescheduling commits both sides together

A workout move MUST atomically commit the source override, destination override and their applicable backup intents. Invalid inputs or destination failures MUST preserve the original schedule.

#### Scenario: Destination persistence fails

- **WHEN** a different-day move encounters a failure after attempting the source change
- **THEN** neither side nor its backup intent MUST be partially committed

### Requirement: Exercise persistence preserves instance identity

Distinct routine exercise instances MUST remain distinguishable through session entry, draft recovery, logging and history, even when display names or catalog identities match. Legacy free-text history MUST remain usable without invented identity mapping.

#### Scenario: Two exercises share a display name

- **WHEN** different exercise instances sharing a name are completed with different modalities or measurements
- **THEN** saved history MUST preserve each instance's identity, modality, set positions and measurements separately

### Requirement: Focus recovery counts active countdown time

Pauses MUST NOT count toward completed Focus duration after restart. Stable session identity MUST be retained independently of its current countdown deadline, and repeated reconciliation MUST log a completed session at most once.

#### Scenario: Resume occurs after the original nominal deadline

- **WHEN** a 25-minute session runs five minutes, pauses twenty minutes, resumes and restarts one minute later
- **THEN** it MUST be classified as unfinished with nineteen minutes of active countdown unperformed and MUST NOT be logged as completed
- **AND** the existing documented interruption UX MUST remain valid without requiring a new post-restart timer-resume feature

### Requirement: Failed Focus startup releases the session claim

Rejected startup MUST restore a coherent idle and startable state without an orphan notification or active intent. An unsupported/permission-denied notification result MUST retain its established warning-success behavior.

#### Scenario: First scheduling attempt rejects

- **WHEN** startup scheduling rejects and the user starts again
- **THEN** the second attempt MUST be accepted unless another actual session has claimed the timer

### Requirement: Associations are coherent at creation and mutation

Every association mutation MUST reject nonexistent or soft-deleted parents without changing child or backup work. A Project-backed Goal MUST align the child's Project. A Project-only move/clear conflicting with the existing Goal MUST clear that Goal; an explicit Goal selection in the same mutation MUST determine its Project. New Todo dialog selections MUST persist through reload.

#### Scenario: Child changes Project without changing its Goal explicitly

- **WHEN** a child linked to a Goal in P1 is reassigned to P2 or cleared of Project
- **THEN** the conflicting Goal MUST be cleared without an inconsistent persisted pair

#### Scenario: User creates a Todo with selected associations

- **WHEN** the creation dialog saves valid selected Project/Goal associations
- **THEN** the canonical Todo and relevant planning views MUST retain the resolved association after reload

### Requirement: Quest eligibility and payment identity are distinct

A newly satisfied unpaid daily quest MUST receive exactly one quest payment, even when canonical post-action facts already display it complete. Retry, undo/recheck, restart and historical reconciliation MUST NOT pay the same quest twice or recursively satisfy a quest using its own reward.

#### Scenario: Planning action satisfies an unpaid quest

- **WHEN** a committed daily plan makes the selected plan quest eligible and its completion is not recorded as paid
- **THEN** the action and quest rewards MUST be persisted with exactly one quest payment record

### Requirement: Notification replay suppression preserves distinct deliveries

The response boundary MUST suppress duplicate handling of one delivery without suppressing a later distinct occurrence using the same notification identifier/action. Delivery identity and durable business-action idempotency MUST remain distinct.

#### Scenario: Repeating reminder delivers twice

- **WHEN** two weekly deliveries share a request identifier/action but represent different occurrences
- **THEN** both deliveries MUST be actionable while listener/cold-start replay of either delivery MUST NOT duplicate its effect
