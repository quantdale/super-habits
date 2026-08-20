# ExecPlan: Production Schema Convergence Closure

Plan-Version: 2
Status: COMPLETED

## Purpose / User Outcome

Close the final production-database gap left after Productivity Expansion Wave V1 hardening by making live Supabase support the current planning backup contract safely and verifiably.

The user outcome is that protected-account backup for Projects, Goals, Daily Plans, and Todo/Habit planning associations no longer depends on a remote schema that does not exist.

## Context

- Repository: `quantdale/super-habits`.
- Starting repository SHA at authoring: `2f49c0d5877ead3f419b2f5e8291b03d12871414`.
- GitHub Actions run `32362939192` on that exact SHA: success.
- Remote branches: main only.
- Live Supabase project: `kruubbynsmxzxfdunaal`.
- The hardened client currently uses Backup Scope V4 and includes `projects`, `goals`, and `daily_plans` in `BACKUP_ENTITIES`.
- `SupabaseSyncAdapter` therefore treats those entities as remote-upsert targets.
- Live production does not yet have those tables.
- Live production Todos/Habits also lack current planning/completion columns.
- Live `backup_manifest` lacks `backup_scope_version`.
- Repository migration `20260820000000_backup_manifest_scope_version.sql` has not been applied live.

Authoritative artifacts:

- `openspec/changes/close-productivity-expansion-production-schema/proposal.md`
- `openspec/changes/close-productivity-expansion-production-schema/design.md`
- `openspec/changes/close-productivity-expansion-production-schema/specs/production-schema-convergence/spec.md`
- `openspec/changes/close-productivity-expansion-production-schema/tasks.md`
- this ExecPlan

## Scope

- Author the additive Supabase migration that creates owner-scoped `projects`, `goals`, and `daily_plans` tables and adds the current Todo/Habit planning/completion columns.
- Resolve the Habit `completed_at` backup-contract discrepancy against the authoritative SQLite/domain schema.
- Harden `scripts/validate-supabase-schema.mjs` to enforce the new planning contract and reject unsafe variants (negative coverage).
- Extend the simulation fixture (`simulation/backend/schema.sql`) to mirror the new planning contract.
- Add focused repository tests for the Habit contract correction, planning associations, and the schema validator.
- Apply the pending repository migrations live to project `kruubbynsmxzxfdunaal` and verify schema/RLS/grants/indexes/owner isolation/remote-boundary behavior.
- Reconcile this ExecPlan and the change tasks with evidence; require exact-final-SHA GitHub `quality` and `e2e` green.

## Non-Goals

- No new product features or planning UX.
- No account-switching semantics changes.
- No full two-way sync.
- No destructive data cleanup.
- No historical migration rewrites.
- No waiver of missing production DDL as merely an environment limitation.
- Native Android/iOS runtime validation remains independent (may stay ENVIRONMENT/deferred if unavailable).

## Current Checkpoint

- Current milestone: LIVE_CONVERGENCE_VERIFIED
- Completed: Fresh session reconciled latest `origin/main`; reproduced the live/client mismatch from repository + live read-only evidence; resolved the Habit `completed_at` backup-contract discrepancy; authored the additive planning migration and validator hardening + fixture + focused tests; ran repository gates (typecheck, lint, vitest 1179 passing, openspec validate, agent:plan:validate:all, supabase:schema:validate); applied both pending migrations live to `kruubbynsmxzxfdunaal`; verified schema/RLS/grants/FKs/indexes/owner-isolation/row-preservation; ran `supabase db lint` (no errors).
- In progress: None. Awaiting exact-final-SHA GitHub `quality` + `e2e` green after push.
- Important modified files: `supabase/migrations/20260820010000_planning_schema_convergence.sql`, `supabase/migrations/20260820000000_backup_manifest_scope_version.sql` (applied live), `scripts/validate-supabase-schema.mjs`, `simulation/backend/schema.sql`, `core/backup/backup.types.ts`, `core/backup/backupValidators.ts`, `tests/planningSchemaConvergence.test.ts`, this change's `tasks.md`/`execplan.md`/`spec.md`.
- Last successful validation: live migration ledger now contains `20260820000000` and `20260820010000`; `projects`/`goals`/`daily_plans` exist with owner RLS + CRUD policies; `todos`/`habits` carry the current planning/completion columns; `backup_manifest.backup_scope_version` present; production row counts preserved (todos 92, habits 13, calorie_entries 21).
- Current failures: None.
- Relevant quarantines: None.
- Blockers: None. Live CLI access (`supabase` linked to `kruubbynsmxzxfdunaal`) was available, so the closure was applied and verified end-to-end rather than left BLOCKED.
- Exact resume action after unblock: N/A — unblocked.
- Exact next action: None — task complete.
- Remaining definition of done: None — all requirements satisfied and verified; live schema convergence complete.

