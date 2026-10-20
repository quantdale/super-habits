import type * as SQLite from 'expo-sqlite';
import { getDatabase } from '@/core/db/client';
import { appMetaKeys, getAppMetaJson, getAppMetaText, setAppMetaJson } from '@/core/db/appMeta';
import { nowIso } from '@/lib/time';

/** The local snapshot that cannot be safely published over the current head. */
export type BackupGenerationConflict = {
  ownerUserId: string;
  localSnapshotId: string;
  localCapturedAt: string;
  localKind: 'legacy_cutover' | 'generation';
  remoteSnapshotId: string;
  remoteSequence: number;
  detectedAt: string;
  /** Set only after an explicit owner decision; an unresolved conflict is active. */
  resolution: 'keep_local' | null;
  resolvedAt: string | null;
};

/**
 * Durable marker written before a keep-local resolution retires the conflicting
 * capture. If the process dies mid-resolution, the next explicit review can
 * resume instead of finding an active conflict whose snapshot is already gone.
 */
export type BackupGenerationResolutionMarker = {
  ownerUserId: string;
  localSnapshotId: string;
  remoteSnapshotId: string;
  remoteSequence: number;
  startedAt: string;
};

/** The owner must review the two recovery points before publication can resume. */
export class BackupGenerationConflictError extends Error {
  constructor(readonly conflict: BackupGenerationConflict) {
    super(
      `Backup recovery conflict: the pending local recovery point ${conflict.localSnapshotId} ` +
        `predates the newer remote recovery point ${conflict.remoteSnapshotId} ` +
        `(sequence ${conflict.remoteSequence}); publication paused. ` +
        'Review this device and the remote recovery point in Settings > Backup before continuing.',
    );
    this.name = 'BackupGenerationConflictError';
  }
}

function normalizeConflict(value: unknown): BackupGenerationConflict | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.ownerUserId !== 'string' || candidate.ownerUserId === '') return null;
  if (typeof candidate.localSnapshotId !== 'string' || candidate.localSnapshotId === '')
    return null;
  if (typeof candidate.localCapturedAt !== 'string') return null;
  if (candidate.localKind !== 'legacy_cutover' && candidate.localKind !== 'generation') return null;
  if (typeof candidate.remoteSnapshotId !== 'string' || candidate.remoteSnapshotId === '')
    return null;
  if (
    typeof candidate.remoteSequence !== 'number' ||
    !Number.isSafeInteger(candidate.remoteSequence)
  )
    return null;
  if (typeof candidate.detectedAt !== 'string') return null;
  if (candidate.resolution !== null && candidate.resolution !== 'keep_local') return null;
  if (candidate.resolvedAt !== null && typeof candidate.resolvedAt !== 'string') return null;
  return {
    ownerUserId: candidate.ownerUserId,
    localSnapshotId: candidate.localSnapshotId,
    localCapturedAt: candidate.localCapturedAt,
    localKind: candidate.localKind,
    remoteSnapshotId: candidate.remoteSnapshotId,
    remoteSequence: candidate.remoteSequence,
    detectedAt: candidate.detectedAt,
    resolution: candidate.resolution,
    resolvedAt: candidate.resolvedAt,
  };
}

/** Read the unresolved conflict, if any. Resolved records remain as audit evidence. */
export async function readActiveBackupGenerationConflict(
  db?: SQLite.SQLiteDatabase,
): Promise<BackupGenerationConflict | null> {
  const conflict = await readBackupGenerationConflict(db);
  return conflict && conflict.resolution === null ? conflict : null;
}

/** Read the latest conflict record, including a resolved one. */
export async function readBackupGenerationConflict(
  db?: SQLite.SQLiteDatabase,
): Promise<BackupGenerationConflict | null> {
  const database = db ?? (await getDatabase());
  const raw = await getAppMetaText(database, appMetaKeys.backupGenerationConflict);
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Backup conflict state is malformed; publication is paused.');
  }
  const conflict = normalizeConflict(parsed);
  if (!conflict) {
    throw new Error('Backup conflict state is malformed; publication is paused.');
  }
  return conflict;
}

/** Persist the conflict without touching either recovery point's bytes. */
export async function recordBackupGenerationConflict(
  input: Omit<BackupGenerationConflict, 'detectedAt' | 'resolution' | 'resolvedAt'>,
  db?: SQLite.SQLiteDatabase,
): Promise<BackupGenerationConflict> {
  const database = db ?? (await getDatabase());
  const previous = await readBackupGenerationConflict(database);
  if (
    previous &&
    previous.resolution === null &&
    previous.localSnapshotId === input.localSnapshotId &&
    previous.remoteSnapshotId === input.remoteSnapshotId
  ) {
    return previous;
  }
  const conflict: BackupGenerationConflict = {
    ...input,
    detectedAt: nowIso(),
    resolution: null,
    resolvedAt: null,
  };
  await setAppMetaJson(database, appMetaKeys.backupGenerationConflict, conflict);
  return conflict;
}

function normalizeResolutionMarker(value: unknown): BackupGenerationResolutionMarker | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.ownerUserId !== 'string' || candidate.ownerUserId === '') return null;
  if (typeof candidate.localSnapshotId !== 'string' || candidate.localSnapshotId === '')
    return null;
  if (typeof candidate.remoteSnapshotId !== 'string' || candidate.remoteSnapshotId === '')
    return null;
  if (
    typeof candidate.remoteSequence !== 'number' ||
    !Number.isSafeInteger(candidate.remoteSequence)
  )
    return null;
  if (typeof candidate.startedAt !== 'string' || candidate.startedAt === '') return null;
  return {
    ownerUserId: candidate.ownerUserId,
    localSnapshotId: candidate.localSnapshotId,
    remoteSnapshotId: candidate.remoteSnapshotId,
    remoteSequence: candidate.remoteSequence,
    startedAt: candidate.startedAt,
  };
}

/** Read a keep-local resolution that started but may not have completed. */
export async function readBackupGenerationResolutionInProgress(
  db?: SQLite.SQLiteDatabase,
): Promise<BackupGenerationResolutionMarker | null> {
  const database = db ?? (await getDatabase());
  const raw = await getAppMetaJson<unknown>(
    database,
    appMetaKeys.backupGenerationResolutionInProgress,
  );
  if (raw === null) return null;
  const marker = normalizeResolutionMarker(raw);
  if (!marker) {
    throw new Error('Backup conflict resolution state is malformed; publication is paused.');
  }
  return marker;
}

/** Persist/clear the in-progress keep-local resolution marker. */
export async function setBackupGenerationResolutionInProgress(
  marker: BackupGenerationResolutionMarker | null,
  db?: SQLite.SQLiteDatabase,
): Promise<void> {
  const database = db ?? (await getDatabase());
  await setAppMetaJson(database, appMetaKeys.backupGenerationResolutionInProgress, marker);
}

/** Mark the owner's explicit decision; callers must still retire pending captures. */
export async function markBackupGenerationConflictResolved(
  conflict: BackupGenerationConflict,
  db?: SQLite.SQLiteDatabase,
): Promise<void> {
  const database = db ?? (await getDatabase());
  await setAppMetaJson(database, appMetaKeys.backupGenerationConflict, {
    ...conflict,
    resolution: 'keep_local' as const,
    resolvedAt: nowIso(),
  });
}
