import { getDatabase } from '@/core/db/client';
import {
  appMetaKeys,
  getAppMetaJsonOrDefault,
  getAppMetaText,
  setAppMetaText,
} from '@/core/db/appMeta';
import { getLocalDatasetOwner } from '@/core/auth/account.data';
import type { SyncAdapter, SyncRecord } from '@/core/sync/sync.engine';
import { SyncPushPartialFailureError } from '@/core/sync/syncErrors';
import { getSupabaseAuthUserId, supabase } from '@/lib/supabase';
import {
  BACKUP_ENTITIES,
  BACKUP_ENTITY_COLUMNS,
  BACKUP_HARD_DELETE_ENTITIES,
  BACKUP_MANIFEST_RECORD_ID,
  BACKUP_NEVER_DELETED_ENTITIES,
  BACKUP_SETTINGS_RECORD_ID,
  BACKUP_SETTINGS_VERSION,
  type BackupManifest,
} from '@/core/backup/backup.types';
import { canonicalizeSettingsPayload } from '@/core/backup/backupSettings';

/**
 * SQLite entity names enqueued for remote backup — must match
 * `syncEngine.enqueue` entity strings. Includes the synthetic
 * `user_backup_settings` and `backup_manifest` records that ride the same
 * durable outbox with push-time payload assembly.
 */
export const SYNCABLE_ENTITIES = [
  ...BACKUP_ENTITIES,
  'user_backup_settings',
  'backup_manifest',
] as const;

type SyncableEntity = (typeof SYNCABLE_ENTITIES)[number];

const SYNCABLE_TABLES = new Set<string>(SYNCABLE_ENTITIES);

