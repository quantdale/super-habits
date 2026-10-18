import type * as SQLite from 'expo-sqlite';
import {
  getCachedLocalDatasetOwner,
  getCachedOwnerBindingProvisional,
  inspectLocalAccountDataState,
  primeLocalDatasetOwner,
  promoteLocalDatasetOwnerIfProvisional,
  setLocalDatasetOwner,
} from '@/core/auth/account.data';
import { appMetaKeys, setAppMetaJson, setAppMetaText } from '@/core/db/appMeta';
import { getDatabase } from '@/core/db/client';
import { withSQLiteTransaction } from '@/core/db/transactions';
import { upsertSyncOutboxRecord } from '@/core/sync/syncPersistence';
import { syncEngine, type PreparedSyncRecord, type SyncRecord } from '@/core/sync/sync.engine';
import { getSupabaseSessionUserId } from '@/lib/supabase';
import { nowIso } from '@/lib/time';
import { BACKUP_SETTINGS_RECORD_ID } from '@/core/backup/backup.types';
import { readRecoverableSettings } from '@/core/backup/backupSettings';

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
 *
 * SAFETY: an UNPRIMED cache (`undefined` — the process has not read the owner
 * yet) is treated exactly like a known-empty one, so the pristine-dataset check
 * runs on every path that does not already have a confirmed owner. The old
 * check only ran for the explicit `null` case, so a device holding real user
 * data with an unprimed cache skipped the check entirely and stamped its new
 * intents with whichever account happened to be current — silently rebinding
 * local data to a wrong account, which is the exact outcome this check exists
 * to prevent.
 */
