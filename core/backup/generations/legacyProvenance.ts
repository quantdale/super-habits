import type * as SQLite from 'expo-sqlite';
import { appMetaKeys, getAppMetaJsonOrDefault, setAppMetaJson } from '@/core/db/appMeta';
import {
  BACKUP_ENTITIES,
  BACKUP_ENTITY_COLUMNS,
  type BackupEntity,
} from '@/core/backup/backup.types';
import { sha256Hex } from '@/lib/checksum';
import { canonicalGenerationRows } from './generationFormat';
import type { CapturedGeneration } from './capture';

type ContentSummary = {
  entities: Record<string, { rows: number; checksum: string }>;
  settingsChecksum: string;
};

type VerifiedLegacyRestore = { ownerUserId: string; contentChecksum: string };

/** Ignore generation identity/sequence, but bind EVERY recoverable content byte. */
function contentChecksum(summary: ContentSummary): string {
  return sha256Hex(
    JSON.stringify({
      entities: BACKUP_ENTITIES.map((entity) => ({ entity, ...summary.entities[entity] })),
      settingsChecksum: summary.settingsChecksum,
    }),
  );
}

/**
 * Persist provenance inside the verified legacy V2 import transaction. A device
 * may edit after restoring; its later first-generation cutover is authorized
 * only if the preserved remote content still matches this exact restored base.
 * No chunks/budget checks are needed here: readable legacy data must remain
 * restorable even when a later upload would exceed a transport budget.
 */
export async function recordVerifiedLegacyRestore(
  db: SQLite.SQLiteDatabase,
  ownerUserId: string,
  snapshot: {
    rowsByEntity: Partial<Record<BackupEntity, Record<string, unknown>[]>>;
    settingsPayload: unknown;
  },
): Promise<void> {
  const entities = Object.fromEntries(
    BACKUP_ENTITIES.map((entity) => {
      const rows = [...(snapshot.rowsByEntity[entity] ?? [])]
        .sort((a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0))
        .map((row) =>
          Object.fromEntries(
            BACKUP_ENTITY_COLUMNS[entity]
              .filter((column) => row[column] !== undefined)
              .map((column) => [column, row[column]]),
          ),
        );
      return [entity, { rows: rows.length, checksum: sha256Hex(canonicalGenerationRows(rows)) }];
    }),
  );
  await setAppMetaJson(db, appMetaKeys.backupVerifiedLegacyRestore, {
    ownerUserId,
    contentChecksum: contentChecksum({
      entities,
      settingsChecksum: sha256Hex(JSON.stringify(snapshot.settingsPayload)),
    }),
  });
}

/** Missing, malformed, other-owner, or changed-content proof never authorizes publication. */
export async function isVerifiedLegacyRestoreBase(
  db: SQLite.SQLiteDatabase,
  ownerUserId: string,
  captured: CapturedGeneration,
): Promise<boolean> {
  const proof = await getAppMetaJsonOrDefault<VerifiedLegacyRestore | null>(
    db,
    appMetaKeys.backupVerifiedLegacyRestore,
    null,
    (value) => {
      if (!value || typeof value !== 'object') return null;
      const candidate = value as Record<string, unknown>;
      return typeof candidate.ownerUserId === 'string' &&
        typeof candidate.contentChecksum === 'string' &&
        /^[a-f0-9]{64}$/.test(candidate.contentChecksum)
        ? { ownerUserId: candidate.ownerUserId, contentChecksum: candidate.contentChecksum }
        : null;
    },
  );
  if (!proof || proof.ownerUserId !== ownerUserId || captured.capture.ownerUserId !== ownerUserId)
    return false;
  // Capture metadata is verified against its immutable chunks by publication.
  // Parsing failure is fatal, never an implicit grant of local provenance.
  let manifest: ContentSummary[];
  try {
    manifest = JSON.parse(captured.capture.manifest) as ContentSummary[];
  } catch {
    throw new Error('Legacy capture manifest is malformed; publication remains paused.');
  }
  if (
    !Array.isArray(manifest) ||
    manifest.length !== 1 ||
    !manifest[0]?.entities ||
    typeof manifest[0].settingsChecksum !== 'string'
  )
    throw new Error('Legacy capture manifest is malformed; publication remains paused.');
  return proof.contentChecksum === contentChecksum(manifest[0]);
}
