import { appMetaKeys, getAppMetaJsonOrDefault, setAppMetaJson } from '@/core/db/appMeta';
import { getDatabase } from '@/core/db/client';
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

/** Persists the sync outbox/status to app_meta so a killed process doesn't silently lose pending records. */
export class SqliteSyncPersistence implements SyncPersistence {
  async loadOutbox(): Promise<SyncRecord[]> {
    const db = await getDatabase();
    const stored = await getAppMetaJsonOrDefault<unknown>(db, appMetaKeys.syncOutbox, []);
    return Array.isArray(stored) ? stored.filter(isSyncRecord) : [];
  }

  async saveOutbox(records: SyncRecord[]): Promise<void> {
    const db = await getDatabase();
    await setAppMetaJson(db, appMetaKeys.syncOutbox, records);
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
