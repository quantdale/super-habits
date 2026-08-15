# Tasks — Backup Completeness V2

## 1. Planning and baseline

- [x] 1.1 ExecPlan + OpenSpec change written (this change) and validated (`openspec:validate`, `agent:plan:validate`).
- [x] 1.2 Baseline QA: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run qa:fast`, `npm run qa:integration`, `npm run supabase:schema:validate`, `npm run openspec:validate`, `npm run agent:plan:validate:all`, `npm run build:web`, `npm run build:sync`, `git diff --check` — record exact results in the ExecPlan Validation Ledger.
- [x] 1.3 Complete persistence inventory and classification matrix (deliverable in ExecPlan/final report).

## 2. Remote schema and validator

- [x] 2.1 Add additive Supabase migration for the 8 new domain tables + `user_backup_settings` + `backup_manifest` with the hardened owner-scoped RLS contract, TEXT timestamps, owner indexes, FKs (NO ACTION), and unique constraints for `habit_completions`/`saved_meals`.
- [x] 2.2 Extend `scripts/validate-supabase-schema.mjs` for every new table (owner column, RLS, 4 owner policies, anon/PUBLIC denial, indexes, grants, no `USING (true)` post fence).
- [x] 2.3 Extend `simulation/backend/schema.sql` fixture to mirror the new remote tables.
- [x] 2.4 Run `supabase:schema:validate` and (if safe, after local green) prepare live deployment steps.

## 3. Sync engine and adapter expansion

- [x] 3.1 Expand `SYNCABLE_ENTITIES`/restore-scope constants with the full recoverable entity set.
- [x] 3.2 Extend `SupabaseSyncAdapter`: hard-delete entities → owner-scoped remote DELETE for `delete` records; synthetic `user_backup_settings` (push-time allowlisted snapshot) and `backup_manifest` (push-time stored pending manifest) payload builders.
- [x] 3.3 Add `lib/checksum.ts` pure-TS SHA-256 + canonical row serializer (fixed column order, sorted keys, id-sorted rows) with known-vector tests.
- [x] 3.4 Add `core/backup/backup.types.ts` (entities, settings contract, manifest types, backup-state union) and app_meta keys (owner `sync`): `backup.scope_version`, `backup.backfill_status`, `backup.backfill_done_entities`, `backup.pending_manifest`, `backup.last_complete_generation`, `backup.settings_dirty`.
- [x] 3.5 Adversarial tests: cross-entity partial failure, hard-delete remote DELETE, owner mismatch refusal, unknown entity refusal.

## 4. Feature instrumentation + import functions

- [x] 4.1 Convert backup-scoped local-only writes to transactional enqueue: `habit_completions` (increment/decrement/notification/linked paths), `pomodoro_sessions`, `workout_logs` + `workout_session_exercises`, `saved_meals` (incl. delete), `linked_action_rules` (create/update/status/delete/replace).
- [x] 4.2 Settings save paths enqueue the `user_backup_settings` record (calorie goal, pomodoro settings, theme mode/slots).
- [x] 4.3 Add `applyRemote*` import functions: habit completions, pomodoro sessions, routine exercises, routine exercise sets, workout logs, workout session exercises, saved meals, linked action rules (plain INSERT OR REPLACE, no side effects, no use-count increments).

## 5. Backfill

- [x] 5.1 `core/backup/backupBackfill.ts`: owner-gated, chunked, idempotent, restart-safe enqueue of all existing rows (incl. tombstones) + settings record.
- [x] 5.2 Integrate into the bootstrap maintenance cycle; add integration tests (fresh upgrade, restart-resume, idempotency, no-owner wait, tombstones).

## 6. Checkpoint / manifest

- [x] 6.1 `core/backup/backupCheckpoint.ts`: maintenance cycle — backfill → flush → recheck → snapshot (counts + checksums + settings) → pending manifest → enqueue manifest → flush → record generation; race-safe publication; previous-good survival.
- [x] 6.2 Integration tests: coherent checkpoint, mutation-during-snapshot abort, failed publication keeps previous manifest, no infinite queue loop, large-history performance.

## 7. Restore V2

- [x] 7.1 `core/backup/backupRestore.ts`: manifest fetch/version gate → prefetch all rows (pagination) → runtime validators → integrity verification → dependency graph → complete emptiness guard → single transaction import → settings apply → post-commit reminder reconciliation.
- [x] 7.2 V1 legacy detection/fallback preserved; `RestorePreview` extended with backup states and recoverable areas.
- [x] 7.3 Integration tests: full restore equivalence (habits insights, focus/workout/calorie summaries, saved meals, settings), rollback on corruption/malformed rows/checksum, race blocked (todos AND pomodoro), offline fetch failure, large-history restore.

## 8. Security tests

- [x] 8.1 Cross-user isolation (read/insert/update/delete/upsert), anon denial, owner forging, malformed payloads, settings `user_id` immutability, manifest ownership.

## 9. UX

- [x] 9.1 `SettingsBackupSection` backup-state UI (`V2 COMPLETE`, `V1 LEGACY/PARTIAL`, `BACKUP IN PROGRESS`, `BACKUP INVALID`, `UNAVAILABLE`, last complete backup, recoverable areas, pending count).
- [x] 9.2 Startup restore prompt text updated for V2 scope; backfill-in-progress disclosure.

## 10. E2E and simulation

- [x] 10.1 New-phone V2 journey: source device with full state → backup complete → fresh device → recover → restore → semantic equivalence → no side-effect replay.
- [x] 10.2 Corrupt-backup blocked, restore-race blocked, backfill-in-progress UI, legacy V1 UI, history continuity journeys/specs.
- [x] 10.3 LONG-TERM USER simulation persona + disaster-recovery scenario (6–12 months state, restore, continue usage, no duplicate automation).
- [x] 10.4 Command Center Ask regression after restore (habit_progress, calorie_summary, workout_summary, focus_summary, daily_overview).

## 11. Full QA and closure

- [ ] 11.1 Full headless QA (mission §89 list), `npx expo-doctor`, `npm audit` (no `--force`), `git diff --check`.
- [x] 11.2 Live Supabase migration apply + read-only verification (ledger, tables, RLS, grants, indexes, FKs, existing V1 row/owner counts unchanged, advisors).
- [ ] 11.3 Android native QA (Nitro_API_36) or record BLOCKED/ENVIRONMENT with evidence.
- [ ] 11.4 Docs updates (backup scope, exclusions, checkpoint semantics, V1 legacy, Restore V2, security).
- [ ] 11.5 Commit coherently → push main (no force) → verify local == origin/main and main-only remote → inspect GitHub CI (quality + e2e PASS) → complete ExecPlan → final 31-section report.
