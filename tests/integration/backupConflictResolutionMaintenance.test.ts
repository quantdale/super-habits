import { describe, expect, it, vi } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';
import { GenerationRemoteDouble } from './helpers/generationRemoteDouble';
import { seedVerifiedGenerationBaseHead } from './helpers/generationBaseline';
import {
  BACKUP_ENTITIES,
  BACKUP_MANIFEST_RECORD_ID,
  BACKUP_SETTINGS_RECORD_ID,
  BACKUP_SETTINGS_VERSION,
} from '@/core/backup/backup.types';

/** Minimal production-shaped transport for the real maintenance/resolution path. */
function remote() {
  const generations = new GenerationRemoteDouble();
  const tables = new Map<string, Map<string, Record<string, unknown>>>();
  const writes: { entity: string; rows: Record<string, unknown>[] }[] = [];
  let failPublish = false;
  const client = {
    rpc: vi.fn(async (name: string, args: Record<string, unknown> = {}) => {
      if (name === 'publish_backup_generation' && failPublish) {
        return { data: null, error: { message: 'publication interrupted' } };
      }
      return generations.rpc(name, args);
    }),
    from: vi.fn((entity: string) => ({
      upsert: vi.fn(async (input: Record<string, unknown> | Record<string, unknown>[]) => {
        const rows = Array.isArray(input) ? input : [input];
        writes.push({ entity, rows });
        if (entity.startsWith('backup_generation')) {
          return generations.upsert(entity, rows);
        }
        const table = tables.get(entity) ?? new Map<string, Record<string, unknown>>();
        for (const row of rows) table.set(String(row.id ?? row.user_id ?? 'singleton'), { ...row });
        tables.set(entity, table);
        return { error: null };
      }),
      select: vi.fn(() => {
        const filters: [string, unknown][] = [];
        let ids: string[] | undefined;
        const rows = () => {
          const candidates =
            entity === 'backup_generation_head'
              ? [...generations.heads].map(([user_id, head]) => ({ user_id, ...head }))
              : entity === 'backup_generation_publication'
                ? [...generations.publications.values()]
                : entity === 'backup_generation'
                  ? [...generations.generations.values()]
                  : entity === 'backup_generation_chunk'
                    ? [...generations.chunks.values()]
                    : [...(tables.get(entity)?.values() ?? [])];
          return candidates
            .filter((row) => filters.every(([column, value]) => row[column] === value))
            .filter((row) => !ids || ids.includes(String(row.id)))
            .sort(
              (a, b) =>
                String(a.entity ?? a.id).localeCompare(String(b.entity ?? b.id)) ||
                Number(a.ordinal ?? 0) - Number(b.ordinal ?? 0),
            );
        };
        const answer = (from: number, to: number) => ({
          data: rows().slice(from, to + 1),
          error: null,
        });
        const query = {
          eq: vi.fn((column: string, value: unknown) => {
            filters.push([column, value]);
            return query;
          }),
          in: vi.fn((_column: string, values: string[]) => {
            ids = values;
            return query;
          }),
          order: vi.fn(() => query),
          limit: vi.fn(async (count: number) => answer(0, count - 1)),
          range: vi.fn(async (from: number, to: number) => answer(from, to)),
        };
        return query;
      }),
      delete: vi.fn(() => ({
        in: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
      })),
    })),
  };
  return {
    client,
    generations,
    tables,
    writes,
    setFailPublish: (value: boolean) => {
      failPublish = value;
    },
  };
}

function install(client: ReturnType<typeof remote>['client']) {
  vi.doMock('@/lib/supabase', () => ({
    supabase: client,
    isRemoteEnabled: () => true,
    getSupabaseAuthUserId: async () => 'user_a',
    getSupabaseSessionUserId: async () => 'user_a',
  }));
}

