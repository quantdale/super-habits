# Reference-Schema Drift Procedure — Disposable-Backend Lane

Applies to `simulation/backend/schema.sql`, the disposable-lane compatibility
fixture for the repository-managed Supabase migration contract. It covers the
the complete owner-scoped Backup V2 surface, including Gym V2 tables, plus
their RLS.

## Why this file exists

The full remote schema and RLS were historically maintained **only in the
Supabase dashboard**, not in this repo (audit SEC-003). The repository now owns
an additive migration series under `supabase/migrations`; this file remains a
standalone SQL payload so the guarded disposable-backend lane can provision a
throwaway project. The intended remote project has not been verified from this
workstation.
The drift procedure below makes that divergence a finding, never a quiet edit.

## Current snapshot

- Tables: the four core sync tables, Backup Completeness V2 entities,
  planning/weekly-review entities, `workout_session_sets`, and Gym V2's
  `custom_exercises`, `workout_weekly_plan`, `workout_schedule_overrides`,
  and `body_weight_entries`. The checked-in snapshot is authoritative for this
  disposable lane.
- The v12 habit contract includes `habits.rule_history`, an effective-dated
  JSON rule array containing local ISO-weekday schedules and historical daily
  targets. The live Supabase dashboard must receive this additive column before
  production backup pushes can report success.
- Column source of truth for the remote: `supabase/migrations/` and the
  checked-in validator (`npm run supabase:schema:validate`). Local shape comes
  from `core/db/client.ts` (`bootstrapStatements` + `runMigrations`) and the entity types in `core/db/types.ts`. The sync
  adapter (`core/sync/supabase.adapter.ts`) selects the full local row
  (`SELECT *`) and upserts keyed on `id`, so every local column must exist
  remotely with a compatible type.
- RLS: enabled with four explicit owner-scoped policies per table for
  `authenticated`, using `((select auth.uid()) = user_id)` and explicit
  update `USING`/`WITH CHECK`; the unauthenticated `anon` role has no backup
  CRUD grant or policy.
- Local operational tables intentionally have **no** remote counterpart:
  `linked_action_events`, `linked_action_executions`, and
  `processed_notification_actions`. Recoverable workout history, nested
  routine/session rows, body weight, custom exercises, and plan rows do have
  owner-scoped remote counterparts.

## Procedure

1. **Any discrepancy** between the dashboard tables and `schema.sql` — a
   column added/renamed/retitled, a type change, an index, an RLS policy
   change — is **filed as a finding**, per the parent change's findings
   protocol. Options:
   - If the dashboard is authoritative (someone edited it in the dashboard by
     hand), the finding is "dashboard drift" and `schema.sql` is updated to
     match as a small change with a link to the finding.
   - If `schema.sql` is ahead (it documents a change the dashboard never
     received), the finding is "out-of-repo schema" and the dashboard is
     brought in line.
   - Either way the finding names the exact diff; it is never absorbed
     silently into another change.
2. **Round-trip failures** in the disposable lane that trace to a schema
   difference (a rejected upsert, a missing column) are _also_ drift findings
   following the same rule — they are evidence the reference copy and the
   dashboard have parted ways.
3. **During maintenance**, update all of: `schema.sql`, the header's snapshot
   note, this file's current snapshot, and the relevant finding issue.
   `core/db/client.ts` is the app's authoritative local shape; a local column
   change MUST be mirrored here or the sync adapter will push rows the remote
   cannot hold.

## Repository-managed migration status

The Habit Engine V2 migration is intentionally narrow: it adds only the
`habits.rule_history` column and does not alter existing policies or rows.
Applying it to the intended project remains a separate deployment gate because
the target project and credentials must be identified first.

The remaining verification step is a read-only comparison of the linked
project's `information_schema` and RLS policies against the migration contract.
That requires credentials and is not performed by the static validator.

The repository-side portion of audit SEC-003 is closed; see the capability-gap
register (`docs/testing/known-gaps.md`) for the external verification status.

## How schema.sql is applied

- Cloud disposable lane: applied via the Supabase Management API
  (`/v1/projects/{ref}/database/query`) in `simulation/backend/provision.ts`,
  after an optional `DROP TABLE IF EXISTS` wipe on a reused project.
- Future local lane (`supabase start`): the file is valid plain Postgres SQL
  (no SQLite-only syntax) and can be applied as-is to the local stack; each
  statement is idempotent (`CREATE TABLE IF NOT EXISTS`, `GRANT`, policy DDL).
- It is **never** applied to a production project; `simulation/backend/guard.ts`
  aborts any such attempt before a network call (rules: production host,
  ambient production credentials, disposable marker).
