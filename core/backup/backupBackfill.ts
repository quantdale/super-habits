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
import { syncEngine, type SyncRecord } from '@/core/sync/sync.engine';
import {
  BACKUP_ENTITY_COLUMNS,
  BACKUP_ENTITIES,
  BACKUP_HARD_DELETE_ENTITIES,
  BACKUP_SCOPE_VERSION,
  BACKUP_SOFT_DELETE_ENTITIES,
  type BackupEntity,
} from '@/core/backup/backup.types';
import { enqueueBackupSettingsRecord } from '@/core/sync/syncedMutation';

/**
 * Versioned existing-data backfill.
 *
 * Adding backup-scoped mutation hooks only backs up FUTURE data; existing
 * users already have local-only history (habit completions, pomodoro
 * sessions, workout structure/history, saved meals, linked-action rules,
 * settings). This module durably enqueues every existing row — including
 * soft-delete tombstones — through the same owner-scoped outbox, so the
 * remote backup becomes complete for pre-existing state.
 *
 * Guarantees:
 *   - owner-gated: runs only when durable owner evidence exists; never
 *     enqueues under a guessed identity;
 *   - idempotent per (entity, id) — the outbox upserts, so re-runs cannot
 *     corrupt the queue;
 *   - restart-safe: per-entity completion markers (app_meta
 *     `backup.backfill_done_entities`) resume after a kill mid-entity;
 *   - bounded batches (500 rows) so no giant synchronous transaction blocks
 *     the UI;
 *   - never blocks ordinary local use.
 */

// Small bounded batches with an event-loop yield between them: on web the
// WASM SQLite statements run on the main thread, so an unbounded batch would
// block UI interactions (the D14 responsiveness ceilings measure section
// switches while a large backfill may still be in flight).
const BACKFILL_BATCH_SIZE = 10;

export type BackfillResult = 'done' | 'waiting' | 'running';

async function readDoneEntities(db: SQLite.SQLiteDatabase): Promise<Set<string>> {
  const stored = await getAppMetaJsonOrDefault<unknown>(
    db,
    appMetaKeys.backupBackfillDoneEntities,
    [],
  );
  if (!Array.isArray(stored)) return new Set();
  return new Set(stored.filter((value): value is string => typeof value === 'string'));
}

async function markEntityDone(
  db: SQLite.SQLiteDatabase,
  done: Set<string>,
  entity: string,
): Promise<void> {
  done.add(entity);
  await setAppMetaJson(db, appMetaKeys.backupBackfillDoneEntities, [...done]);
}

async function enqueueRowsForEntity(
  db: SQLite.SQLiteDatabase,
  entity: BackupEntity,
  ownerUserId: string,
): Promise<void> {
  const hasSoftDelete = BACKUP_SOFT_DELETE_ENTITIES.has(entity);
  const columns = BACKUP_ENTITY_COLUMNS[entity];
  const hasUpdatedAt = columns.includes('updated_at');
  const selectColumns = [
    'id',
    hasUpdatedAt ? 'updated_at' : 'created_at',
    ...(hasSoftDelete ? ['deleted_at'] : []),
  ].join(', ');
  let offset = 0;
  while (true) {
    const rows = await db.getAllAsync<{
      id: string;
      updated_at: string | null;
      created_at?: string;
      deleted_at: string | null;
    }>(
      `SELECT ${selectColumns}
       FROM ${entity}
       ORDER BY id ASC
       LIMIT ? OFFSET ?`,
      [BACKFILL_BATCH_SIZE, offset],
    );
    if (rows.length === 0) break;

    const hardDelete = BACKUP_HARD_DELETE_ENTITIES.has(entity);
    const records: SyncRecord[] = rows.map((row) => ({
      entity,
      id: row.id,
      updatedAt: row.updated_at ?? row.created_at ?? '',
      ownerUserId,
      // Tombstoned soft-delete rows are authoritative backup rows: they keep
      // the remote tombstone fresh. Hard-delete tables only ever contain
      // live rows here (deleted rows are gone).
      operation:
        hasSoftDelete && row.deleted_at !== null ? 'delete' : hardDelete ? 'create' : 'update',
    }));

    const preparedList: ReturnType<typeof syncEngine.prepare>[] = [];
    await withSQLiteTransaction(db, async (transactionDb) => {
      for (const record of records) {
        const prepared = syncEngine.prepare(record);
        preparedList.push(prepared);
        await upsertSyncOutboxRecord(transactionDb, prepared, prepared.revision);
      }
      await setAppMetaText(transactionDb, appMetaKeys.backupDirty, '1');
    });
    for (const prepared of preparedList) {
      syncEngine.enqueuePrepared(prepared, { durablyPersisted: true });
    }

    offset += rows.length;
    // Yield so the main thread can serve UI work (switches, input) between
    // bounded batches instead of stalling for the whole entity.
    await new Promise((resolve) => setTimeout(resolve, 0));
    if (rows.length < BACKFILL_BATCH_SIZE) break;
  }
}