export async function resolveSyncOwnerUserId(db: SQLite.SQLiteDatabase): Promise<string | null> {
  let sessionUserId: string | null = null;
  try {
    sessionUserId = await getSupabaseSessionUserId();
  } catch {
    sessionUserId = null;
  }

  const existingOwnerUserId = getCachedLocalDatasetOwner();
  if (typeof existingOwnerUserId === 'string' && existingOwnerUserId.length > 0) {
    return existingOwnerUserId;
  }
  // Either explicitly empty (`null`) or never primed (`undefined`): the dataset
  // may not be pristine, so it must be proven before a session owner is adopted.
  try {
    const local = await inspectLocalAccountDataState(db);
    if (local.hasUserData || local.pendingOutboxCount > 0) {
      return null;
    }
  } catch {
    return null;
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
    if (!result.changed && preparedRecords.length > 0) {
      // Fail closed: a mutation that queued backup intents must report the
      // change. The converse (row writes under changed:false with NO intents)
      // stays legal for local-only tables this wrapper does not see — what is
      // enforced here is "never commit a row change whose sync intents would be
      // silently dropped", so backup completeness is structural, not merely
      // conventional. Throwing rolls the whole transaction back.
      throw new Error(
        'runBackupMutation: mutation queued sync intents but reported changed=false; refusing to commit row changes without their intents.',
      );
    }
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
 * The allowlisted snapshot is captured NOW (SQLite app_meta + AsyncStorage
 * theme) and stored in app_meta `backup.pending_settings` in the same
 * transaction as the outbox record — the adapter pushes that captured
 * snapshot, never a fresh read, so the settings payload is generation-bound
 * and the manifest can certify it. Call after a settings save; outbox
 * coalescing keeps at most one record.
 */
export async function enqueueBackupSettingsRecord(db?: SQLite.SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  const capture = await captureSettingsOutbox(database);
  let prepared: PreparedSyncRecord | null = null;
  await withSQLiteTransaction(database, async (transactionDb) => {
    prepared = await persistSettingsOutboxInTransaction(
      transactionDb,
      capture.ownerUserId,
      capture.snapshot,
    );
  });
  if (prepared === null) {
    throw new Error('enqueueBackupSettingsRecord: transaction did not run.');
  }
  syncEngine.enqueuePrepared(prepared, { durablyPersisted: true });
}

/**
 * Capture (owner resolution + snapshot read) is done against the base handle;
 * the enqueued outbox row, pending-snapshot and dirty markers commit together.
 */
type SettingsCaptureSnapshot = Awaited<ReturnType<typeof readRecoverableSettings>>;

type SettingsOutboxCapture = {
  snapshot: SettingsCaptureSnapshot;
  ownerUserId: string | null;
};

async function captureSettingsOutbox(
  database: SQLite.SQLiteDatabase,
): Promise<SettingsOutboxCapture> {
  const ownerUserId = await resolveSyncOwnerUserId(database);
  const settingsSnapshot = await readRecoverableSettings(database);
  return { snapshot: settingsSnapshot, ownerUserId };
}

/** Write the captured snapshot + durable outbox row inside the CALLER's transaction. */
async function persistSettingsOutboxInTransaction(
  transactionDb: SQLite.SQLiteDatabase,
  ownerUserId: string | null,
  settingsSnapshot: SettingsCaptureSnapshot,
): Promise<PreparedSyncRecord> {
  const record = {
    entity: 'user_backup_settings',
    id: BACKUP_SETTINGS_RECORD_ID,
    updatedAt: nowIso(),
    operation: 'update' as const,
    ...(ownerUserId ? { ownerUserId } : {}),
  };
  const prepared = syncEngine.prepare(record);
  await setAppMetaJson(transactionDb, appMetaKeys.backupPendingSettings, {
    generation: null,
    payload: settingsSnapshot,
  });
  // Dirty flag BEFORE the outbox row: if the row insert fails after the marker
  // and snapshot committed (the caller may swallow that failure to keep the
  // local value), the next maintenance cycle sees dirt and re-captures instead
  // of leaving a durable row with no in-memory queue entry.
  await setAppMetaText(transactionDb, appMetaKeys.backupDirty, '1');
  await upsertSyncOutboxRecord(transactionDb, prepared, prepared.revision);
  return prepared;
}

/**
 * Apply a SQLite-backed settings mutation and durably enqueue the
 * recoverable-settings snapshot in the SAME transaction: the app_meta write,
 * the snapshot capture and the `user_backup_settings` outbox row commit
 * atomically (the snapshot is read INSIDE the transaction, AFTER the
 * mutation, so the pending payload always includes the just-written value —
 * the manifest-staleness check depends on that guarantee).
 *
 * Local-first contract: a failure to record the BACKUP intent must never
 * discard the user's value. If the snapshot/outbox step fails, the setting
 * still commits (same transaction) and the result reports
 * `backupEnqueued: false` so the caller can tell the user the value is saved
 * locally but the backup confirmation is pending. Only a failure of the
 * mutation itself throws.
 *
 * AsyncStorage-backed settings (theme, live notification prefs) cannot join
 * the SQLite transaction; write them first, then re-capture via
 * `enqueueBackupSettingsRecord()`.
 */
export type RecoverableSettingsWriteResult<T> = {
  value: T;
  /** False when the setting committed but its backup intent could not be recorded. */
  backupEnqueued: boolean;
};

export async function runRecoverableSettingsMutation<T>(input: {
  db: SQLite.SQLiteDatabase;
  mutate: (transactionDb: SQLite.SQLiteDatabase) => Promise<T> | T;
}): Promise<RecoverableSettingsWriteResult<T>> {
  const ownerUserId = await resolveSyncOwnerUserId(input.db);
  let prepared: PreparedSyncRecord | null = null;
  const value = await withSQLiteTransaction(input.db, async (transactionDb) => {
    const result = await input.mutate(transactionDb);
    try {
      const settingsSnapshot = await readRecoverableSettings(transactionDb);
      prepared = await persistSettingsOutboxInTransaction(
        transactionDb,
        ownerUserId,
        settingsSnapshot,
      );
    } catch (error) {
      // Backup bookkeeping failed; keep the committed local value and report
      // the unconfirmed intent instead of rolling the user's setting back.
      prepared = null;
      console.warn('[backup] settings intent could not be recorded; local value kept', error);
    }
    return result;
  });
  if (prepared !== null) {
    syncEngine.enqueuePrepared(prepared, { durablyPersisted: true });
  }
  return { value, backupEnqueued: prepared !== null };
}
