# weekly-review-planning Specification

## Purpose

Define the deterministic offline-first Weekly Review and next-week planning
workflow, including explicit decisions, preview/confirmation, and durable
review history.

## Requirements

### Requirement: The application SHALL provide a deterministic Weekly Review for a canonical local week

The application SHALL compute a Weekly Review from local authoritative data using the repository's sanctioned local-date helpers and a single documented canonical week boundary.

The Weekly Review SHALL remain fully functional without network access or AI.

The calculation SHALL be read-only.

#### Scenario: User opens the Weekly Review offline

- **GIVEN** the device contains local Super Habits data
- **AND** Supabase/remote mode is unavailable or disabled
- **AND** no AI endpoint is available
- **WHEN** the user opens Weekly Review
- **THEN** the application SHALL compute the review from local SQLite data
- **AND** SHALL display the deterministic summary
- **AND** SHALL NOT require remote access
- **AND** SHALL NOT mutate user data

#### Scenario: Week crosses a calendar-year boundary

- **GIVEN** a canonical review week that crosses a month or year boundary
- **WHEN** the application derives the review range and next-week range
- **THEN** all boundaries SHALL be derived from sanctioned local-date semantics
- **AND** SHALL remain stable across restart
- **AND** SHALL NOT reinterpret historical local `date_key` values through UTC conversion

### Requirement: The Weekly Review SHALL summarize existing product domains from bounded local queries

The Weekly Review SHALL include deterministic, bounded summaries for Todos, Habits, Focus/Pomodoro, Workouts, and Calories.

At minimum the summary SHALL expose:

- Todo completed, incomplete, overdue, due-next-week, and carry-forward candidate information;
- Habit scheduled occurrences, completed occurrences, consistency, streak/attention information;
- Focus completed sessions and focused minutes;
- Workout completed-session and routine-frequency information;
- Calorie logged-day and average-on-logged-days information, including configured goal when available;
- deterministic wins and attention items backed by computed facts.

Prior-week comparison SHALL query only the immediately preceding canonical week unless a stronger bounded implementation is explicitly justified.

#### Scenario: Summary is generated for a long-term user

- **GIVEN** the user has years of historical data
- **WHEN** the Weekly Review for one week is computed
- **THEN** the implementation SHALL query only data required for the review week and bounded comparison period
- **AND** SHALL NOT require an unbounded full-history scan on every review render

#### Scenario: No calorie data exists for the review week

- **GIVEN** the configured calorie goal exists
- **AND** there are no calorie entries in the review week
- **WHEN** the summary is calculated
- **THEN** logged-day count SHALL be zero
- **AND** average calories SHALL be represented as unavailable/null rather than zero consumption
- **AND** the application SHALL NOT infer or estimate missing calories

### Requirement: Weekly Review insights SHALL be deterministic and fact-backed

Wins and attention items SHALL be generated from explicit local rules and SHALL reference only facts computed from authoritative local data.

The application SHALL NOT use an AI model to invent numerical claims, select internal entity IDs, or replace deterministic calculations.

#### Scenario: AI phrasing is unavailable

- **GIVEN** the implementation optionally supports AI phrasing
- **AND** the AI request fails or is unavailable
- **WHEN** the Weekly Review renders
- **THEN** deterministic local wording SHALL be used immediately
- **AND** the review SHALL remain complete and actionable

### Requirement: The user SHALL make explicit planning decisions before any mutation occurs

The Weekly Review SHALL allow explicit user decisions for next-week priorities and eligible unfinished Todos.

Supported V1 planning decisions SHALL include:

- leaving an eligible Todo unchanged;
- safely rescheduling an eligible Todo;
- carrying forward an eligible Todo using recurrence-safe semantics;
- creating a bounded number of explicit new Todo commitments;
- selecting between one and five short next-week priorities;
- saving an optional bounded reflection.

The application SHALL NOT mutate domain data while the user is viewing the summary, editing the draft, or viewing the final preview.

#### Scenario: User changes Todo decisions in the draft

- **GIVEN** a Weekly Review draft is open
- **WHEN** the user changes a Todo from `leave` to `reschedule`
- **THEN** the change SHALL affect only draft state
- **AND** the underlying Todo SHALL remain unchanged until final confirmation

### Requirement: The application SHALL provide a complete final preview before confirmation

The final preview SHALL show every planned domain mutation in user-understandable terms.

For each Todo reschedule, the preview SHALL show the previous due date and proposed due date when applicable.

For new commitments, the preview SHALL show the Todo content and due date/priority fields that will be created.

The preview SHALL show selected next-week priorities and reflection.

#### Scenario: User cancels from the preview

- **GIVEN** the user has configured Todo changes, priorities, and a reflection
- **AND** no confirmation has occurred
- **WHEN** the user cancels or leaves the preview
- **THEN** no Todo mutation SHALL have occurred
- **AND** no completed weekly review record SHALL have been created

### Requirement: Weekly Review execution SHALL revalidate referenced entities immediately before mutation

Before final execution, the application SHALL re-fetch and revalidate every referenced Todo and SHALL detect incompatible concurrent changes.

