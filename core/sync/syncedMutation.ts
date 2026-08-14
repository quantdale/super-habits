import type * as SQLite from 'expo-sqlite';
import {
  getCachedLocalDatasetOwner,
  inspectLocalAccountDataState,
  primeLocalDatasetOwner,
  setLocalDatasetOwner,
} from '@/core/auth/account.data';
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
  // session must never block a SQLite write. When a durable dataset binding
  // exists, it remains the owner of new local sync intent even during auth
  // loss or while another account is cached in the Auth client.
  let sessionUserId: string | null = null;
  try {
    sessionUserId = await getSupabaseSessionUserId();
  } catch {
    sessionUserId = null;
  }

  const existingOwnerUserId = getCachedLocalDatasetOwner();
  let canPersistOwner = existingOwnerUserId !== undefined;
  if (existingOwnerUserId === null) {
    try {
      const local = await inspectLocalAccountDataState(input.db);
      if (local.hasUserData || local.pendingOutboxCount > 0) {
        canPersistOwner = false;
      }
    } catch {
      canPersistOwner = false;
    }
  }
  // AppProviders reconciles legacy populated datasets before feature writes
  // are available. If a test/dummy database has no app_meta API, preserve its
  // existing contract and let the durable outbox record remain authoritative.
  const ownerUserId = existingOwnerUserId ?? (canPersistOwner ? sessionUserId : null);

  const { ownerUserId: _ignoredOwnerUserId, ...recordWithoutOwner } = input.record;
  const prepared = syncEngine.prepare(
    ownerUserId ? { ...recordWithoutOwner, ownerUserId } : recordWithoutOwner,
  );
  const outcome = await withSQLiteTransaction(input.db, async (transactionDb) => {
    const result = await input.mutate(transactionDb);
    if (result.changed) {
      if (!existingOwnerUserId && ownerUserId && canPersistOwner) {
        await setLocalDatasetOwner(transactionDb, ownerUserId);
      }
      await upsertSyncOutboxRecord(transactionDb, prepared, prepared.revision);
    }
    return result;
  });

  if (outcome.changed) {
    if (!existingOwnerUserId && ownerUserId && canPersistOwner) {
      primeLocalDatasetOwner(ownerUserId);
    }
    syncEngine.enqueuePrepared(prepared, { durablyPersisted: true });
  }
  return outcome;
}
