/**
 * Durable generation capture (`AUD-SH02-A`/`E`).
 *
 * ## Why this is separate from the checkpoint
 *
 * The audited defect's root cause is structural: the mutable current-row store
 * cannot retain a previous snapshot, because uploading a new generation rewrites
 * the very rows an older manifest certifies. Fixing the label or wrapping the
 * local work in a transaction cannot help — the recovery BYTES must be captured
 * somewhere the later upload does not touch.
 *
 * So capture happens ONCE, coherently, into an immutable generation payload:
 * one snapshot identity, bounded chunks per entity, and a manifest that describes
 * exactly those chunks. Nothing in the later upload path rewrites that payload.
 *
 * ## Durability
 *
 * The capture state (snapshot id, sequence, manifest, chunk ordinals, upload
 * cursor) is persisted so a killed process resumes the SAME generation. Minting a
 * new snapshot id after a kill would create a second generation that must be
 * garbage-collected and could race its own predecessor.
 *
 * No network I/O happens inside the capture transaction.
 */

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
import { createId } from '@/lib/id';
import { nowIso } from '@/lib/time';
import { sha256Hex } from '@/lib/checksum';
import {
  BACKUP_ENTITY_COLUMNS,
  BACKUP_ENTITIES,
  BACKUP_SCHEMA_VERSION,
  BACKUP_SETTINGS_VERSION,
  BACKUP_SCOPE_VERSION,
} from '@/core/backup/backup.types';
import {
  currentGenerationScope,
  type GenerationChunk,
  type GenerationScope,
} from '@/core/backup/generations/generationProtocol';

/**
 * Rows per chunk.
 *
 * Bounded on purpose: one unbounded JSON RPC for a mature corpus was rejected in
 * the design, and a chunk that carries a few hundred rows is retryable on its own
 * without re-uploading the whole generation.
 */
export const GENERATION_CHUNK_ROWS = 250;

/** Persisted in-flight capture. */
export interface GenerationCapture {
  /** Owner-scoped snapshot identity (`gsnap_…`). */
  snapshotId: string;
  /** Monotonic publication sequence for this owner. */
  sequence: number;
  /** The captured scope. */
  scope: GenerationScope;
  /** When the capture transation committed. */
  capturedAt: string;
  /** Canonical manifest for this generation (entity counts + checksums). */
  manifest: string;
  /** SHA-256 of `manifest`. */
  manifestChecksum: string;
  /** Expected chunk count per entity, so completeness is decidable offline. */
  expectedChunks: Record<string, number>;
  /** Entities whose chunks have been staged locally. */
  stagedEntities: string[];
}

/** The captured payload, returned by `captureGeneration`. */
export interface CapturedGeneration {
  capture: GenerationCapture;
  chunks: GenerationChunk[];
}

/** True when a persisted value is a usable capture. */
function normalizeCapture(value: unknown): GenerationCapture | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.snapshotId !== 'string' || candidate.snapshotId.length === 0) return null;
  if (typeof candidate.sequence !== 'number' || !Number.isInteger(candidate.sequence)) return null;
  if (typeof candidate.manifest !== 'string') return null;
  if (typeof candidate.manifestChecksum !== 'string') return null;
  if (!candidate.scope || typeof candidate.scope !== 'object') return null;
  const expectedChunks = candidate.expectedChunks;
  if (!expectedChunks || typeof expectedChunks !== 'object') return null;
  return {
    snapshotId: candidate.snapshotId,
    sequence: candidate.sequence,
    scope: candidate.scope as GenerationScope,
    capturedAt: typeof candidate.capturedAt === 'string' ? candidate.capturedAt : nowIso(),
    manifest: candidate.manifest,
    manifestChecksum: candidate.manifestChecksum,
    expectedChunks: expectedChunks as Record<string, number>,
    stagedEntities: Array.isArray(candidate.stagedEntities)
      ? candidate.stagedEntities.filter((entity): entity is string => typeof entity === 'string')
      : [],
  };
}

/** Read the in-flight capture, or `null` when none is pending. */
export async function readGenerationCapture(
  db?: SQLite.SQLiteDatabase,
): Promise<GenerationCapture | null> {
  const database = db ?? (await getDatabase());
  return getAppMetaJsonOrDefault<GenerationCapture | null>(
    database,
    appMetaKeys.backupGenerationCapture,
    null,
    normalizeCapture,
  );
}

/** Clear the in-flight capture (after an acknowledged publication). */
export async function clearGenerationCapture(db?: SQLite.SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await setAppMetaText(database, appMetaKeys.backupGenerationCapture, 'null');
}

/**
 * The next publication sequence for this owner.
 *
 * Two floors are considered: the last PUBLISHED sequence and the IN-FLIGHT
 * capture's sequence. Using only the published floor lets two captures taken
 * before any publication both claim sequence 1, which would make the second
 * unreleasable (the head advance refuses a same-sequence different snapshot) and
 * would break the "one sequence per owner" uniqueness of the remote metadata.
 *
 * @param db the capture transaction
 */
async function nextGenerationSequence(db: SQLite.SQLiteDatabase): Promise<number> {
  const stored = await getAppMetaText(db, appMetaKeys.backupGenerationSequence);
  const parsed = stored === null ? 0 : Number.parseInt(stored, 10);
  const publishedFloor = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  const inFlight = await readGenerationCapture(db);
  const inFlightFloor = inFlight?.sequence ?? 0;
  return Math.max(publishedFloor, inFlightFloor) + 1;
}

