import { appMetaKeys, getAppMetaJson, setAppMetaJson } from '@/core/db/appMeta';
import { getDatabase } from '@/core/db/client';
import type { SyncPersistence, SyncRecord, SyncStatus } from '@/core/sync/sync.engine';

/** Persists the sync outbox/status to app_meta so a killed process doesn't silently lose pending records. */
export class SqliteSyncPersistence implements SyncPersistence {
  async loadOutbox(): Promise<SyncRecord[]> {
    const db = await getDatabase();
    const outbox = await getAppMetaJson<SyncRecord[]>(db, appMetaKeys.syncOutbox);
    return outbox ?? [];
  }

  async saveOutbox(records: SyncRecord[]): Promise<void> {
    const db = await getDatabase();
    await setAppMetaJson(db, appMetaKeys.syncOutbox, records);
  }

  async loadStatus(): Promise<SyncStatus | null> {
    const db = await getDatabase();
    return getAppMetaJson<SyncStatus>(db, appMetaKeys.syncStatus);
  }

  async saveStatus(status: SyncStatus): Promise<void> {
    const db = await getDatabase();
    await setAppMetaJson(db, appMetaKeys.syncStatus, status);
  }
}
