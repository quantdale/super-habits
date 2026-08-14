# ExecPlan: Live Supabase production convergence

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Converge the linked `superhabits` Supabase project (`kruubbynsmxzxfdunaal`)
onto the repository's hardened backup-ownership, RLS, grants, AI quota, and
Edge Function contract without exposing backup rows or losing data. Produce
live SQL/security evidence, complete safe headless/native verification, and
finish with the validated result committed and pushed to `origin/main`.

## Context

- Canonical repository: `C:/Users/Michael Roy/Documents/super-habits`.
- Main-only delivery policy: work on local `main`; no temporary branch, force
  push, reset, table drop, truncate, or production data rewrite.
- Local SQLite is authoritative; Supabase is push backup plus restore-v1, not
  full symmetric synchronization.
- Synced backup tables: `todos`, `habits`, `calorie_entries`, and
  `workout_routines`.
- Repository ownership contract: `user_id UUID`, owner indexes/FKs, RLS with
  explicit `TO authenticated` operation policies using `(select auth.uid())`,
  no anon/PUBLIC backup CRUD, and explicit UPDATE `WITH CHECK`.
- Relevant repository artifacts: `supabase/migrations/`,
  `supabase/config.toml`, `supabase/functions/`, `scripts/validate-supabase-schema.mjs`,
  `core/sync/`, restore code, AI security tests, and
  `openspec/changes/secure-supabase-backup-row-ownership/`.
- Production changes use the authenticated Supabase connector/SQL path only
  after current read-only evidence and a documented rollback/recovery plan.

## Scope

- Verify current Git, repository QA, Supabase CLI/docs, project identity, live
  schema/RLS/grants/ownership, migration ledger, quota objects, functions, and
  advisors.
- Select and execute a zero-regression migration-history/schema convergence
  strategy; apply secure owner RLS/grants and quota objects only when proven
  safe.
- Prove production two-user and anon isolation transactionally with rollback,
  preserve all existing owners/rows, deploy and verify current AI functions,
  rerun sync/restore regressions, and record advisor results.
- Run required headless QA, diagnose/build current-main Android release and run
  serialized native QA when the environment permits.
- Update focused OpenSpec/ExecPlan evidence, commit on `main`, push, verify
  main-only remote topology and actual GitHub CI for the final SHA.

## Non-Goals

- No blanket ownership backfill, user-data rewrite, destructive reset, or
  temporary permissive policy.
- No unrelated auth-product changes merely to clear leaked-password guidance.
- No paid-provider quota burn beyond the least-expensive safe canary.
- No claim of live proof from repository static tests, database-owner results,
  stale deployed artifacts, unavailable native infrastructure, or skipped CI.

## Starting Git State

- Worktree: `C:/Users/Michael Roy/Documents/super-habits` on `main`.
- `HEAD`: `60d141e2154cac736e894b28fec4c6f039ca2c3c`.
- `main`: `60d141e2154cac736e894b28fec4c6f039ca2c3c`.
- `origin/main`: `60d141e2154cac736e894b28fec4c6f039ca2c3c`.
- `git ls-remote --heads origin`: `refs/heads/main` only.
- Worktree is clean; `git fetch origin --prune` completed without movement.
- Recent tip: `docs: close Supabase ownership hardening plan`.

## Starting GitHub Main SHA

`60d141e2154cac736e894b28fec4c6f039ca2c3c` (verified locally and against
`origin` at plan creation).

## Starting Supabase State

Read-only snapshot refreshed on 2026-08-14 before any production mutation:

- Project `superhabits`, ref `kruubbynsmxzxfdunaal`, region `ap-northeast-1`.
- Status `ACTIVE_HEALTHY`; PostgreSQL `17.6.1.104` / engine 17.
- Auth has 634 users, all 634 anonymous and zero non-anonymous users.
- Exact SQL counts are `todos=92`, `habits=13`, `calorie_entries=21`,
  `workout_routines=0`, total `126` rows.
- All 126 rows have non-NULL owners; all 9 distinct owner IDs resolve to
  existing `auth.users` rows. No ownership backfill is required or permitted.
