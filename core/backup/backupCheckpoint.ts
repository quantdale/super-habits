import type * as SQLite from 'expo-sqlite';
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
  BACKUP_SCOPE_VERSION,
  BACKUP_SETTINGS_RECORD_ID,
  BACKUP_SETTINGS_VERSION,
  type BackupEntity,
  type BackupManifest,
  type EntityIntegrityMetadata,
} from '@/core/backup/backup.types';
import { canonicalizeSettingsPayload, readRecoverableSettings } from '@/core/backup/backupSettings';
import { ensureBackupBackfill } from '@/core/backup/backupBackfill';

/**
 * Versioned backup completeness checkpoint.
 *
 * A complete backup is more than "the outbox happens to be empty": a restore
 * candidate must know whether the remote backup represents a coherent,
 * complete scope. `runBackupMaintenance()` publishes an owner-scoped
 * `backup_manifest` row — backup schema version, generation, completion
 * time, per-entity row counts + deterministic SHA-256 checksums, and the
 * certified settings snapshot (`settingsMetadata {version, checksum}`) — but
 * ONLY after the data queue has fully drained.
 *
 * Coherence model (closure remediation): the manifest snapshot, the settings
 * snapshot, the durable publication intent (outbox records), and the
 * dirty-clear all happen inside ONE SQLite transaction — a single local
 * coherence boundary. No mutation can commit between "the snapshot is
 * certified" and "the publication intent is durably recorded":
 *   - A mutation enqueues durably in the SAME SQLite transaction as its row
 *     write and sets the durable `backup.dirty` flag.
 *   - The cycle flushes data, then opens the capture transaction. Inside it
 *     the durable outbox is re-read: anything enqueued during the flush (or
 *     between the flush and the transaction) defers publication — the
 *     previous manifest remains authoritative.
 *   - The snapshot is computed from LOCAL rows inside the same transaction,
 *     and the outbox is re-checked once more before the manifest intent is
 *     written (defense-in-depth for non-transactional web interleaving and a
 *     deterministic barrier for the race tests).
 *   - The settings payload is captured with the same generation, stored in
 *     app_meta (`backup.pending_settings`), and hashed; the manifest certifies
 *     that checksum. Remote push order is settings-first; the manifest push
 *     verifies the certified settings snapshot still matches before
 *     uploading, so a manifest can never certify a settings payload that was
 *     not uploaded for that generation.
 *   - The manifest rides the durable outbox as a synthetic record
 *     (`backup_manifest`/`manifest`); nothing re-enqueues it except this
 *     cycle, so no infinite queue loop exists. The manifest payload is
 *     captured at enqueue time into app_meta (`backup.pending_manifest`) and
 *     is never recomputed at push time.
 *   - A failed publication leaves the previous remote manifest row intact.
 *   - No Supabase or network I/O ever happens inside the capture transaction.
 *
 * Newer pending changes do not invalidate the published checkpoint: the UI
 * shows the last complete backup time plus the pending change count.
 */

let maintenanceRunning = false;

/**
 * Test-only deterministic barriers. Production callers never pass hooks.
 * `beforeCapture` runs after the flush/recheck and before the capture
 * transaction opens (a real mutation can run here). `afterQueueRecheck` and
 * `afterSnapshot` run INSIDE the capture transaction and must NOT call
 * `runBackupMutation`/`withSQLiteTransaction` (they would deadlock on the
 * serialized transaction tail); simulate durable mutation effects with direct
 * SQL on the transaction connection instead.
 */
export type BackupMaintenanceHooks = {
  beforeCapture?: () => Promise<void>;
  afterQueueRecheck?: (transactionDb: SQLite.SQLiteDatabase) => Promise<void>;
  afterSnapshot?: (transactionDb: SQLite.SQLiteDatabase) => Promise<void>;
};

async function durableOutboxCount(db: SQLite.SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM sync_outbox',
  );
  return row?.count ?? 0;
}

async function readLastCompleteGeneration(db: SQLite.SQLiteDatabase): Promise<number> {
  const value = await getAppMetaText(db, appMetaKeys.backupLastCompleteGeneration);
  const parsed = value === null ? NaN : parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

async function readPendingManifest(db: SQLite.SQLiteDatabase): Promise<BackupManifest | null> {
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
    candidate.entityMetadata === null ||
    typeof candidate.settingsVersion !== 'number'
  ) {
    return null;
  }
  return candidate as unknown as BackupManifest;
}