Deleted, already-satisfied, unexpectedly completed, or otherwise stale items SHALL not be blindly mutated from stale draft state.

#### Scenario: Todo changes after preview but before confirmation

- **GIVEN** a Todo is included in the final Weekly Review preview
- **AND** that Todo is modified or deleted through another application path before confirmation
- **WHEN** the user confirms the review
- **THEN** the Weekly Review SHALL detect the stale state
- **AND** SHALL fail or return the user to a conflict-resolution state
- **AND** SHALL NOT silently apply the stale action

### Requirement: Todo planning mutations SHALL use canonical Todo domain behavior

Weekly Review SHALL use existing canonical Todo creation/update/recurrence APIs rather than direct ad hoc SQL mutation for normal user actions.

Recurring Todo semantics SHALL not be corrupted by carry-forward behavior.

If V1 cannot safely carry forward a specific recurring Todo state, that action SHALL be disabled or replaced with an explicitly safe alternative.

#### Scenario: Carry-forward candidate is a recurring Todo instance

- **GIVEN** an unfinished Todo belongs to recurrence semantics
- **WHEN** Weekly Review offers planning actions
- **THEN** the application SHALL NOT duplicate or rewrite recurrence state in a way that causes duplicate recurrence expansion
- **AND** SHALL expose only actions proven compatible with existing recurrence invariants

### Requirement: Weekly Review confirmation SHALL be durable and exactly-once

The feature SHALL prevent duplicate Todo effects when final confirmation is submitted repeatedly or when the application crashes during execution.

A process-local flag alone SHALL NOT be sufficient for effects that can duplicate across restart.

The implementation SHALL use durable review/execution state or receipts sufficient to resume or reject duplicate work safely.

#### Scenario: User double-taps Confirm

- **GIVEN** a Weekly Review contains new Todo commitments
- **WHEN** Confirm is activated twice
- **THEN** each intended Todo commitment SHALL be created at most once
- **AND** the Weekly Review SHALL be completed at most once for the canonical week

#### Scenario: Application crashes after one of several planned Todo effects

- **GIVEN** Weekly Review execution contains multiple planned effects
- **AND** one effect has completed durably
- **WHEN** the application crashes before the review reaches final completion
- **AND** the user retries or the application resumes execution
- **THEN** the already-completed effect SHALL NOT be duplicated
- **AND** remaining safe effects MAY continue according to the durable execution design

### Requirement: Completed Weekly Reviews SHALL be authoritative persisted user state

The application SHALL persist completed Weekly Reviews in an append-only-schema local representation with runtime-validated versioned payloads.

A completed review SHALL preserve:

- canonical reviewed week identity and date range;
- completion timestamp;
- deterministic summary snapshot or normalized equivalent;
- selected next-week priorities;
- recorded Todo planning decisions and resulting references;
- optional reflection;
- schema/version metadata required for validation and future migration.

The application SHALL enforce one canonical completed review per review week unless an explicit revision model is designed and specified.

#### Scenario: Application restarts after review completion

- **GIVEN** a Weekly Review has been completed
- **WHEN** the application restarts
- **THEN** the completed review SHALL remain available
- **AND** its historical summary, priorities, reflection, and decisions SHALL remain stable

### Requirement: The application SHALL provide read-only Weekly Review history

The user SHALL be able to list recent completed Weekly Reviews newest first and open a historical review read-only.

Historical review snapshots SHALL not automatically change merely because underlying current Todo/Habit state changes later.

#### Scenario: Current Habit state changes after a previous review

- **GIVEN** a completed historical review contains a Habit summary
- **WHEN** the user later records new Habit activity
- **THEN** the stored historical review SHALL continue to represent the facts/summary captured for its reviewed week

### Requirement: Weekly Review priorities SHALL appear only during their target week

A completed review MAY expose its next-week priorities on Home/Today.

The Home surface SHALL show at most three priorities compactly and SHALL hide them outside the target week.

Priorities SHALL remain plan concepts and SHALL NOT automatically become Todos.

#### Scenario: Target week ends

- **GIVEN** a completed review has priorities for a target week
- **WHEN** the current local date moves outside that target week
- **THEN** the Home/Today priority surface SHALL stop showing those priorities automatically

### Requirement: Weekly Review SHALL have a bounded, accessible guided UI

The user SHALL be able to complete the review through a focused guided flow rather than a single dense dashboard.

The flow SHALL provide accessible headings, labels, focus order, validation/error announcements, and sufficiently large interaction targets.

The final confirmation action SHALL be visually and semantically distinct.

#### Scenario: Keyboard user completes the review on Web

- **GIVEN** the Weekly Review is open on Web
- **WHEN** the user navigates using keyboard controls
- **THEN** all required review steps, decision controls, preview, and confirmation SHALL be reachable in a deterministic order

### Requirement: Weekly Review SHALL integrate with Backup Completeness V2

Completed Weekly Reviews SHALL be part of the authoritative recoverable backup scope.

The implementation SHALL update the shared Backup V2 contract, including as applicable:

