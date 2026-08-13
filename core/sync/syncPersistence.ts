import { appMetaKeys, getAppMetaJsonOrDefault, setAppMetaJson } from '@/core/db/appMeta';
import { getDatabase } from '@/core/db/client';
import { withSQLiteTransaction } from '@/core/db/transactions';
import type { SyncPersistence, SyncRecord, SyncStatus } from '@/core/sync/sync.engine';

function isSyncRecord(value: unknown): value is SyncRecord {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.entity === 'string' &&
    candidate.entity.length > 0 &&
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.updatedAt === 'string' &&
    (candidate.operation === 'create' ||
      candidate.operation === 'update' ||
      candidate.operation === 'delete')
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isSyncStatus(value: unknown): value is SyncStatus {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    isNullableString(candidate.lastSuccessAt) &&
    Number.isInteger(candidate.consecutiveFailures) &&
    Number(candidate.consecutiveFailures) >= 0 &&
    isNullableString(candidate.lastErrorMessage) &&
    isNullableString(candidate.nextRetryAt)
  );
}

/** Persists the durable SQLite outbox and sync status so a killed process doesn't silently lose pending records. */
export class SqliteSyncPersistence implements SyncPersistence {
  async loadOutbox(): Promise<SyncRecord[]> {
    const db = await getDatabase();
    // Keep the small mocked persistence contract used by legacy unit tests
    // and support a one-time read from pre-v14 app_meta if a caller opens a
    // database before migrations have completed. Runtime v14+ always uses the
    // table below.
    if (typeof db.getAllAsync !== 'function') {
      const stored = await getAppMetaJsonOrDefault<unknown>(db, appMetaKeys.syncOutbox, []);
      return Array.isArray(stored) ? stored.filter(isSyncRecord) : [];
    }
    const rows = await db.getAllAsync<{
      entity: string;
      id: string;
      updated_at: string;
      operation: SyncRecord['operation'];
      revision: number;
    }>(
      `SELECT entity, id, updated_at, operation, revision
       FROM sync_outbox
       ORDER BY revision ASC`,
    );
    return rows
      .map((row) => ({
        entity: row.entity,
        id: row.id,
        updatedAt: row.updated_at,
        operation: row.operation,
        revision: row.revision,
      }))
      .filter(isSyncRecord);
  }

  async saveOutbox(records: SyncRecord[]): Promise<void> {
    const db = await getDatabase();
    await withSQLiteTransaction(db, async (transactionDb) => {
      await transactionDb.runAsync('DELETE FROM sync_outbox');
      let revision = 0;
      for (const record of records) {
        revision += 1;
        await upsertSyncOutboxRecord(transactionDb, record, record.revision ?? revision);
      }
    });
  }

  async upsertOutbox(record: SyncRecord, revision: number): Promise<void> {
    const db = await getDatabase();
    await upsertSyncOutboxRecord(db, record, revision);
  }

  async removeOutbox(records: SyncRecord[]): Promise<void> {
    const db = await getDatabase();
    await withSQLiteTransaction(db, async (transactionDb) => {
      for (const record of records) {
        const revision = record.revision;
        if (revision === undefined || !Number.isInteger(revision)) continue;
        await transactionDb.runAsync(
          `DELETE FROM sync_outbox
           WHERE entity = ? AND id = ? AND revision = ?`,
          [record.entity, record.id, revision],
        );
      }
    });
  }

  async loadStatus(): Promise<SyncStatus | null> {
    const db = await getDatabase();
    const stored = await getAppMetaJsonOrDefault<unknown>(db, appMetaKeys.syncStatus, null);
    return isSyncStatus(stored) ? stored : null;
  }

  async saveStatus(status: SyncStatus): Promise<void> {
    const db = await getDatabase();
    await setAppMetaJson(db, appMetaKeys.syncStatus, status);
  }
}

export async function upsertSyncOutboxRecord(
  db: Parameters<typeof withSQLiteTransaction>[0],
  record: SyncRecord,
  revision: number,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO sync_outbox (entity, id, updated_at, operation, revision)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(entity, id) DO UPDATE SET
       updated_at = excluded.updated_at,
       operation = excluded.operation,
       revision = excluded.revision
     WHERE excluded.revision > sync_outbox.revision`,
    [record.entity, record.id, record.updatedAt, record.operation, revision],
  );
}
