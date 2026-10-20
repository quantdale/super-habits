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
  getAppMetaJson,
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
import { readRecoverableSettings } from '@/core/backup/backupSettings';
import {
  BackupGenerationConflictError,
  readActiveBackupGenerationConflict,
} from '@/core/backup/generations/conflict';
import { canonicalGenerationRows, generationRowPayloads } from './generationFormat';
import { GENERATION_PAYLOAD_BYTES, utf8Bytes } from './requestBudget';
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
  /** Provisional floor, replaced by the owner's server reservation before upload. */
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
  /**
   * The durable owner this generation belongs to (`AUD-SH02-A`).
   *
   * Persisted so a resumed upload cannot publish under a different account, and
   * so ownership/restore-emptiness safety can see the pending work.
   */
  ownerUserId: string;
  /**
   * The outbox revisions this capture absorbed.
   *
   * Publication acknowledges only these exact revisions, so a newer local write
   * of the same record stays pending (`AUD-SH02-B` step 5). Persisting them is
   * what makes that decidable after a process loss.
   */
  capturedRevisions: Record<string, number>;
  /**
   * The VERIFIED local baseline this snapshot was captured from. This is not
   * merely the head seen during a push: it is a head the device has successfully
   * published, restored from, or explicitly chosen to replace. If the remote
   * head later differs, the capture cannot be proven newer and needs review.
   */
  baseHeadSnapshotId: string | null;
  baseHeadSequence: number | null;
  /**
   * How the base was established. Captures written before provenance tracking
   * normalize to `unverified` and must be reviewed before publication over an
   * existing remote head (`AUD-F1`).
   */
  baseHeadProof: 'verified' | 'unverified';
}

/** A remote head this device has proven its local dataset derives from. */
export type VerifiedGenerationBaseHead = {
  ownerUserId: string;
  snapshotId: string;
  sequence: number;
};

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
    ownerUserId: typeof candidate.ownerUserId === 'string' ? candidate.ownerUserId : '',
    capturedRevisions:
      candidate.capturedRevisions && typeof candidate.capturedRevisions === 'object'
        ? (candidate.capturedRevisions as Record<string, number>)
        : {},
    baseHeadSnapshotId:
      typeof candidate.baseHeadSnapshotId === 'string' ? candidate.baseHeadSnapshotId : null,
    baseHeadSequence:
      typeof candidate.baseHeadSequence === 'number' &&
      Number.isSafeInteger(candidate.baseHeadSequence)
        ? candidate.baseHeadSequence
        : null,
    baseHeadProof: candidate.baseHeadProof === 'verified' ? 'verified' : 'unverified',
  };
}

/** Read the in-flight capture, or `null` when none is pending. */
export async function readGenerationCapture(
  db?: SQLite.SQLiteDatabase,
): Promise<GenerationCapture | null> {
  const database = db ?? (await getDatabase());
  const stored = await getAppMetaJson<unknown>(database, appMetaKeys.backupGenerationCapture);
  if (stored === null) return null;
  const capture = normalizeCapture(stored);
  if (!capture)
    throw new Error('The durable generation capture is malformed; publication is paused.');
  return capture;
}

/** Clear the in-flight capture (after an acknowledged publication). */
export async function clearGenerationCapture(db?: SQLite.SQLiteDatabase): Promise<void> {
  const database = db ?? (await getDatabase());
  await setAppMetaText(database, appMetaKeys.backupGenerationCapture, 'null');
}

function normalizeVerifiedBaseHead(value: unknown): VerifiedGenerationBaseHead | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.ownerUserId !== 'string' || candidate.ownerUserId === '') return null;
  if (typeof candidate.snapshotId !== 'string' || candidate.snapshotId === '') return null;
  if (typeof candidate.sequence !== 'number' || !Number.isSafeInteger(candidate.sequence))
    return null;
  return {
    ownerUserId: candidate.ownerUserId,
    snapshotId: candidate.snapshotId,
    sequence: candidate.sequence,
  };
}

/**
 * The remote head this local dataset is proven to derive from.
 *
 * A missing value is not the same as an empty remote: a device with local data
 * and an existing remote head must be reviewed before it can publish over that
 * head (`AUD-F1`).
 */
