import { getDatabase } from '@/core/db/client';
import {
  appMetaKeys,
  getAppMetaJson,
  getAppMetaJsonOrDefault,
  setAppMetaJson,
  setAppMetaText,
} from '@/core/db/appMeta';
import { getLocalDatasetOwner } from '@/core/auth/account.data';
import { withSQLiteTransaction } from '@/core/db/transactions';
import {
  captureCurrentGeneration,
  captureVerifiedRows,
  readCapturedChunks,
  readVerifiedGenerationBaseHead,
  recordPublishedGeneration,
  setVerifiedGenerationBaseHead,
  withReservedGenerationSequence,
  type CapturedGeneration,
  type VerifiedGenerationBaseHead,
} from '@/core/backup/generations/capture';
import { readVerifiedLegacySnapshot } from '@/core/backup/legacySnapshot';
import {
  BackupGenerationConflictError,
  readActiveBackupGenerationConflict,
  recordBackupGenerationConflict,
} from '@/core/backup/generations/conflict';
import {
  boundedBackupRequests,
  boundedBackupRecord,
} from '@/core/backup/generations/requestBudget';
import {
  GENERATION_CAPABILITY_VERSION,
  PUBLICATION_PROVENANCE_VERSION,
} from '@/core/backup/generations/generationProtocol';
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
  BACKUP_SCHEMA_VERSION,
  BACKUP_SCOPE_VERSION,
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
  const match = /\b(PGRST\d{3}|\d{5}|\d{4})\b/.exec(error.message);
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

type OwnerHead = { snapshotId: string; sequence: number };

/** Read the authoritative owner head, refusing malformed or unreadable evidence. */
async function readOwnerHead(
  client: NonNullable<typeof supabase>,
  ownerUserId: string,
): Promise<OwnerHead | null> {
  const result = await client
    .from('backup_generation_head')
    .select('snapshot_id, sequence')
    .eq('user_id', ownerUserId)
    .limit(1);
  if (result.error)
    throw new Error(
      `Backup publication paused: cannot inspect the previous recovery point (${result.error.message}).`,
    );
  const row = result.data?.[0] as { snapshot_id?: unknown; sequence?: unknown } | undefined;
  if (!row) return null;
  if (typeof row.snapshot_id !== 'string' || row.snapshot_id === '') {
    throw new Error('Backup publication paused: the remote recovery head is malformed.');
  }
  if (typeof row.sequence !== 'number' || !Number.isSafeInteger(row.sequence)) {
    throw new Error('Backup publication paused: the remote recovery head is malformed.');
  }
  return { snapshotId: row.snapshot_id, sequence: row.sequence };
}

