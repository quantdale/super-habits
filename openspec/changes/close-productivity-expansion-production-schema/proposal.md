# Proposal: Close Productivity Expansion Production Schema Gap

## Why

Productivity Expansion Wave V1 is locally hardened and repository CI is green, but the production Supabase schema still reflects the pre-planning backup contract.

The hardened client now treats `projects`, `goals`, and `daily_plans` as `BACKUP_ENTITIES`, includes planning/completion fields in current backup canonical columns, and the sync adapter will attempt to upsert those entities remotely. Production currently lacks those tables and several expected columns. This creates a real deployment mismatch: a protected user with planning data can accumulate outbox records that cannot be uploaded successfully.

This change closes only that mismatch.

## Current independently observed state

Repository head at authoring:

`2f49c0d5877ead3f419b2f5e8291b03d12871414`

GitHub Actions:

run `32362939192` — success on that exact SHA.

Live Supabase project:

`kruubbynsmxzxfdunaal`

Observed live schema:

- `projects` absent.
- `goals` absent.
- `daily_plans` absent.
- `todos` has the historical columns only and lacks `project_id`, `goal_id`, `completed_at`.
- `habits` has the historical columns only and lacks `project_id`, `goal_id`.
- `backup_manifest` lacks `backup_scope_version`.
- the repository migration `20260820000000_backup_manifest_scope_version.sql` is not present in the live migration ledger.

## Goal

Make the live Supabase schema exactly support the current owner-scoped Backup Scope V4 contract without data loss, weakened RLS, or historical-backup compatibility regressions.

## Required outcomes

1. Add an additive repository migration for current planning backup entities and required existing-table columns.
2. Keep existing historical migrations immutable.
3. Preserve all existing production rows and owners.
4. Create owner-scoped `projects`, `goals`, and `daily_plans` remote tables with correct defaults, constraints, indexes, RLS, grants, and owner-safe relationships.
5. Add the current Todo/Habit planning/completion columns only after reconciling them against the authoritative SQLite/domain/backup contract.
6. Apply all pending production migrations only after repository validation and explicit operational safety checks.
7. Verify the production migration ledger, schema, RLS, grants, indexes, owner isolation, row preservation, and current-client remote-boundary behavior.
8. Finish with exact-final-SHA GitHub `quality` and `e2e` green.

## Explicit non-goals

- No new product features.
- No new planning UX.
- No changes to account-switching semantics.
- No full two-way sync.
- No destructive data cleanup.
- No historical migration rewrites.
- No waiver of missing production DDL as merely an environment limitation.
- Native Android/iOS runtime validation remains independent from this database closure.

## Important contract question to resolve first

`BACKUP_ENTITY_COLUMNS.habits` currently includes `completed_at`, while local SQLite migration 19 adds `completed_at` to Todos, Projects, Goals, and Daily Plans but not Habits.

Before authoring the remote migration, determine the intended authoritative contract:

- If Habit `completed_at` is erroneous/unneeded, remove it from the current backup contract and update validators/checksums/tests/version compatibility deliberately.
- If Habit `completed_at` is genuinely required, add it to the local authoritative schema and domain semantics first, with migration/tests, then include it remotely.

Do not create a remote-only column merely to make the current constant compile.