- backup scope version;
- canonical column definition;
- strict runtime validation;
- durable outbox instrumentation;
- existing-user backfill;
- manifest/checkpoint integrity;
- owner-scoped Supabase representation;
- Restore V2 fetch/validation/import;
- schema validation.

Remote Weekly Review rows SHALL be owner-scoped and protected by the same authenticated RLS model as the existing Backup V2 tables.

#### Scenario: Existing user upgrades after creating historical Weekly Reviews

- **GIVEN** the user has local Weekly Review history before the new backup scope is fully backfilled
- **WHEN** Backup V2 scope migration/backfill runs
- **THEN** the historical Weekly Review rows SHALL be enqueued under the durable dataset owner
- **AND** a complete backup checkpoint SHALL not be published until the required review data has reached remote storage

### Requirement: Restore V2 SHALL restore Weekly Review history inertly

Restore V2 SHALL validate Weekly Review rows as untrusted remote input and SHALL import them without replaying historical planning effects.

#### Scenario: Restoring a review that originally created two Todo commitments

- **GIVEN** a cloud backup contains a completed Weekly Review whose original execution created Todo commitments
- **WHEN** Restore V2 imports the backup on an eligible empty device
- **THEN** the historical Weekly Review record SHALL be restored
- **AND** the corresponding Todo rows SHALL be restored through their normal backup entities
- **AND** the Weekly Review execution SHALL NOT run again
- **AND** no duplicate Todo commitments or Linked Action effects SHALL be created

### Requirement: Weekly Review SHALL integrate with Portable Backup V1

Completed Weekly Reviews SHALL be included in the portable recoverable scope through the shared backup contract or an equivalently consistent mechanism.

Portable checksums/integrity SHALL cover the Weekly Review data.

Portable import SHALL restore Weekly Review history without replaying historical planning effects.

#### Scenario: User exports and imports a portable backup containing review history

- **GIVEN** the source database contains completed Weekly Reviews
- **WHEN** the user exports a Portable Backup V1 file and imports it on an eligible destination
- **THEN** the imported Weekly Review history SHALL semantically match the source
- **AND** all portable integrity checks SHALL include the review data
- **AND** historical Todo planning effects SHALL not replay

### Requirement: Supabase Weekly Review storage SHALL be owner-scoped

Any new remote `weekly_reviews` representation SHALL include `user_id` ownership and SHALL use authenticated owner RLS from table creation.

Week uniqueness SHALL be scoped by owner rather than globally across all users.

The client SHALL not contain or expose the service-role credential.

#### Scenario: Two users review the same canonical week

- **GIVEN** users A and B both complete a review for the same `week_key`
- **WHEN** both rows are stored remotely
- **THEN** both SHALL be valid because uniqueness is scoped by owner
- **AND** user A SHALL not be able to read, update, or delete user B's row

### Requirement: Weekly Review SHALL preserve local-first operation when remote backup is unavailable

The user SHALL be able to complete and persist a Weekly Review when remote backup is unavailable.

Any required Backup V2 sync record SHALL remain durable locally and retry later under the existing owner/outbox model.

#### Scenario: User confirms a review while offline

- **GIVEN** the device has a compatible durable dataset owner
- **AND** remote backup is unavailable
- **WHEN** the user confirms a valid Weekly Review
- **THEN** the review and its intended local Todo effects SHALL complete according to local transaction/execution safety
- **AND** remote backup work SHALL remain queued for later retry
- **AND** the review UI SHALL not require immediate remote success

### Requirement: Weekly Review optional AI integration SHALL remain bounded and non-authoritative

If optional AI phrasing or Command Center read-only intents are implemented, the model SHALL receive only bounded typed facts required for phrasing and SHALL not receive arbitrary database access.

V1 SHALL NOT expose a free-form AI command that autonomously completes a Weekly Review or applies its Todo mutations.

#### Scenario: User asks Command Center for next-week plan

- **GIVEN** bounded read-only Command Center integration is implemented
- **WHEN** the user requests the next-week plan
- **THEN** the answer SHALL be derived from deterministic local Weekly Review data
- **AND** any remote phrasing failure SHALL fall back to deterministic local wording
- **AND** no Weekly Review mutation SHALL occur

### Requirement: Weekly Review implementation SHALL be fully validated before completion

The change SHALL include unit, real-SQLite integration, Web E2E, deterministic simulation, backup/portable regression, and Android validation where the environment is available.

The final repository state SHALL be committed to `main`, pushed to `origin/main`, have a clean working tree, retain only remote `main`, and have final GitHub Actions `quality` and `e2e` PASS for the exact final SHA.

#### Scenario: Final implementation session completes

- **WHEN** the implementation agent reports Weekly Review & Planning V1 complete
- **THEN** the OpenSpec tasks SHALL be complete
- **AND** the ExecPlan SHALL be schema-valid and `COMPLETED`
- **AND** local `main` SHALL equal `origin/main`
- **AND** the final GitHub Actions run for that SHA SHALL have `quality = PASS` and `e2e = PASS`
- **AND** all session-generated prose SHALL be English only