async function computeEntityMetadata(
  db: SQLite.SQLiteDatabase,
): Promise<Partial<Record<BackupEntity, EntityIntegrityMetadata>>> {
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
 * Full maintenance cycle: backfill → flush data → recheck → capture (ONE
 * atomic local coherence boundary) → publish manifest (as an outbox record)
 * → flush → record generation. Safe to call repeatedly (interval,
 * visibility, reconnect, bootstrap); concurrent calls are serialized.
 */
export async function runBackupMaintenance(options?: {
  /** The caller owns pushing (e.g. AppProviders' flush hooks); the cycle must
   *  not flush again, so sync-failure accounting stays one attempt per
   *  trigger and backfilled records are pushed by the same flush effect. */
  skipFlush?: boolean;
  /** Test-only deterministic race barriers (see BackupMaintenanceHooks). */
  hooks?: BackupMaintenanceHooks;
}): Promise<void> {
  if (maintenanceRunning) return;
  maintenanceRunning = true;
  try {
    await runMaintenanceCycle(options);
  } finally {
    maintenanceRunning = false;
  }
}

async function runMaintenanceCycle(options?: {
  skipFlush?: boolean;
  hooks?: BackupMaintenanceHooks;
}): Promise<void> {
  const db = await getDatabase();
  const backfillResult = await ensureBackupBackfill();
  if (backfillResult === 'waiting') return;

  // 1. Push everything currently queued (data and any pending manifest).
  //    When the caller owns pushing, skip this and defer when anything is
  //    still queued (the caller's next flush will drain it, then the cycle
  //    runs again with an empty queue).
  if (options?.skipFlush) {
    if ((await durableOutboxCount(db)) > 0) return;
  } else {
    try {
      await syncEngine.flush();
    } catch {
      // Records stay queued; retry on the next cycle. Previous manifest intact.
      return;
    }
  }

  // 2. Anything enqueued during the flush? Defer — coherence boundary.
  if ((await durableOutboxCount(db)) > 0) return;

  // 3. If a manifest snapshot was already pushed, record it as the last
  //    complete generation (e.g. a previous cycle published it but crashed
  //    before recording, or a retry push just succeeded).
  const pendingManifest = await readPendingManifest(db);
  const lastComplete = await readLastCompleteGeneration(db);
  if (pendingManifest && pendingManifest.generation > lastComplete) {
    await setAppMetaText(
      db,
      appMetaKeys.backupLastCompleteGeneration,
      String(pendingManifest.generation),
    );
  }

  // 4. Nothing changed since the last manifest → stay quiet.
  if (!(await isBackupDirty(db))) return;

  // Test barrier: a real mutation may commit here, between the cycle's
  // checks and the capture transaction. The in-transaction rechecks below
  // must catch it and defer publication.
  await options?.hooks?.beforeCapture?.();

  // 5. Capture: ONE atomic local coherence boundary. The snapshot, the
  //    settings capture, the durable publication intent, and the dirty-clear
  //    commit together — or not at all.
  const captured = await withSQLiteTransaction(
    db,
    async (
      transactionDb,
    ): Promise<{
      manifest: BackupManifest;
      settingsPrepared: ReturnType<typeof syncEngine.prepare>;
      manifestPrepared: ReturnType<typeof syncEngine.prepare>;
    } | null> => {
      // 5a. Re-read the durable outbox INSIDE the transaction: any mutation
      //     that committed between the flush and now (or during it) defers
      //     publication — its rows are not in any snapshot we could certify.
      if ((await durableOutboxCount(transactionDb)) > 0) return null;
      await options?.hooks?.afterQueueRecheck?.(transactionDb);

      // 5b. Dirty verified inside the coherence boundary.
      if (!(await isBackupDirty(transactionDb))) return null;

      // 5c. Canonical snapshot computed from local rows inside the boundary.
      const entityMetadata = await computeEntityMetadata(transactionDb);

      // 5d. Re-check the outbox (defense-in-depth against non-transactional
      //     web interleaving; deterministic barrier for the race tests). Any
      //     record that appeared during the snapshot defers publication.
      if ((await durableOutboxCount(transactionDb)) > 0) return null;
      await options?.hooks?.afterSnapshot?.(transactionDb);
      if ((await durableOutboxCount(transactionDb)) > 0) return null;

      // 5e. Settings captured with the same generation; the manifest certifies
      //     the canonical checksum of exactly this snapshot.
      const settingsSnapshot = await readRecoverableSettings(transactionDb);
      const settingsChecksum = canonicalizeSettingsPayload(settingsSnapshot);

      const ownerUserId = await getLocalDatasetOwner(transactionDb);
      if (!ownerUserId) return null;

      const generation = Math.max(lastComplete, pendingManifest?.generation ?? 0) + 1;
      const completedAt = nowIso();
      const nextManifest: BackupManifest = {
        backupSchemaVersion: BACKUP_SCHEMA_VERSION,
        backupScopeVersion: BACKUP_SCOPE_VERSION,
        generation,
        completedAt,
        entityMetadata,
        settingsVersion: BACKUP_SETTINGS_VERSION,
        settingsMetadata: { version: BACKUP_SETTINGS_VERSION, checksum: settingsChecksum },
      };

      // 5f. Persist the pending manifest and the generation-bound settings
      //     snapshot, enqueue the settings + manifest outbox records, and clear
      //     the dirty flag — the complete coherent state transition, atomically.
      await setAppMetaJson(transactionDb, appMetaKeys.backupPendingManifest, nextManifest);
      await setAppMetaJson(transactionDb, appMetaKeys.backupPendingSettings, {
        generation,
        payload: settingsSnapshot,
      });
      const settingsRecord = {
        entity: 'user_backup_settings',
        id: BACKUP_SETTINGS_RECORD_ID,
        updatedAt: completedAt,
        operation: 'update' as const,
        ownerUserId,
      };
      const manifestRecord = {
        entity: 'backup_manifest',
        id: BACKUP_MANIFEST_RECORD_ID,
        updatedAt: completedAt,
        operation: 'update' as const,
        ownerUserId,
      };
      const nextSettingsPrepared = syncEngine.prepare(settingsRecord);
      const nextManifestPrepared = syncEngine.prepare(manifestRecord);
      await upsertSyncOutboxRecord(
        transactionDb,
        nextSettingsPrepared,
        nextSettingsPrepared.revision,
      );
      await upsertSyncOutboxRecord(
        transactionDb,
        nextManifestPrepared,
        nextManifestPrepared.revision,
      );
      await setAppMetaText(transactionDb, appMetaKeys.backupDirty, '0');
      return {
        manifest: nextManifest,
        settingsPrepared: nextSettingsPrepared,
        manifestPrepared: nextManifestPrepared,
      };
    },
  );
  if (!captured) return; // deferred: previous manifest stays authoritative
  syncEngine.enqueuePrepared(captured.settingsPrepared, { durablyPersisted: true });
  syncEngine.enqueuePrepared(captured.manifestPrepared, { durablyPersisted: true });

  // 6. Push the manifest (settings record precedes it in the queue, so the
  //    certified settings snapshot is uploaded first). On failure both stay
  //    queued and are retried; the previous remote manifest remains
  //    restorable. Dirty stays cleared only for the snapshot that was
  //    captured; newer mutations set it again.
  try {
    await syncEngine.flush();
  } catch {
    return;
  }
  // Record the generation only when this exact manifest was actually pushed:
  // the adapter drops a stale manifest intent (settings changed after
  // capture) WITHOUT pushing and clears the pending snapshot, in which case
  // the next cycle recaptures with a fresh generation.
  const pushedPending = await readPendingManifest(db);
  if (pushedPending && pushedPending.generation === captured.manifest.generation) {
    await setAppMetaText(
      db,
      appMetaKeys.backupLastCompleteGeneration,
      String(captured.manifest.generation),
    );
  }
}

export async function isBackupDirty(db?: SQLite.SQLiteDatabase): Promise<boolean> {
  const database = db ?? (await getDatabase());
  const value = await getAppMetaText(database, appMetaKeys.backupDirty);
  return value === '1';
}

export { readPendingManifest, readLastCompleteGeneration };