/**
 * Run the V2 backfill if needed. Returns:
 *   - `done` when scope is already V2 (idempotent);
 *   - `waiting` when durable owner evidence is missing (retry later);
 *   - `running` when backfill records were enqueued in this call.
 */
export async function ensureBackupBackfill(): Promise<BackfillResult> {
  const db = await getDatabase();
  const scopeVersion = await getAppMetaText(db, appMetaKeys.backupScopeVersion);
  if (scopeVersion !== null && parseInt(scopeVersion, 10) >= BACKUP_SCOPE_VERSION) {
    return 'done';
  }

  // Durable owner evidence only (read from app_meta, the authority — not the
  // in-memory cache). A missing or conflicting binding means the account
  // coordinator has not reached a compatible state — wait instead of
  // enqueuing under a guessed identity. Local use continues normally.
  const ownerUserId = await getLocalDatasetOwner(db);
  if (!ownerUserId) {
    return 'waiting';
  }

  await setAppMetaText(db, appMetaKeys.backupBackfillStatus, 'running');

  const done = await readDoneEntities(db);
  for (const entity of BACKUP_ENTITIES) {
    if (done.has(entity)) continue;
    await enqueueRowsForEntity(db, entity, ownerUserId);
    await markEntityDone(db, done, entity);
  }

  await setAppMetaText(db, appMetaKeys.backupBackfillStatus, 'complete');
  await setAppMetaText(db, appMetaKeys.backupScopeVersion, String(BACKUP_SCOPE_VERSION));

  // The settings snapshot is part of the V2 scope; enqueue it once backfill
  // completes so the first completeness checkpoint covers it. A completely
  // empty device has nothing to back up — the settings record (and the
  // manifest) arrive with the first real content or settings save.
  const totalRows = await db.getFirstAsync<{ count: number }>(
    `SELECT SUM(count) AS count FROM (
       ${BACKUP_ENTITIES.map((entity) => `SELECT COUNT(*) AS count FROM ${entity}`).join(
         ' UNION ALL ',
       )}
     )`,
  );
  if (Number(totalRows?.count ?? 0) > 0) {
    await enqueueBackupSettingsRecord(db);
  }

  return 'running';
}

export async function getBackfillStatus(): Promise<{
  status: 'idle' | 'running' | 'complete';
  scopeVersion: number | null;
}> {
  const db = await getDatabase();
  const statusValue = await getAppMetaText(db, appMetaKeys.backupBackfillStatus);
  const scopeVersionValue = await getAppMetaText(db, appMetaKeys.backupScopeVersion);
  const status =
    statusValue === 'complete' ? 'complete' : statusValue === 'running' ? 'running' : 'idle';
  return {
    status,
    scopeVersion: scopeVersionValue === null ? null : parseInt(scopeVersionValue, 10),
  };
}
