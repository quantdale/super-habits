# Tasks — Backup V2 closure defects

## 1. Planning and baseline

- [x] 1.1 ExecPlan `.agent/execplans/backup-completeness-v2-closure.md` written and validated (`agent:plan:validate`).
- [x] 1.2 OpenSpec closure change written and validated (`openspec:validate`).
- [x] 1.3 Baseline QA: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run qa:integration`, `npm run supabase:schema:validate`, `npm run openspec:validate`, `npm run agent:plan:validate:all`, `git diff --check` — record in ExecPlan Validation Ledger.

## 2. Finding 1 — saved-meal uniqueness

- [x] 2.1 Reproduce the cross-owner conflict (owner A and owner B both save "Chicken Breast") against the current remote contract in a safe/rollback context.
- [x] 2.2 Confirm local semantic is case-insensitive (`food_name COLLATE NOCASE` upsert) and record the decision.
- [x] 2.3 Additive remedial migration: drop `saved_meals_food_name_unique`; `CREATE UNIQUE INDEX uq_saved_meals_owner_food_name ON saved_meals (user_id, lower(food_name))`; add `backup_manifest.settings_metadata JSONB`.
- [x] 2.4 Update `simulation/backend/schema.sql` fixture to mirror both changes.
- [x] 2.5 Verify client sync upsert semantics (`onConflict: 'id'`) stay consistent with owner-scoped uniqueness (same owner upsert, case variation, hard-delete/recreate, cross-owner).
- [x] 2.6 Security test: A and B may both store "Chicken Breast"; neither can read/update/delete/upsert the other's row; RLS is the boundary.

## 3. Finding 2 — checkpoint coherence

- [x] 3.1 Write the deterministic regression test first (mutation injected at the old final-check gap; stale publication/dirty-clear must be impossible).
- [x] 3.2 Rewrite `runBackupMaintenance` capture to one `withSQLiteTransaction`: outbox recheck → dirty verify → snapshot → outbox recheck → settings capture → pending manifest/settings → enqueue settings+manifest → clear dirty → commit; no network inside.
- [x] 3.3 Add internal test hooks (`beforeCapture` outside, `afterSnapshot` inside with direct-SQL mutation simulation) for the deterministic race matrix.
- [x] 3.4 Race tests A–H: mutation during flush; mutation at old final-check gap; mutation after manifest transaction commit; manifest push failure (previous-good survival); crash after intent commit before push; crash after push before lastComplete marker; idle no-loop.
- [x] 3.5 Verify dirty semantics: never cleared over a newer uncheckpointed mutation; pending manifest durable; last complete generation recorded only after confirmed push.

## 4. Finding 3 — settings restore atomicity

- [x] 4.1 `fetchRemoteRecoverableSettings(ownerUserId)` fetched BEFORE the restore transaction; every `{ error }` is a restore failure.
- [x] 4.2 Settings row presence/version/runtime validation + canonical checksum vs manifest `settings_metadata` before any write; v2 manifest without settings integrity → incomplete.
- [x] 4.3 Remove the network call from the restore import transaction; assert no-network via test seam.
- [x] 4.4 Settings generation binding: `backup.pending_settings` snapshot at enqueue/capture; adapter pushes from snapshot; manifest push verifies checksum and uploads settings before manifest.
- [x] 4.5 Durable cross-store theme recovery: `backup.pending_theme_apply` staged in the import transaction; `applyPendingThemeApplication()` after commit; retry on bootstrap until cleared.
- [x] 4.6 Settings failure matrix tests: valid; missing row; query error (`{data:null, error:{...}}`); malformed; checksum mismatch; unsupported version; theme-apply failure + restart retry; settings mutated during generation.
- [x] 4.7 `getBackupStateSummary`/UX: never report V2 COMPLETE for a manifest without settings integrity; wording reflects last checkpoint published.

## 5. Validator and tests

- [x] 5.1 Extend `scripts/validate-supabase-schema.mjs` (owner-scoped saved-meal uniqueness required; global food_name uniqueness forbidden; settings_metadata present; fixture mirrors; RLS unchanged).
- [x] 5.2 Unit tests: settings canonicalization vectors; manifest parsing with settings metadata; settings version compatibility.
- [x] 5.3 Integration tests: checkpoint race matrix; restore failure matrix; semantic equivalence with settings integrity; cross-owner saved meals.
- [x] 5.4 Web E2E: settings remote error blocks restore; settings checksum mismatch; V2 restore completes with settings; new-phone-v2 journey green.
- [x] 5.5 Simulation: LONG-TERM USER disaster recovery covers settings integrity.

## 6. QA, deployment, closure

- [x] 6.1 Full headless QA (§52 list: typecheck, lint, test, qa:fast, qa:integration, qa:timezones, validate:themes, supabase:schema:validate, openspec:validate, qa:impact:validate, agent:plan:validate:all, build:web, build:sync, e2e:sync, e2e:full, qa:simulation deterministic, expo-doctor, npm audit, git diff --check).
- [x] 6.2 Live remedial migration apply + read-only verification (ledger, saved_meals constraints/indexes, settings_metadata, RLS/grants unchanged, row counts preserved, advisors).
- [x] 6.3 Android regression (Nitro_API_36; serial Maestro: backup-v2 settings status, smoke, persistence, V2 restore path).
- [x] 6.4 Docs updates (V2 design/spec, ExecPlan, durable docs; record the six closure contracts).
- [ ] 6.5 Coherent commits → push main (no force) → verify local == origin/main, main-only remote → GitHub CI quality + e2e PASS → complete ExecPlan → final report (mission §63).
