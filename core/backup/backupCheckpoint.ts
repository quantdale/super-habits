import {
  appMetaKeys,
  getAppMetaJsonOrDefault,
  getAppMetaText,
  setAppMetaJson,
  setAppMetaText,
} from '@/core/db/appMeta';
import { getDatabase } from '@/core/db/client';
import { getLocalDatasetOwner } from '@/core/auth/account.data';
import { withSQLiteTransaction } from '@/core/db/transactions';
import { upsertSyncOutboxRecord } from '@/core/sync/syncPersistence';
import { syncEngine } from '@/core/sync/sync.engine';
import { nowIso } from '@/lib/time';
import { checksumRows } from '@/lib/checksum';
import {
  BACKUP_ENTITY_COLUMNS,
  BACKUP_ENTITIES,
  BACKUP_MANIFEST_RECORD_ID,
  BACKUP_SCHEMA_VERSION,
  BACKUP_SETTINGS_VERSION,
  type BackupEntity,
  type BackupManifest,
  type EntityIntegrityMetadata,
} from '@/core/backup/backup.types';
import { ensureBackupBackfill } from '@/core/backup/backupBackfill';

/**
 * Versioned backup completeness checkpoint.
 *
 * A complete backup is more than "the outbox happens to be empty": a restore
 * candidate must know whether the remote backup represents a coherent,
 * complete scope. `runBackupMaintenance()` publishes an owner-scoped
 * `backup_manifest` row — backup schema version, generation, completion
 * time, per-entity row counts + deterministic SHA-256 checksums, and the
 * settings version — but ONLY after the data queue has fully drained.
 *
 * Coherence model (documented race analysis):
 *   - A mutation enqueues durably in the SAME SQLite transaction as the row
 *     write and sets the durable `backup.dirty` flag.
 *   - The cycle flushes data, then rechecks the durable outbox; if anything
 *     arrived during the flush, publication is deferred (the previous
 *     manifest remains authoritative).
 *   - The snapshot is computed from LOCAL rows after that recheck, and the
 *     queue is rechecked once more before the manifest record is enqueued.
 *     A manifest therefore always describes a state that was fully pushed
 *     (complete "as of completed_at").
 *   - Newer pending changes do not invalidate the published checkpoint: the
 *     UI shows the last complete backup time plus the pending count.
 *   - The manifest rides the durable outbox as a synthetic record
 *     (`backup_manifest`/`manifest`); nothing re-enqueues it except this
 *     cycle, so no infinite queue loop exists. The manifest payload is
 *     captured at enqueue time into app_meta (`backup.pending_manifest`) and
 *     is never recomputed at push time.
 *   - A failed publication leaves the previous remote manifest row intact.
 */

let maintenanceRunning = false;

async function durableOutboxCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM sync_outbox',
  );
  return row?.count ?? 0;
}

