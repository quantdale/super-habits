import { getDatabase } from '@/core/db/client';
import { appMetaKeys, getAppMetaJsonOrDefault, getAppMetaText } from '@/core/db/appMeta';
import { getLocalDatasetOwner } from '@/core/auth/account.data';
import type { SyncAdapter, SyncRecord } from '@/core/sync/sync.engine';
import { SyncPushPartialFailureError } from '@/core/sync/syncErrors';
import { getSupabaseAuthUserId, supabase } from '@/lib/supabase';
import {
  BACKUP_ENTITIES,
  BACKUP_HARD_DELETE_ENTITIES,
  BACKUP_MANIFEST_RECORD_ID,
  BACKUP_SETTINGS_RECORD_ID,
  BACKUP_SETTINGS_VERSION,
  type BackupManifest,
} from '@/core/backup/backup.types';
import { readRecoverableSettings } from '@/core/backup/backupSettings';

/**
 * SQLite entity names enqueued for remote backup — must match
 * `syncEngine.enqueue` entity strings. Includes the synthetic
 * `user_backup_settings` and `backup_manifest` records that ride the same
 * durable outbox with push-time payload assembly.
 */
const SYNCABLE_ENTITIES = [...BACKUP_ENTITIES, 'user_backup_settings', 'backup_manifest'] as const;

type SyncableEntity = (typeof SYNCABLE_ENTITIES)[number];

const SYNCABLE_TABLES = new Set<string>(SYNCABLE_ENTITIES);

function collectIdsByEntity(records: SyncRecord[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const r of records) {
    let set = map.get(r.entity);
    if (!set) {
      set = new Set();
      map.set(r.entity, set);
    }
    set.add(r.id);
  }
  return map;
}

function isSyncableEntity(entity: string): entity is SyncableEntity {
  return SYNCABLE_TABLES.has(entity);
}

