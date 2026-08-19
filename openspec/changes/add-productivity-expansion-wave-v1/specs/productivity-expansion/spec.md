# Productivity Expansion Wave V1 — Spec Delta

## Purpose

Define the implementation-only product expansion that adds local planning, organization, quick capture, timeline, and progress capabilities before a separate hardening campaign.

This change SHALL be treated as an implementation wave. It SHALL NOT claim production readiness or comprehensive validation.

## ADDED Requirements

### Requirement: Planning Hub provides one coherent planning workspace

The application SHALL provide a Planning Hub modal/drawer reachable without adding a seventh top-level tab.

The Planning Hub SHALL expose Today, Projects, Goals, Progress, and Timeline views.

#### Scenario: User opens Today planning

- **GIVEN** the user is on Overview,
- **WHEN** they choose Plan Today,
- **THEN** the Planning Hub opens directly to the Today view.

#### Scenario: User opens progress

- **WHEN** the user chooses the Progress entry point,
- **THEN** the same Planning Hub opens to the Progress view without changing the six-section primary navigation model.

### Requirement: Projects are authoritative local user state

The application SHALL support locally persisted Projects with name, description, color, status, optional target date, ordering, timestamps, and soft delete.

#### Scenario: Project lifecycle

- **WHEN** a user creates, edits, pauses, completes, archives, reorders, or soft-deletes a Project,
- **THEN** the resulting state persists in SQLite and remains available after app restart.

#### Scenario: Project contains organizational context

- **WHEN** a Project is opened,
- **THEN** the UI can show associated Todos, Habits, and Goals without automatically mutating those children when Project status changes.

### Requirement: Goals are authoritative local user state

The application SHALL support locally persisted Goals with optional Project association, title, description, horizon, optional target date, status, manual progress percentage, timestamps, and soft delete.

#### Scenario: Manual progress

- **WHEN** a user updates Goal progress,
- **THEN** the value is clamped/validated to the inclusive range 0–100 and persists locally.

#### Scenario: Goal completion

- **WHEN** a Goal is marked completed,
- **THEN** linked Todos/Habits are not automatically completed or mutated.

### Requirement: Todos and Habits may be organized by Project and Goal

Todos and Habits SHALL support optional Project/Goal association in local persistence.

Existing records SHALL remain valid with null associations.

#### Scenario: Existing record upgrade

- **GIVEN** a Todo/Habit created before this wave,
- **WHEN** the local migration runs,
- **THEN** the record remains usable with no Project/Goal association.

#### Scenario: Association editing

- **WHEN** the user assigns or removes a Project/Goal association,
- **THEN** the canonical Todo/Habit record persists the new optional association without changing unrelated domain behavior.

### Requirement: One Daily Plan exists per local calendar date

The application SHALL support one authoritative local Daily Plan per local `YYYY-MM-DD` date key.

A Daily Plan SHALL support intention, up to three selected Todo IDs, focus-minutes target, notes, reflection, optional energy score 1–5, status, timestamps, and soft delete.

#### Scenario: Select top priorities

- **WHEN** the user selects priority Todos for today,
- **THEN** at most three unique Todo IDs are stored.

#### Scenario: Referenced Todo disappears

- **GIVEN** a historical Daily Plan references a Todo that is later deleted,
- **WHEN** the plan is rendered,
- **THEN** the missing reference is ignored safely rather than crashing or recreating the Todo.

#### Scenario: Complete Daily Plan

- **WHEN** the user records reflection/energy and marks the plan completed,
- **THEN** the plan status changes but selected Todos are not automatically completed.

### Requirement: Today planning uses existing domain facts

The Today view SHALL surface current pending Todo candidates and today's scheduled Habits using existing Todo priority/due semantics and existing Habit schedule semantics.

It SHALL NOT invent a second Habit scheduling formula or automatically rewrite existing records.

### Requirement: Quick Capture is globally accessible

The app SHALL provide a quick-capture launcher accessible from the normal application shell without obstructing core navigation.

#### Scenario: Capture Todo

