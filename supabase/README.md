# Supabase contract

The repository-owned remote contract is the ordered SQL migration series under
`supabase/migrations/`:

- `001_initial_supabase.sql` is historical and only reserves `profiles`.
- `20260810130000_add_habits_rule_history.sql` is the existing additive Habit
  V2 migration.
- `20260814140000_sync_schema_baseline.sql` owns the four backup tables,
  client-written columns, and updated-at indexes. Its historical permissive
  policies are superseded by the append-only ownership migration below.
- `20260814150000_ai_request_quota.sql` owns the private service-role quota
  table and atomic quota RPC used by paid AI Edge Functions.
- `20260814160000_secure_sync_row_ownership.sql` adds UUID Auth ownership,
  owner indexes/foreign keys, removes all prior policies and anonymous table
  grants, and creates explicit owner-scoped authenticated CRUD policies for
  every synchronized table.

The final sync contract is per-user backup isolation. Every owned row in
`todos`, `habits`, `calorie_entries`, and `workout_routines` carries a
`user_id UUID`, and normal access requires `(select auth.uid()) = user_id`.
Signed-in anonymous Auth users use the `authenticated` role and are scoped by
their Auth UID; the unauthenticated PostgreSQL `anon` role has no backup CRUD.
The global text `id` primary key remains the conflict target because app IDs
are generated globally and RLS blocks cross-owner conflicts.

The client stores the enqueue-time owner in the local durable `sync_outbox`
(SQLite migration 15), derives the push payload owner from the current
verified Auth user, and refuses to rebind pending intents across sessions.
Restore metadata and rows are explicitly filtered by the same owner. This is
still push/backup/restore, not full symmetric multi-device synchronization.

The linked production project was inspected read-only on 2026-08-14. It
already has non-null owner columns and all observed rows map to existing Auth
users, but its migration history is behind this repository and its table ACLs
still grant `anon`; no live migration is claimed by this repository change
until the deployment safety gate is satisfied.

The AI quota table has RLS enabled, no client-role policies, and grants only to
`service_role`; clients cannot call or reset quota state. Edge Function secrets
(`SUPABASE_SERVICE_ROLE_KEY`, provider keys) remain server-side.

Run `npm run supabase:schema:validate` for deterministic repository-side
validation. It checks required migrations, owner columns/indexes/foreign keys,
RLS operation predicates, grants, anonymous-role denial, quota function
security, client service-role exclusion, and explicit function JWT settings.
It does not contact or modify a remote project. Live table/policy comparison
requires a separately authenticated, read-only inspection of the linked
project.