export class SupabaseSyncAdapter implements SyncAdapter {
  async push(records: SyncRecord[]): Promise<void> {
    if (records.length === 0) return;
    if (!supabase) {
      // No remote backend configured: a "successful" no-op push would let the
      // sync engine drop the outbox (queue cleared on success), silently
      // losing pending records. Fail instead so the engine restores them —
      // same path as any other unavailable backend (see sync.engine flush
      // snapshot/restore contract).
      throw new Error('Supabase is not configured; keeping the outbox intact.');
    }

    let currentUserId: string | null;
    try {
      currentUserId = await getSupabaseAuthUserId();
    } catch (error) {
      throw new Error(
        `Supabase auth is unavailable; keeping the outbox intact: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    if (!currentUserId) {
      throw new Error('Supabase auth user is unavailable; keeping the outbox intact.');
    }

    const db = await getDatabase();
    const localOwnerUserId = await getLocalDatasetOwner(db);
    if (!localOwnerUserId) {
      throw new Error(
        'Local dataset owner is unavailable; keeping the outbox intact until account recovery completes.',
      );
    }
    if (localOwnerUserId !== currentUserId) {
      throw new Error(
        'Local dataset owner does not match the verified Supabase user; keeping the outbox intact.',
      );
    }
    const client = supabase;
    const byEntity = collectIdsByEntity(records);
    const failedRecords: SyncRecord[] = [];
    const errorMessages: string[] = [];

    // One entity's failure (missing rows, a schema-drift upsert rejection,
    // network blip) must not block every other entity's records behind it —
    // push each entity independently and collect failures instead of
    // aborting the whole batch on the first error.
    for (const [entity, idSet] of byEntity) {
      const entityRecords = records.filter((record) => record.entity === entity);
      try {
        if (!isSyncableEntity(entity)) {
          throw new Error(`Unknown entity in queue: ${entity}`);
        }

        const ids = [...idSet];
        if (ids.length === 0) continue;

        const unownedOrWrongSession = entityRecords.filter(
          (record) =>
            record.ownerUserId !== currentUserId || record.ownerUserId !== localOwnerUserId,
        );
        if (unownedOrWrongSession.length > 0) {
          throw new Error(
            `Sync owner mismatch for ${entity}; refusing to push under the current Supabase user.`,
          );
        }

        if (entity === 'user_backup_settings') {
          await this.pushSettingsSnapshot(client, db, currentUserId, entityRecords);
          continue;
        }

        if (entity === 'backup_manifest') {
          await this.pushManifestSnapshot(client, db, currentUserId, entityRecords);
          continue;
        }

        const hardDeleteRecords = BACKUP_HARD_DELETE_ENTITIES.has(entity)
          ? entityRecords.filter((record) => record.operation === 'delete')
          : [];
        if (hardDeleteRecords.length > 0) {
          // The product hard-deletes these rows locally (no tombstone), so a
          // delete intent must remove the remote row instead of upserting a
          // row that no longer exists locally.
          for (const record of hardDeleteRecords) {
            const { error } = await client
              .from(entity)
              .delete()
              .eq('id', record.id)
              .eq('user_id', currentUserId);
            if (error) {
              throw new Error(
                `Supabase delete failed for ${entity} ${record.id}: ${error.message}`,
              );
            }
          }
          const remainingIds = ids.filter(
            (id) => !hardDeleteRecords.some((record) => record.id === id),
          );
          if (remainingIds.length === 0) continue;
          await this.upsertEntityRows(client, db, entity, remainingIds, currentUserId);
          continue;
        }

        await this.upsertEntityRows(client, db, entity, ids, currentUserId);
      } catch (error) {
        failedRecords.push(...entityRecords);
        errorMessages.push(error instanceof Error ? error.message : String(error));
      }
    }

    if (failedRecords.length > 0) {
      throw new SyncPushPartialFailureError(
        `[sync] Push failed for one or more entities: ${errorMessages.join('; ')}`,
        failedRecords,
      );
    }
  }

  private async upsertEntityRows(
    client: NonNullable<typeof supabase>,
    db: Awaited<ReturnType<typeof getDatabase>>,
    entity: (typeof BACKUP_ENTITIES)[number],
    ids: string[],
    currentUserId: string,
  ): Promise<void> {
    const placeholders = ids.map(() => '?').join(', ');
    const sql = `SELECT * FROM ${entity} WHERE id IN (${placeholders})`;

    const rows = await db.getAllAsync<Record<string, unknown>>(sql, ids);
    const selectedIds = new Set(
      rows.flatMap((row) => (typeof row.id === 'string' ? [row.id] : [])),
    );
    const missingIds = ids.filter((id) => !selectedIds.has(id));

    if (missingIds.length > 0) {
      throw new Error(`Missing local rows for ${entity}: ${missingIds.join(', ')}`);
    }

    const payloadRows = rows.map((row) => {
      const { user_id: _localOwner, ...localRow } = row;
      return { ...localRow, user_id: currentUserId };
    });

    const { error } = await client.from(entity).upsert(payloadRows, {
      onConflict: 'id',
    });

    if (error) {
      throw new Error(`Supabase upsert failed for ${entity}: ${error.message}`);
    }
  }

  private async pushSettingsSnapshot(
    client: NonNullable<typeof supabase>,
    db: Awaited<ReturnType<typeof getDatabase>>,
    currentUserId: string,
    records: SyncRecord[],
  ): Promise<void> {
    const payload = await readRecoverableSettings(db);
    const latestUpdatedAt = records
      .map((record) => record.updatedAt)
      .sort((a, b) => b.localeCompare(a))[0];
    const { error } = await client.from('user_backup_settings').upsert(
      {
        user_id: currentUserId,
        settings_version: BACKUP_SETTINGS_VERSION,
        payload,
        updated_at: latestUpdatedAt ?? new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) {
      throw new Error(`Supabase upsert failed for user_backup_settings: ${error.message}`);
    }
  }

  private async pushManifestSnapshot(
    client: NonNullable<typeof supabase>,
    db: Awaited<ReturnType<typeof getDatabase>>,
    currentUserId: string,
    records: SyncRecord[],
  ): Promise<void> {
    // The manifest snapshot is captured at enqueue time (after the data queue
    // drained) and stored in app_meta; it is never recomputed at push time, so
    // the pushed checkpoint always describes the state that was actually
    // pushed.
    const pending = await getAppMetaJsonOrDefault<unknown>(
      db,
      appMetaKeys.backupPendingManifest,
      null,
    );
    if (!pending || typeof pending !== 'object') {
      throw new Error('backup_manifest record has no pending manifest snapshot.');
    }
    const manifest = pending as BackupManifest;
    const latestUpdatedAt = records
      .map((record) => record.updatedAt)
      .sort((a, b) => b.localeCompare(a))[0];
    const { error } = await client.from('backup_manifest').upsert(
      {
        user_id: currentUserId,
        backup_schema_version: manifest.backupSchemaVersion,
        generation: manifest.generation,
        completed_at: manifest.completedAt,
        entity_metadata: manifest.entityMetadata,
        settings_version: manifest.settingsVersion,
        updated_at: latestUpdatedAt ?? new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );
    if (error) {
      throw new Error(`Supabase upsert failed for backup_manifest: ${error.message}`);
    }
  }

  pull(_since: string | null): Promise<SyncRecord[]> {
    return Promise.resolve([]);
  }
}

export { BACKUP_MANIFEST_RECORD_ID, BACKUP_SETTINGS_RECORD_ID };

export async function getPendingManifestForDiagnostics(): Promise<BackupManifest | null> {
  const db = await getDatabase();
  return getAppMetaJsonOrDefault<BackupManifest | null>(
    db,
    appMetaKeys.backupPendingManifest,
    null,
  );
}

export async function getBackupDirtyFlag(): Promise<boolean> {
  const db = await getDatabase();
  const value = await getAppMetaText(db, appMetaKeys.backupDirty);
  return value === '1';
}