export async function readVerifiedGenerationBaseHead(
  db: SQLite.SQLiteDatabase,
  ownerUserId: string,
): Promise<VerifiedGenerationBaseHead | null> {
  const stored = await getAppMetaJsonOrDefault<VerifiedGenerationBaseHead | null>(
    db,
    appMetaKeys.backupVerifiedGenerationBaseHead,
    null,
    normalizeVerifiedBaseHead,
  );
  return stored && stored.ownerUserId === ownerUserId ? stored : null;
}

/** Record the head this device's local dataset is proven to derive from. */
export async function setVerifiedGenerationBaseHead(
  db: SQLite.SQLiteDatabase,
  head: VerifiedGenerationBaseHead | null,
): Promise<void> {
  await setAppMetaJson(db, appMetaKeys.backupVerifiedGenerationBaseHead, head);
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

/**
 * Capture a generation INSIDE a caller-owned transaction (`AUD-SH02-A`).
 *
 * The backup maintenance cycle already holds the coherent SQLite boundary where
 * the manifest snapshot, the settings snapshot and the dirty-clear commit
 * together. Capturing the immutable generation there — rather than in a second
 * transaction — is what guarantees the generation describes exactly the state the
 * manifest certifies.
 *
 * @param transactionDb the caller's open transaction
 * @param settingsPayload the capture-bound settings payload
 */
export async function captureGenerationWithinTransaction(
  transactionDb: Awaited<ReturnType<typeof getDatabase>>,
  settingsPayload: unknown,
): Promise<GenerationCapture> {
  const ownerUserId = await getLocalDatasetOwner(transactionDb);
  if (!ownerUserId) {
    throw new Error('captureGenerationWithinTransaction requires durable owner evidence.');
  }
  const captured = await captureInto(transactionDb, ownerUserId, settingsPayload);
  return captured.capture;
}

export async function captureGeneration(options: {
  settingsPayload: unknown;
}): Promise<CapturedGeneration> {
  const db = await getDatabase();
  const ownerUserId = await getLocalDatasetOwner(db);
  if (!ownerUserId) {
    throw new Error('captureGeneration requires durable owner evidence.');
  }

  return withSQLiteTransaction(db, (transactionDb) =>
    captureInto(transactionDb, ownerUserId, options.settingsPayload),
  );
}

/** Initial publication uses the same SQLite boundary for settings and rows. */
export async function captureCurrentGeneration(): Promise<CapturedGeneration> {
  const db = await getDatabase();
  return withSQLiteTransaction(db, async (transactionDb) => {
    const ownerUserId = await getLocalDatasetOwner(transactionDb);
    if (!ownerUserId) throw new Error('Generation capture requires durable owner evidence.');
    return captureInto(transactionDb, ownerUserId, await readRecoverableSettings(transactionDb));
  });
}

/**
 * The capture body, callable inside a caller-owned transaction.
 *
 * @param transactionDb the open transaction
 * @param ownerUserId the durable owner
 * @param settingsPayload the capture-bound settings payload
 */
async function captureInto(
  transactionDb: Awaited<ReturnType<typeof getDatabase>>,
  ownerUserId: string,
  settingsPayload: unknown,
): Promise<CapturedGeneration> {
  {
    // `AUD-F6`: never replace a durable capture while an owner review is active.
    // The normal flush path rejects before this point; this is the
    // transaction-level guard that keeps maintenance from overwriting the evidence.
    const activeConflict = await readActiveBackupGenerationConflict(transactionDb);
    if (activeConflict) throw new BackupGenerationConflictError(activeConflict);
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
      for (const payload of generationRowPayloads(projected)) {
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
        checksum: sha256Hex(canonicalGenerationRows(projected)),
      };
    }

    // The settings snapshot is part of the generation, addressed the same way.
    const settingsJson = JSON.stringify(settingsPayload ?? null);
    if (utf8Bytes(settingsJson) > GENERATION_PAYLOAD_BYTES)
      throw new Error('Backup capture paused: settings exceed the generation payload budget.');
    const settingsChecksum = sha256Hex(settingsJson);
    chunks.push({
      snapshotId,
      entity: 'user_backup_settings',
      ordinal: 0,
      payload: settingsJson,
      checksum: settingsChecksum,
    });
    expectedChunks.user_backup_settings = 1;
    manifestEntities.user_backup_settings = { rows: 1, checksum: settingsChecksum };

    const scope = currentGenerationScope({
      backupSchemaVersion: BACKUP_SCHEMA_VERSION,
      scopeVersion: BACKUP_SCOPE_VERSION,
      settingsVersion: BACKUP_SETTINGS_VERSION,
    });
    const manifest = canonicalGenerationRows([
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

    // Absorb the exact durable revisions this snapshot represents, so an
    // acknowledgement after publication removes only what was captured.
    const outboxRows = await transactionDb.getAllAsync<{
      entity: string;
      id: string;
      revision: number;
    }>(`SELECT entity, id, revision FROM sync_outbox ORDER BY revision ASC`);
    const capturedRevisions: Record<string, number> = {};
    for (const row of outboxRows) {
      capturedRevisions[`${row.entity}:${row.id}`] = Number(row.revision);
    }
    const verifiedBase = await readVerifiedGenerationBaseHead(transactionDb, ownerUserId);

    const capture: GenerationCapture = {
      snapshotId,
      sequence,
      scope,
      capturedAt,
      manifest,
      manifestChecksum,
      expectedChunks,
      stagedEntities: [],
      ownerUserId,
      capturedRevisions,
      baseHeadSnapshotId: verifiedBase?.snapshotId ?? null,
      baseHeadSequence: verifiedBase?.sequence ?? null,
      baseHeadProof: 'verified',
    };
    // Durable BEFORE any chunk leaves the device: a kill during upload resumes
    // this exact generation instead of minting a second one. The CHUNKS are
    // persisted alongside the metadata — metadata alone cannot resume an
    // immutable upload, because the mutable entity rows it was derived from may
    // change (or be deleted) before the process returns.
    await setAppMetaJson(transactionDb, appMetaKeys.backupGenerationCapture, {
      ...capture,
      chunks,
    });
    return { capture, chunks };
  }
}

/**
 * The chunks of the in-flight capture, restored from durable state.
 *
 * @param db optional database
 */
export async function readCapturedChunks(
  db?: SQLite.SQLiteDatabase,
): Promise<{ capture: GenerationCapture; chunks: GenerationChunk[] } | null> {
  const database = db ?? (await getDatabase());
  const stored = await getAppMetaJson<unknown>(database, appMetaKeys.backupGenerationCapture);
  if (stored === null) return null;
  const capture = normalizeCapture(stored);
  if (!capture)
    throw new Error('The durable generation capture is malformed; publication is paused.');
  const rawChunks = (stored as { chunks?: unknown }).chunks;
  if (!Array.isArray(rawChunks))
    throw new Error('The durable generation chunks are missing; publication is paused.');
  const chunks: GenerationChunk[] = [];
  for (const entry of rawChunks) {
    if (!entry || typeof entry !== 'object') throw new Error('Malformed durable generation chunk.');
    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.snapshotId !== 'string' ||
      typeof candidate.entity !== 'string' ||
      typeof candidate.ordinal !== 'number' ||
      typeof candidate.payload !== 'string' ||
      typeof candidate.checksum !== 'string'
    ) {
      throw new Error('Malformed durable generation chunk.');
    }
    chunks.push({
      snapshotId: candidate.snapshotId,
      entity: candidate.entity,
      ordinal: candidate.ordinal,
      payload: candidate.payload,
      checksum: candidate.checksum,
    });
  }
  return { capture, chunks };
}

/**
 * Record that an entity's chunks are staged and durable.
 *
 * @param snapshotId the capture this belongs to
 * @param entity the staged entity
 */
export async function markEntityStaged(snapshotId: string, entity: string): Promise<void> {
  const db = await getDatabase();
  const captured = await readCapturedChunks(db);
  if (!captured || captured.capture.snapshotId !== snapshotId) return;
  const { capture, chunks } = captured;
  if (capture.stagedEntities.includes(entity)) return;
  await setAppMetaJson(db, appMetaKeys.backupGenerationCapture, {
    ...capture,
    chunks,
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

/** Build a new protocol capture from an already verified legacy recovery point. */
export function captureVerifiedRows(input: {
  ownerUserId: string;
  rowsByEntity: Partial<Record<(typeof BACKUP_ENTITIES)[number], Record<string, unknown>[]>>;
  settingsPayload: unknown;
  baseHead?: { snapshotId: string; sequence: number } | null;
}): CapturedGeneration {
  const snapshotId = createId('gsnap');
  const capturedAt = nowIso();
  const chunks: GenerationChunk[] = [];
  const expectedChunks: Record<string, number> = {};
  const entities: Record<string, { rows: number; checksum: string }> = {};
  for (const entity of BACKUP_ENTITIES) {
    // IDs use ASCII. Match SQLite BINARY / PostgreSQL C ordering; localeCompare
    // orders punctuation differently and can invalidate a supported old backup.
    const rows = [...(input.rowsByEntity[entity] ?? [])].sort((a, b) =>
      String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0,
    );
    const projected = rows.map((row) =>
      Object.fromEntries(
        BACKUP_ENTITY_COLUMNS[entity]
          .filter((column) => row[column] !== undefined)
          .map((column) => [column, row[column]]),
      ),
    );
    let ordinal = 0;
    for (const payload of generationRowPayloads(projected)) {
      chunks.push({
        snapshotId,
        entity,
        ordinal: ordinal++,
        payload,
        checksum: sha256Hex(payload),
      });
    }
    expectedChunks[entity] = ordinal;
    entities[entity] = {
      rows: projected.length,
      checksum: sha256Hex(canonicalGenerationRows(projected)),
    };
  }
  const settingsPayload = JSON.stringify(input.settingsPayload);
  if (utf8Bytes(settingsPayload) > GENERATION_PAYLOAD_BYTES)
    throw new Error('Backup capture paused: settings exceed the generation payload budget.');
  const settingsChecksum = sha256Hex(settingsPayload);
  chunks.push({
    snapshotId,
    entity: 'user_backup_settings',
    ordinal: 0,
    payload: settingsPayload,
    checksum: settingsChecksum,
  });
  expectedChunks.user_backup_settings = 1;
  entities.user_backup_settings = { rows: 1, checksum: settingsChecksum };
  const scope = currentGenerationScope({
    backupSchemaVersion: BACKUP_SCHEMA_VERSION,
    scopeVersion: BACKUP_SCOPE_VERSION,
    settingsVersion: BACKUP_SETTINGS_VERSION,
  });
  const sequence = 1; // Provisional only; the authenticated server reserves the authoritative value.
  const manifest = canonicalGenerationRows([
    { ...scope, snapshotId, sequence, capturedAt, entities, settingsChecksum },
  ]);
  return {
    capture: {
      snapshotId,
      sequence,
      scope,
      capturedAt,
      manifest,
      manifestChecksum: sha256Hex(manifest),
      expectedChunks,
      stagedEntities: [],
      ownerUserId: input.ownerUserId,
      capturedRevisions: {},
      baseHeadSnapshotId: input.baseHead?.snapshotId ?? null,
      baseHeadSequence: input.baseHead?.sequence ?? null,
      baseHeadProof: 'verified',
    },
    chunks,
  };
}

/** Reserve-before-upload rebasing never rereads or changes captured recovery bytes. */
export function withReservedGenerationSequence(
  captured: CapturedGeneration,
  sequence: number,
): CapturedGeneration {
  if (!Number.isSafeInteger(sequence) || sequence < 1)
    throw new Error('Invalid reserved generation sequence.');
  const parsed = JSON.parse(captured.capture.manifest) as Record<string, unknown>[];
  const manifest = canonicalGenerationRows([{ ...parsed[0], sequence }]);
  return {
    chunks: captured.chunks,
    capture: { ...captured.capture, sequence, manifest, manifestChecksum: sha256Hex(manifest) },
  };
}
