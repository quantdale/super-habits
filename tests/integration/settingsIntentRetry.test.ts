import { afterEach, describe, expect, it, vi } from 'vitest';
import { freshDatabase } from './helpers/db';
import { BACKUP_SCOPE_VERSION } from '@/core/backup/backup.types';

const storage = vi.hoisted(() => new Map<string, string>());
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  storage.clear();
});

describe('settings intent failures retain durable retry evidence', () => {
  it.each(['capture', 'snapshot', 'outbox'] as const)(
    'recaptures a saved setting after a transient %s failure',
    async (failure) => {
      const db = await freshDatabase();
      try {
        const account = await import('@/core/auth/account.data');
        await account.setLocalDatasetOwner(db as never, 'settings-owner');
        const { appMetaKeys, setAppMetaText, setAppMetaJson } = await import('@/core/db/appMeta');
        // Model an existing clean checkpoint. Backfill must not mask the lost
        // retry intent by independently dirtying the dataset on first use.
        await setAppMetaText(
          db as never,
          appMetaKeys.backupScopeVersion,
          String(BACKUP_SCOPE_VERSION),
        );
        await setAppMetaText(db as never, appMetaKeys.backupDirty, '0');
        const settings = await import('@/core/backup/backupSettings');
        const original = db.runAsync.bind(db);
        if (failure === 'capture') {
          vi.spyOn(settings, 'readRecoverableSettings').mockRejectedValueOnce(
            new Error('capture failed'),
          );
        } else {
          let injected = false;
          vi.spyOn(db, 'runAsync').mockImplementation(async (sql, params) => {
            if (
              !injected &&
              (failure === 'snapshot'
                ? params?.[0] === appMetaKeys.backupPendingSettings.key
                : sql.includes('INSERT INTO sync_outbox'))
            ) {
              injected = true;
              throw new Error(`${failure} failed`);
            }
            return original(sql, params);
          });
        }
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const { runRecoverableSettingsMutation } = await import('@/core/sync/syncedMutation');
        const goal = { calories: 2345, protein: 120, carbs: 230, fats: 70 };
        const result = await runRecoverableSettingsMutation({
          db: db as never,
          mutate: (tx) => setAppMetaJson(tx, appMetaKeys.calorieGoal, goal),
        });
        expect(result.backupEnqueued).toBe(false);
        expect(await db.getAllAsync('SELECT * FROM sync_outbox')).toEqual([]);
        expect(await settings.readRecoverableSettings(db as never)).toMatchObject({
          calorieGoal: goal,
        });
        const { isBackupDirty, runBackupMaintenance } =
          await import('@/core/backup/backupCheckpoint');
        expect.soft(await isBackupDirty(db as never)).toBe(true);
        // After the transient failure is gone the ordinary maintenance path
        // must capture the value without another user edit or a scope upgrade.
        expect(await runBackupMaintenance({ skipFlush: true })).toEqual({ capturedManifest: true });
        const capture = await db.getFirstAsync<{ value: string }>(
          'SELECT value FROM app_meta WHERE key = ?',
          [appMetaKeys.backupGenerationCapture.key],
        );
        const chunks = JSON.parse(capture!.value).chunks as { entity: string; payload: string }[];
        const payload = chunks.find((chunk) => chunk.entity === 'user_backup_settings')!.payload;
        expect(JSON.parse(payload)).toMatchObject({ calorieGoal: goal });
      } finally {
        await db.closeAsync();
      }
    },
  );

  it('retries an already saved theme when its settings snapshot cannot be persisted', async () => {
    const db = await freshDatabase();
    try {
      const account = await import('@/core/auth/account.data');
      await account.setLocalDatasetOwner(db as never, 'settings-owner');
      const { appMetaKeys, setAppMetaText } = await import('@/core/db/appMeta');
      await setAppMetaText(
        db as never,
        appMetaKeys.backupScopeVersion,
        String(BACKUP_SCOPE_VERSION),
      );
      await setAppMetaText(db as never, appMetaKeys.backupDirty, '0');
      storage.set('superhabits.theme.mode', 'dark');
      const original = db.runAsync.bind(db);
      let injected = false;
      vi.spyOn(db, 'runAsync').mockImplementation(async (sql, params) => {
        if (!injected && params?.[0] === appMetaKeys.backupPendingSettings.key) {
          injected = true;
          throw new Error('snapshot failed');
        }
        return original(sql, params);
      });
      const { enqueueBackupSettingsRecord } = await import('@/core/sync/syncedMutation');
      await expect(enqueueBackupSettingsRecord(db as never)).rejects.toThrow('snapshot failed');
      expect(await db.getAllAsync('SELECT * FROM sync_outbox')).toEqual([]);
      const { isBackupDirty, runBackupMaintenance } =
        await import('@/core/backup/backupCheckpoint');
      expect.soft(await isBackupDirty(db as never)).toBe(true);
      expect(await runBackupMaintenance({ skipFlush: true })).toEqual({ capturedManifest: true });
      const { readCapturedChunks } = await import('@/core/backup/generations/capture');
      const captured = await readCapturedChunks(db as never);
      const payload = captured!.chunks.find(
        (chunk) => chunk.entity === 'user_backup_settings',
      )!.payload;
      expect(JSON.parse(payload).theme.mode).toBe('dark');
    } finally {
      await db.closeAsync();
    }
  });
});
