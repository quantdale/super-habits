-- Campaign B: catalog / recovery-impact inspection only. NOT a migration.
-- Run with a separately authorized read-only SQL connection, never a password
-- on the command line: psql -X -w -v ON_ERROR_STOP=1 -f scripts/cloud-readonly-preflight.sql
-- Catalog visibility and aggregate row counts depend on the inspecting role.
-- An empty result under RLS is NOT evidence of an empty database.
-- No identities, payloads, connection strings, JWTs or Auth secrets are output.
\set ON_ERROR_STOP on
\pset pager off
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';

SELECT current_timestamp AS observed_at, current_database() AS database_name,
       current_user AS inspection_role, current_setting('server_version') AS server_version,
       current_setting('transaction_read_only') AS transaction_read_only,
       r.rolsuper, r.rolbypassrls
FROM pg_roles r WHERE r.rolname = current_user;

-- These are connection settings, NOT proof of the hosted PostgREST deployment.
SELECT current_setting('pgrst.db_schemas', true) AS connection_pgrst_schemas,
       current_setting('pgrst.db_extra_search_path', true) AS connection_pgrst_search_path;

SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS has_migration_ledger,
       to_regclass('auth.schema_migrations') IS NOT NULL AS has_auth_ledger
\gset
\if :has_migration_ledger
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;
\else
\echo 'BLOCKED: migration ledger absent; do not infer applied state from repository SQL.'
\endif
\if :has_auth_ledger
SELECT version FROM auth.schema_migrations ORDER BY version;
\else
\echo 'UNEXECUTED: Auth migration ledger absent; hosted Auth configuration still requires provider evidence.'
\endif

-- Expected current recoverable tables + synthetic settings/manifest + five
-- generation tables. Missing relations stay visible instead of disappearing.
WITH expected(name) AS (VALUES
  ('todos'), ('habits'), ('habit_completions'), ('calorie_entries'), ('saved_meals'),
  ('workout_routines'), ('routine_exercises'), ('routine_exercise_sets'),
  ('workout_logs'), ('workout_session_exercises'), ('pomodoro_sessions'),
  ('linked_action_rules'), ('weekly_reviews'), ('projects'), ('goals'), ('daily_plans'),
  ('workout_session_sets'), ('custom_exercises'), ('workout_weekly_plan'),
  ('workout_schedule_overrides'), ('body_weight_entries'), ('user_backup_settings'),
  ('backup_manifest'), ('backup_generation'), ('backup_generation_chunk'),
  ('backup_generation_head'), ('backup_generation_sequence_reservation'),
  ('backup_generation_publication')
)
SELECT e.name, c.oid IS NOT NULL AS present, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced, pg_get_userbyid(c.relowner) AS table_owner,
       has_table_privilege(current_user, c.oid, 'SELECT') AS inspector_can_select,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_can_select,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS authenticated_can_select,
       has_table_privilege('authenticated', c.oid, 'TRUNCATE') AS authenticated_can_truncate
FROM expected e LEFT JOIN pg_class c ON c.oid = to_regclass('public.' || e.name)
ORDER BY e.name;

SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;

-- Direct ACL expansion includes PUBLIC; effective privileges can also be
-- inherited through role membership, so inspect both outputs.
SELECT c.relname, CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type, a.is_grantable
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY c.relname, grantee, a.privilege_type;

SELECT c.relname, role.name AS role_name, privilege.name AS privilege_name,
       has_table_privilege(role.name, c.oid, privilege.name) AS effective_privilege
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN (VALUES ('anon'), ('authenticated'), ('service_role')) AS role(name)
CROSS JOIN (VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'),
                   ('REFERENCES'), ('TRIGGER')) AS privilege(name)
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY c.relname, role.name, privilege.name;

SELECT member.rolname AS member_role, parent.rolname AS inherited_role, m.admin_option
FROM pg_auth_members m JOIN pg_roles member ON member.oid = m.member
JOIN pg_roles parent ON parent.oid = m.roleid
WHERE member.rolname IN ('anon', 'authenticated', 'service_role', current_user)
ORDER BY member_role, inherited_role;

-- Check constraints, composite owner FKs, valid indexes and numeric precision.
SELECT c.relname, k.conname, k.contype, k.convalidated, pg_get_constraintdef(k.oid) AS definition
FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public'
ORDER BY c.relname, k.conname;
SELECT t.relname AS table_name, i.relname AS index_name, x.indisvalid, x.indisready,
       pg_get_indexdef(i.oid) AS definition
FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid JOIN pg_class t ON t.oid = x.indrelid
JOIN pg_namespace n ON n.oid = t.relnamespace WHERE n.nspname = 'public'
ORDER BY t.relname, i.relname;
SELECT table_name, column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name LIKE 'backup_generation%' OR table_name = 'backup_manifest'
       OR data_type IN ('real', 'double precision', 'numeric'))
ORDER BY table_name, ordinal_position;

-- Exact targets of 20260925125655; missing columns must not disappear.
WITH target(table_name, column_name) AS (VALUES
  ('calorie_entries', 'protein'), ('calorie_entries', 'carbs'),
  ('calorie_entries', 'fats'), ('calorie_entries', 'fiber'),
  ('saved_meals', 'protein'), ('saved_meals', 'carbs'),
  ('saved_meals', 'fats'), ('saved_meals', 'fiber'),
  ('routine_exercises', 'progression_increment'),
  ('routine_exercise_sets', 'target_load'), ('routine_exercise_sets', 'target_distance'),
  ('routine_exercise_sets', 'target_pace'), ('workout_session_sets', 'weight'),
  ('workout_session_sets', 'distance'), ('workout_session_sets', 'pace'),
  ('workout_session_sets', 'effort_value'), ('body_weight_entries', 'weight')
)
SELECT t.table_name, t.column_name, c.data_type,
       COALESCE(c.data_type = 'numeric', false) AS expected_numeric
