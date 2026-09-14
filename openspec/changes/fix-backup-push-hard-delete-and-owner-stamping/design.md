## Context

See `proposal.md` for motivation. The product already hard-deletes accidental workout logs (`deleteWorkoutLog` in `features/workout/workout.data.ts`) and already stamps owners on ordinary CRUD via `runBackupMutation`. The adapter already implements owner-scoped remote DELETE for `BACKUP_HARD_DELETE_ENTITIES` (`habit_completions`, `saved_meals`). This change aligns the partition and the remaining write paths with those existing primitives.

## Goals / Non-Goals

**Goals:**

- Make the delete-semantic partition match the product, so workout-log deletes flush as remote DELETEs.
- Route reminder and linked-action recoverable writes through the same owner-stamp + `enqueuePrepared` contract as CRUD.
- Keep inventory coherence tests as the loud guard that the partition cannot drift again.

**Non-Goals:**

- Soft-deleting workout history (no `deleted_at` on those tables; do not add a migration).
- Changing Restore V2 emptiness, importers, or Scope 7 entity set.
- Two-way sync or per-row merge.
- Rewriting `runBackupMutation` itself unless a thin helper is the cheapest way to stamp owner + enqueue.
- Pomodoro session deletion (still never-deleted).
- Fixing already-specified restore UI refresh / Settings V1 copy.

## Decisions

1. **Reclassify the three workout history tables as hard-delete, do not invent soft-delete columns.**
   - Rationale: the product already hard-deletes them and the adapter already has a hard-delete path. Adding `deleted_at` would be a schema 26 migration for a user-facing "undo accidental log" that is meant to forget the row.
   - Alternative considered: keep them never-deleted and stop enqueueing deletes. Rejected because `workout-correction` requires durable delete intents and restore would keep resurrecting the log.
   - Alternative considered: treat the adapter throw as correct and remove the UI delete. Rejected; the product contract is the delete.

2. **Reuse `runBackupMutation` / `resolveSyncOwnerUserId` on the reminder and linked-action paths rather than a one-off owner field.**
   - Rationale: those helpers already claim first-content ownership, refuse rebind, and enqueue after commit. The bug is bypassing them.
   - Alternative considered: only add `ownerUserId: getCachedLocalDatasetOwner()` at `prepare` call sites. Rejected as too easy to miss `enqueuePrepared` (todo reminder already missed it).
   - Implementation leeway: a small shared helper next to `runBackupMutation` is acceptable if wrapping the existing notification transactions is awkward; the observable contract is owner stamp + in-memory enqueue, not the function name.

3. **Do not rewrite flush to re-read SQLite owners on every record.**
   - Rationale: hydrate already loads owners from SQLite; the same-session hole is the in-memory record. Fixing the producer is cheaper and preserves the snapshot/restore flush contract.
   - Alternative considered: make the adapter ignore missing owners and fill from local binding. Rejected; that would hide unowned-legacy rows the coordinator is designed to pause on.

4. **Inventory test is part of the contract, not a follow-up.**
   - `tests/backupInventoryCoherence.test.ts` currently asserts the broken never-deleted set. It MUST move the three workout tables into hard-delete in the same change, plus a focused integration assertion that a `deleteWorkoutLog` intent is hard-delete and that a reminder prepare on a bound device carries `ownerUserId`.

## Risks / Trade-offs

- **[Risk] Remote rows for already-deleted local logs are removed on the next successful flush.** → Intended. Document in the change as **BREAKING** for stale remote history only. Local data already lacks those rows.
- **[Risk] A stuck illegal-delete outbox on existing devices unblocks only after this change ships and flush runs.** → Mitigation: the same flush that used to throw will now remote-DELETE and drain. No manual outbox surgery.
- **[Risk] Wrapping notification transactions in `runBackupMutation` could double-enqueue if both the helper and the existing `upsertSyncOutboxRecord` run.** → Mitigation: one enqueue path only; tasks must delete the bypass `prepare` calls, not stack them.
- **[Risk] Unowned reminder writes on a pristine device.** → Keep current CRUD semantics: local write succeeds; owner is stamped when binding exists.

## Migration Plan

- No SQLite schema migration.
- No remote schema migration (workout tables already allow owner-scoped DELETE under existing RLS).
- Rollout: ship the partition + write-path fix together. Existing queued illegal deletes become legal hard-deletes and drain.
- Rollback: revert the partition and write-path changes; do not attempt to resurrect already-remotely-deleted logs.

## Open Questions

None. Remaining environment limits (live Supabase round-trip, iOS notification shade) are known capability gaps and do not change this design.