function collectRecordsByEntity(records: SyncRecord[]): Map<string, SyncRecord[]> {
  const map = new Map<string, SyncRecord[]>();
  for (const r of records) {
    const bucket = map.get(r.entity);
    if (bucket) {
      bucket.push(r);
    } else {
      map.set(r.entity, [r]);
    }
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
    const byEntity = collectRecordsByEntity(records);
    const failedRecords: SyncRecord[] = [];
    const errorMessages: string[] = [];

    // One entity's failure (missing rows, a schema-drift upsert rejection,
    // network blip) must not block every other entity's records behind it —
    // push each entity independently and collect failures instead of
    // aborting the whole batch on the first error.
    for (const [entity, entityRecords] of byEntity) {
      try {
        if (!isSyncableEntity(entity)) {
          throw new Error(`Unknown entity in queue: ${entity}`);
        }

        const ids = [...new Set(entityRecords.map((record) => record.id))];
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

        const illegalDeleteRecords = BACKUP_NEVER_DELETED_ENTITIES.has(entity)
          ? entityRecords.filter((record) => record.operation === 'delete')
          : [];
        if (illegalDeleteRecords.length > 0) {
          // Append-only history tables are never locally deleted. A queued
          // delete intent here is an upstream defect — fail loudly and keep
          // the records queued rather than silently forwarding it.
          throw new Error(
            `Illegal delete intent for append-only entity ${entity} (${illegalDeleteRecords.length} rows).`,
          );
        }

        const hardDeleteRecords = BACKUP_HARD_DELETE_ENTITIES.has(entity)
          ? entityRecords.filter((record) => record.operation === 'delete')
          : [];
        if (hardDeleteRecords.length > 0) {
          // The product hard-deletes these rows locally (no tombstone), so a
          // delete intent must remove the remote row instead of upserting a
          // row that no longer exists locally. Deletes are batched into one
          // round trip per entity (burst decrements/cleanups previously paid
          // one request per row).
          const hardDeleteIds = [...new Set(hardDeleteRecords.map((record) => record.id))];
          const { error } = await client
            .from(entity)
            .delete()
            .in('id', hardDeleteIds)
            .eq('user_id', currentUserId);
          if (error) {
            throw new Error(
              `Supabase delete failed for ${entity} (${hardDeleteIds.length} rows): ${error.message}`,
            );
          }
          const hardDeleteIdSet = new Set(hardDeleteIds);
          const remainingIds = ids.filter((id) => !hardDeleteIdSet.has(id));
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
      // Project each local row onto the entity's canonical backup columns so
      // extra local columns (e.g. a freshly migrated device pushing against an
      // un-migrated remote) never break push. Columns absent from the local
      // row (pre-migration schema) are omitted entirely rather than sent as
      // NULL, so push also decouples from remote migration timing; explicit
      // local NULLs are still sent to overwrite remote values.
      const projected: Record<string, unknown> = {};
      for (const column of BACKUP_ENTITY_COLUMNS[entity]) {
        if (row[column] !== undefined) projected[column] = row[column];
      }
      return { ...projected, user_id: currentUserId };
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
    // The payload is the snapshot stored at enqueue/capture time
    // (`backup.pending_settings`), never a fresh read at push time: the
    // manifest certifies exactly the snapshot that was captured with its
    // generation, so the uploaded payload must be that snapshot.
    const stored = await getAppMetaJsonOrDefault<unknown>(
      db,
      appMetaKeys.backupPendingSettings,
      null,
    );
    if (!stored || typeof stored !== 'object' || !('payload' in stored)) {
      // No certifiable snapshot exists for this queued settings record
      // (corruption or a pre-closure artifact). Pushing a fresh live read
      // would upload a payload certified by no manifest checksum, so the
      // next restore would fail integrity verification. Dropping the stale
      // intent is the only non-looping resolution: the next maintenance
      // cycle captures a fresh snapshot and enqueues a replacement record.
      console.error(
        '[sync] dropping queued user_backup_settings record: no pending settings snapshot.',
      );
      return;
    }
    const payload = stored.payload;
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
    // The manifest snapshot is captured at enqueue time (inside the
    // checkpoint's atomic coherence boundary) and stored in app_meta; it is
    // never recomputed at push time, so the pushed checkpoint always
    // describes the state that was actually pushed.
    const pending = await getAppMetaJsonOrDefault<unknown>(
      db,
      appMetaKeys.backupPendingManifest,
      null,
    );
    if (!pending || typeof pending !== 'object') {
      // No certifiable snapshot exists for this queued manifest record
      // (corruption or a pre-closure artifact). Dropping the stale intent is
      // the only non-looping resolution: the next maintenance cycle captures
      // a fresh snapshot and enqueues a replacement record.
      await setAppMetaText(db, appMetaKeys.backupPendingManifest, 'null');
      console.error('[sync] dropping queued backup_manifest record: no pending manifest snapshot.');
      return;
    }
    const manifest = pending as BackupManifest;
    if (!manifest.settingsMetadata) {
      await setAppMetaText(db, appMetaKeys.backupPendingManifest, 'null');
      console.error(
        '[sync] dropping queued backup_manifest record: snapshot has no settings integrity metadata.',
      );
      return;
    }
    // Settings-G before manifest-G: the manifest certifies exactly the
    // settings snapshot stored for its generation. If a newer settings save
    // replaced the stored snapshot after capture, the certified payload is no
    // longer the current one — the stale intent can never be published
    // coherently. Drop it (and its pending snapshot) so the next cycle
    // recaptures a fresh checkpoint that certifies the CURRENT settings; the
    // previous remote manifest remains authoritative meanwhile. Keeping the
    // record queued would block every later cycle (a stale manifest that can
    // never push), an infinite manifest loop.
    const pendingSettings = await getAppMetaJsonOrDefault<{ payload?: unknown } | null>(
      db,
      appMetaKeys.backupPendingSettings,
      null,
    );
    const pendingChecksum = pendingSettings
      ? canonicalizeSettingsPayload(pendingSettings.payload)
      : null;
    if (pendingChecksum !== manifest.settingsMetadata.checksum) {
      await setAppMetaText(db, appMetaKeys.backupPendingManifest, 'null');
      console.warn(
        '[sync] dropping stale backup_manifest record: settings changed after capture; a newer checkpoint will certify the current settings.',
      );
      return;
    }
    const latestUpdatedAt = records
      .map((record) => record.updatedAt)
      .sort((a, b) => b.localeCompare(a))[0];
    const updatedAt = latestUpdatedAt ?? new Date().toISOString();
    // (Re)upload the certified settings payload immediately before the
    // manifest so the remote settings row always matches the certified
    // checksum when the manifest becomes authoritative. Idempotent with the
    // settings record push that precedes this entity in the same batch.
    const settingsResult = await client.from('user_backup_settings').upsert(
      {
        user_id: currentUserId,
        settings_version: manifest.settingsMetadata.version,
        payload: pendingSettings?.payload ?? null,
        updated_at: updatedAt,
      },
      { onConflict: 'user_id' },
    );
    if (settingsResult.error) {
      throw new Error(
        `Supabase upsert failed for user_backup_settings: ${settingsResult.error.message}`,
      );
    }
    const { error } = await client.from('backup_manifest').upsert(
      {
        user_id: currentUserId,
        backup_schema_version: manifest.backupSchemaVersion,
        backup_scope_version: manifest.backupScopeVersion,
        generation: manifest.generation,
        completed_at: manifest.completedAt,
        entity_metadata: manifest.entityMetadata,
        settings_version: manifest.settingsVersion,
        settings_metadata: manifest.settingsMetadata,
        updated_at: updatedAt,
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