async function seedConflictFixture(db: TestDatabase, target: ReturnType<typeof remote>) {
  const { appMetaKeys, setAppMetaText, setAppMetaJson } = await import('@/core/db/appMeta');
  const { BACKUP_SCOPE_VERSION: scope } = await import('@/core/backup/backup.types');
  await setAppMetaText(db as never, appMetaKeys.backupScopeVersion, String(scope));
  await setAppMetaText(db as never, appMetaKeys.backupBackfillStatus, 'complete');
  await setAppMetaJson(db as never, appMetaKeys.backupBackfillDoneEntities, [...BACKUP_ENTITIES]);

  const { readRecoverableSettings, canonicalizeSettingsPayload } =
    await import('@/core/backup/backupSettings');
  const { captureGeneration, readCapturedChunks } =
    await import('@/core/backup/generations/capture');
  const captured = await captureGeneration({
    settingsPayload: await readRecoverableSettings(db as never),
  });
  const { recordBackupGenerationConflict } = await import('@/core/backup/generations/conflict');

  const staleSettings = {
    theme: { mode: 'dark', slots: { stale: 'F3_STALE_SETTINGS' } },
  };
  const staleManifest = {
    backupSchemaVersion: 2,
    backupScopeVersion: scope,
    generation: 99,
    completedAt: '2026-10-20T00:00:00.000Z',
    entityMetadata: {},
    settingsVersion: BACKUP_SETTINGS_VERSION,
    settingsMetadata: {
      version: BACKUP_SETTINGS_VERSION,
      checksum: canonicalizeSettingsPayload(staleSettings),
    },
  };
  await setAppMetaJson(db as never, appMetaKeys.backupPendingSettings, {
    generation: 99,
    payload: staleSettings,
  });
  await setAppMetaJson(db as never, appMetaKeys.backupPendingManifest, staleManifest);

  const remoteHead = { snapshot_id: 'snap_from_b_f3', sequence: 2 };
  target.generations.generations.set('user_a:snap_from_b_f3', {
    user_id: 'user_a',
    snapshot_id: 'snap_from_b_f3',
    sequence: 2,
    manifest_checksum: 'checksum_from_b_f3',
  });
  target.generations.publications.set('user_a:snap_from_b_f3', {
    user_id: 'user_a',
    snapshot_id: 'snap_from_b_f3',
    sequence: 2,
  });
  target.generations.heads.set('user_a', remoteHead);
  await recordBackupGenerationConflict(
    {
      ownerUserId: 'user_a',
      localSnapshotId: captured.capture.snapshotId,
      localCapturedAt: captured.capture.capturedAt,
      localKind: 'generation',
      remoteSnapshotId: remoteHead.snapshot_id,
      remoteSequence: remoteHead.sequence,
    },
    db as never,
  );

  const { syncEngine } = await import('@/core/sync/sync.engine');
  const record = (entity: string, id: string) => ({
    entity,
    id,
    updatedAt: '2026-10-20T00:00:00.000Z',
    operation: 'update' as const,
    ownerUserId: 'user_a',
  });
  syncEngine.enqueue(record('user_backup_settings', BACKUP_SETTINGS_RECORD_ID));
  syncEngine.enqueue(record('backup_manifest', BACKUP_MANIFEST_RECORD_ID));

  return { staleSettings, staleManifest, captured, readCapturedChunks };
}

function staleSettingsWrites(writes: { entity: string; rows: Record<string, unknown>[] }[]) {
  return writes
    .filter((entry) => entry.entity === 'user_backup_settings')
    .flatMap((entry) => entry.rows)
    .filter((row) => JSON.stringify(row.payload).includes('F3_STALE_SETTINGS'));
}