- `auth.uid()` reads `request.jwt.claim.sub` first and the `sub` field from
  `request.jwt.claims` as fallback.

## Current Migration Ledger

Live ledger from `supabase migration list --linked` and the Supabase API:
`20260810130000 add_habits_rule_history` only. Repository additionally contains
`20260814140000_sync_schema_baseline`, `20260814150000_ai_request_quota`, and
`20260814160000_secure_sync_row_ownership`. A dry-run `db push --linked` confirms
that naïvely pushing would attempt all three missing files, including the
historically permissive 140000 baseline.

## Live Schema Matrix

| Table              | `user_id` | Nullability/default     | Owner FK | Owner indexes | RLS     |
| ------------------ | --------- | ----------------------- | -------- | ------------- | ------- |
| `todos`            | UUID      | NOT NULL / `auth.uid()` | absent   | absent        | enabled |
| `habits`           | UUID      | NOT NULL / `auth.uid()` | absent   | absent        | enabled |
| `calorie_entries`  | UUID      | NOT NULL / `auth.uid()` | absent   | absent        | enabled |
| `workout_routines` | UUID      | NOT NULL / `auth.uid()` | absent   | absent        | enabled |

The baseline's four `updated_at` indexes were also absent. Primary keys are the
existing `id` columns (`todos_pkey`, `habits_pkey`, `calorie_entries_pkey`, and
`workout_routines_pkey`).

## Live RLS Matrix

| Table              | SELECT                                           | INSERT                         | UPDATE                         | DELETE      |
| ------------------ | ------------------------------------------------ | ------------------------------ | ------------------------------ | ----------- |
| `todos`            | `FOR ALL TO public USING (auth.uid() = user_id)` | same policy; no explicit check | same policy; no explicit check | same policy |
| `habits`           | `FOR ALL TO public USING (auth.uid() = user_id)` | same policy; no explicit check | same policy; no explicit check | same policy |
| `calorie_entries`  | `FOR ALL TO public USING (auth.uid() = user_id)` | same policy; no explicit check | same policy; no explicit check | same policy |
| `workout_routines` | `FOR ALL TO public USING (auth.uid() = user_id)` | same policy; no explicit check | same policy; no explicit check | same policy |

Each table had exactly one policy (`Manage own ...`) and RLS was enabled, with
`force_row_security=false`.

## Live Grants

The exact pre-mutation table ACL was the same for all four backup tables:

- `anon`: `DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE,
UPDATE`.
- `authenticated`: the same eight privileges.
- `service_role`: the same eight administrative privileges.
- `PUBLIC`: no explicit table ACL entry; the `public` schema had PUBLIC USAGE.

The final convergence must remove all table privileges from `anon` and PUBLIC,
reduce `authenticated` to SELECT/INSERT/UPDATE/DELETE, and retain only the
reviewed server-side administrative access required for `service_role`.

## Existing Row Counts

Pre-mutation exact SQL evidence: `todos=92`, `habits=13`,
`calorie_entries=21`, `workout_routines=0`, total `126`. Active (not soft
deleted) rows were `88`, `13`, `21`, and `0`, respectively, total `122`.

## Existing Ownership Counts

Pre-mutation exact SQL evidence: distinct owners across the four tables `9`,
NULL owners `0`, orphan owners `0`. Per-table owners were `7`, `3`, `2`, and
`0` for todos, habits, calorie entries, and workout routines. Owner distribution
was recorded by redacted/hash labels only; no Auth UUID list is committed.

## Existing Edge Function Versions / Hashes

Pre-deployment metadata: `parse-ai-command` version `2`, active,
`verify_jwt=true`, hash
`4ccd221f00094b6f8dffa887da2779aae43895d6739a9fb25704e0a0769bf6e5`; and
`user-ai-ask` version `5`, active, `verify_jwt=true`, hash
`d4cd24c5716d0ca83690ce4873a194a3834099538a7967201b54364e53037fc5`.
Both deployed sources were stale and lacked the current explicit Auth/quota
gate. Their source paths were temporary deployment paths, not this checkout.

