## 1. Backup coverage and restore honesty

- [x] 1.1 Reframe `probeV2TablesPresent` in `core/backup/backupRestore.ts` as a three-valued capability probe that distinguishes a transport failure from a well-formed "tables absent" answer
- [x] 1.2 Change `isMissingV2RemoteTableError` handling at `core/backup/backupRestore.ts:410-428` so an empty or unrecognized error message yields an indeterminate result rather than `status: 'legacy'`
- [x] 1.3 Add an indeterminate state to `BackupCoverageState` (`core/backup/backupRestore.ts:171`) and to `BackupStateSummary.state`, and stop collapsing every manifest-fetch failure in the `catch` at `:786-804` to `v1_legacy`
- [x] 1.4 Add the indeterminate copy to `describeBackupCoverage()` in `features/settings/SettingsBackupSection.tsx:43-67`
- [x] 1.5 Render `missingEntities` in the Settings backup section so a partial-scope manifest discloses its omitted entity groups instead of claiming a verified complete backup
- [x] 1.6 Add per-entity restored counts to the V2 restore success path in `features/settings/SettingsScreen.tsx:204-226`, mirroring the portable-import report already shown from `SettingsPortableSection.tsx`
- [x] 1.7 Add integration coverage for the empty-message classification and for a transient manifest failure under an existing V2 manifest

## 2. Terminal outbox classification

- [x] 2.1 Add a durable per-outbox-record attempt counter that survives restarts
- [x] 2.2 Define the distinguishable persistent-failure classes (missing remote table or column, permanently rejected record, missing local row) and keep every transient failure on the existing backoff schedule in `core/sync/sync.engine.ts:77-83`
- [x] 2.3 Add a `blocked` backup coverage state with copy that names the blocked entity and the reason, distinct from `in_progress`
- [x] 2.4 Exclude records in the terminal `blocked` state from the durable-outbox gate in `core/backup/backupCheckpoint.ts:183,:194,:232,:244,:246` so an un-pushable record no longer freezes the checkpoint forever
- [x] 2.5 Add integration coverage for each persistent-failure class and for a transient failure that must never reach the terminal state

## 3. Remote write verification

- [x] 3.1 Add a read-back of the just-written ids filtered to the current user after `upsertEntityRows` in `core/sync/supabase.adapter.ts:182-223`
- [x] 3.2 Surface a zero-rows-affected or missing-read-back outcome as a per-entity push failure that leaves the outbox record queued, through the existing `SyncPushPartialFailureError` path
- [x] 3.3 Add a unit test that a conflicting foreign row produces a push failure for that entity and does not drop the outbox record
- [x] 3.4 Record the added request count per flush and confirm the hot path stays within the existing round-trip profile

## 4. Ownership-scoped uniqueness and non-vacuous checks

- [x] 4.1 Refactor the `saved_meals` and `daily_plans` uniqueness assertions in `scripts/validate-supabase-schema.mjs:286-311` into an explicit table of `{ table, ownerColumns, remediation }` entries
- [x] 4.2 Add `habit_completions` to that table, covering the global constraint declared at `supabase/migrations/20260815100000_add_backup_completeness_v2.sql:45` and mirrored at `simulation/backend/schema.sql:164`
- [x] 4.3 Replace the `ownerIds` derivation in `getRemoteFingerprint` (`core/auth/accountCoordinator.ts:89-124`) with a bounded query returning the distinct remote `user_id` values, so the `remote_foreign_owner` branch at `:429-436` is reachable
- [x] 4.4 Add unit coverage that a foreign remote owner pauses the backup and records a protection failure
- [x] 4.5 Close the unprimed-owner-cache hole in `resolveSyncOwnerUserId()` (`core/sync/syncedMutation.ts:32-55`) so the pristine-dataset check runs on every path, and add coverage for the unprimed-cache-plus-data case
- [x] 4.6 Add coverage for the cached-session-versus-verified-user divergence case, which every current integration test mocks to the same value

## 5. Migration and remote-projection integrity

- [x] 5.1 Make a non-numeric or missing `db_schema_version` on a populated database fail loudly in `core/db/client.ts:141-142` instead of synthesizing version 0
- [x] 5.2 Add an `addedSortOrder`-style guard to the block-6 `sort_order` backfill at `core/db/client.ts:170-183`, following the pattern migration 24 already uses
- [x] 5.3 Assert the migration chain landed on the expected maximum schema version after `runMigrations` completes
- [x] 5.4 Add a guard that every column in `BACKUP_ENTITY_COLUMNS` is declared by the repository's remote migration SQL for that entity, mirroring `tests/integration/backupCanonicalColumns.test.ts`
- [x] 5.5 Add migration integration coverage for a corrupted-version database with a user-reordered list

## 6. Copy and count accuracy

- [x] 6.1 Correct the legacy restore prompt copy in `core/providers/AppProviders.tsx:608-611` to enumerate only the entity groups the V1 path imports, matching `buildDisclosures()`
- [x] 6.2 Scope `pendingChangeCount` in `core/backup/backupRestore.ts:764-772` to outbox rows the current owner can push

## 7. Validate

- [x] 7.1 Run the `core/backup`, `core/sync`, and `core/auth` Vitest projects plus the real-SQLite integration project on pinned Node `v22.23.2` and record the exact result
- [x] 7.2 Run `npm run supabase:schema:validate` and confirm the generalized uniqueness and remote-projection guards pass
- [x] 7.3 Run `npm run typecheck` and `npm run lint --max-warnings 0` and record the exact results
- [x] 7.4 Run `npm run openspec:validate --all` and confirm this change still validates
- [x] 7.5 Re-run the affected web E2E journeys against a fresh hermetic `dist/` and confirm no coverage was silently removed
- [x] 7.6 Review the full diff and confirm no ceiling, threshold, checksum, soft-delete, one-way-backup, or SQLite-authority invariant was weakened
