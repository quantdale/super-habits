# secure-supabase-backup-row-ownership

Scope Supabase backup rows to authenticated owners with RLS, sync, restore, and adversarial isolation verification.

## Production convergence evidence — 2026-08-14

The linked `superhabits` project (`kruubbynsmxzxfdunaal`) was converged from
the repository contract without an ownership backfill. Before and after the
remote DDL, the four backup tables contained 92 todos, 13 habits, 21 calorie
entries, and 0 workout routines: 126 rows total, 9 distinct owners, zero NULL
owners, and zero orphan owners.

Migration `20260814140000_sync_schema_baseline.sql` was never executed because
its historical policy DDL was permissive. Its missing structural indexes were
added idempotently, then the supported Supabase history-only repair marked
140000 applied. Migrations 150000, 160000, and the append-only
`20260814170000_production_grant_convergence.sql` were then applied normally.
The final ledger matches the repository through 170000.

All four tables now have `user_id UUID NOT NULL DEFAULT auth.uid()`, an
`auth.users(id) ON DELETE CASCADE` foreign key, owner and updated-at indexes,
RLS, and explicit authenticated-only SELECT/INSERT/UPDATE/DELETE policies.
UPDATE includes both owner `USING` and owner `WITH CHECK`, so ownership cannot
be reassigned. Database role `anon` and PUBLIC have no backup table CRUD;
authenticated has CRUD only; service-role administration remains server-side.

Live SQL impersonation using two existing Auth users, `SET LOCAL ROLE
authenticated`, and a JWT subject setting proved symmetric owner isolation,
own-row CRUD, wrong-owner insert/update/delete/upsert denial, and anon
no-data/no-write behavior. The probe transaction was aborted and rolled back;
no canary rows remained.

`public.ai_request_quota` and its pinned-search-path SECURITY DEFINER RPC are
deployed with service-role-only table/RPC access. The current Edge Functions
were deployed from repository source with gateway `verify_jwt=true`:
`parse-ai-command` version 3 and `user-ai-ask` version 6. Retrieved deployed
source contains explicit bearer authentication, bounded bodies, durable quota
before provider calls, timeouts, and safe errors. Missing and malformed JWT
HTTP canaries returned 401 before provider work. A safe existing user JWT was
not available, so no production user was created or borrowed for a paid valid
provider canary; provider suppression remains covered by repository tests.

Security advisor warnings for direct anonymous database-role access and direct
`auth.uid()` init-plan performance warnings were addressed. The remaining
anonymous-sign-in advisor warnings reflect the product's intentional use of
anonymous Auth users receiving the `authenticated` role; leaked-password
protection is an unrelated Auth recommendation.

The required post-convergence repository gates also passed: 793 Vitest tests,
typecheck, lint, schema validation, OpenSpec validation, web/sync builds, full
E2E (153 passed / 17 expected skips), deterministic simulation (17/17), and
Expo Doctor (19/19). Native Android validation used current main source on one
API-36 x86_64 emulator: release APK build/install passed, smoke passed 1/1,
persistence passed 10/10, lifecycle passed 5/5 with the explicit E2E reminder
flag, and Habit Progress Insights passed. The ordinary release correctly does
not expose E2E-only reminder injection controls; that first attempt was
classified as an environment/configuration mismatch, not a product failure.
EAS cloud execution remains credential-required on this Windows host.