## Current AI Quota Objects

Pre-mutation SQL evidence: `public.ai_request_quota` did not exist;
`public.consume_ai_request_quota(uuid,text,integer,integer)` did not exist; no
quota indexes, policies, or quota ACLs were present.

## Migration-Convergence Decision

Selected zero-regression path: **safe structural completion, history repair,
then normal forward application**.

1. Do not run 140000. Its live table/column/RLS structural intent is already
   present, but its four `updated_at` indexes are not. Add only those missing
   indexes directly with idempotent `CREATE INDEX IF NOT EXISTS`; this cannot
   expose rows or modify ownership/data.
2. Use the current CLI's documented `supabase migration repair --linked
--status applied 20260814140000` to mark only 140000 as satisfied. The
   command updates migration history and does not execute migration SQL.
3. Apply 150000 and 160000 with `supabase db push --linked`; the former creates
   private quota objects, and the latter adds owner FKs/indexes and atomically
   replaces the old owner-filtered PUBLIC policy with explicit authenticated
   policies. Neither stage has global row access.
4. Add and apply a new 170000 grant-convergence migration that makes the
   existing broad ACL drift explicit and reduces authenticated to CRUD while
   preserving server-side `service_role` administration. It is idempotent and
   contains no policies or global predicates.

This is safe because 140000 is never executed, the pre-existing policy was
owner-filtered rather than global, and each mutation is either index-only,
history-only, private quota DDL, or secure ownership/grant DDL. The missing
140000 indexes are added before history repair and then represented again by
the new repository migration, so the repository and final live schema remain
auditable without falsifying an unsatisfied structural effect.

## Production Mutation Checklist

- [x] Current official Supabase docs/changelog and CLI help captured.
- [x] Complete pre-mutation snapshot recorded and ownership invariants match.
- [x] Recovery/rollback path reviewed; no broad policy fallback.
- [x] Migration strategy proven not to expose backup rows globally.
- [x] Secure schema/RLS/grants applied and verified.
- [x] Quota table/RPC applied and verified service-role-only.
- [x] Current Edge Functions deployed directly from main and verified.
- [x] Row-preservation and rolled-back adversarial tests completed.
- [x] Advisors rerun and findings classified.

## Pre-Mutation Evidence

Captured before any production write on 2026-08-14: project identity/status,
PostgreSQL version, Auth population, complete migration ledger, four table
columns/defaults/nullability, primary keys, constraints, indexes, RLS state and
policies, table ACLs for anon/authenticated/service_role/PUBLIC, per-table and
aggregate row/owner/NULL/orphan counts, redacted owner distribution, quota
absence, Edge Function versions/hashes/source drift, `auth.uid()` behavior,
security advisors, performance advisors, current CLI help, and `db push
--dry-run`. No production write had occurred at this checkpoint.

## Post-Mutation Evidence

After 20260814150000/160000/170000 on 2026-08-14:

- Migration ledger is exactly 10130000, 140000, 150000, 160000, 170000; local
  and remote entries match.
- All four tables retain `user_id UUID NOT NULL DEFAULT auth.uid()` and now
  have `FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE`,
  their primary key on `id`, `updated_at` indexes, and `user_id` indexes.
- RLS is enabled on all four; force RLS is false. Each table has exactly four
  `authenticated` policies: SELECT/DELETE USING and INSERT/UPDATE WITH CHECK,
  with UPDATE having both USING and WITH CHECK; every predicate is
  `((select auth.uid()) = user_id)`. No anon/PUBLIC policy remains.
- Table ACLs are identical by table: authenticated has only
  SELECT/INSERT/UPDATE/DELETE; anon and PUBLIC have no table privileges;
  service_role retains administrative table privileges.
- Ownership evidence remains `126` total, `9` distinct owners, `0` NULL, and
  `0` orphan owners; per-table totals remain 92/13/21/0.
- `public.ai_request_quota` exists with RLS enabled and its primary key on
  `(user_id, request_class)`. It has no anon/authenticated/PUBLIC table access;
  service_role has the intended server-side table access.
- `public.consume_ai_request_quota(uuid,text,integer,integer)` is SECURITY
  DEFINER with `search_path=public`; EXECUTE is present for service_role and
  absent for PUBLIC/anon/authenticated.
- The db push emitted only a Docker catalog-cache warning after applying all
  three migrations; remote application completed successfully.

## Real RLS Adversarial Test Ledger

2026-08-14 live SQL proof on `public.todos`, using two existing Auth users
represented only as A/B:

- Began an explicit transaction, inserted uniquely prefixed A/B canaries as
  the setup owner, then switched to `SET LOCAL ROLE authenticated` and set
  `request.jwt.claim.sub` for A and B. `auth.uid()` matched each subject.
- A and B each read, updated, tombstoned, deleted, and inserted their own row.
  Each saw zero rows for the other owner, updated/deleted zero other-owner
  rows, received denial for a wrong-owner insert, received denial for changing
  `user_id`, and received denial for an upsert against the other owner's ID.
- Switched with `RESET ROLE; SET LOCAL ROLE anon`; anon saw zero rows and all
  insert/update/delete attempts were denied or affected zero rows.
- The probe deliberately aborted after serializing its result, causing the
  entire transaction to roll back. Independent post-probe SQL found zero
  `rls_probe_20260814_*` rows (A prefix 0, B prefix 0).
- This is faithful role/policy proof, not a database-owner result. The same
  exact policy contract is present on all four synced tables.

## AI Deployment Test Ledger

2026-08-14:

- Deployed current checkout source directly with `supabase functions deploy
... --use-api`; shared `_shared/aiSecurity.js` was uploaded with both
  functions.
- Live metadata/source proof: `parse-ai-command` version 3,
  `verify_jwt=true`, hash `7a5ab9d2...e3c87d`; `user-ai-ask` version 6,
  `verify_jwt=true`, hash `6e8ab8c3...12b84d`. Both are ACTIVE and include the
  current bearer verification, bounded body, quota-before-provider, timeout,
  and safe-error markers. Prior versions were 2/5 with different hashes.
- Live HTTP canaries against both functions: no Authorization returned gateway
  401 `UNAUTHORIZED_NO_AUTH_HEADER`; malformed bearer returned gateway 401
  `UNAUTHORIZED_INVALID_JWT_FORMAT`. These prove rejection before provider
  invocation.
- Live quota RPC transaction using service_role: first call at limit 1 was
  allowed with remaining 0; second call was denied with a positive retry
  interval; intentional rollback left zero probe rows.
- Live quota boundary transactions: anon and authenticated both received
  denial for direct table access and RPC execution.
- No safe user JWT/session exists in the checkout or environment. No temporary
  production Auth user was created and no existing user's token was borrowed.
  Therefore a valid authenticated Edge Function HTTP canary and production
  provider-suppression telemetry are intentionally not claimed. Provider
  suppression remains proven by the 8 repository AI-security tests, which pass;
  this is clearly separated from live HTTP evidence.

The full deployed hashes are `7a5ab9d2b0d49ef4fb7572afae892ff9160b62541ecb1cea44ce01271fe3c87d`
for `parse-ai-command` and
`6e8ab8c33ce2359f8764f552f2ac5b4b72ae6ec765ee4d433fa62da82512b84d` for
`user-ai-ask`. The retrieved source marker check was positive for explicit
bearer extraction/user verification, bounded JSON body reads, durable quota
calls before provider invocation, timeout handling, auth/quota provider
suppression, service-role server-side access, and safe error responses.

## Supabase Advisor Results

Before: security had four WARN anonymous-policy findings on the four backup
tables plus leaked-password protection; performance had four WARN direct
`auth.uid()` init-plan findings. After: the direct init-plan findings are gone;
performance reports only INFO unused-index notices for the newly required
indexes. Security reports no anon table ACLs, but still reports four
`auth_allow_anonymous_sign_ins` WARNs because all 634 product Auth identities
are anonymous and the correct owner policies target the `authenticated` role,
plus the unrelated leaked-password WARN. This is an advisor/product-config
classification, not permission to weaken the explicit authenticated RLS
contract or disable anonymous sign-in. Quota's RLS-with-no-policy is an INFO
that intentionally reflects its service-role-only design.

## Android Closure Ledger

The prior redbox was a debug-variant mismatch: the installed APK was
`DEBUGGABLE` and had no embedded JS bundle, so it expected Metro. The normal
release build below embeds `assets/index.android.bundle`, has no debuggable
flag, and starts without Metro.

- Source SHA for both artifacts: `60d141e2154cac736e894b28fec4c6f039ca2c3c`
  (application source was unchanged by this session's migration/docs work).
- Normal release: `app:assembleRelease`, x86_64/API 36, 6m57s, PASS;
  APK SHA-256 `07942099E34388FCEADE06743A9BBB634A08CC6BE32396D479578ED3652A318B`;
  package `com.dale16.superhabits`, version `1.0.0`, installed on
  `emulator-5554`, non-debuggable.
- E2E-configured release: same release variant with the repository's
  `EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST=true` profile flag, 5m55s, PASS; APK
  SHA-256 `4F7505FE971DF9568818A342560F9D9752260D6CF98E48D6C08CAB97E2277B3D`;
  embedded bundle, non-debuggable, installed on the same single emulator.
- Native smoke: PASS, 1/1.
- Native persistence: PASS, 10/10 (Todos, Habits, Calories, Workout,
  Settings, schedule, reminder persistence/isolation/disable/permission).
- First lifecycle run on the normal release correctly classified the three
  reminder-injection failures as configuration/ENVIRONMENT evidence because
  those controls are E2E-only; Pomodoro and notification scheduling passed.
- Lifecycle rerun on the E2E-configured release: PASS, 5/5, including reminder
  delivery, Mark Complete, Snooze, exactly-once replay, and Pomodoro flows.
- Habit Progress Insights dedicated flow: PASS.
- EAS CLI is unavailable on this Windows host; cloud execution is
  `CREDENTIAL_REQUIRED`, not fabricated as green. iOS remains unavailable on
  Windows (`xcrun`/simulator not present).
- A final live count query after all native runs remained `126` total,
  `todos=92`, `habits=13`, `calorie_entries=21`, `workout_routines=0`, `9`
  owners, `0` NULL, `0` orphan, and zero `codex_`/`native_` canary rows.

## Full Headless QA

After live convergence, the required headless lanes passed:

- `npm ci` — PASS, 1,138 packages; npm reported 16 known transitive
  vulnerabilities (6 moderate, 10 high).
- `npm run typecheck` — PASS, zero errors.
- `npm run lint` — PASS, zero errors/warnings.
- `npm test` — PASS, 79 files / 793 tests.
- `npm run qa:fast` — PASS; unit 62 files / 702 tests plus typecheck/lint.
- `npm run qa:integration` — PASS, 17 files / 91 tests.
- `npm run qa:timezones` — PASS in all five configured timezones, 42 tests
  each.
- `npm run validate:themes` — PASS, 140 contrast checks.
- `npm run supabase:schema:validate` — PASS.
- `npm run openspec:validate` — PASS, 23/23.
- `npm run qa:impact:validate` — PASS, 12 rules.
- `npm run agent:plan:validate:all` — PASS.
- `npm run build:web` — PASS.
- `npm run build:sync` — PASS; dummy Supabase URL, no real credentials.
- `npm run e2e:sync` — PASS 15 / SKIP 4, 19 total; skips are the documented
  dummy-backend remote-restore boundary.
- `npm run e2e:full` — PASS 153 / SKIP 17, 170 total.
- `npm run qa:simulation -- --all --mode deterministic` — PASS, 17/17.
- `npx expo-doctor` — PASS, 19/19.
- `npm audit` and `npm audit --omit=dev` — both report the same 16 known
  transitive advisories; `npm audit fix --force` would downgrade Expo and was
  not run.
- `git diff --check` — PASS.

## GitHub CI Ledger

Final push run `31774559677` for `95fb1dc4d17bc38ab8baf2d01671d4cc134b536f`
completed successfully. `quality` job `94687208382` passed; `e2e` job
`94687464158` passed, including full E2E, deterministic scenarios, and the
dummy-credential `dist-sync` lane; `nightly` job `94687464674` was skipped as
expected for a normal push. No repository-caused CI failure or fix cycle was
required.

## Rollback / Recovery Notes

- Capture row/owner counts and policy/grant definitions before every remote
  write phase.
- Prefer transaction-contained DDL or a direct secure convergence migration;
  never restore `USING (true)` or disable RLS as an incident response.
- If a policy issue appears, restore the prior owner-filtered policy only via a
  reviewed additive correction, retaining owner predicates and explicit role
  targeting. Do not drop owner columns/FKs/indexes or rewrite rows.
- Quota/function rollback is by restoring the previous server-side deployment
  or applying a reviewed safe correction; never expose service-role material.

## Decision Log

- 2026-08-14 — Stay on `main` — mandatory user policy requires local and remote
  final state on `main` with no force push.
- 2026-08-14 — No ownership backfill — historical evidence reports all 126
  rows already owned and mapped, but the current snapshot must re-prove it.
- 2026-08-14 — No naive sequential migration replay — the repository baseline
  contains obsolete permissive policies and must not be externally observable.
- 2026-08-14 — Repair 140000 only after structural completion — the live
  schema already has its tables/columns but lacks the four baseline indexes;
  add those indexes idempotently first, then use history-only repair so the
  obsolete policy DDL is never run.
- 2026-08-14 — Add 170000 grant convergence — live ACLs retain MAINTAIN,
  REFERENCES, TRIGGER, and TRUNCATE for authenticated; repository contract
  requires authenticated CRUD only, so an append-only safe follow-up is
  required.
- 2026-08-14 — Index completion and history repair — all four missing
  `updated_at` indexes were created idempotently; row/owner evidence remained
  unchanged. Supported CLI repair marked only 140000 applied without executing
  its SQL, and `db push --dry-run` now lists only 150000, 160000, and 170000.

## Surprises & Discoveries

- Exact live counts match the historical invariant (126 rows, 9 owners, zero
  NULL/orphan owners), but the four 140000 `updated_at` indexes are missing.
- The live owner-filtered policy uses `TO public` and direct `auth.uid()` with
  no explicit UPDATE check; this is not global row access, but it is not the
  repository contract.
- The live table ACL includes maintenance-level privileges for authenticated,
  which the existing 160000 migration does not revoke; this requires the new
  grant-convergence follow-up.
- Current `auth.uid()` supports both `request.jwt.claim.sub` and the JWT claims
  JSON fallback, enabling a faithful transactional impersonation probe.

## Current Checkpoint

- Current milestone: Live Supabase convergence, AI deployment, headless QA,
  Android validation, repository delivery, and final GitHub CI are complete.
- Completed: Read `AGENTS.md`, `.agent/PLANS.md`, repository workflow/rules,
  Supabase skill, relevant data/sync guidance, existing ownership ExecPlans,
  and focused OpenSpec artifacts. Confirmed clean `main`, one worktree,
  `origin/main` at `60d141e...`, and only remote branch `main`.
- In progress: None — the campaign and all required transport verification are
  complete.
- Completed: Deployed and retrieved current Edge Function versions/source;
  completed live no-auth/malformed-auth and quota-boundary checks, with the
  valid-user/provider canary explicitly unclaimed because no safe JWT exists.
- Important modified files: This ExecPlan and
  `supabase/migrations/20260814170000_production_grant_convergence.sql`; no
  production backup rows were changed.
- Last successful validation: headless suite, deterministic simulations,
  current-source Android release install, smoke, persistence, lifecycle, and
  Insights all passed as recorded above; final live ownership counts remain
  unchanged.
- Current failures: No unresolved product failure. The first `npm ci` attempt
  hit an EPERM from an existing repo Expo process, which was stopped and the
  retry passed. Parallel CLI help briefly contended on the shared Supabase
  telemetry file; serial retries passed. The first native lifecycle run used a
  normal release without the intentional E2E reminder flag; the rerun with the
  repository e2e-test flag passed 5/5.
- Relevant quarantines: Historical live migration drift, stale AI deployment,
  and Android tooling/build limitations require fresh verification.
- Blockers: EAS cloud credentials/CLI and a safe existing authenticated JWT are
  unavailable; these limit cloud iOS/EAS and valid-user paid-provider proof but
  do not block the completed safe convergence.
- Condition required to unblock: Provide authorized EAS credentials and/or a
  disposable authenticated test session if those optional live lanes are
  required.
- Exact next action: None — task complete. Preserve the final main-only remote
  state and the recorded optional external-lane limitations.
- Remaining definition of done: Complete and validated. Live security/data/AI
  convergence is proven or explicitly bounded with evidence; repository docs
  and plan are updated; final main is pushed and equal to origin/main; actual
  GitHub CI is green for the final transport commit; Android is accurately
  classified.

## Progress

- [x] Read durable repository, Supabase, data/sync, and OpenSpec guidance.
- [x] Capture starting Git state and verify main-only topology.
- [x] Create this Plan-Version 2 ExecPlan.
- [x] Validate plan and run repository baseline QA.
- [x] Verify current Supabase docs/CLI and complete read-only production snapshot.
- [x] Decide and document safe migration-history convergence.
- [x] Apply and verify secure live schema/RLS/grants/quota, if safe.
- [x] Deploy and verify current Edge Functions and safe live AI security.
- [x] Run live RLS, sync/restore, advisors, and row-preservation proof.
- [x] Run full headless QA and Android closure attempts.
- [x] Update OpenSpec/docs, commit, push main, inspect GitHub CI.
- [x] Complete and validate this ExecPlan.

## Validation Ledger

- 2026-08-14 — Required guidance reads — PASS — repository, plan protocol,
  Supabase skill, data/sync guidance, existing plans, and focused OpenSpec
  artifacts read.
- 2026-08-14 — Git topology/fetch/remote-head inspection — PASS — clean local
  `main`, one worktree, local/remote SHA `60d141e2154cac736e894b28fec4c6f039ca2c3c`,
  remote branches contain only `main`.
- 2026-08-14 — ExecPlan structural validation — PASS — this Plan-Version 2
  plan is structurally valid and ACTIVE.
- 2026-08-14 — `npm ci` — PASS — 1,138 packages installed and repository
  postinstall patches applied; 16 known transitive advisories reported.
- 2026-08-14 — `npm run typecheck` — PASS — zero TypeScript errors.
- 2026-08-14 — `npm run lint` — PASS — zero ESLint errors/warnings under the
  repository warning threshold.
- 2026-08-14 — `npm test` — PASS — 79 test files, 793 tests.
- 2026-08-14 — `npm run supabase:schema:validate` — PASS — four owner-scoped
  sync tables, five migration files, and private AI quota RPC contract.
- 2026-08-14 — `npm run openspec:validate` — PASS — 23/23 artifacts.
- 2026-08-14 — `npm run agent:plan:validate:all` — PASS — all versioned plans.
- 2026-08-14 — `git diff --check` — PASS — no whitespace errors.
- 2026-08-14 — Supabase official docs/changelog and CLI help — PASS — current
  docs confirm migration repair is history-only, `db push` ordering/dry-run,
  `verify_jwt` default/defense-in-depth, explicit RLS role targeting, and
  `(select auth.uid())` init-plan guidance; local CLI is `2.113.0`.
- 2026-08-14 — Pre-convergence index phase and migration repair — PASS — all
  four `updated_at` indexes present; 140000 repaired as applied with the
  supported history-only command; dry-run enumerates only safe 150000/160000/
  170000 application.
- 2026-08-14 — Live schema/RLS/grant/quota post-DDL snapshot — PASS — all
  expected owner columns, FKs, indexes, exact authenticated policies, least
  privilege backup ACLs, private quota objects, and unchanged ownership counts
  verified. Edge Functions not yet redeployed; live adversarial proof pending.
- 2026-08-14 — Live transactional RLS adversarial proof — PASS — A/B
  authenticated isolation, owner-preserving UPDATE checks, own CRUD, anon
  no-data/no-write behavior, intentional transaction rollback, and zero
  remaining canary rows verified.
- 2026-08-14 — Edge deployment and AI live checks — PASS/PARTIAL — current
  source deployed as versions 3/6 with `verify_jwt=true`; missing/malformed JWT
  HTTP rejection, service-role-only quota RPC behavior, direct anon/authenticated
  quota denial, and deployed-source markers verified. A valid user JWT/provider
  suppression HTTP canary was not claimed because no safe token was available;
  repository provider-suppression tests pass.
- 2026-08-14 — Post-convergence advisors and final live data snapshot — PASS/
  CLASSIFIED — direct `auth.uid()` warnings disappeared; only intentional
  anonymous-Auth/leaked-password security warnings and INFO unused-index/quota
  notices remain. Counts stayed 126/9/0/0 with no canaries after native QA.
- 2026-08-14 — Full headless QA — PASS/PARTIAL — all required build, unit,
  integration, timezone, web/E2E, simulation, schema, OpenSpec, and Expo Doctor
  gates passed; npm audit remains at 16 known transitive advisories.
- 2026-08-14 — Android release/native closure — PASS/PARTIAL — normal and
  E2E-configured release APKs built and installed; smoke 1/1, persistence 10/10,
  lifecycle 5/5, and Insights passed. EAS cloud is CREDENTIAL_REQUIRED and
  iOS is unavailable on Windows.
- 2026-08-14 — Final Git transport and GitHub CI — PASS — commit `95fb1dc`
  pushed normally to `origin/main`; local and remote SHA matched, remote heads
  contained only `main`, worktree was clean, and GitHub run `31774559677`
  passed both `quality` and `e2e` with `nightly` skipped.

## Changed Files / Areas

- `.agent/execplans/live-supabase-production-convergence.md` — task-specific
  durable state, evidence ledgers, recovery notes, and final definition of done.
- `supabase/` — only if a safe repository migration/convergence documentation
  change is required after live evidence.
- `openspec/changes/secure-supabase-backup-row-ownership/` — deployment
  evidence update or focused convergence delta as repository conventions
  require.
- Android/QA artifacts — only if a genuinely repository-owned fix is proven.

## Recovery / Resume Instructions

1. Read `AGENTS.md`, `.agent/PLANS.md`, this ExecPlan, and the focused
   ownership/AI OpenSpec artifacts completely.
2. Run `git status --short`, `git diff --stat`, `git diff --name-only`, and
   `npm run agent:resume -- --plan
.agent/execplans/live-supabase-production-convergence.md`.
3. Reconcile the checkpoint with Git and fresh live evidence; Git and live
   queries win over stale narrative.
4. Keep all production queries/mutations authenticated, minimally scoped, and
   recorded in this plan; never replay `140000` blindly.
5. Before completion, run affected/full required gates, validate the plan,
   commit on `main`, push normally, verify SHA equality/remote branches, and
   inspect actual GitHub CI for the final SHA.

## Outcomes & Retrospective

- Status: Completed.
- Summary: Production schema/RLS/grants/quota convergence, migration-history
  reconciliation, current AI Edge Function deployment, live transactional
  isolation proof, headless QA, and local Android closure are complete.
- Evidence: The live ledgers above record pre/post row preservation,
  authenticated A/B and anon policy proof, exact migration/function metadata,
  advisor classification, full QA, and serialized native reports.
- Remaining work: None for the required campaign. EAS/iOS and valid-user
  paid-provider HTTP proof remain optional external lanes requiring credentials
  or an authorized disposable session.
- Follow-up: EAS/iOS and valid-user paid-provider HTTP proof remain optional
  external lanes requiring credentials or an authorized disposable session.
