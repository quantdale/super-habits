# Tasks: Production Schema Convergence Closure

Keep this checklist synchronized with `execplan.md`. Do not mark a task complete without repository/live evidence.

## 0. Reconcile current head

- [ ] 0.1 Fetch/prune latest `origin/main`; preserve all legitimate hardening work.
- [ ] 0.2 Confirm starting SHA and exact GitHub CI result for `2f49c0d5877ead3f419b2f5e8291b03d12871414` or newer actual head.
- [ ] 0.3 Read all authoritative files listed in `README.md` and `design.md`.
- [ ] 0.4 Run OpenSpec/ExecPlan validation before edits.

## 1. Reproduce live/client schema mismatch

- [ ] 1.1 Verify live `projects` is absent.
- [ ] 1.2 Verify live `goals` is absent.
- [ ] 1.3 Verify live `daily_plans` is absent.
- [ ] 1.4 Verify live Todos lack current planning/completion columns.
- [ ] 1.5 Verify live Habits lack current planning columns.
- [ ] 1.6 Verify live `backup_manifest` lacks `backup_scope_version`.
- [ ] 1.7 Verify pending migration `20260820000000_backup_manifest_scope_version.sql` is not yet in the live ledger.
- [ ] 1.8 Add a focused test or schema-validator proof showing the current client contract would fail against the observed pre-planning remote schema.

## 2. Resolve Habit `completed_at` contract discrepancy

- [ ] 2.1 Confirm SQLite authoritative Habit schema does not currently have `completed_at`.
- [ ] 2.2 Confirm whether any Habit domain behavior legitimately requires terminal `completed_at`.
- [ ] 2.3 Decide explicitly: remove erroneous Habit backup field OR add full local/domain semantics.
- [ ] 2.4 Update backup canonical columns/validators/tests/version compatibility consistently with the decision.
- [ ] 2.5 Preserve historical Portable V1 checksum/canonicalization compatibility.
- [ ] 2.6 Current Portable V2 round-trip remains valid after the correction.

## 3. Author additive production migration

- [ ] 3.1 Do not edit historical migration files.
- [ ] 3.2 Create one new migration after `20260820000000` for planning schema convergence.
- [ ] 3.3 Create `projects` with owner column/FK/product columns/completion/tombstone fields.
- [ ] 3.4 Create `goals` with owner column/FK/product columns/completion/tombstone fields.
- [ ] 3.5 Create `daily_plans` with owner column/FK/product columns/completion/tombstone fields.
- [ ] 3.6 Add Todo `project_id`, `goal_id`, `completed_at`.
- [ ] 3.7 Add Habit `project_id`, `goal_id` and only add `completed_at` if task 2 proves it belongs.
- [ ] 3.8 Add owner/product indexes.
- [ ] 3.9 Add owner-scoped active Daily Plan date uniqueness.
- [ ] 3.10 Add owner-safe Project/Goal relationship constraints or an equally strong proven alternative.
- [ ] 3.11 Migration is additive and preserves all existing rows.

## 4. RLS and grants

- [ ] 4.1 Enable RLS on Projects at creation.
- [ ] 4.2 Enable RLS on Goals at creation.
- [ ] 4.3 Enable RLS on Daily Plans at creation.
- [ ] 4.4 Add authenticated owner SELECT policies.
- [ ] 4.5 Add authenticated owner INSERT policies.
- [ ] 4.6 Add authenticated owner UPDATE policies with USING + WITH CHECK.
- [ ] 4.7 Add authenticated owner DELETE policies.
- [ ] 4.8 No `anon` or `PUBLIC` table privileges on the new tables.
- [ ] 4.9 Authenticated Data API grants match the existing hardened convergence model.

## 5. Schema validator hardening

- [ ] 5.1 Extend `scripts/validate-supabase-schema.mjs` for all new tables.
- [ ] 5.2 Require owner column/default/FK.
- [ ] 5.3 Require RLS and owner CRUD policies.
- [ ] 5.4 Require no anon/PUBLIC grants.
- [ ] 5.5 Require owner-scoped Daily Plan uniqueness, reject global uniqueness.
- [ ] 5.6 Require Todo/Habit current columns.
- [ ] 5.7 Require `backup_manifest.backup_scope_version`.
- [ ] 5.8 Require owner-safe planning relationships.
- [ ] 5.9 Validator passes on correct migrations and has negative coverage for at least one unsafe variant.

## 6. Repository regression before live apply