FROM target t LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = t.table_name AND c.column_name = t.column_name
ORDER BY t.table_name, t.column_name;

-- Do not execute a publication/reservation/helper function during preflight.
-- Definition hashes allow BEFORE/AFTER comparisons without logging bodies.
SELECT p.oid::regprocedure AS function_signature, pg_get_userbyid(p.proowner) AS function_owner,
       p.prosecdef AS security_definer, p.proconfig AS function_settings,
       md5(pg_get_functiondef(p.oid)) AS definition_md5,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f'
ORDER BY p.oid::regprocedure::text;
SELECT p.oid::regprocedure AS function_signature,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type, a.is_grantable
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
WHERE n.nspname = 'public' AND p.prokind = 'f'
ORDER BY p.oid::regprocedure::text, grantee;
SELECT c.relname, t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal ORDER BY c.relname, t.tgname;

-- Capability fences: inventory presence, never call a potentially drifted RPC.
SELECT signature, to_regprocedure(signature) IS NOT NULL AS present
FROM (VALUES
  ('public.backup_generation_capabilities()'),
  ('public.reserve_backup_generation_sequence(text)'),
  ('public.reserve_backup_generation_sequence(text,text,bigint,integer)'),
  ('public.publish_backup_generation(text,bigint,integer,text)'),
  ('public.publish_backup_generation(text,bigint,integer,text,integer)'),
  ('public.backup_generation_publish_v1(text,bigint,integer,text)')
) AS expected(signature) ORDER BY signature;

-- Skip row inspection on a pre-generation remote, but never silently classify
-- a partial five-table installation as healthy.
SELECT count(*) = 5 AS has_generation_tables FROM pg_class
WHERE oid IN (
  to_regclass('public.backup_generation'), to_regclass('public.backup_generation_chunk'),
  to_regclass('public.backup_generation_head'),
  to_regclass('public.backup_generation_sequence_reservation'),
  to_regclass('public.backup_generation_publication'))
\gset
\if :has_generation_tables
-- EXACT cleanup scope of 20261020090000 before it is applied: all existing
-- reservations acquire default provenance 0 and are retired; only unpublished,
-- non-head metadata is removed, with cascading chunks. Post-migration these
-- counts are candidate history, NOT a proposal to run cleanup again.
SELECT count(*) AS reservations_visible FROM public.backup_generation_sequence_reservation;
SELECT count(*) AS staged_non_head_non_journal_generations_visible
FROM public.backup_generation g
WHERE NOT EXISTS (SELECT 1 FROM public.backup_generation_publication p
                  WHERE p.user_id = g.user_id AND p.snapshot_id = g.snapshot_id)
  AND NOT EXISTS (SELECT 1 FROM public.backup_generation_head h
                  WHERE h.user_id = g.user_id AND h.snapshot_id = g.snapshot_id);
SELECT count(*) AS staged_cascading_chunks_visible
FROM public.backup_generation_chunk c JOIN public.backup_generation g
  ON g.user_id = c.user_id AND g.snapshot_id = c.snapshot_id
WHERE NOT EXISTS (SELECT 1 FROM public.backup_generation_publication p
                  WHERE p.user_id = g.user_id AND p.snapshot_id = g.snapshot_id)
  AND NOT EXISTS (SELECT 1 FROM public.backup_generation_head h
                  WHERE h.user_id = g.user_id AND h.snapshot_id = g.snapshot_id);

-- Aggregate validation; no owner IDs, snapshot IDs, manifests or chunk bytes.
SELECT count(*) AS heads_visible,
       count(*) FILTER (WHERE g.snapshot_id IS NULL) AS missing_generation,
       count(*) FILTER (WHERE g.sequence IS DISTINCT FROM h.sequence) AS sequence_mismatch,
       count(*) FILTER (WHERE p.snapshot_id IS NULL) AS missing_publication,
       count(*) FILTER (WHERE p.sequence IS DISTINCT FROM h.sequence) AS publication_sequence_mismatch
FROM public.backup_generation_head h LEFT JOIN public.backup_generation g
  ON g.user_id = h.user_id AND g.snapshot_id = h.snapshot_id
LEFT JOIN public.backup_generation_publication p
  ON p.user_id = h.user_id AND p.snapshot_id = h.snapshot_id;
SELECT count(*) AS manifests_visible,
       count(*) FILTER (WHERE encode(sha256(convert_to(manifest, 'UTF8')), 'hex')
                             IS DISTINCT FROM manifest_checksum) AS manifest_hash_mismatch
FROM public.backup_generation;
SELECT count(*) AS chunks_visible,
       count(*) FILTER (WHERE encode(sha256(convert_to(payload, 'UTF8')), 'hex')
                             IS DISTINCT FROM checksum) AS chunk_hash_mismatch
FROM public.backup_generation_chunk;
\else
\echo 'UNEXECUTED: generation row inspection requires all five tables; inspect missing-table inventory above.'
\endif

-- This is NOT a full canonical/entity/graph validation or a restore rehearsal.
-- Never publish, repair metadata, weaken checksums or remove rows to make it pass.
ROLLBACK;