async function readLastCompleteGeneration(): Promise<number> {
  const db = await getDatabase();
  const value = await getAppMetaText(db, appMetaKeys.backupLastCompleteGeneration);
  const parsed = value === null ? NaN : parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

async function readPendingManifest(): Promise<BackupManifest | null> {
  const db = await getDatabase();
  const stored = await getAppMetaJsonOrDefault<unknown>(
    db,
    appMetaKeys.backupPendingManifest,
    null,
  );
  if (!stored || typeof stored !== 'object') return null;
  const candidate = stored as Record<string, unknown>;
  if (
    typeof candidate.backupSchemaVersion !== 'number' ||
    typeof candidate.generation !== 'number' ||
    typeof candidate.completedAt !== 'string' ||
    typeof candidate.entityMetadata !== 'object' ||
    candidate.entityMetadata === null
  ) {
    return null;
  }
  return candidate as unknown as BackupManifest;
}

async function computeEntityMetadata(): Promise<
  Partial<Record<BackupEntity, EntityIntegrityMetadata>>
> {
  const db = await getDatabase();
  const metadata: Partial<Record<BackupEntity, EntityIntegrityMetadata>> = {};
  for (const entity of BACKUP_ENTITIES) {
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM ${entity} ORDER BY id ASC`,
    );
    metadata[entity] = checksumRows(rows, BACKUP_ENTITY_COLUMNS[entity]);
  }
  return metadata;
}

/**
 * Full maintenance cycle: backfill → flush data → recheck → snapshot →
 * publish manifest (as an outbox record) → flush manifest. Safe to call
 * repeatedly (interval, visibility, reconnect, bootstrap); concurrent calls
 * are serialized.
 */
export async function runBackupMaintenance(options?: {
  /** The caller owns pushing (e.g. AppProviders' flush hooks); the cycle must
   *  not flush again, so sync-failure accounting stays one attempt per
   *  trigger and backfilled records are pushed by the same flush effect. */
  skipFlush?: boolean;
}): Promise<void> {
  if (maintenanceRunning) return;
  maintenanceRunning = true;
  try {
    await runMaintenanceCycle(options);
  } finally {
    maintenanceRunning = false;
  }
}

async function runMaintenanceCycle(options?: { skipFlush?: boolean }): Promise<void> {
  const backfillResult = await ensureBackupBackfill();
  if (backfillResult === 'waiting') return;

  // 1. Push everything currently queued (data and any pending manifest).
  //    When the caller owns pushing, skip this and defer when anything is
  //    still queued (the caller's next flush will drain it, then the cycle
  //    runs again with an empty queue).
  if (options?.skipFlush) {
    if ((await durableOutboxCount()) > 0) return;
  } else {
    try {
      await syncEngine.flush();
    } catch {
      // Records stay queued; retry on the next cycle. Previous manifest intact.
      return;
    }
  }

  // 2. Anything enqueued during the flush? Defer — coherence boundary.
  if ((await durableOutboxCount()) > 0) return;

  // 3. If a manifest snapshot was already pushed, record it as the last
  //    complete generation (e.g. a previous cycle published it but crashed
  //    before recording, or a retry push just succeeded).
  const pendingManifest = await readPendingManifest();
  const lastComplete = await readLastCompleteGeneration();
  if (pendingManifest && pendingManifest.generation > lastComplete) {
    await setAppMetaText(
      await getDatabase(),
      appMetaKeys.backupLastCompleteGeneration,
      String(pendingManifest.generation),
    );
  }

  // 4. Nothing changed since the last manifest → stay quiet.
  const dirty = await isBackupDirty();
  if (!dirty) return;

  // 5. Coherent snapshot: computed from local rows AFTER the drain recheck.
  const entityMetadata = await computeEntityMetadata();
  const generation = Math.max(lastComplete, pendingManifest?.generation ?? 0) + 1;
  const completedAt = nowIso();
  const manifest: BackupManifest = {
    backupSchemaVersion: BACKUP_SCHEMA_VERSION,
    generation,
    completedAt,
    entityMetadata,
    settingsVersion: BACKUP_SETTINGS_VERSION,
  };

  // 6. Recheck the queue once more (a mutation landed during the snapshot
  //    computation → its rows are not in this snapshot → defer).
  if ((await durableOutboxCount()) > 0) return;

  const db = await getDatabase();
  const ownerUserId = await getLocalDatasetOwner(db);
  if (!ownerUserId) return;

  // 7. Publish intent: pending manifest + dirty-clear + outbox record in one
  //    transaction, so a crash can never leave a half-published checkpoint.
  const record = {
    entity: 'backup_manifest',
    id: BACKUP_MANIFEST_RECORD_ID,
    updatedAt: completedAt,
    operation: 'update' as const,
    ownerUserId,
  };
  let prepared: ReturnType<typeof syncEngine.prepare> | null = null;
  await withSQLiteTransaction(db, async (transactionDb) => {
    prepared = syncEngine.prepare(record);
    await setAppMetaJson(transactionDb, appMetaKeys.backupPendingManifest, manifest);
    await setAppMetaText(transactionDb, appMetaKeys.backupDirty, '0');
    await upsertSyncOutboxRecord(transactionDb, prepared, prepared.revision);
  });
  syncEngine.enqueuePrepared(prepared!, { durablyPersisted: true });

  // 8. Push the manifest. On failure it stays queued and is retried; the
  //    previous remote manifest remains restorable.
  try {
    await syncEngine.flush();
  } catch {
    return;
  }
  await setAppMetaText(db, appMetaKeys.backupLastCompleteGeneration, String(generation));
}

export async function isBackupDirty(): Promise<boolean> {
  const db = await getDatabase();
  const value = await getAppMetaText(db, appMetaKeys.backupDirty);
  return value === '1';
}

export { readPendingManifest, readLastCompleteGeneration };
