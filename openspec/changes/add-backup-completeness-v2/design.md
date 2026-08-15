# Design — Backup Completeness V2

## 1. Backup scope

### Recoverable (backup V2 + restore V2)

| Entity                    | Local table                       | Soft delete                 | Remote table                | Notes                |
| ------------------------- | --------------------------------- | --------------------------- | --------------------------- | -------------------- |
| Todos                     | `todos`                           | yes                         | `todos` (exists)            | V1 entity            |
| Habits                    | `habits`                          | yes                         | `habits` (exists)           | incl. `rule_history` |
| Calorie entries           | `calorie_entries`                 | yes                         | `calorie_entries` (exists)  | V1 entity            |
| Habit completions         | `habit_completions`               | no (hard delete at count 0) | `habit_completions`         | new                  |
| Pomodoro sessions         | `pomodoro_sessions`               | no                          | `pomodoro_sessions`         | new                  |
| Workout routines          | `workout_routines`                | yes                         | `workout_routines` (exists) | now also restored    |
| Routine exercises         | `routine_exercises`               | yes                         | `routine_exercises`         | new                  |
| Routine exercise sets     | `routine_exercise_sets`           | yes                         | `routine_exercise_sets`     | new                  |
| Workout logs              | `workout_logs`                    | no                          | `workout_logs`              | new                  |
| Workout session exercises | `workout_session_exercises`       | no                          | `workout_session_exercises` | new                  |
| Saved meals               | `saved_meals`                     | no (hard delete)            | `saved_meals`               | new                  |
| Linked action rules       | `linked_action_rules`             | yes                         | `linked_action_rules`       | new                  |
| Settings snapshot         | app_meta + AsyncStorage allowlist | —                           | `user_backup_settings`      | new                  |
| Backup manifest           | app_meta (pending)                | —                           | `backup_manifest`           | new                  |

### Explicitly excluded

- `linked_action_events`, `linked_action_executions` — execution ledgers;
  no startup/import re-apply runner exists; restoring rules without ledgers
  cannot replay effects. Documented consequence: re-triggering the identical
  source identity on the restored device may re-apply a `habit.increment` /
  `calorie.log` effect once (dedup receipts are device-local). New actions
  fire exactly once.
- `processed_notification_actions` — device-specific receipt ledger; reminder
  reconciliation schedules only today/future and never reads it; restore
  must not replay notification actions.
- `sync_outbox`, `sync_status`, restore signatures, `db_schema_version`,
  date-key cutover — sync/system internal; a recovered device rebuilds them.
- `account.*` keys, pending protection/recovery, JWT/session material — auth
  state owned by Recoverable Account V1.
- AsyncStorage `superhabits.calories.viewMode`,
  `superhabits.command.last-used-mode`,
  `superhabits.command.internal-rollout.remote-enabled` — device/UI/internal.
- `app_meta.guest_profile` — no active feature usage today.
- In-app notices (in-memory), notification receipts — transient.

## 2. Remote schema (additive migration)

Every new table: `user_id UUID NOT NULL DEFAULT auth.uid()` +
`REFERENCES auth.users(id) ON DELETE CASCADE`, index
`idx_<table>_user_id`, RLS enabled, `REVOKE ALL ... FROM anon, PUBLIC`,
`GRANT SELECT, INSERT, UPDATE, DELETE TO authenticated, service_role`, four
owner policies `sync_<table>_{select,insert,update,delete}_owner` with
`((select auth.uid()) = user_id)` and UPDATE USING + WITH CHECK. All data
timestamps are TEXT (local ISO format) so checksums round-trip; the two
metadata tables may use TIMESTAMPTZ for their bookkeeping columns.

New domain tables mirror the local schema columns exactly (plus `user_id`).
Workout child tables declare FKs to their parents with NO ACTION (no
cascade — history must survive routine soft-deletes); restore imports
parents before children and validates the graph before import. Remote
`habit_completions` has `UNIQUE(habit_id, date_key)` and `saved_meals` has
`UNIQUE(food_name)` as defense-in-depth; local constraints remain
authoritative.

`user_backup_settings`:
`user_id UUID PK`, `settings_version INTEGER NOT NULL` (= 2),
`payload JSONB NOT NULL` (validated allowlist only),
`updated_at TIMESTAMPTZ NOT NULL`.

`backup_manifest`:
`user_id UUID PK`, `backup_schema_version INTEGER NOT NULL` (= 2),
`generation INTEGER NOT NULL`, `completed_at TIMESTAMPTZ NOT NULL`,
`entity_metadata JSONB NOT NULL` (`{entity: {count, checksum}}`),
`settings_version INTEGER NOT NULL`, `updated_at TIMESTAMPTZ NOT NULL`.

## 3. Sync instrumentation

- `SYNCABLE_ENTITIES` grows to the full recoverable set plus synthetic
  `user_backup_settings` and `backup_manifest`.
- Every backup-scoped mutation enqueues through the existing transactional
  pattern (`runSyncedMutation` or the equivalent
  `withSQLiteTransaction` + `upsertSyncOutboxRecord` +
  `syncEngine.enqueuePrepared({durablyPersisted:true})`). Local-only writes
  (habit completions, pomodoro, workout logs/nested, saved meals, linked
  action rules) are converted to this pattern.
