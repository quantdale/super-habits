import { beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

describe('backup generation conflict state', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(db as never, 'user_a');
  });

  async function seedConflict(ownerUserId = 'user_a') {
    const { captureGeneration, readCapturedChunks } =
      await import('@/core/backup/generations/capture');
    await captureGeneration({ settingsPayload: {} });
    const pending = await readCapturedChunks(db as never);
    const { recordBackupGenerationConflict } = await import('@/core/backup/generations/conflict');
    await recordBackupGenerationConflict(
      {
        ownerUserId,
        localSnapshotId: pending!.capture.snapshotId,
        localCapturedAt: pending!.capture.capturedAt,
        localKind: 'generation',
        remoteSnapshotId: 'snap_from_other_device',
        remoteSequence: 2,
      },
      db as never,
    );
    return { pending: pending! };
  }

  it('AUD-F6: refuses to replace the durable capture while a conflict is active', async () => {
    const { pending } = await seedConflict();
    const { captureGeneration, readCapturedChunks } =
      await import('@/core/backup/generations/capture');
    await expect(captureGeneration({ settingsPayload: {} })).rejects.toThrow(/conflict|review/i);
    expect((await readCapturedChunks(db as never))?.capture.snapshotId).toBe(
      pending.capture.snapshotId,
    );
  });

  it('refuses to resolve a conflict recorded for a different dataset owner', async () => {
    const { pending } = await seedConflict('user_other');
    const { resolveBackupGenerationConflictKeepLocal } =
      await import('@/core/backup/backupConflictResolution');
    await expect(resolveBackupGenerationConflictKeepLocal()).rejects.toThrow(
      'local dataset owner changed',
    );
    const { readCapturedChunks } = await import('@/core/backup/generations/capture');
    const { readActiveBackupGenerationConflict } =
      await import('@/core/backup/generations/conflict');
    expect(await readActiveBackupGenerationConflict(db as never)).not.toBeNull();
    expect((await readCapturedChunks(db as never))?.capture.snapshotId).toBe(
      pending.capture.snapshotId,
    );
  });

  it('fails closed when the durable conflict record is malformed', async () => {
    const { setAppMetaText, appMetaKeys } = await import('@/core/db/appMeta');
    await setAppMetaText(db as never, appMetaKeys.backupGenerationConflict, '{"bad":true}');
    const { readActiveBackupGenerationConflict } =
      await import('@/core/backup/generations/conflict');
    await expect(readActiveBackupGenerationConflict(db as never)).rejects.toThrow(
      /malformed|paused/i,
    );
  });

  it('clears a stale resolution marker when no active conflict remains', async () => {
    const { readBackupGenerationResolutionInProgress, setBackupGenerationResolutionInProgress } =
      await import('@/core/backup/generations/conflict');
    await setBackupGenerationResolutionInProgress(
      {
        ownerUserId: 'user_a',
        localSnapshotId: 'snap_done',
        remoteSnapshotId: 'snap_remote',
        remoteSequence: 2,
        startedAt: '2026-10-20T00:00:00.000Z',
      },
      db as never,
    );
    const { resolveBackupGenerationConflictKeepLocal } =
      await import('@/core/backup/backupConflictResolution');
    await resolveBackupGenerationConflictKeepLocal();
    expect(await readBackupGenerationResolutionInProgress(db as never)).toBeNull();
  });
});
