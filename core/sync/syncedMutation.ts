import type * as SQLite from 'expo-sqlite';
import { withSQLiteTransaction } from '@/core/db/transactions';
import { upsertSyncOutboxRecord } from '@/core/sync/syncPersistence';
import { syncEngine, type SyncRecord } from '@/core/sync/sync.engine';

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
  const prepared = syncEngine.prepare(input.record);
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
