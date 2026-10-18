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

/**
 * True when the outbox already holds a durable intent for (entity, id) whose
 * revision is newer than the row state the backfill is about to enqueue.
 *
 * `AUD-SH07-A`: the audited race had the backfill read a row, a concurrent
 * delete commit its intent, and the stale snapshot then enqueue a NEWER
 * `create` that overwrote the delete. Two guards are needed, and this is the
 * second: the outbox upsert already refuses a lower revision, so a backfill
 * intent must not claim a revision above the row state it is derived from.
 *
 * The comparison is by OPERATION and updated_at rather than by revision alone,
 * because the outbox revision is a monotonic queue counter, not a version of
 * the row. A delete intent for a row that no longer exists (or a delete intent
 * at all, for a soft-delete entity) is never superseded by a backfill
 * re-derivation of the same row.
 *
 * @param db the enqueue transaction
 * @param entity the backup entity
 * @param id the row id
 * @param current the row state read inside the transaction
 */
async function hasNewerDurableIntent(
  db: SQLite.SQLiteDatabase,
  entity: BackupEntity,
  id: string,
  current: { updated_at: string | null; created_at?: string; deleted_at: string | null },
): Promise<boolean> {
  const existing = await db.getFirstAsync<{ operation: string; updated_at: string }>(
    `SELECT operation, updated_at FROM sync_outbox WHERE entity = ? AND id = ?`,
    [entity, id],
  );
  if (!existing) return false;
  // A committed delete intent is authoritative: a surviving row cannot be
  // evidence that the deletion did not happen (it may be a re-create the
  // product has not enqueued yet, which its own write path will do).
  if (existing.operation === 'delete') return true;
  const rowUpdatedAt = current.updated_at ?? current.created_at ?? '';
  // A newer row timestamp already has, or will have, its own intent from the
  // write path. Racing it with a backfill re-derivation would rewrite history.
  return rowUpdatedAt !== '' && existing.updated_at > rowUpdatedAt;
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
  // Keyset cursor paging (id > cursor), NOT OFFSET: a concurrent hard
  // delete between pages used to shift the table left, so the row at the
  // page boundary was never read — the entity was still marked done and the
  // next checkpoint certified a row the remote would never receive, failing
  // restore with integrity_mismatch forever (32 adversarial review,
  // 2026-09-24, backupBackfill OFFSET page-skip). Rows before the cursor
  // cannot affect which rows come next, so deletions mid-run are safe.
  let lastId = '';
  while (true) {
    const rows = await db.getAllAsync<{
      id: string;
      updated_at: string | null;
      created_at?: string;
      deleted_at: string | null;
    }>(
      `SELECT ${selectColumns}
       FROM ${entity}
       WHERE id > ?
       ORDER BY id ASC
       LIMIT ?`,
      [lastId, BACKFILL_BATCH_SIZE],
    );
    if (rows.length === 0) break;

    const hardDelete = BACKUP_HARD_DELETE_ENTITIES.has(entity);

    const preparedList: ReturnType<typeof syncEngine.prepare>[] = [];
    await withSQLiteTransaction(db, async (transactionDb) => {
      for (const row of rows) {
        // AUD-SH07-A/B: the row snapshot above was read BEFORE this transaction
        // opened, so it can be stale. Re-read the row's current state INSIDE the
        // serialized enqueue transaction and skip anything that no longer
        // exists. Without this the audited race replaced a committed hard-delete
        // intent with a stale `create`: the local row was gone, the durable
        // intent said "create", the remote never deleted it, and the missing-row
        // classification stalled completeness.
        const current = await transactionDb.getFirstAsync<{
          updated_at: string | null;
          created_at?: string;
          deleted_at: string | null;
        }>(`SELECT ${selectColumns} FROM ${entity} WHERE id = ?`, [row.id]);
        if (!current) {
          // The row was hard-deleted (or never existed) after the snapshot. It
          // must not receive an intent; a truthful delete intent is produced by
          // the delete path itself, in its own transaction.
          continue;
        }

        // A newer durable intent for this (entity, id) is authoritative. The
        // outbox upsert already refuses a lower revision, but skipping here
        // keeps the in-memory queue from re-adding a superseded record.
        const newer = await hasNewerDurableIntent(transactionDb, entity, row.id, current);
        if (newer) continue;

        const record: SyncRecord = {
          entity,
          id: row.id,
          updatedAt: current.updated_at ?? current.created_at ?? '',
          ownerUserId,
          // Tombstoned soft-delete rows are authoritative backup rows: they keep
          // the remote tombstone fresh. Hard-delete tables only ever contain
          // live rows here (deleted rows are gone).
          operation:
            hasSoftDelete && current.deleted_at !== null
              ? 'delete'
              : hardDelete
                ? 'create'
                : 'update',
        };
        const prepared = syncEngine.prepare(record);
        preparedList.push(prepared);
        await upsertSyncOutboxRecord(transactionDb, prepared, prepared.revision);
      }
      if (preparedList.length === 0) return;
      await setAppMetaText(transactionDb, appMetaKeys.backupDirty, '1');
    });
    for (const prepared of preparedList) {
      syncEngine.enqueuePrepared(prepared, { durablyPersisted: true });
    }

    lastId = rows[rows.length - 1].id;
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
