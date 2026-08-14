import type * as SQLite from 'expo-sqlite';
import { withSQLiteTransaction } from '@/core/db/transactions';
import { upsertSyncOutboxRecord } from '@/core/sync/syncPersistence';
import { syncEngine, type SyncRecord } from '@/core/sync/sync.engine';
import { getSupabaseSessionUserId } from '@/lib/supabase';

export type SyncedMutationOutcome<T> = {
  value: T;
  changed: boolean;
};

/**
 * Commit an authoritative local mutation and its remote-sync intent together.
 * The in-memory engine is updated only after SQLite commits successfully.
 */
export async function runSyncedMutation<T>(input: {
  db: SQLite.SQLiteDatabase;
  record: SyncRecord;
  mutate: (transactionDb: SQLite.SQLiteDatabase) => Promise<SyncedMutationOutcome<T>>;
}): Promise<SyncedMutationOutcome<T>> {
  // Session lookup is best-effort at the local boundary. A missing/expired
  // session must never block a SQLite write; the resulting unowned outbox
  // intent is quarantined from remote push until it is explicitly resolved.
  let ownerUserId: string | null = null;
  try {
    ownerUserId = await getSupabaseSessionUserId();
  } catch {
    ownerUserId = null;
  }

  const { ownerUserId: _ignoredOwnerUserId, ...recordWithoutOwner } = input.record;
  const prepared = syncEngine.prepare(
    ownerUserId ? { ...recordWithoutOwner, ownerUserId } : recordWithoutOwner,
  );
  const outcome = await withSQLiteTransaction(input.db, async (transactionDb) => {
    const result = await input.mutate(transactionDb);
    if (result.changed) {
      await upsertSyncOutboxRecord(transactionDb, prepared, prepared.revision);
    }
    return result;
  });

  if (outcome.changed) {
    syncEngine.enqueuePrepared(prepared, { durablyPersisted: true });
  }
  return outcome;
}
