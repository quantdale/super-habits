# Production Schema Convergence — Spec Delta

## Purpose

Define the final production-database convergence required for Productivity Expansion Wave V1 hardening. Repository correctness alone is insufficient while the deployed Supabase schema cannot accept the current Backup Scope V4 planning entities.

## ADDED Requirements

### Requirement: Production remote schema matches current recoverable planning scope

The production Supabase project SHALL expose owner-scoped `projects`, `goals`, and `daily_plans` tables compatible with the current hardened client contract.

#### Scenario: Current planning backup reaches production

- **GIVEN** a protected user has local Project, Goal, or Daily Plan state,
- **WHEN** the durable backup pipeline flushes current Backup Scope V4 rows,
- **THEN** the Data API accepts those rows without missing-table or missing-column errors.

### Requirement: Existing Todo and Habit remote rows accept current planning associations

The production `todos` and `habits` tables SHALL contain the planning association columns required by current local mutations and backup payloads.

Todo completion history SHALL have a remote `completed_at` field matching the authoritative local completion fact.

The Habit remote contract SHALL match the authoritative local Habit schema exactly; the implementation SHALL resolve the current `completed_at` contract discrepancy before migration.

#### Scenario: Todo with planning associations backs up

- **WHEN** a Todo has Project/Goal associations and a stable completion fact,
- **THEN** its owner-scoped remote upsert succeeds without dropping or rejecting those fields.

#### Scenario: Habit contract is not remote-only

- **GIVEN** the current backup constant lists a Habit field that SQLite does not own,
- **WHEN** the production migration is designed,
- **THEN** the discrepancy is resolved at the authoritative contract rather than creating a meaningless remote-only column.

### Requirement: Planning tables are owner isolated

Each new public planning table SHALL have `user_id UUID NOT NULL DEFAULT auth.uid()` referencing `auth.users(id) ON DELETE CASCADE`, SHALL have RLS enabled, and SHALL use authenticated owner CRUD policies.

UPDATE SHALL use both `USING` and `WITH CHECK` owner predicates.

#### Scenario: Different owner cannot read planning data

- **GIVEN** Project row P belongs to user A,
- **WHEN** authenticated user B queries P,
- **THEN** P is not visible to B.

#### Scenario: Different owner cannot reassign planning data

- **GIVEN** a planning row belongs to user A,
- **WHEN** user A or B attempts to write another user's `user_id`,
- **THEN** the RLS owner check rejects the reassignment.

### Requirement: Cross-owner planning relationships are impossible

A Goal SHALL NOT reference a Project owned by another user. Todo/Habit Project and Goal associations SHALL NOT be able to reference another user's parent state.

#### Scenario: Cross-owner Project association

- **GIVEN** Project P belongs to A and Todo T belongs to B,
- **WHEN** B attempts to associate T with P,
- **THEN** the database or an equivalently strong owner-safe constraint rejects the relationship.

### Requirement: Daily Plan uniqueness is owner-scoped and soft-delete compatible

Active Daily Plan uniqueness SHALL be scoped by owner and date.

Different owners MAY each have an active Daily Plan for the same date.

The same owner SHALL NOT have more than one active Daily Plan for a date.

Soft-deleting the active plan SHALL allow that owner to create a new plan for the same date.

#### Scenario: Same date for two owners

- **GIVEN** users A and B,
- **WHEN** each creates an active Daily Plan for `2026-08-20`,
- **THEN** both rows are accepted.

#### Scenario: Recreate after delete

- **GIVEN** A soft-deletes the active `2026-08-20` plan,
- **WHEN** A creates a replacement for that date,
- **THEN** the replacement succeeds.

### Requirement: No anonymous/public table access is introduced

The new planning tables SHALL NOT grant table privileges to `anon` or `PUBLIC`.

Authenticated Data API privileges MAY be granted as required, with RLS providing owner authorization.

### Requirement: Backup manifest scope version exists in production

The production `backup_manifest` table SHALL contain `backup_scope_version` and the migration ledger SHALL reflect the repository migration that adds it.

#### Scenario: Scope-4 manifest publication

- **WHEN** a current Backup Scope V4 checkpoint publishes a manifest,
- **THEN** the remote row can persist its explicit scope version.

### Requirement: Schema convergence is additive and preserves production rows

The production migration SHALL preserve all existing user rows and owner assignments.

Historical migration files SHALL NOT be rewritten.

#### Scenario: Existing production data survives migration

- **GIVEN** pre-migration Todos/Habits/Calories/etc. exist,
- **WHEN** the planning schema migrations are applied,
- **THEN** their row counts and owner assignments remain unchanged except for nullable new columns/defaulted schema metadata.

### Requirement: Repository schema validator enforces the deployed contract

`supabase:schema:validate` SHALL fail if the migration set omits required planning tables/columns, owner/RLS policies, owner-safe relationships, owner-scoped Daily Plan uniqueness, or `backup_manifest.backup_scope_version`.

It SHALL reject unsafe global date uniqueness or missing owner authorization.

### Requirement: Live deployment is verified, not inferred

This change SHALL NOT be marked complete solely because migration SQL exists or local tests pass.

Completion requires live verification against project `kruubbynsmxzxfdunaal` unless the change is explicitly left ACTIVE/BLOCKED for unavailable credentials.

#### Scenario: Credentials unavailable

- **WHEN** the execution environment cannot access the production project,
- **THEN** the agent may finish repository migration implementation but SHALL leave this change ACTIVE/BLOCKED with live apply as the exact next action.

#### Scenario: Production convergence complete

- **WHEN** live migration, RLS/grant/index checks, owner isolation, and remote-boundary smoke all pass,
- **THEN** this closure MAY be marked COMPLETED after exact-final-SHA GitHub `quality` and `e2e` also pass.
