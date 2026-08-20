import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getLocalDatasetOwner } from '@/core/auth/account.data';
import { BACKUP_ENTITIES } from '@/core/backup/backup.types';
import {
  canonicalSettingsPayloadText,
  readRecoverableSettings,
} from '@/core/backup/backupSettings';
import { getDatabase } from '@/core/db/client';
import { withSQLiteTransaction } from '@/core/db/transactions';
import { utf8Bytes } from '@/lib/checksum';
import { portableOwnerFingerprint } from '@/lib/portableOwnerFingerprint';
import { nowIso } from '@/lib/time';
import {
  buildPortableBackupFile,
  portableExportFileName,
  formatBytes,
} from '@/core/portable/portableFormat';
import { PORTABLE_V1_MAX_BYTES } from '@/core/portable/portable.types';
import type { BackupEntity, RecoverableSettingsV2 } from '@/core/backup/backup.types';

/**
 * Portable backup export — user-controlled, offline, read-only.
 *
 * The snapshot is captured inside ONE serialized SQLite read transaction
 * (all recoverable entities for the current scope + SQLite-backed recoverable
 * settings + AsyncStorage theme), then re-verified after commit: if the
 * settings/theme canonical text changed
 * during capture, the capture runs once more. Export performs NO writes — no
 * sync records, no linked-action events, no saved-meal use-count changes, no
 * `app_meta` mutations.
 *
 * The owner fingerprint comes from the DURABLE local dataset binding (the
 * authority), never from the current session: a file describes data, it does
 * not authenticate anyone.
 */

export type PortableSnapshot = {
  rowsByEntity: Partial<Record<BackupEntity, Record<string, unknown>[]>>;
  settings: RecoverableSettingsV2;
  ownerFingerprint: string | null;
};

export type PortableExportResult =
  | { ok: true; fileName: string; json: string; byteLength: number }
  | {
      ok: false;
      /** The dataset exceeds the V1 size contract; NO file was produced. */
      reason: 'too_large';
      error: string;
      byteLength: number;
      maxBytes: number;
    }
  | { ok: false; error: string };

async function capturePortableSnapshot(
  db: Awaited<ReturnType<typeof getDatabase>>,
): Promise<PortableSnapshot> {
  return withSQLiteTransaction(db, async (transactionDb) => {
    const rowsByEntity: Partial<Record<BackupEntity, Record<string, unknown>[]>> = {};
    for (const entity of BACKUP_ENTITIES) {
      // Entity names are compile-time constants; no file input reaches SQL.
      rowsByEntity[entity] = await transactionDb.getAllAsync<Record<string, unknown>>(
        `SELECT * FROM ${entity} ORDER BY id ASC`,
      );
    }
    // Theme lives in AsyncStorage and is read close to the SQLite snapshot;
    // the caller re-verifies the combined canonical settings text after the
    // transaction and retries once if it changed.
    const settings = await readRecoverableSettings(transactionDb);
    const ownerUserId = await getLocalDatasetOwner(transactionDb);
    return {
      rowsByEntity,
      settings,
      ownerFingerprint: ownerUserId ? portableOwnerFingerprint(ownerUserId) : null,
    };
  });
}

/**
 * Export the complete recoverable dataset as ONE self-contained portable
 * file. Never mutates user data. Returns the serialized JSON + a
 * deterministic filename.
 */
export async function exportPortableBackup(): Promise<PortableExportResult> {
  try {
    const db = await getDatabase();
    let snapshot: PortableSnapshot | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      snapshot = await capturePortableSnapshot(db);
      // Cross-store coherence: the theme (AsyncStorage) is captured close to
      // the SQLite snapshot; if the canonical settings text changed while we
      // were reading, recapture once. The second capture is accepted
      // (documented best-effort — export is read-only and never blocks
      // writers).
      const after = await readRecoverableSettings(db);
      if (
        canonicalSettingsPayloadText(after) === canonicalSettingsPayloadText(snapshot.settings) ||
        attempt === 1
      ) {
        break;
      }
    }

    const exportedAt = nowIso();
    const file = buildPortableBackupFile({
      exportedAt,
      appVersion: Constants.expoConfig?.version ?? 'unknown',
      platform: Platform.OS,
      ownerFingerprint: snapshot!.ownerFingerprint,
      rowsByEntity: snapshot!.rowsByEntity,
      settings: snapshot!.settings,
    });
    const json = JSON.stringify(file, null, 2);
    const byteLength = utf8Bytes(json).length;
    // Round-trip contract: every SUCCESSFUL V1 export must fit within the V1
    // import size bound. An oversized dataset fails here — before any file is
    // presented — instead of producing a backup that the V1 importer would
    // reject later. Cloud backup is unaffected; nothing is truncated.
    if (byteLength > PORTABLE_V1_MAX_BYTES) {
      return {
        ok: false,
        reason: 'too_large',
        byteLength,
        maxBytes: PORTABLE_V1_MAX_BYTES,
        error: `Your dataset is larger than Portable Backup V1 can safely package (current size ${formatBytes(
          byteLength,
        )}; supported maximum ${formatBytes(PORTABLE_V1_MAX_BYTES)}). No portable file was created. Your local data was not changed.`,
      };
    }
    return {
      ok: true,
      fileName: portableExportFileName(exportedAt),
      json,
      byteLength,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Export failed: ${message}` };
  }
}
