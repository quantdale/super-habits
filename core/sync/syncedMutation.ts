import type * as SQLite from 'expo-sqlite';
import {
  getCachedLocalDatasetOwner,
  getCachedOwnerBindingProvisional,
  inspectLocalAccountDataState,
  primeLocalDatasetOwner,
  promoteLocalDatasetOwnerIfProvisional,
  setLocalDatasetOwner,
} from '@/core/auth/account.data';
import { appMetaKeys, setAppMetaText } from '@/core/db/appMeta';
import { getDatabase } from '@/core/db/client';
import { withSQLiteTransaction } from '@/core/db/transactions';
import { upsertSyncOutboxRecord } from '@/core/sync/syncPersistence';
import { syncEngine, type PreparedSyncRecord, type SyncRecord } from '@/core/sync/sync.engine';
import { getSupabaseSessionUserId } from '@/lib/supabase';
import { nowIso } from '@/lib/time';
import { BACKUP_SETTINGS_RECORD_ID } from '@/core/backup/backup.types';

export type SyncedMutationOutcome<T> = {
  value: T;
  changed: boolean;
};

/**
 * Resolve the durable owner for new backup intents: the cached dataset owner
 * when known, otherwise the current session user when the dataset is still
 * pristine. A missing/expired session must never block a SQLite write, so
 * `null` is a valid result (the outbox row stays unowned until the owner is
 * established, mirroring `runSyncedMutation`).
 */
export async function resolveSyncOwnerUserId(db: SQLite.SQLiteDatabase): Promise<string | null> {
  let sessionUserId: string | null = null;
  try {
    sessionUserId = await getSupabaseSessionUserId();
  } catch {
    sessionUserId = null;
  }

  const existingOwnerUserId = getCachedLocalDatasetOwner();
  if (existingOwnerUserId !== undefined && existingOwnerUserId !== null) {
    return existingOwnerUserId;
  }
  if (existingOwnerUserId === null) {
    try {
      const local = await inspectLocalAccountDataState(db);
      if (local.hasUserData || local.pendingOutboxCount > 0) {
        return null;
      }
    } catch {
      return null;
    }
  }
  return sessionUserId;
}

/**
 * Commit an authoritative local mutation and its remote-backup intents
 * together. `runBackupMutation` is the low-level primitive: every durable
 * sync intent must be created through the `enqueue` callback inside `mutate`,
 * so the outbox row lands in the SAME SQLite transaction as the row it
 * describes (including ids discovered mid-transaction, e.g. upsert RETURNING).
 * The in-memory engine is updated only after SQLite commits successfully.
 */
export async function runBackupMutation<T>(input: {
  db: SQLite.SQLiteDatabase;
  mutate: (
    transactionDb: SQLite.SQLiteDatabase,
    enqueue: (record: SyncRecord) => void,
  ) => Promise<SyncedMutationOutcome<T>>;
}): Promise<SyncedMutationOutcome<T>> {
  const ownerUserId = await resolveSyncOwnerUserId(input.db);
  const existingOwnerUserId = getCachedLocalDatasetOwner();
  const canPersistOwner = ownerUserId !== null;
  const preparedRecords: PreparedSyncRecord[] = [];
  const outcome = await withSQLiteTransaction(input.db, async (transactionDb) => {
    const enqueue = (record: SyncRecord): void => {
      const { ownerUserId: _ignored, ...bare } = record;
      const prepared = syncEngine.prepare(ownerUserId ? { ...bare, ownerUserId } : bare);
      preparedRecords.push(prepared);
    };
    const result = await input.mutate(transactionDb, enqueue);
    if (result.changed) {
      if (!existingOwnerUserId && ownerUserId && canPersistOwner) {
        await setLocalDatasetOwner(transactionDb, ownerUserId);
      }
      // First meaningful content durably claims the dataset: a provisional
      // anonymous binding becomes permanent in the same transaction as the
      // write, so later activity can never re-open account replacement.
      if (getCachedOwnerBindingProvisional() === true) {
        await promoteLocalDatasetOwnerIfProvisional(transactionDb);
      }
      for (const prepared of preparedRecords) {
        await upsertSyncOutboxRecord(transactionDb, prepared, prepared.revision);
      }
      await setAppMetaText(transactionDb, appMetaKeys.backupDirty, '1');
    }
    return result;
  });

  if (outcome.changed) {
    if (!existingOwnerUserId && ownerUserId && canPersistOwner) {
      primeLocalDatasetOwner(ownerUserId);
    }
    for (const prepared of preparedRecords) {
      syncEngine.enqueuePrepared(prepared, { durablyPersisted: true });
    }
  }
  return outcome;
}

/**
 * Convenience wrapper: enqueues `input.record` when the mutation changed, and
 * passes the in-transaction `enqueue` through to `mutate` so callers can add
 * extra durable intents (e.g. linked-action rule tombstones) in the same
 * transaction. Equivalent to `runBackupMutation` with
 * `enqueue(input.record)` added when `changed`.
 */
export async function runSyncedMutation<T>(input: {
  db: SQLite.SQLiteDatabase;
  record: SyncRecord;
  mutate: (
    transactionDb: SQLite.SQLiteDatabase,
    enqueue: (record: SyncRecord) => void,
  ) => Promise<SyncedMutationOutcome<T>>;
}): Promise<SyncedMutationOutcome<T>> {
  return runBackupMutation({
    db: input.db,
    mutate: async (transactionDb, enqueue) => {
      const result = await input.mutate(transactionDb, enqueue);
      if (result.changed) enqueue(input.record);
      return result;
    },
  });
}

/**
 * Durably enqueue the settings snapshot as a synthetic outbox record so it
 * rides the same hardened owner-scoped queue as every other backup entity.
 * Call after a settings save; outbox coalescing keeps at most one record.
 */
export async function enqueueBackupSettingsRecord(db?: SQLite.SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  const ownerUserId = await resolveSyncOwnerUserId(database);
  const record = {
    entity: 'user_backup_settings',
    id: BACKUP_SETTINGS_RECORD_ID,
    updatedAt: nowIso(),
    operation: 'update' as const,
    ...(ownerUserId ? { ownerUserId } : {}),
  };
  let prepared: ReturnType<typeof syncEngine.prepare> | null = null;
  await withSQLiteTransaction(database, async (transactionDb) => {
    prepared = syncEngine.prepare(record);
    await upsertSyncOutboxRecord(transactionDb, prepared, prepared.revision);
    await setAppMetaText(transactionDb, appMetaKeys.backupDirty, '1');
  });
  syncEngine.enqueuePrepared(prepared!, { durablyPersisted: true });
}
