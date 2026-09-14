## Why

Two backup-push paths currently disagree with the product write they describe, so a completed local mutation can fail to reach (or can be resurrected from) the remote backup.

First, `workout-correction` requires an accidental workout log to be hard-deleted locally with durable delete intents for the log and its nested session rows. Those three tables remain in `BACKUP_NEVER_DELETED_ENTITIES`. `SupabaseSyncAdapter.push` treats a queued `operation: 'delete'` as an illegal append-only defect, throws, and keeps the batch queued. Local history is gone; remote rows remain; checkpoint cannot complete; a later empty-device restore resurrects the session the user deleted.

Second, ordinary CRUD stamps `ownerUserId` through `runBackupMutation` and then `enqueuePrepared`. Habit reminder completion, linked-action habit increments, and todo reminder mark-done call `syncEngine.prepare` without an owner. The todo reminder path also never calls `enqueuePrepared`, so the in-memory queue can miss the SQLite outbox row until hydrate. Flush compares the in-memory record's owner to the verified UID and fails the whole entity batch when the owner is missing. Interactive CRUD is fine; reminder and linked-action completions after the original create has already flushed are not.

## What Changes

- Reclassify `workout_logs`, `workout_session_exercises`, and `workout_session_sets` as hard-delete backup entities (same remote-DELETE contract as `saved_meals` / `habit_completions`). Accidental log deletion MUST enqueue owner-scoped delete intents that the adapter forwards as remote DELETEs, after which the outbox drains and a subsequent Restore V2 on an empty device MUST NOT resurrect those rows.
- Require every durable backup intent — including notification and linked-action completion paths — to stamp the dataset owner the same way `runBackupMutation` does and to publish the prepared record into the in-memory engine after the SQLite transaction commits (`enqueuePrepared` with `durablyPersisted: true`).
- Update inventory coherence so the hard-delete / never-deleted / soft-delete partition matches the product. Pomodoro sessions remain append-only (the product does not delete them).
- **BREAKING** for any remote backup that still contains a workout log the user already deleted locally: after this change, a successful flush removes those remote rows. Local SQLite and Restore V2 stay consistent with the user's last delete. No schema migration. Frozen Scope-6 payloads are unchanged.

## Capabilities

### New Capabilities

- `backup-push-contracts`: owner-stamped durable intents, in-memory enqueue after commit, and a delete-semantic partition the adapter actually implements (hard remote DELETE vs refuse-and-keep vs tombstone upsert).

### Modified Capabilities

- `workout-correction`: accidental workout-log deletion MUST result in a remotely applied delete after flush, not a stuck illegal-delete outbox row.

## Impact

- **Backup / sync:** `core/backup/backup.types.ts` (`BACKUP_HARD_DELETE_ENTITIES` / `BACKUP_NEVER_DELETED_ENTITIES`), `core/sync/supabase.adapter.ts`, `core/sync/syncedMutation.ts` / `syncEngine.prepare` callers.
- **Feature data:** `features/workout/workout.data.ts` (`deleteWorkoutLog` stays the product path; partition must match it), `features/habits/habits.data.ts` (notification + linked-action completion prepares), `features/todos/todoNotificationActions.data.ts` (prepare + missing `enqueuePrepared`).
- **Tests:** `tests/backupInventoryCoherence.test.ts` currently locks the broken never-deleted partition and MUST change with the contract; add real-SQLite coverage that a workout-log delete intent is classified as hard-delete, that reminder/linked-action prepares carry `ownerUserId` on a bound device, and that the todo reminder path reaches the in-memory queue.
- **No migration.** Schema stays at 25. Restore importers and emptiness gates are unchanged.
- **Depends on:** none of the other campaign changes. Complements existing `gym-workout-recovery-contract` and `supabase-backup-ownership` without replacing them.