- **WHEN** the user submits a Todo through Quick Capture,
- **THEN** the canonical Todo creation path is used.

#### Scenario: Capture Habit

- **WHEN** the user submits a Habit through Quick Capture,
- **THEN** the canonical Habit creation path is used.

#### Scenario: Capture Calorie entry

- **WHEN** the user submits a calorie entry through Quick Capture,
- **THEN** the canonical Calories data path is used.

#### Scenario: Capture Project or Goal

- **WHEN** the user submits a Project or Goal through Quick Capture,
- **THEN** the new local Project/Goal data API persists it.

#### Scenario: Start Focus

- **WHEN** the user chooses Start Focus,
- **THEN** Quick Capture closes and navigation moves to the existing Focus section; no second timer engine is created.

### Requirement: Activity Timeline is derived, bounded, and cross-domain

The Timeline SHALL be a derived read model rather than a new authoritative event table.

It SHALL use bounded queries and combine deterministic facts from existing domains plus Weekly Review, Daily Plan, Projects, and Goals.

#### Scenario: Recent timeline

- **WHEN** the user opens Timeline,
- **THEN** recent activity is grouped by local day and can be filtered by All, Productivity, Health, or Planning.

#### Scenario: Missing timestamp precision

- **WHEN** a source domain lacks an exact event timestamp,
- **THEN** the Timeline uses only defensible available timestamp/date facts and does not fabricate precision.

### Requirement: Progress Insights compare bounded periods

The Progress view SHALL compare a current local 7-day period with the immediately preceding 7-day period using deterministic local facts.

It SHALL include at least Todos, Habits, Focus, Workout, calorie-tracking context, Weekly Review state, Projects, and Goals.

It SHALL NOT introduce an opaque global productivity score.

### Requirement: New planning entities participate in local account safety

`projects`, `goals`, and `daily_plans` SHALL be included in the complete local user-data inventory used by account ownership/recovery emptiness safety.

#### Scenario: Project-only device is populated

- **GIVEN** a device has no legacy tracker rows but contains a Project,
- **WHEN** account replacement safety inspects local state,
- **THEN** the device is treated as populated.

### Requirement: New planning entities remain local-only during the implementation wave

During this change, Projects, Goals, and Daily Plans SHALL NOT be added to remote Backup/Sync/Restore/Portable contracts.

#### Scenario: Client is connected to Supabase

- **WHEN** the user creates a Project during this implementation wave,
- **THEN** no new remote sync entity is enqueued for a nonexistent production table.

The UI SHALL NOT falsely claim these entities are protected by the existing complete cloud backup.

### Requirement: Existing six-section navigation remains stable

The implementation SHALL preserve the six primary sections and SHALL NOT introduce a seventh primary tab for Planning/Projects/Goals.

### Requirement: Implementation-wave validation is intentionally minimal

This OpenSpec change SHALL skip baseline QA and broad regression during the implementation session.

The minimum end-of-wave validation SHALL be:

- TypeScript typecheck;
- lint under repository policy;
- OpenSpec validation;
- ExecPlan validation;
- `git diff --check`.

Full Vitest, E2E, simulation, native QA, live Supabase verification, performance hardening, and accessibility audit SHALL be deferred to a dedicated follow-up hardening change.

#### Scenario: Broad regression fails or is unknown after push

- **WHEN** GitHub Actions later reports a regression or has not completed,
- **THEN** the implementation wave may still be reported as implementation-complete provided the minimal gates passed and the report explicitly states hardening is required; the next campaign owns diagnosis and correction.

### Requirement: The wave does not stop on one non-critical slice blocker

If one feature slice encounters a non-safety-critical implementation blocker, the autonomous session SHALL record the blocker and continue implementing independent slices rather than ending the entire overnight run.

Critical compile/data-loss issues must still be fixed before push.

### Requirement: Final status distinguishes implementation from readiness

The final report SHALL NOT use production-ready language.

If the implementation scope is materially complete, the final verdict SHALL be:

`PRODUCTIVITY EXPANSION WAVE V1: IMPLEMENTATION COMPLETE — HARDENING REQUIRED`