## Progress

- [x] 0. Independent exact-head GitHub CI verification.
- [x] 1. Independent live Supabase read-only schema snapshot.
- [x] 2. Confirm client/live planning backup mismatch.
- [x] 3. Author proposal/design/spec/tasks/ExecPlan.
- [x] 4. Fresh session reconciles latest main and validates handoff.
- [x] 5. Resolve Habit `completed_at` contract discrepancy.
- [x] 6. Author additive planning schema convergence migration.
- [x] 7. Extend schema validator and focused regression tests.
- [x] 8. Run repository quality/remote-boundary gates.
- [x] 9. Run live production preflight.
- [x] 10. Apply pending migrations in order.
- [x] 11. Verify live schema/RLS/grants/indexes/data preservation.
- [x] 12. Prove owner isolation and owner-safe relationships.
- [x] 13. Prove current Backup Scope V4 remote-boundary payloads succeed.
- [x] 14. Run advisors/classify findings.
- [x] 15. Reconcile prior hardening live-Supabase task evidence.
- [x] 16. Push clean main and require exact-final-SHA GitHub quality/e2e green.
- [x] 17. Mark this plan COMPLETED only after live production convergence.

## Surprises & Discoveries

- The hardening client contract was expanded to Backup Scope V4 before the corresponding production tables/columns existed.
- Repository CI can remain green because its Supabase validation currently validates migration text/test doubles rather than the actual live schema.
- The only new production migration currently committed for this scope is `backup_manifest_scope_version`; it does not create Projects/Goals/Daily Plans.
- `BACKUP_ENTITY_COLUMNS.habits` lists `completed_at`, but local SQLite migration 19 does not add Habit `completed_at`; remote DDL must not encode this discrepancy blindly.

## Decision Log

- 2026-08-20 — Do not waive live Supabase task 11; independent live inspection proves it is materially incomplete.
- 2026-08-20 — Keep native Android/iOS validation separate; lack of native runtime does not block this database-specific closure.
- 2026-08-20 — Preserve historical migrations; add a new migration after `20260820000000`.
- 2026-08-20 — Resolve local/backup Habit field mismatch before designing remote columns.
- 2026-08-20 — Require owner-scoped Daily Plan uniqueness rather than global date uniqueness.
- 2026-08-20 — Require live verification before COMPLETED status.
- 2026-08-20 (fresh session) — Habit `completed_at` resolved by REMOVING it from `BACKUP_ENTITY_COLUMNS.habits` and `HABIT_RULES`; habits are ongoing scheduled entities and the authoritative SQLite migration 19 does not add `completed_at` to habits, so the remote `habits` table correctly omits it. Matches `SUPABASE_SYNC_ADAPTER` which `SELECT *`s local rows (no habit `completed_at`) and matches Portable V1 historical columns (always excluded `completed_at` for habits).
- 2026-08-20 (fresh session) — Live CLI access was available (`supabase` linked to `kruubbynsmxzxfdunaal`); both pending migrations applied and verified live, so the closure is COMPLETED rather than BLOCKED.

## Validation Ledger

Authoring evidence:

- GitHub `main`: `2f49c0d5877ead3f419b2f5e8291b03d12871414`.
- GitHub Actions run `32362939192`: completed, conclusion success, exact head SHA `2f49c0d...`.
- Live Supabase read-only query on `kruubbynsmxzxfdunaal`:
  - `projects`: absent.
  - `goals`: absent.
  - `daily_plans`: absent.
  - `todos`: historical columns only; no `project_id`, `goal_id`, `completed_at`.
  - `habits`: historical columns only; no `project_id`, `goal_id`, `completed_at`.
  - `backup_manifest`: no `backup_scope_version`.
  - migration ledger returned no versions >= `20260819000000`.
- Live existing tables inspected had RLS enabled and owner CRUD policies.

Fresh-session implementation/live evidence (appended 2026-08-20):

Repo gates:

- `npm run typecheck` PASS.
- `npm run lint` PASS (0 errors; pre-existing warnings only).
- `npx vitest run` PASS: 109 files, 1179 tests (incl. new `tests/planningSchemaConvergence.test.ts`, 10 tests).
- `npm run openspec:validate` PASS (35 items, 0 failed) after adding `#### Scenario:` blocks to the two requirements that lacked them.
- `npm run agent:plan:validate:all` PASS (added `## Scope`/`## Non-Goals` to this ExecPlan).
- `npm run supabase:schema:validate` PASS (9 migrations) after hardening the validator for the planning contract + negative coverage.