/** True when the immutable publication journal says this snapshot published. */
async function isGenerationPublished(
  client: NonNullable<typeof supabase>,
  ownerUserId: string,
  snapshotId: string,
): Promise<boolean> {
  const journal = await client
    .from('backup_generation_publication')
    .select('user_id, snapshot_id, sequence')
    .eq('snapshot_id', snapshotId)
    .limit(1);
  if (journal.error)
    throw new Error(`Cannot reconcile generation publication: ${journal.error.message}`);
  return (journal.data ?? []).some(
    (row) => row.user_id === ownerUserId && row.snapshot_id === snapshotId,
  );
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

  private async ensureRecoveryPoint(
    client: NonNullable<typeof supabase>,
    db: Awaited<ReturnType<typeof getDatabase>>,
    ownerUserId: string,
  ): Promise<void> {
    const capability = await client.rpc('backup_generation_capabilities');
    const versions = capability.data as Record<string, unknown> | null;
    if (
      capability.error ||
      !versions ||
      versions.protocol_version !== GENERATION_CAPABILITY_VERSION ||
      versions.publication_provenance_version !== PUBLICATION_PROVENANCE_VERSION ||
      versions.content_verification_version !== 1 ||
      versions.sequence_reservation_version !== 1 ||
      versions.backup_schema_version !== BACKUP_SCHEMA_VERSION ||
      versions.scope_version !== BACKUP_SCOPE_VERSION ||
      versions.settings_version !== BACKUP_SETTINGS_VERSION
    ) {
      throw new Error(
        'Backup publication paused: this remote does not advertise the verified generation protocol. Apply the current backup migrations and retry; existing recovery content and local pending changes are preserved.',
      );
    }
    const activeConflict = await readActiveBackupGenerationConflict(db);
    if (activeConflict) throw new BackupGenerationConflictError(activeConflict);
    const head = await readOwnerHead(client, ownerUserId);
    // Informational only. This value is NOT provenance and must never be used as
    // a capture base (`AUD-F1`): another device may have published it while this
    // device was offline.
    await setAppMetaJson(db, appMetaKeys.backupObservedGenerationHead, head);
    const verifiedBase = await this.resolveVerifiedGenerationBaseHead(db, ownerUserId, head);

    const legacyCapture = await getAppMetaJson<CapturedGeneration>(
      db,
      appMetaKeys.backupLegacyGenerationCapture,
    );
    const pending = await readCapturedChunks(db);
    if (legacyCapture && pending) {
      // Upgrade ambiguity: old clients could leave both keys populated. Never
      // let the legacy branch authorize mutable writes while a normal capture
      // is still unevaluated (`AUD-F2`).
      if (head) {
        await this.failGenerationConflict(db, ownerUserId, head, pending.capture, 'generation');
      }
      throw new Error(
        'Backup publication paused: both legacy and normal recovery captures are pending; review the backup state.',
      );
    }
    if (legacyCapture) {
      const legacySnapshotId = legacyCapture.capture.snapshotId;
      if (head && head.snapshotId !== legacySnapshotId) {
        // A legacy capture is only safe to publish when it is already the head or
        // when the remote has no recovery point. Even an already-published
        // legacy snapshot is stale if a newer head has since appeared.
        await this.failGenerationConflict(
          db,
          ownerUserId,
          head,
          legacyCapture.capture,
          'legacy_cutover',
        );
      }
      if (!head && legacyCapture.capture.baseHeadSnapshotId !== null) {
        throw new Error(
          'Backup publication paused: the remote recovery head is absent but the legacy capture has a recorded base; review the backup state.',
        );
      }
      await this.uploadGeneration(client, db, ownerUserId, legacyCapture, true);
      return;
    }

    if (pending) {
      if (pending.capture.ownerUserId !== ownerUserId) {
        throw new Error('Captured generation owner mismatch.');
      }
      if (head) {
        if (head.snapshotId === pending.capture.snapshotId) {
          // The capture is already the visible head (lost acknowledgement). The
          // authoritative head retires the local retry without touching mutable
          // rows; the capture bytes are already published.
          await setVerifiedGenerationBaseHead(db, {
            ownerUserId,
            snapshotId: head.snapshotId,
            sequence: head.sequence,
          });
          await recordPublishedGeneration(pending.capture.snapshotId, head.sequence);
          return;
        }
        const baseMatches =
          pending.capture.baseHeadProof === 'verified' &&
          pending.capture.baseHeadSnapshotId === head.snapshotId &&
          pending.capture.baseHeadSequence === head.sequence;
        if (!baseMatches) {
          // F2: reject BEFORE any mutable entity/settings/manifest write. An old
          // capture whose base came from an observed head is unverified and is
          // reviewed exactly like a provably stale capture.
          await this.failGenerationConflict(db, ownerUserId, head, pending.capture, 'generation');
        }
        // Publish the coherent capture FIRST. The server re-checks the base
        // against the live head atomically, so a concurrent publisher makes this
        // call fail before the caller can write mutable staging rows.
        await this.uploadGeneration(client, db, ownerUserId, pending, false);
        return;
      }

      // No remote head exists. Only a capture with no claimed base is a safe
      // initial publication; a capture that claims to continue a now-missing
      // recovery point needs review rather than silent re-creation.
      if (pending.capture.baseHeadSnapshotId !== null) {
        throw new Error(
          'Backup publication paused: the remote recovery head is absent but the pending capture has a recorded base; review the backup state.',
        );
      }
      await this.uploadGeneration(client, db, ownerUserId, pending, false);
      return;
    }

    if (!head) {
      // A genuinely empty remote account has no recovery point to destroy. Clear
      // any stale local provenance before capturing the first local baseline.
      if (verifiedBase) await setVerifiedGenerationBaseHead(db, null);
      const legacy = await readVerifiedLegacySnapshot(client, ownerUserId);
      if (legacy) {
        const captured = captureVerifiedRows({ ownerUserId, ...legacy, baseHead: null });
        await setAppMetaJson(db, appMetaKeys.backupLegacyGenerationCapture, captured);
        await this.uploadGeneration(client, db, ownerUserId, captured, true);
        return;
      }
      const captured = await captureCurrentGeneration();
      await this.uploadGeneration(client, db, ownerUserId, captured, false);
      return;
    }

    // A head exists but no capture is pending. Only a device whose local dataset
    // is proven to derive from that exact head may proceed with mutable writes.
    // The old behavior silently adopted the observed head here, allowing a stale
    // dirty device to publish A3 above B2 (`AUD-F1`).
    const headMatches =
      verifiedBase !== null &&
      verifiedBase.snapshotId === head.snapshotId &&
      verifiedBase.sequence === head.sequence;
    if (headMatches) return;

    // Preserve the divergent local dataset as a durable capture based on the
    // device's VERIFIED base (which may be null), then stop before any remote
    // mutation. The owner must explicitly keep local or recover elsewhere.
    const captured = await captureCurrentGeneration();
    await this.failGenerationConflict(db, ownerUserId, head, captured.capture, 'generation');
  }

  /**
   * Resolve the head this device can prove its local dataset derives from.
   *
   * There is deliberately no fallback promotion from the device-global
   * `backup.generation_sequence` counter: it survives an owner replacement, so a
   * sequence match alone would let a new owner's observed head become
   * publication authority (`AUD-F1`). Pre-provenance devices that have no
   * verified base are treated as unverified and require owner review.
   */
  private async resolveVerifiedGenerationBaseHead(
    db: Awaited<ReturnType<typeof getDatabase>>,
    ownerUserId: string,
    _head: OwnerHead | null,
  ): Promise<VerifiedGenerationBaseHead | null> {
    return readVerifiedGenerationBaseHead(db, ownerUserId);
  }

  private async failGenerationConflict(
    db: Awaited<ReturnType<typeof getDatabase>>,
    ownerUserId: string,
    head: OwnerHead,
    capture: CapturedGeneration['capture'],
    localKind: 'legacy_cutover' | 'generation',
  ): Promise<never> {
    const conflict = await withSQLiteTransaction(db, async (transactionDb) => {
      // Re-read durable evidence inside the transaction. A concurrent capture
      // may have replaced the caller's in-memory snapshot after it was read; a
      // conflict must never point at a snapshot that no longer exists (`F6`).
      const legacy = await getAppMetaJson<CapturedGeneration>(
        transactionDb,
        appMetaKeys.backupLegacyGenerationCapture,
      );
      const pending = await readCapturedChunks(transactionDb);
      const current =
        localKind === 'legacy_cutover'
          ? (legacy?.capture ?? pending?.capture ?? capture)
          : (pending?.capture ?? legacy?.capture ?? capture);
      return recordBackupGenerationConflict(
        {
          ownerUserId,
          localSnapshotId: current.snapshotId,
          localCapturedAt: current.capturedAt,
          localKind,
          remoteSnapshotId: head.snapshotId,
          remoteSequence: head.sequence,
        },
        transactionDb,
      );
    });
    throw new BackupGenerationConflictError(conflict);
  }

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

    // `AUD-SH02-A` (review finding 8): BEFORE any mutable entity row is written,
    // establish that this remote can publish an immutable generation. The audited
    // order uploaded mutable entities first, so a remote without generation
    // capability had its rows overwritten and the previously valid recovery point
    // was destroyed before a safe replacement existed. When the capability is
    // absent this push refuses and keeps the local work durable, rather than
    // silently taking away a recovery point it cannot recreate.
    if (records.some((record) => isSyncableEntity(record.entity))) {
      await this.ensureRecoveryPoint(client, db, currentUserId);
    }

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
    const writeBatches = boundedBackupRequests(payloadRows, writeBatchRows(this.serverRowCap));
    /**
     * Ids whose batch stored AND was read back (`AUD-SH03-B`, review finding 9).
     *
     * A write must not be acknowledged merely because the statement returned no
     * error: `upsert` can report success while storing nothing for this owner,
     * and a LATER batch failing must not short-circuit verification of the
     * earlier ones. So each batch is verified immediately after it is written,
     * and only a verified batch contributes acknowledged ids.
     */
    const acknowledgedIds: string[] = [];
    for (const [batchIndex, batch] of writeBatches.entries()) {
      const { error } = await client.from(entity).upsert(batch, {
        onConflict: 'id',
      });
      const batchIds = batch.flatMap((row) => {
        // SAFETY: every payload row is a projected entity row plus `user_id`, so
        // `id` is present as a string for entity tables; the guard keeps the
        // synthetic records defensive.
        const id = (row as Record<string, unknown>).id;
        return typeof id === 'string' ? [id] : [];
      });
      if (error) {
        const failedIds = new Set(batchIds);
        // A failed batch must not implicate the batches that already stored AND
        // verified.
        throw new EntityBatchPushError(
          `Supabase upsert failed for ${entity} (batch ${batchIndex + 1}/${writeBatches.length}, ${batch.length} row(s)): ${error.message}`,
          acknowledgedIds,
          failedIds,
        );
      }
      // Verify THIS batch before acknowledging it. Reusing the full-id-set
      // verification here would be wrong — an unverified earlier batch must not
      // be acknowledged just because a later one is fine.
      //
      // Review finding 10: a THROWN read-back must not lose the ids this entity
      // already verified. `verifyEntityRows` can throw (network error, malformed
      // response), and letting that escape carried no `acknowledgedIds` — the
      // outer handler then reported every record as failed, so 250 verified rows
      // were retried even though they had stored. The throw is converted into the
      // same `EntityBatchPushError` shape so the verified prefix survives every
      // later failure path.
      let confirmed: Set<string>;
      try {
        confirmed = await this.verifyEntityRows(client, entity, batchIds, currentUserId);
      } catch (verifyError) {
        throw new EntityBatchPushError(
          `Supabase batch verification errored for ${entity} (batch ${
            batchIndex + 1
          }/${writeBatches.length}): ${
            verifyError instanceof Error ? verifyError.message : String(verifyError)
          }`,
          acknowledgedIds,
          new Set(batchIds),
        );
      }
      const outcome = compareVerifiedIds(batchIds, confirmed, { serverCap: this.serverRowCap });
      if (!outcome.ok) {
        const detail =
          outcome.reason === 'truncated'
            ? `read-back was truncated: ${outcome.detail}`
            : `${outcome.missing.length} of ${batchIds.length} row(s) were not stored for this owner (${describeMissingIds(outcome.missing)})`;
        throw new EntityBatchPushError(
          `Supabase batch verification failed for ${entity} (batch ${batchIndex + 1}/${writeBatches.length}): ${detail}`,
          acknowledgedIds,
          new Set(batchIds),
        );
      }
      acknowledgedIds.push(...batchIds);
    }

    // Verification happens PER BATCH, inside the loop above, before any batch is
    // acknowledged. That replaced the single whole-entity read-back this method
    // used to run at the end:
    //
    //   - a whole-entity read-back of 1,001 rows is silently truncated by the
    //     server's `max_rows` cap (AUD-SH08-A), which produced the audited false
    //     failure of 1,001 correctly-stored rows;
    //   - acknowledging earlier batches BEFORE verifying them meant a later
    //     batch failure skipped verification entirely and silently removed
    //     unstored work from the outbox (review finding 9).
    //
    // Both are avoided by verifying each batch with its own bounded, paginated
    // read-back and only then contributing its ids to the acknowledged set. There
    // is deliberately NO second whole-entity verification here: it would re-read
    // rows already proven and would reintroduce the unbounded query.
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
      boundedBackupRecord({
        user_id: currentUserId,
        settings_version: BACKUP_SETTINGS_VERSION,
        payload,
        updated_at: latestUpdatedAt ?? new Date().toISOString(),
      }),
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
    await this.uploadGeneration(client, db, currentUserId, captured, false);
  }

  private async uploadGeneration(
    client: NonNullable<typeof supabase>,
    db: Awaited<ReturnType<typeof getDatabase>>,
    currentUserId: string,
    captured: CapturedGeneration,
    isLegacyCutover: boolean,
  ): Promise<void> {
    if (captured.capture.ownerUserId !== currentUserId)
      throw new Error('Captured generation owner mismatch.');
    const activeConflict = await readActiveBackupGenerationConflict(db);
    if (activeConflict) throw new BackupGenerationConflictError(activeConflict);
    const head = await readOwnerHead(client, currentUserId);
    await setAppMetaJson(db, appMetaKeys.backupObservedGenerationHead, head);

    if (head && head.snapshotId === captured.capture.snapshotId) {
      // This exact snapshot is already the visible head. A lost response is
      // success; retire the retry without republishing or touching mutable rows.
      await setVerifiedGenerationBaseHead(db, {
        ownerUserId: currentUserId,
        snapshotId: head.snapshotId,
        sequence: head.sequence,
      });
      await recordPublishedGeneration(captured.capture.snapshotId, head.sequence);
      if (isLegacyCutover) {
        await setAppMetaText(db, appMetaKeys.backupLegacyGenerationCapture, 'null');
      }
      return;
    }

    if (!head) {
      if (
        captured.capture.baseHeadSnapshotId !== null ||
        captured.capture.baseHeadSequence !== null
      ) {
        throw new Error(
          'Backup publication paused: the remote recovery head is absent but the capture has a recorded base; review the backup state.',
        );
      }
    } else {
      const baseMatches =
        captured.capture.baseHeadProof === 'verified' &&
        captured.capture.baseHeadSnapshotId === head.snapshotId &&
        captured.capture.baseHeadSequence === head.sequence;
      if (!baseMatches) {
        await this.failGenerationConflict(
          db,
          currentUserId,
          head,
          captured.capture,
          isLegacyCutover ? 'legacy_cutover' : 'generation',
        );
      }
    }

    const reservation = await client.rpc('reserve_backup_generation_sequence', {
      p_snapshot_id: captured.capture.snapshotId,
      p_base_head_snapshot_id: captured.capture.baseHeadSnapshotId,
      p_base_head_sequence: captured.capture.baseHeadSequence,
      p_provenance_version: PUBLICATION_PROVENANCE_VERSION,
    });
    if (reservation.error)
      throw new Error(`Backup sequence reservation failed: ${reservation.error.message}`);
    const reserved = withReservedGenerationSequence(captured, Number(reservation.data));
    // Persist the server's idempotent reservation BEFORE metadata leaves the
    // device. Rebuilding from live rows here would rewrite a resumed snapshot.
    await setAppMetaJson(
      db,
      isLegacyCutover
        ? appMetaKeys.backupLegacyGenerationCapture
        : appMetaKeys.backupGenerationCapture,
      isLegacyCutover ? reserved : { ...reserved.capture, chunks: reserved.chunks },
    );
    const { capture, chunks } = reserved;
    if (capture.ownerUserId && capture.ownerUserId !== currentUserId) {
      throw new Error(
        `Generation ${capture.snapshotId} belongs to a different owner; refusing to publish it as ${currentUserId}.`,
      );
    }

    // 1. Generation metadata first: chunks carry an FK to it. The base-head
    // columns are part of the reserved provenance record, not client-supplied
    // publication authority: the server checks them against the live head at
    // reservation AND publication.
    const metaResult = await client.from('backup_generation').upsert(
      boundedBackupRecord({
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
        base_head_snapshot_id: capture.baseHeadSnapshotId,
        base_head_sequence: capture.baseHeadSequence,
        publication_provenance_version: PUBLICATION_PROVENANCE_VERSION,
      }),
      { onConflict: 'user_id,snapshot_id' },
    );
    if (metaResult.error) {
      throw new Error(
        `Supabase upsert failed for backup_generation (${capture.snapshotId}): ${metaResult.error.message}`,
      );
    }

    // 2. Chunks in bounded batches. An identical re-upload is a server-side
    // no-op; different bytes under an existing identity are refused there.
    const chunkRows = chunks.map((entry) => ({
      user_id: currentUserId,
      snapshot_id: entry.snapshotId,
      entity: entry.entity,
      ordinal: entry.ordinal,
      payload: entry.payload,
      checksum: entry.checksum,
    }));
    for (const batch of boundedBackupRequests(chunkRows, writeBatchRows(this.serverRowCap))) {
      const result = await client
        .from('backup_generation_chunk')
        .upsert(batch, { onConflict: 'user_id,snapshot_id,entity,ordinal' });
      if (result.error) {
        throw new Error(
          `Supabase upsert failed for backup_generation_chunk (${batch.length} chunk(s)): ${result.error.message}`,
        );
      }
    }

    // 3. Atomic head advance. The server REQUIRES `p_provenance_version` and
    // verifies the generation's stored base head against the live head under its
    // advisory lock. Old clients that call the previous RPC signature are
    // rejected rather than allowed to publish stale captures.
    const previousSequence = head?.sequence ?? 0;
    const publish = await client.rpc('publish_backup_generation', {
      p_snapshot_id: capture.snapshotId,
      p_expected_previous_sequence: previousSequence,
      p_expected_chunk_count: chunks.length,
      p_manifest_checksum: capture.manifestChecksum,
      p_provenance_version: PUBLICATION_PROVENANCE_VERSION,
    });
    let acknowledgedHead: OwnerHead | null = null;
    if (publish.error) {
      const latestHead = await readOwnerHead(client, currentUserId);
      if (latestHead && latestHead.snapshotId === capture.snapshotId) {
        // The RPC committed and the response was lost. The visible head is the
        // authoritative acknowledgement.
        acknowledgedHead = latestHead;
      } else if (await isGenerationPublished(client, currentUserId, capture.snapshotId)) {
        // The snapshot published but a newer head is visible. This device's
        // local data derives from the older snapshot, so mutable writes would be
        // stale. Preserve the capture and require owner review.
        if (latestHead) {
          await this.failGenerationConflict(
            db,
            currentUserId,
            latestHead,
            capture,
            isLegacyCutover ? 'legacy_cutover' : 'generation',
          );
        }
        throw new Error(
          `Backup publication paused for ${capture.snapshotId}: the publication journal exists but no current head could be resolved.`,
        );
      } else if (
        latestHead &&
        (latestHead.snapshotId !== capture.baseHeadSnapshotId ||
          latestHead.sequence !== capture.baseHeadSequence)
      ) {
        await this.failGenerationConflict(
          db,
          currentUserId,
          latestHead,
          capture,
          isLegacyCutover ? 'legacy_cutover' : 'generation',
        );
      } else {
        throw new Error(
          `Backup publication paused for ${capture.snapshotId}: ${publish.error.message}. ` +
            'The captured recovery data remains pending; a newer backup from another device must be reviewed before replacing it.',
        );
      }
    }

    const publishedHead = acknowledgedHead ?? {
      snapshotId: capture.snapshotId,
      sequence: capture.sequence,
    };
    await setAppMetaJson(db, appMetaKeys.backupObservedGenerationHead, publishedHead);
    await setVerifiedGenerationBaseHead(db, {
      ownerUserId: currentUserId,
      snapshotId: publishedHead.snapshotId,
      sequence: publishedHead.sequence,
    });
    await recordPublishedGeneration(publishedHead.snapshotId, publishedHead.sequence);
    if (isLegacyCutover) {
      await setAppMetaText(db, appMetaKeys.backupLegacyGenerationCapture, 'null');
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
      boundedBackupRecord({
        user_id: currentUserId,
        settings_version: manifest.settingsMetadata.version,
        payload: pendingSettings?.payload ?? null,
        updated_at: updatedAt,
      }),
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
      boundedBackupRecord({
        user_id: currentUserId,
        backup_schema_version: manifest.backupSchemaVersion,
        backup_scope_version: manifest.backupScopeVersion,
        generation: manifest.generation,
        completed_at: manifest.completedAt,
        entity_metadata: manifest.entityMetadata,
        settings_version: manifest.settingsVersion,
        settings_metadata: manifest.settingsMetadata,
        updated_at: updatedAt,
      }),
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