- Adapter behavior:
  - Soft-delete entities: unchanged upsert of the row (tombstone included).
  - Hard-delete entities (`habit_completions`, `saved_meals`): `delete`
    records issue an owner-scoped remote DELETE instead of reading local
    rows (row may be gone).
  - `user_backup_settings`: push-time payload = validated allowlist snapshot
    read from app_meta/AsyncStorage (outbox coalescing makes the latest
    snapshot win).
  - `backup_manifest`: push-time payload = the manifest snapshot captured at
    enqueue time and stored in app_meta `backup.pending_manifest` (never
    recomputed at push).
  - Owner checks unchanged: record owner == verified UID == local owner.
- Partial per-entity failure preserved; the checkpoint never advances while
  any scope entity fails.

## 4. Backfill (existing local data)

`core/backup/backupBackfill.ts`, gated on durable owner evidence
(owner binding exists and matches the verified UID; otherwise wait, local
use continues). app_meta keys (owner `sync`): `backup.scope_version` (=2),
`backup.backfill_status`, `backup.backfill_done_entities`. Process: per
entity, select all rows (including `deleted_at` tombstones where present)
ordered by id in bounded batches, upsert outbox records (idempotent per
(entity,id)), mark entity done, resume from the marker after restart.
Finally enqueue the settings snapshot. Never blocks UI; runs inside the
bootstrap maintenance cycle.

## 5. Completeness checkpoint

`core/backup/backupCheckpoint.ts` — `runBackupMaintenance()`:

1. Backfill if not complete (see §4).
2. If outbox has records → `syncEngine.flush()`; on failure, stop.
3. If outbox still non-empty (mutations landed during flush) → stop (previous
   manifest stays authoritative).
4. If dirty (any backup-scoped enqueue since the last manifest) → compute
   snapshot: per-entity `SELECT * ORDER BY id` (active + tombstones for
   soft-delete tables; all rows for history tables), canonicalize, count +
   SHA-256; capture settings allowlist + version; write
   `backup.pending_manifest` (app_meta) with `generation = last + 1`,
   `completed_at = snapshot time`.
5. Enqueue `backup_manifest` record; flush; on success store
   `backup.last_complete_generation` and clear the dirty flag.
6. Recheck outbox emptiness at publication time; abort if new records
   arrived (coherent as-of semantics: manifest describes the snapshot that
   was fully pushed; newer pending changes keep the checkpoint valid per
   §46 of the mission).

Canonical serialization (`lib/checksum.ts`): fixed per-entity column order,
rows sorted by id, each row `JSON.stringify` with sorted keys (nulls
preserved as null), joined with `\n`, SHA-256 (pure-TS implementation,
deterministic across node/web/native, verified against known vectors).
Settings are validated structurally, not hashed (JSONB normalization makes
payload hashes unstable).

## 6. Restore V2

`core/backup/backupRestore.ts`:

1. Owner verification: verified auth UID == local dataset owner (both set);
   recheck immediately before the import transaction.
2. Fetch `backup_manifest` for the owner. Absent → legacy V1 path with
   `V1 LEGACY/PARTIAL` disclosure. Present but schema version > 2 or
   malformed → `BACKUP INVALID`, restore blocked, local DB untouched.
3. Prefetch ALL entity rows (paginated, `created_at ASC, id ASC`), then
   per-row runtime validation (ids, strings, enums, integer/numeric ranges,
   timestamps, date keys, JSON fields `rule_history`/`effect_payload`,
   `deleted_at`), duplicate-key checks
   (`habit_completions(habit_id,date_key)`, `saved_meals(food_name)`), and
   dependency-graph validation (completions→habits, exercises→routines,
   sets→exercises, logs→routines incl. tombstones, session exercises→logs).
4. Integrity: per-entity count + checksum must equal the manifest.
5. Complete emptiness guard: `inspectLocalAccountDataState()` —
   no user data (active or deleted) in ANY of the 14 user tables, no pending
   outbox, no unowned outbox, no foreign outbox owners; rechecked inside the
   transaction.
6. Single SQLite transaction: apply entities in dependency order
   (todos → habits → habit_completions → calorie_entries → saved_meals →
   workout_routines → routine_exercises → routine_exercise_sets →
   workout_logs → workout_session_exercises → pomodoro_sessions →
   linked_action_rules) via dedicated `applyRemote*` import functions
   (plain INSERT OR REPLACE preserving `deleted_at`, `use_count`,
   `last_used_at`, IDs, timestamps); apply validated settings; record
   restore signature/timestamp; bind owner if unbound.
7. Post-commit: `requestHabitReminderReconciliation()` only (current/future
   scheduling). No linked actions, no recurring expansion, no thresholds,
   no notification replay.

Failure of any step leaves local state unchanged (no table clearing before
import; transaction rollback on SQLite failure).

## 7. Backup-state UX

`RestorePreview` gains `backupState: 'v2_complete' | 'v1_legacy' |
'in_progress' | 'invalid' | 'unavailable'`, `lastCompleteBackupAt`,
`recoverableAreas[]`, `pendingChangeCount`. `SettingsBackupSection` shows
coverage state, last complete backup time, recoverable areas, in-progress
backfill/queue state; restore stays empty-device-only. Startup prompt text
updated for V2 scope.

## 8. Security

All new tables inherit the hardened RLS contract; validator
(`scripts/validate-supabase-schema.mjs`) extended to assert per new table:
owner column, RLS, 4 owner policies, no anon/PUBLIC, no `USING (true)` post
fence, grants; fixture `simulation/backend/schema.sql` mirrors schema.
Client-side restore treats remote rows as untrusted; ownership filtering
(`user_id = owner`) plus RLS enforces isolation; adversarial tests cover
cross-user read/insert/update/delete and anon denial. No service role in the
app; no secrets in payloads or manifests.