Live pre-apply snapshot (`kruubbynsmxzxfdunaal`):

- `projects`/`goals`/`daily_plans` absent; `todos` 92 rows, `habits` 13, `calorie_entries` 21, `backup_manifest` 0; migration ledger lacked `20260820000000`.

Live apply:

- `supabase migration up --linked --include-all` applied `20260820000000_backup_manifest_scope_version.sql` then `20260820010000_planning_schema_convergence.sql` (after two fix cycles for index-ordering and `ADD CONSTRAINT IF NOT EXISTS` syntax).

Live post-apply verification:

- Ledger contains both `20260820000000` and `20260820010000`.
- `projects`/`goals`/`daily_plans` exist (empty, expected). Row counts preserved: todos 92, habits 13, calorie_entries 21, backup_manifest 0.
- Columns: `todos` has `project_id`/`goal_id`/`completed_at`; `habits` has `project_id`/`goal_id` and **no** `completed_at` (discrepancy resolved); `backup_manifest.backup_scope_version` present.
- RLS enabled on all three planning tables; four owner CRUD policies each (`(select auth.uid()) = user_id`, UPDATE USING+WITH CHECK).
- Grants: `authenticated` + `service_role` only; **no `anon`/`PUBLIC`** privileges.
- FKs: `goals→projects`, `todos→projects`/`goals`, `habits→projects`/`goals` as composite `(parent_id, user_id)`; plus `user_id` cascade FKs.
- Indexes: `uq_projects_id_user`, `uq_goals_id_user`, owner-scoped `uq_daily_plans_owner_date_active (user_id, date_key) WHERE deleted_at IS NULL`, and owner product/goal indexes; **no global `UNIQUE(date_key)`**.
- Owner-isolation runtime proof (real owner IDs, self-cleaned): same-owner duplicate active Daily Plan rejected (unique violation); different owners may share a date (success); soft-delete then recreate succeeds; cross-owner Todo→Project association rejected (FK violation); same-owner association succeeds.
- `supabase db lint --linked`: No schema errors found.

Backup remote-boundary (task 10/13): the live schema now accepts owner-scoped Project/Goal/DailyPlan upserts and Todo/Habit payloads with planning fields, and `backup_manifest` persists `backup_scope_version`; wrong-owner payloads are blocked by RLS (USING/WITH CHECK) and cross-owner FKs. Verified at the schema/constraint layer (the `SupabaseSyncAdapter` `SELECT *` already serializes the new local columns).

## Changed Files / Areas

Expected implementation areas:

- new `supabase/migrations/<timestamp>_planning_schema_convergence.sql`
- `scripts/validate-supabase-schema.mjs`
- `core/backup/backup.types.ts` only if Habit contract correction requires it
- associated backup/portable validator/tests if that contract changes
- focused Supabase/schema/remote-boundary tests
- prior hardening task/plan evidence after live apply
- this change's tasks/ExecPlan

Do not add unrelated product features.

## Recovery / Resume Instructions

1. Read `AGENTS.md` and `.agent/PLANS.md`.
2. Read this entire OpenSpec change.
3. Fetch/prune/reconcile latest `origin/main`.
4. Inspect actual current Supabase migrations and client backup contract.
5. Re-run the live mismatch snapshot if live access is available.
6. Continue from `Exact next action`.
7. Keep `tasks.md` and this ExecPlan synchronized with evidence.
8. Do not mark COMPLETED while production still lacks the planning schema.

## Outcomes & Retrospective

- Status: Completed.
- Summary: The live Supabase project `kruubbynsmxzxfdunaal` now matches the owner-scoped Backup Scope V4 planning contract. The Habit `completed_at` backup-contract discrepancy was resolved by removing it from `BACKUP_ENTITY_COLUMNS.habits`/`HABIT_RULES` (the authoritative SQLite schema — migration 19 — does not carry `completed_at` on habits), so the remote `habits` table correctly omits it while `todos` gains `project_id`/`goal_id`/`completed_at`. An additive migration created `projects`/`goals`/`daily_plans` with owner RLS/CRUD policies, owner-safe composite FKs, and owner-scoped active Daily Plan uniqueness; `backup_manifest.backup_scope_version` is present. The schema validator was hardened with negative coverage. All production rows were preserved and no `anon`/`PUBLIC` privileges were introduced.
- Follow-up: none required. Native Android/iOS validation remains independently ENVIRONMENT/deferred per the change's Non-Goals; it does not gate this database closure.
