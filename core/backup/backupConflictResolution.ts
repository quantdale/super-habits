import { getDatabase } from '@/core/db/client';
import { getLocalDatasetOwner } from '@/core/auth/account.data';
import { appMetaKeys, getAppMetaJson, setAppMetaJson, setAppMetaText } from '@/core/db/appMeta';
import { withSQLiteTransaction } from '@/core/db/transactions';
import type { CapturedGeneration } from '@/core/backup/generations/capture';
import {
  clearGenerationCapture,
  captureGenerationWithinTransaction,
  readCapturedChunks,
  setVerifiedGenerationBaseHead,
} from '@/core/backup/generations/capture';
import {
  markBackupGenerationConflictResolved,
  readActiveBackupGenerationConflict,
  readBackupGenerationResolutionInProgress,
  setBackupGenerationResolutionInProgress,
} from '@/core/backup/generations/conflict';
import { runBackupMaintenance } from '@/core/backup/backupCheckpoint';
import { readRecoverableSettings } from '@/core/backup/backupSettings';
import { nowIso } from '@/lib/time';

/**
 * Explicit owner decision: keep THIS device's local data and replace the remote
 * recovery head with a fresh local snapshot.
 *
 * Ordering is load-bearing (`AUD-F3`):
 *   1. persist an in-progress marker and keep the conflict ACTIVE;
 *   2. retire the conflicting capture and its pending settings/manifest;
 *   3. record the chosen base + dirty flag;
 *   4. mark resolved and capture fresh local bytes in the SAME transaction.
 *
 * A failed replacement capture rolls back the whole decision, preserving the
 * conflicted bytes and metadata. After commit, a durable fresh capture is ready
 * for publication even if the process stops before maintenance runs. Ordinary
 * entity outbox work is never deleted.
 */
export async function resolveBackupGenerationConflictKeepLocal(): Promise<void> {
  const db = await getDatabase();
  const conflict = await readActiveBackupGenerationConflict(db);
  if (!conflict) {
    // A crash after the final resolved write may leave only the marker behind.
    const staleMarker = await readBackupGenerationResolutionInProgress(db);
    if (staleMarker) {
      await withSQLiteTransaction(db, (transactionDb) =>
        setBackupGenerationResolutionInProgress(null, transactionDb),
      );
    }
    return;
  }
  const ownerUserId = await getLocalDatasetOwner(db);
  if (!ownerUserId || ownerUserId !== conflict.ownerUserId) {
    throw new Error(
      'The local dataset owner changed; refusing to resolve another owner’s backup conflict.',
    );
  }

  await withSQLiteTransaction(db, async (transactionDb) => {
    const transactionConflict = await readActiveBackupGenerationConflict(transactionDb);
    if (!transactionConflict) {
      await setBackupGenerationResolutionInProgress(null, transactionDb);
      return;
    }
    if (transactionConflict.ownerUserId !== ownerUserId) {
      throw new Error(
        'The local dataset owner changed; refusing to resolve another owner’s backup conflict.',
      );
    }

    const marker = await readBackupGenerationResolutionInProgress(transactionDb);
    if (
      marker &&
      (marker.ownerUserId !== ownerUserId ||
        marker.localSnapshotId !== transactionConflict.localSnapshotId ||
        marker.remoteSnapshotId !== transactionConflict.remoteSnapshotId ||
        marker.remoteSequence !== transactionConflict.remoteSequence)
    ) {
      throw new Error(
        'A different backup resolution is already in progress. Review the backup state again.',
      );
    }
    const resuming = marker !== null;

    const legacy = await getAppMetaJson<CapturedGeneration>(
      transactionDb,
      appMetaKeys.backupLegacyGenerationCapture,
    );
    const pending = await readCapturedChunks(transactionDb);
    // A mixed-version device can retain BOTH capture kinds. Match the actual
    // conflicted identity, not whichever storage key happens to be read first.
    const hasConflictedCapture = [legacy?.capture.snapshotId, pending?.capture.snapshotId].includes(
      transactionConflict.localSnapshotId,
    );
    if (!resuming && !hasConflictedCapture) {
      throw new Error(
        'The pending recovery point changed since the conflict was recorded. Review the backup state again.',
      );
    }

    if (!resuming) {
      await setBackupGenerationResolutionInProgress(
        {
          ownerUserId,
          localSnapshotId: transactionConflict.localSnapshotId,
          remoteSnapshotId: transactionConflict.remoteSnapshotId,
          remoteSequence: transactionConflict.remoteSequence,
          startedAt: nowIso(),
        },
        transactionDb,
      );
    }

    // Retire the conflicting evidence and every mutable snapshot bound to it
    // BEFORE the conflict becomes non-active.
    if (legacy) {
      await setAppMetaText(transactionDb, appMetaKeys.backupLegacyGenerationCapture, 'null');
    }
    if (pending) {
      await clearGenerationCapture(transactionDb);
    }
    await setAppMetaText(transactionDb, appMetaKeys.backupPendingSettings, 'null');
    await setAppMetaText(transactionDb, appMetaKeys.backupPendingManifest, 'null');

    // The owner explicitly chose local over the observed remote point. This is
    // the only source of a new verified base here; the server still re-checks it
    // against the live head, so a newer unseen publication re-enters conflict.
    const chosenBase = {
      ownerUserId,
      snapshotId: transactionConflict.remoteSnapshotId,
      sequence: transactionConflict.remoteSequence,
    };
    await setVerifiedGenerationBaseHead(transactionDb, chosenBase);
    await setAppMetaJson(transactionDb, appMetaKeys.backupObservedGenerationHead, {
      snapshotId: chosenBase.snapshotId,
      sequence: chosenBase.sequence,
    });
    await setAppMetaText(transactionDb, appMetaKeys.backupDirty, '1');

    // Resolve only inside this transaction so the capture guard can admit the
    // replacement. No reader can observe a committed resolved state without
    // its fresh durable bytes; a capture/settings failure rolls everything back.
    await markBackupGenerationConflictResolved(transactionConflict, transactionDb);
    await captureGenerationWithinTransaction(
      transactionDb,
      await readRecoverableSettings(transactionDb),
    );
    await setBackupGenerationResolutionInProgress(null, transactionDb);
  });

  // The resolution transaction has already committed; a maintenance failure
  // here is retryable background work (dirty state is re-derived), not a
  // resolution failure. Reporting it as one would tell the owner their decision
  // failed when it in fact succeeded (`W-4`).
  try {
    await runBackupMaintenance();
  } catch (error) {
    console.error('[backup] post-resolution maintenance failed; will retry later', error);
  }
}
