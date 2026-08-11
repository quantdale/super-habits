# Reference-Schema Drift Procedure — Disposable-Backend Lane

Applies to `simulation/backend/schema.sql`, the MANUALLY MAINTAINED COPY of
the Supabase dashboard configuration for the four synced tables
(`todos`, `habits`, `calorie_entries`, `workout_routines`) plus their RLS.

## Why this file exists

The full remote schema and RLS were historically maintained **only in the
Supabase dashboard**, not in this repo (audit SEC-003). `schema.sql` remains a
checked-in reference copy so the disposable-backend lane can provision
throwaway projects — and so that a divergence between the dashboard and the
repo is _visible_ instead of silent. Habit Engine V2 now also has an additive,
repository-managed migration at
`supabase/migrations/20260810130000_add_habits_rule_history.sql`; the intended
remote project has not been verified from this workstation.
The drift procedure below makes that divergence a finding, never a quiet edit.

## Current snapshot

- Tables: `todos`, `habits`, `calorie_entries`, `workout_routines`.
- The v12 habit contract includes `habits.rule_history`, an effective-dated
  JSON rule array containing local ISO-weekday schedules and historical daily
  targets. The live Supabase dashboard must receive this additive column before
  production backup pushes can report success.
- Column source of truth: `core/db/client.ts` (`bootstrapStatements` +
  `runMigrations`) and the entity types in `core/db/types.ts`. The sync
  adapter (`core/sync/supabase.adapter.ts`) selects the full local row
  (`SELECT *`) and upserts keyed on `id`, so every local column must exist
  remotely with a compatible type.
- RLS: enabled permissive for `anon` (and `authenticated`) with
  `USING (true) WITH CHECK (true)` — the app is single-user and anonymous
  (design D8: isolation comes from the disposable project + guard, not RLS).
- Non-synced tables intentionally have **no** remote counterpart:
  `habit_completions`, `pomodoro_sessions`, `saved_meals`, `workout_logs`,
  `routine_exercises`, `routine_exercise_sets`, `workout_session_exercises`,
  `linked_action_*`.

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

The remaining infrastructure follow-up is to move the complete Supabase
schema **into version control** so the dashboard is derived from (and
reconciled against) a committed definition instead of the reverse.

Recommended shape: Supabase-managed migrations (a `supabase/migrations/*.sql`
convention applied by `supabase db push` in CI against a staging project, or a
local `supabase start` stack) — `schema.sql` is already written as plain
Postgres SQL so it can be staged into that convention with minimal change. The
follow-up change owns: migration scaffolding, a "dashboard drift detector"
(compare the live remote `information_schema` against the committed schema and
fail/label on mismatch), and retiring this manual-copy header once the remote
is provably derived from the repo.

Closes audit SEC-003; see the capability-gap register
(`docs/testing/known-gaps.md`, "manually maintained reference schema").

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