describe('AUD-F3: keep-local resolution uses real maintenance ordering', () => {
  it('drops stale pending settings/manifest, then publishes the current local state', async () => {
    const target = remote();
    install(target.client);
    const db = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(db as never, 'user_a');
    await seedVerifiedGenerationBaseHead(db, 'user_a', 'snap_a1_f3', 1);
    const { captured, staleManifest, readCapturedChunks } = await seedConflictFixture(db, target);

    const { resolveBackupGenerationConflictKeepLocal } =
      await import('@/core/backup/backupConflictResolution');
    await resolveBackupGenerationConflictKeepLocal();

    expect(staleSettingsWrites(target.writes)).toEqual([]);
    expect(
      target.writes.some(
        (entry) =>
          entry.entity === 'backup_manifest' &&
          entry.rows.some((row) => row.generation === staleManifest.generation),
      ),
    ).toBe(false);
    expect(target.generations.heads.get('user_a')?.sequence).toBeGreaterThan(2);
    expect(await readCapturedChunks(db as never)).toBeNull();
    const { appMetaKeys, getAppMetaJson } = await import('@/core/db/appMeta');
    // A successful recapture enqueues FRESH pending records; the stale F3 bytes
    // must not survive into them.
    expect(
      JSON.stringify(await getAppMetaJson(db as never, appMetaKeys.backupPendingSettings)),
    ).not.toContain('F3_STALE_SETTINGS');
    expect(
      JSON.stringify(await getAppMetaJson(db as never, appMetaKeys.backupPendingManifest)),
    ).not.toContain('"generation":99');
    expect(captured.capture.snapshotId).toBeTruthy();
    await db.closeAsync();
  });

  it('resolves a normal-capture conflict when a separate legacy capture is also pending', async () => {
    const target = remote();
    install(target.client);
    const db = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(db as never, 'user_a');
    await seedVerifiedGenerationBaseHead(db, 'user_a', 'snap_a1_dual', 1);
    await seedConflictFixture(db, target);
    const { captureVerifiedRows } = await import('@/core/backup/generations/capture');
    const { appMetaKeys, setAppMetaJson, getAppMetaJson } = await import('@/core/db/appMeta');
    await setAppMetaJson(
      db as never,
      appMetaKeys.backupLegacyGenerationCapture,
      captureVerifiedRows({ ownerUserId: 'user_a', rowsByEntity: {}, settingsPayload: {} }),
    );
    const { resolveBackupGenerationConflictKeepLocal } =
      await import('@/core/backup/backupConflictResolution');

    await expect(resolveBackupGenerationConflictKeepLocal()).resolves.toBeUndefined();

    expect(target.generations.heads.get('user_a')?.sequence).toBeGreaterThan(2);
    expect(staleSettingsWrites(target.writes)).toEqual([]);
    expect(await getAppMetaJson(db as never, appMetaKeys.backupLegacyGenerationCapture)).toBeNull();
    await db.closeAsync();
  });

  it('rolls back the owner decision and retains old bytes when the replacement capture fails', async () => {
    const target = remote();
    install(target.client);
    const db = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(db as never, 'user_a');
    await seedVerifiedGenerationBaseHead(db, 'user_a', 'snap_a1_atomic', 1);
    const { captured, readCapturedChunks } = await seedConflictFixture(db, target);
    await db.execAsync(`CREATE TRIGGER fail_replacement_capture BEFORE INSERT ON app_meta
      WHEN NEW.key = 'backup.generation_capture'
      BEGIN SELECT RAISE(ABORT, 'forced replacement capture failure'); END;`);
    const { resolveBackupGenerationConflictKeepLocal } =
      await import('@/core/backup/backupConflictResolution');

    await expect(resolveBackupGenerationConflictKeepLocal()).rejects.toThrow(
      'forced replacement capture failure',
    );

    const { readActiveBackupGenerationConflict } =
      await import('@/core/backup/generations/conflict');
    expect((await readActiveBackupGenerationConflict(db as never))?.localSnapshotId).toBe(
      captured.capture.snapshotId,
    );
    expect(await readCapturedChunks(db as never)).toEqual(captured);
    expect(target.writes).toEqual([]);
    await db.execAsync('DROP TRIGGER fail_replacement_capture');
    await resolveBackupGenerationConflictKeepLocal();
    expect(target.generations.heads.get('user_a')?.sequence).toBeGreaterThan(2);
    await db.closeAsync();
  });

  it('keeps a durable replacement and reports the committed decision when maintenance throws', async () => {
    const target = remote();
    install(target.client);
    const db = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(db as never, 'user_a');
    await seedVerifiedGenerationBaseHead(db, 'user_a', 'snap_a1_maintenance', 1);
    const { captured, readCapturedChunks } = await seedConflictFixture(db, target);
    const maintenance = await import('@/core/backup/backupCheckpoint');
    const failure = vi
      .spyOn(maintenance, 'runBackupMaintenance')
      .mockRejectedValueOnce(new Error('forced post-commit maintenance failure'));
    const { resolveBackupGenerationConflictKeepLocal } =
      await import('@/core/backup/backupConflictResolution');
    try {
      await expect(resolveBackupGenerationConflictKeepLocal()).resolves.toBeUndefined();
      expect(failure).toHaveBeenCalledTimes(1);
      const pending = await readCapturedChunks(db as never);
      expect(pending).not.toBeNull();
      expect(pending?.capture.snapshotId).not.toBe(captured.capture.snapshotId);
      expect(pending?.capture.baseHeadSnapshotId).toBe('snap_from_b_f3');
      const { readActiveBackupGenerationConflict } =
        await import('@/core/backup/generations/conflict');
      expect(await readActiveBackupGenerationConflict(db as never)).toBeNull();
    } finally {
      failure.mockRestore();
      await db.closeAsync();
    }
  });

  it('does not write stale state when the fresh publication fails, then retries safely', async () => {
    const target = remote();
    install(target.client);
    const db = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(db as never, 'user_a');
    await seedVerifiedGenerationBaseHead(db, 'user_a', 'snap_a1_f3_retry', 1);
    const { readCapturedChunks } = await seedConflictFixture(db, target);
    target.setFailPublish(true);

    const { resolveBackupGenerationConflictKeepLocal } =
      await import('@/core/backup/backupConflictResolution');
    await resolveBackupGenerationConflictKeepLocal();

    expect(staleSettingsWrites(target.writes)).toEqual([]);
    expect(target.generations.heads.get('user_a')).toEqual({
      snapshot_id: 'snap_from_b_f3',
      sequence: 2,
    });
    expect(await readCapturedChunks(db as never)).not.toBeNull();

    target.setFailPublish(false);
    const { runBackupMaintenance } = await import('@/core/backup/backupCheckpoint');
    await runBackupMaintenance();
    expect(target.generations.heads.get('user_a')?.sequence).toBeGreaterThan(2);
    expect(await readCapturedChunks(db as never)).toBeNull();
    await db.closeAsync();
  });
});