- [ ] 6.1 `npm run typecheck` PASS.
- [ ] 6.2 `npm run lint` PASS under repository warning policy.
- [ ] 6.3 Focused backup/restore/portable tests PASS.
- [ ] 6.4 Focused planning association tests PASS.
- [ ] 6.5 `npm run supabase:schema:validate` PASS.
- [ ] 6.6 `npm run openspec:validate` PASS.
- [ ] 6.7 `npm run agent:plan:validate:all` PASS.
- [ ] 6.8 `npm run e2e:sync` or current equivalent remote-boundary lane PASS against schema-compatible test environment.
- [ ] 6.9 `git diff --check` PASS.

## 7. Live production preflight

- [ ] 7.1 Read live migration ledger immediately before apply.
- [ ] 7.2 Snapshot counts/owners/null-owner counts for existing user tables.
- [ ] 7.3 Snapshot existing target table/column/index/policy/grant state.
- [ ] 7.4 Confirm no unexpected planning tables/columns appeared concurrently.
- [ ] 7.5 Confirm project ref is exactly `kruubbynsmxzxfdunaal`.
- [ ] 7.6 Record a rollback/recovery plan before DDL.

## 8. Apply live pending migrations

- [ ] 8.1 Apply repository migration `20260820000000_backup_manifest_scope_version.sql` in normal migration order.
- [ ] 8.2 Apply the new planning schema convergence migration.
- [ ] 8.3 Do not manually forge migration ledger entries.
- [ ] 8.4 If any DDL fails, stop and inspect rather than partially declaring success.

## 9. Live verification

- [ ] 9.1 Migration ledger includes both pending migrations.
- [ ] 9.2 `projects`, `goals`, `daily_plans` exist with exact required columns.
- [ ] 9.3 Todo/Habit columns match the reconciled current client contract.
- [ ] 9.4 `backup_manifest.backup_scope_version` exists.
- [ ] 9.5 Existing production row counts preserved.
- [ ] 9.6 Existing owner/null-owner invariants preserved.
- [ ] 9.7 New-table RLS is enabled.
- [ ] 9.8 New-table owner CRUD policies match required predicates.
- [ ] 9.9 No anon/PUBLIC table privileges.
- [ ] 9.10 Required indexes/constraints exist.
- [ ] 9.11 Same owner can create/read/update/delete planning rows.
- [ ] 9.12 Different owner cannot read/mutate another owner's planning rows.
- [ ] 9.13 Cross-owner Project/Goal association is rejected.
- [ ] 9.14 Same-owner association succeeds.
- [ ] 9.15 Different owners may each have an active Daily Plan for the same date.
- [ ] 9.16 Same owner cannot have two active Daily Plans for one date.
- [ ] 9.17 Soft-delete then recreate same owner/date succeeds.

## 10. Backup remote-boundary proof

- [ ] 10.1 Project upsert succeeds under owner-scoped client contract.
- [ ] 10.2 Goal upsert succeeds under owner-scoped client contract.
- [ ] 10.3 Daily Plan upsert succeeds under owner-scoped client contract.
- [ ] 10.4 Current Todo/Habit payload with planning fields succeeds.
- [ ] 10.5 Backup manifest scope 4 with `backup_scope_version` succeeds.
- [ ] 10.6 Wrong-owner payloads remain blocked.
- [ ] 10.7 Temporary test data is cleaned up safely.

## 11. Advisors and documentation

- [ ] 11.1 Run Supabase security advisors after migration and classify findings.
- [ ] 11.2 Run relevant performance advisors and classify findings.
- [ ] 11.3 Update hardening ExecPlan/task evidence to show live Supabase gate honestly completed.
- [ ] 11.4 Leave native Android/iOS gate marked ENVIRONMENT if still unavailable; do not fabricate it.
- [ ] 11.5 Update this closure ExecPlan with exact live evidence.

## 12. Final Git/CI

- [ ] 12.1 All completed work committed to `main`.
- [ ] 12.2 Working tree clean.
- [ ] 12.3 Local `main == origin/main`.
- [ ] 12.4 Remote branches: `main` only.
- [ ] 12.5 `npm run openspec:validate` PASS.
- [ ] 12.6 `npm run agent:plan:validate:all` PASS with this closure COMPLETED only after live schema verification.
- [ ] 12.7 Exact final SHA GitHub `quality` PASS.
- [ ] 12.8 Exact final SHA GitHub `e2e` PASS.

## Completion verdict

Do not mark this change COMPLETED if production Supabase still lacks the planning schema. If credentials remain unavailable, leave it ACTIVE/BLOCKED with the migration fully authored/validated and the exact next action being live apply + verification.
