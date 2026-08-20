# ExecPlan: Production Schema Convergence Closure

Plan-Version: 2
Status: ACTIVE

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

## Current Checkpoint

- Current milestone: HANDOFF_AUTHORED_LIVE_GAP_CONFIRMED
- Completed: Independent GitHub verification of exact-head green CI; independent read-only live Supabase inspection proving Projects/Goals/Daily Plans absent, current planning columns absent, and backup scope version migration unapplied.
- In progress: None. Fresh execution session must implement the repository migration and, when credentials are available, apply/verify it live.
- Important modified files: None yet in implementation; this change is spec-only at authoring.
- Last successful validation: GitHub Actions run `32362939192` on `2f49c0d...` concluded success.
- Current failures: Production schema is incompatible with current planning backup/sync contract.
- Relevant quarantines: None.
- Blockers: Live credentials may be unavailable inside the CLI environment. That is acceptable only as a reason to leave this closure ACTIVE/BLOCKED after repository migration implementation; it is not acceptable as evidence that production is converged.
- Condition required to unblock: Access to live Supabase project `kruubbynsmxzxfdunaal` through authenticated CLI/MCP/dashboard tooling.
- Exact resume action after unblock: Run the live preflight snapshot, apply pending repository migrations in order, then verify schema/RLS/grants/indexes/owner isolation/remote-boundary behavior.
- Exact next action: Fetch latest main, reproduce the live/client schema mismatch from repository/live evidence, and resolve the Habit `completed_at` contract discrepancy before authoring the new migration.
- Remaining definition of done: Complete all repository migration/schema-validator work; live migration and verification; reconcile hardening evidence; clean main-only Git; exact-final-SHA quality/e2e green.

## Progress

- [x] 0. Independent exact-head GitHub CI verification.
- [x] 1. Independent live Supabase read-only schema snapshot.
- [x] 2. Confirm client/live planning backup mismatch.
- [x] 3. Author proposal/design/spec/tasks/ExecPlan.
- [ ] 4. Fresh session reconciles latest main and validates handoff.
- [ ] 5. Resolve Habit `completed_at` contract discrepancy.
- [ ] 6. Author additive planning schema convergence migration.
- [ ] 7. Extend schema validator and focused regression tests.
- [ ] 8. Run repository quality/remote-boundary gates.
- [ ] 9. Run live production preflight.
- [ ] 10. Apply pending migrations in order.
- [ ] 11. Verify live schema/RLS/grants/indexes/data preservation.
- [ ] 12. Prove owner isolation and owner-safe relationships.
- [ ] 13. Prove current Backup Scope V4 remote-boundary payloads succeed.
- [ ] 14. Run advisors/classify findings.
- [ ] 15. Reconcile prior hardening live-Supabase task evidence.
- [ ] 16. Push clean main and require exact-final-SHA GitHub quality/e2e green.
- [ ] 17. Mark this plan COMPLETED only after live production convergence.

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

Fresh-session implementation/live evidence must be appended here. Do not invent results.

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

Not yet complete. Populate only with verified repository migration, live production apply, owner/RLS proof, row preservation, and exact-final-SHA CI evidence.
