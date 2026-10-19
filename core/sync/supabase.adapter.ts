import { getDatabase } from '@/core/db/client';
import { appMetaKeys, getAppMetaJsonOrDefault, setAppMetaText } from '@/core/db/appMeta';
import { getLocalDatasetOwner } from '@/core/auth/account.data';
import { readCapturedChunks, recordPublishedGeneration } from '@/core/backup/generations/capture';
import type { SyncAdapter, SyncRecord } from '@/core/sync/sync.engine';
import {
  EntityBatchPushError,
  SyncPushPartialFailureError,
  type SyncRecordFailure,
} from '@/core/sync/syncErrors';
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
import {
  chunk,
  compareVerifiedIds,
  describeMissingIds,
  evaluateVerificationPage,
  verifyPageRows,
  writeBatchRows,
} from '@/core/sync/syncBatching';

/**
 * Best-effort PostgREST/transport code from an adapter error (`AUD-SH03-B`).
 *
 * The code is recorded as SAFE diagnostic metadata next to the per-record error
 * so a reader can distinguish `PGRST205` from `PGRST204` without re-parsing a
 * human message. The classifier still reads the message text (it must also work
 * for errors that carry no code), so this is additive.
 */
function postgrestCodeOf(error: Error): string | undefined {
  const withCode = error as Error & { code?: unknown };
  if (typeof withCode.code === 'string' && withCode.code.trim() !== '') return withCode.code;
  const match = /(PGRST\d{3}|\d{5}|\d{4})/.exec(error.message);
  return match?.[1];
}

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
  /**
   * @param options.serverRowCap the backend's advertised row cap (`max_rows`).
   *   Batches and verification pages stay strictly inside it; leaving it unset
   *   uses the documented defaults, which are already below the 1,000-row
   *   PostgREST default (`AUD-SH08-A`).
   */
  constructor(private readonly options: { serverRowCap?: number } = {}) {}

  /** The declared server row cap, if any. */
  private get serverRowCap(): number | undefined {
    return this.options.serverRowCap;
  }

  /**
   * Read back the ids a push claims to have stored, in bounded pages.
   *
   * Returns every id the remote reported for this owner, or throws when a page
   * violates its own bound (which would make the result untrustworthy).
   *
   * @param client the Supabase client
   * @param entity the entity being verified
   * @param ids the ids the push wrote
   * @param currentUserId the pushing owner
   */
  private async verifyEntityRows(
    client: NonNullable<typeof supabase>,
    entity: (typeof BACKUP_ENTITIES)[number],
    ids: string[],
    currentUserId: string,
  ): Promise<Set<string>> {
    const pageSize = verifyPageRows(this.serverRowCap);
    // AUD-SH08-B: a verification page must never REQUEST more rows than the
    // server can return. If it did, a short response would be indistinguishable
    // from genuine absence — which is exactly how the audited 1,001-row push
    // was misreported as 1,001 unstored rows. Fail before reading rather than
    // certifying an unknowable result.
    if (this.serverRowCap !== undefined && pageSize > this.serverRowCap) {
      throw new Error(
        `Supabase read-back page size ${pageSize} exceeds the declared ${this.serverRowCap}-row server cap; refusing to verify against a response the server must truncate.`,
      );
    }
    const confirmed = new Set<string>();
    for (const page of chunk(ids, pageSize)) {
      const readBack = await client
        .from(entity)
        .select('id')
        .in('id', page)
        .eq('user_id', currentUserId)
        // Deterministic ordering is what makes `range` pagination stable.
        .order('id', { ascending: true })
        .range(0, pageSize - 1);
      if (readBack.error) {
        throw new Error(
          `Supabase read-back failed for ${entity} (${page.length} row(s) in a ${pageSize}-row page): ${readBack.error.message}`,
        );
      }
      const pageIds = (readBack.data ?? [])
        .map((row) => (row as { id?: unknown } | null)?.id)
        .filter((id): id is string => typeof id === 'string');
      const pageOutcome = evaluateVerificationPage({
        expectedRows: page.length,
        receivedIds: pageIds,
        pageSize,
      });
      if (!pageOutcome.ok) {
        const detail =
          pageOutcome.reason === 'truncated'
            ? pageOutcome.detail
            : `${pageOutcome.missing.length} expected id(s) absent from the page`;
        throw new Error(
          `Supabase read-back for ${entity} was unreliable (${detail}). ` +
            'Lower the verification page size or raise the backend row cap.',
        );
      }
      for (const id of pageIds) confirmed.add(id);
    }
    return confirmed;
  }

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
    // AUD-SH03-B: per-record evidence. The engine classifies each record from
    // ITS OWN error; the joined summary below is diagnostics only.
    const failures: SyncRecordFailure[] = [];
    /** Records whose batch(es) definitely stored (`AUD-SH03-B`). */
    const succeededRecords: SyncRecord[] = [];
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
        const failure = error instanceof Error ? error : new Error(String(error));
        // `AUD-SH03-B`: only the records whose OWN batch failed are reported. A
        // batch that already stored is acknowledged, so its records are REMOVED
        // from the outbox instead of being retried — or terminally blocked — for
        // a failure they never experienced. The audited probe stored 250 Todos,
        // failed the second batch, and saw all 251 reported as permanent
        // failures.
        const acknowledged =
          error instanceof EntityBatchPushError
            ? new Set(error.acknowledgedIds)
            : new Set<string>();
        const batchFailed =
          error instanceof EntityBatchPushError
            ? error.failedIds
            : new Set(entityRecords.map((record) => record.id));
        for (const record of entityRecords) {
          if (acknowledged.has(record.id) && !batchFailed.has(record.id)) {
            succeededRecords.push(record);
            continue;
          }
          failedRecords.push(record);
          failures.push({ record, error: failure, code: postgrestCodeOf(failure) });
        }
        errorMessages.push(failure.message);
      }
    }

    if (failedRecords.length > 0) {
      throw new SyncPushPartialFailureError(
        `[sync] Push failed for one or more entities: ${errorMessages.join('; ')}`,
        failedRecords,
        failures,
        succeededRecords,
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

    // AUD-SH08-A: bounded write batches. One unbounded statement per entity
    // approached both the row cap and the request-body budget; splitting keeps
    // every statement comfortably inside both, and a failure now names only the
    // batch that failed.
    const writeBatches = chunk(payloadRows, writeBatchRows(this.serverRowCap));
    /** Ids whose batch has already stored (`AUD-SH03-B`). */
    const acknowledgedIds: string[] = [];
    for (const [batchIndex, batch] of writeBatches.entries()) {
      const { error } = await client.from(entity).upsert(batch, {
        onConflict: 'id',
      });
      if (error) {
        const failedIds = new Set(
          batch.flatMap((row) => {
            // SAFETY: every payload row is a projected entity row plus
            // `user_id`, so `id` is present as a string for entity tables; the
            // guard keeps the synthetic records defensive.
            const id = (row as Record<string, unknown>).id;
            return typeof id === 'string' ? [id] : [];
          }),
        );
        // A failed batch must not implicate the batches that already stored.
        throw new EntityBatchPushError(
          `Supabase upsert failed for ${entity} (batch ${batchIndex + 1}/${writeBatches.length}, ${batch.length} row(s)): ${error.message}`,
          acknowledgedIds,
          failedIds,
        );
      }
      for (const row of batch) {
        const id = (row as Record<string, unknown>).id;
        if (typeof id === 'string') acknowledgedIds.push(id);
      }
    }

    // VERIFY THE WRITE BEFORE CALLING IT A PUSH (task 3.1).
    //
    // `upsert(..., onConflict: 'id')` can succeed with HTTP 200 while affecting
    // ZERO rows: if a row with the same `id` already exists and belongs to a
    // DIFFERENT owner, the owner's RLS policy makes the statement a no-op
    // instead of an error. The push then looked successful, the record was
    // dropped from the outbox, and the manifest certified counts and checksums
    // for a row the remote never stored.
    //
    // AUD-SH08-A: the read-back is PAGINATED and bounded. A single unpaged
    // `.in(ids)` was silently truncated by the server's `max_rows` cap (1,000 in
    // supabase/config.toml), so 1,001 correctly-stored rows verified as 1,000
    // and the adapter failed the whole entity. Each page now asks for a bounded
    // `range`, pages are compared against the complete expected id set, and a
    // page that violates its own bound is reported as truncation rather than
    // being mistaken for missing data.
    const confirmedIds = await this.verifyEntityRows(client, entity, ids, currentUserId);
    const outcome = compareVerifiedIds(ids, confirmedIds, { serverCap: this.serverRowCap });
    if (!outcome.ok) {
      if (outcome.reason === 'truncated') {
        throw new Error(
          `Supabase push verification for ${entity} was truncated: ${outcome.detail}. ` +
            'Refusing to certify a read-back the server capped, because it cannot distinguish "not stored" from "not returned".',
        );
      }
      throw new Error(
        `Supabase push verification failed for ${entity}: ${outcome.missing.length} of ${ids.length} row(s) were not stored for this owner (${describeMissingIds(outcome.missing)}). ` +
          `The remote accepted the statement without storing them (a row with the same id owned by another account makes the upsert a no-op), so this push is reported as a failure rather than a success.`,
      );
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

  /**
   * Publish the in-flight generation's immutable chunks and advance its head
   * (`AUD-SH02-A`/`B`).
   *
   * Reads the DURABLE capture (metadata + chunks + owner + captured revisions)
   * so a process killed mid-upload resumes the same generation instead of
   * minting a second one. Publication is idempotent: identical chunks are
   * accepted as no-ops by the server, and the head advance calls the
   * `publish_backup_generation` RPC, which re-verifies ownership, completeness,
   * manifest checksum and the expected previous sequence.
   *
   * Failure here is FATAL for the manifest push: publishing the mutable manifest
   * without a certified generation would restore the audited "manifest pointing
   * at rewritten bytes" state.
   *
   * @param client the Supabase client
   * @param db the local database
   * @param currentUserId the pushing owner
   */
  private async publishGenerationContents(
    client: NonNullable<typeof supabase>,
    db: Awaited<ReturnType<typeof getDatabase>>,
    currentUserId: string,
  ): Promise<void> {
    const captured = await readCapturedChunks(db);
    if (!captured) {
      // No generation capture pending (a legacy client, or it was already
      // acknowledged). Nothing to publish; the legacy path continues.
      return;
    }
    const { capture, chunks } = captured;
    if (capture.ownerUserId && capture.ownerUserId !== currentUserId) {
      throw new Error(
        `Generation ${capture.snapshotId} belongs to a different owner; refusing to publish it as ${currentUserId}.`,
      );
    }

    // 1. Generation metadata first: chunks carry an FK to it.
    const metaResult = await client.from('backup_generation').upsert(
      {
        user_id: currentUserId,
        snapshot_id: capture.snapshotId,
        sequence: capture.sequence,
        protocol_version: capture.scope.protocolVersion,
        backup_schema_version: capture.scope.backupSchemaVersion,
        scope_version: capture.scope.scopeVersion,
        settings_version: capture.scope.settingsVersion,
        manifest: capture.manifest,
        manifest_checksum: capture.manifestChecksum,
        captured_at: capture.capturedAt,
      },
      { onConflict: 'user_id,snapshot_id' },
    );
    if (metaResult.error) {
      throw new Error(
        `Supabase upsert failed for backup_generation (${capture.snapshotId}): ${metaResult.error.message}`,
      );
    }

    // 2. Chunks in bounded batches. An identical re-upload is a server-side
    // no-op; different bytes under an existing identity are refused there.
    for (const batch of chunk(chunks, writeBatchRows(this.serverRowCap))) {
      const result = await client.from('backup_generation_chunk').upsert(
        batch.map((entry) => ({
          user_id: currentUserId,
          snapshot_id: entry.snapshotId,
          entity: entry.entity,
          ordinal: entry.ordinal,
          payload: entry.payload,
          checksum: entry.checksum,
        })),
        { onConflict: 'user_id,snapshot_id,entity,ordinal' },
      );
      if (result.error) {
        throw new Error(
          `Supabase upsert failed for backup_generation_chunk (${batch.length} chunk(s)): ${result.error.message}`,
        );
      }
    }

    // 3. Atomic head advance with compare-and-swap on the expected sequence.
    const head = await client
      .from('backup_generation_head')
      .select('sequence')
      .eq('user_id', currentUserId)
      .limit(1);
    if (head.error) {
      throw new Error(`Supabase read failed for backup_generation_head: ${head.error.message}`);
    }
    const previousSequence = Number(
      (head.data as { sequence?: number }[] | null)?.[0]?.sequence ?? 0,
    );
    const publish = await client.rpc('publish_backup_generation', {
      p_snapshot_id: capture.snapshotId,
      p_expected_previous_sequence: previousSequence,
      p_expected_chunk_count: chunks.length,
      p_manifest_checksum: capture.manifestChecksum,
    });
    if (publish.error) {
      throw new Error(
        `publish_backup_generation failed for ${capture.snapshotId}: ${publish.error.message}`,
      );
    }

    // 4. Acknowledged: retire the durable capture and advance the local floor.
    await recordPublishedGeneration(capture.snapshotId, capture.sequence);
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
    // `AUD-SH02-A`: publish this generation's IMMUTABLE content and advance the
    // owner head BEFORE the legacy mutable manifest row is overwritten. The
    // generation namespace is what keeps an earlier complete recovery point
    // restorable while these mutable rows change; writing the mutable manifest
    // first would recreate the audited defect (a pointer whose certified bytes no
    // longer exist).
    await this.publishGenerationContents(client, db, currentUserId);

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
