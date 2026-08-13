# Supabase contract

The repository-owned remote contract is the ordered SQL migration series under
`supabase/migrations/`:

- `001_initial_supabase.sql` is historical and only reserves `profiles`.
- `20260810130000_add_habits_rule_history.sql` is the existing additive Habit
  V2 migration.
- `20260814140000_sync_schema_baseline.sql` owns the four backup tables,
  client-written columns, updated-at indexes, grants, and the current
  single-user anon/authenticated RLS expectation.
- `20260814150000_ai_request_quota.sql` owns the private service-role quota
  table and atomic quota RPC used by paid AI Edge Functions.

The sync tables are intentionally still the product's existing single-user
backup model: rows do not have a `user_id`, and their current RLS policies are
permissive for `anon` and `authenticated`. This is an explicit compatibility
contract, not a claim of multi-tenant isolation. A future ownership migration
must change the client adapter and restore semantics together.

The AI quota table has RLS enabled, no client-role policies, and grants only to
`service_role`; clients cannot call or reset quota state. Edge Function secrets
(`SUPABASE_SERVICE_ROLE_KEY`, provider keys) remain server-side.

Run `npm run supabase:schema:validate` for deterministic repository-side
validation. It checks required migrations, tables, columns, indexes, RLS/policy
markers, quota function security, and explicit function JWT settings. It does
not contact or modify a remote project. Live table/policy comparison requires a
separately authenticated, read-only inspection of the linked project.