/** Canonical serialization for a chunk's rows (sorted keys, stable order). */
function canonicalizeRows(rows: readonly Record<string, unknown>[]): string {
  return JSON.stringify(
    rows.map((row) => {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(row).sort()) sorted[key] = row[key];
      return sorted;
    }),
  );
}

/**
 * Capture ONE coherent generation of the complete recoverable scope.
 *
 * Reads every backup entity and the certified settings payload inside a single
 * transaction, so the snapshot cannot straddle a concurrent write. Returns the
 * chunks to upload and persists the durable capture state.
 *
 * @param options.settingsPayload the already-captured settings payload for this
 *   generation (captured by the caller's own coherent settings path)
 * @returns the capture plus its chunks
 */
export async function captureGeneration(options: {
  settingsPayload: unknown;
}): Promise<CapturedGeneration> {
  const db = await getDatabase();
  const ownerUserId = await getLocalDatasetOwner(db);
  if (!ownerUserId) {
    throw new Error('captureGeneration requires durable owner evidence.');
  }

  return withSQLiteTransaction(db, async (transactionDb) => {
    const sequence = await nextGenerationSequence(transactionDb);
    const snapshotId = createId('gsnap');
    const capturedAt = nowIso();
    const chunks: GenerationChunk[] = [];
    const expectedChunks: Record<string, number> = {};
    const manifestEntities: Record<string, { rows: number; checksum: string }> = {};

    for (const entity of BACKUP_ENTITIES) {
      const columns = BACKUP_ENTITY_COLUMNS[entity];
      const rows = await transactionDb.getAllAsync<Record<string, unknown>>(
        `SELECT ${columns.join(', ')} FROM ${entity} ORDER BY id ASC`,
      );
      // Project onto the canonical column set so the capture is decoupled from
      // local-only columns.
      const projected = rows.map((row) => {
        const out: Record<string, unknown> = {};
        for (const column of columns) if (row[column] !== undefined) out[column] = row[column];
        return out;
      });

      let ordinal = 0;
      for (let index = 0; index < projected.length; index += GENERATION_CHUNK_ROWS) {
        const slice = projected.slice(index, index + GENERATION_CHUNK_ROWS);
        const payload = canonicalizeRows(slice);
        chunks.push({
          snapshotId,
          entity,
          ordinal,
          payload,
          checksum: sha256Hex(payload),
        });
        ordinal += 1;
      }
      expectedChunks[entity] = ordinal;
      manifestEntities[entity] = {
        rows: projected.length,
        checksum: sha256Hex(canonicalizeRows(projected)),
      };
    }

    // The settings snapshot is part of the generation, addressed the same way.
    const settingsPayload = JSON.stringify(options.settingsPayload ?? null);
    const settingsChecksum = sha256Hex(settingsPayload);
    chunks.push({
      snapshotId,
      entity: 'user_backup_settings',
      ordinal: 0,
      payload: settingsPayload,
      checksum: settingsChecksum,
    });
    expectedChunks.user_backup_settings = 1;
    manifestEntities.user_backup_settings = { rows: 1, checksum: settingsChecksum };

    const scope = currentGenerationScope({
      backupSchemaVersion: BACKUP_SCHEMA_VERSION,
      scopeVersion: BACKUP_SCOPE_VERSION,
      settingsVersion: BACKUP_SETTINGS_VERSION,
    });
    const manifest = canonicalizeRows([
      {
        protocolVersion: scope.protocolVersion,
        backupSchemaVersion: scope.backupSchemaVersion,
        scopeVersion: scope.scopeVersion,
        settingsVersion: scope.settingsVersion,
        snapshotId,
        sequence,
        capturedAt,
        entities: manifestEntities,
        settingsChecksum,
      },
    ]);
    const manifestChecksum = sha256Hex(manifest);

    const capture: GenerationCapture = {
      snapshotId,
      sequence,
      scope,
      capturedAt,
      manifest,
      manifestChecksum,
      expectedChunks,
      stagedEntities: [],
    };
    // Durable BEFORE any chunk leaves the device: a kill during upload resumes
    // this exact generation instead of minting a second one.
    await setAppMetaJson(transactionDb, appMetaKeys.backupGenerationCapture, capture);
    return { capture, chunks };
  });
}

/**
 * Record that an entity's chunks are staged and durable.
 *
 * @param snapshotId the capture this belongs to
 * @param entity the staged entity
 */
export async function markEntityStaged(snapshotId: string, entity: string): Promise<void> {
  const db = await getDatabase();
  const capture = await readGenerationCapture(db);
  if (!capture || capture.snapshotId !== snapshotId) return;
  if (capture.stagedEntities.includes(entity)) return;
  await setAppMetaJson(db, appMetaKeys.backupGenerationCapture, {
    ...capture,
    stagedEntities: [...capture.stagedEntities, entity],
  });
}

/**
 * Record an acknowledged publication.
 *
 * The sequence floor advances only for a generation that actually published, so
 * a retry of the same generation keeps the same number and a stale retry cannot
 * claim a newer one.
 *
 * @param snapshotId the published generation
 * @param sequence its sequence
 */
export async function recordPublishedGeneration(
  snapshotId: string,
  sequence: number,
): Promise<void> {
  const db = await getDatabase();
  const capture = await readGenerationCapture(db);
  if (capture && capture.snapshotId === snapshotId) {
    await clearGenerationCapture(db);
  }
  const stored = await getAppMetaText(db, appMetaKeys.backupGenerationSequence);
  const current = stored === null ? 0 : Number.parseInt(stored, 10);
  const next = Number.isFinite(current) ? Math.max(current, sequence) : sequence;
  await setAppMetaText(db, appMetaKeys.backupGenerationSequence, String(next));
}
