## 1. Align the backup delete partition

- [x] 1.1 Move `workout_logs`, `workout_session_exercises`, and `workout_session_sets` from `BACKUP_NEVER_DELETED_ENTITIES` to `BACKUP_HARD_DELETE_ENTITIES` in `core/backup/backup.types.ts`. Leave `pomodoro_sessions` never-deleted.
- [x] 1.2 Update `tests/backupInventoryCoherence.test.ts` so the partition assertion expects those three workout history tables as hard-delete. Confirm the union still equals `BACKUP_ENTITIES` with no overlap.
- [x] 1.3 Confirm `SupabaseSyncAdapter.push` already remote-DELETEs `BACKUP_HARD_DELETE_ENTITIES` and needs no new adapter branch; add or extend a unit test that a workout-log `operation: 'delete'` is treated as hard-delete rather than illegal append-only.

## 2. Owner-stamp reminder and linked-action writes

- [x] 2.1 Route `completeHabitFromNotification` in `features/habits/habits.data.ts` through `runBackupMutation` (or a shared helper that calls `resolveSyncOwnerUserId` + `prepare` with owner + `upsertSyncOutboxRecord` + post-commit `enqueuePrepared`). Remove the unowned `syncEngine.prepare` call.
- [x] 2.2 Route `incrementHabitFromLinkedAction` and `ensureHabitDailyTargetFromLinkedAction` the same way. One enqueue path only — do not double-write the outbox.
- [x] 2.3 Route todo reminder mark-done in `features/todos/todoNotificationActions.data.ts` the same way, including the currently missing `enqueuePrepared({ durablyPersisted: true })` so the in-memory queue updates without hydrate.

## 3. Tests

- [x] 3.1 Add a real-SQLite integration test that `deleteWorkoutLog` enqueues `operation: 'delete'` for the log and nested session rows, those entities are in `BACKUP_HARD_DELETE_ENTITIES`, and the adapter hard-delete path would accept them.
- [x] 3.2 Add a real-SQLite (or bound-owner unit) test that a habit reminder completion and a linked-action habit increment produce outbox rows with `ownerUserId` equal to the bound dataset owner and that `syncEngine` pending records include them after commit.
- [x] 3.3 Add a test that todo reminder mark-done both persists an owner-stamped outbox row and publishes it to the in-memory queue without a hydrate.
- [x] 3.4 Run `npx vitest run tests/backupInventoryCoherence.test.ts tests/integration/workoutCorrection.test.ts` plus the new owner-stamping tests. Do not weaken existing delete-intent assertions.

## 4. Verification

- [x] 4.1 Run `npm run typecheck` and `npm run lint`.
- [x] 4.2 Run `npm run test:unit` and `npm run test:integration` for the backup/sync/workout/habit/todo suites touched above. (Full `npm test` ran both projects: 197 files passed.)
- [x] 4.3 Confirm `openspec validate fix-backup-push-hard-delete-and-owner-stamping --strict` still passes after any spec wording edits made during implementation.
