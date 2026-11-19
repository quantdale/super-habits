import { afterEach, describe, expect, it, vi } from 'vitest';
import { freshDatabase } from './helpers/db';
import { portableOwnerFingerprint } from '@/lib/portableOwnerFingerprint';
import { buildPortableBackupFile } from '@/core/portable/portableFormat';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

afterEach(() => {
  vi.doUnmock('@/lib/supabase');
  vi.restoreAllMocks();
});

const sourceOwner = 'portable-source-account';
const stamp = '2026-11-14T12:00:00.000Z';

function file(owner: string, withTodo = false) {
  return buildPortableBackupFile({
    exportedAt: stamp,
    appVersion: '1.0.0',
    platform: 'web',
    ownerFingerprint: portableOwnerFingerprint(owner),
    rowsByEntity: withTodo
      ? {
          todos: [
            {
              id: 'todo_1',
              title: 'Remote account content',
              notes: null,
              completed: 0,
              due_date: null,
              priority: 'normal',
              sort_order: 0,
              recurrence: null,
              recurrence_id: null,
              created_at: stamp,
              updated_at: stamp,
              deleted_at: null,
            },
          ],
        }
      : {},
    settings: { calorieGoal: { calories: withTodo ? 2600 : 1900, protein: 0, carbs: 0, fats: 0 } },
  });
}

function installRemote(owner: string) {
  const backup = file(owner, true);
  const tables: Record<string, Record<string, unknown>[]> = {
    ...Object.fromEntries(
      Object.entries(backup.entities).map(([entity, rows]) => [
        entity,
        rows.map((row) => ({ ...row, user_id: owner })),
      ]),
    ),
    backup_manifest: [
      {
        user_id: owner,
        backup_schema_version: backup.backupSchemaVersion,
        backup_scope_version: backup.backupScopeVersion,
        generation: 1,
        completed_at: stamp,
        entity_metadata: backup.integrity.entities,
        settings_version: backup.integrity.settings.version,
        settings_metadata: backup.integrity.settings,
      },
    ],
    user_backup_settings: [
      {
        user_id: owner,
        settings_version: backup.integrity.settings.version,
        payload: backup.settings,
        updated_at: stamp,
      },
    ],
  };
  const client = {
    from: vi.fn((entity: string) => ({
      select: () => {
        let rows = tables[entity] ?? [];
        const query = {
          eq: (column: string, value: unknown) => {
            rows = rows.filter((row) => row[column] === value);
            return query;
          },
          order: () => query,
          range: async (from: number, to: number) => ({
            data: rows.slice(from, to + 1),
            error: null,
          }),
          limit: async (count: number) => ({ data: rows.slice(0, count), error: null }),
        };
        return query;
      },
    })),
  };
  vi.doMock('@/lib/supabase', () => ({
    supabase: client,
    isRemoteEnabled: () => true,
    getSupabaseAuthUserId: async () => owner,
    getSupabaseSessionUserId: async () => owner,
  }));
}

describe('cloud restore respects an unbound protected portable origin', () => {
  it.each([sourceOwner, 'unrelated-cloud-account'])(
    'restores only the compatible source account (%s)',
    async (remoteOwner) => {
      installRemote(remoteOwner);
      const db = await freshDatabase();
      try {
        const { preparePortableImport, confirmPortableImport } =
          await import('@/core/portable/portableImport');
        const prepared = await preparePortableImport({
          fileName: 'settings.json',
          text: JSON.stringify(file(sourceOwner)),
        });
        expect(prepared.status).toBe('ready');
        if (prepared.status !== 'ready') throw new Error('settings-only fixture rejected');
        expect((await confirmPortableImport({ file: prepared.file })).status).toBe('restored');
        const before = await db.getAllAsync('SELECT * FROM app_meta ORDER BY key');
        const { restoreFromRemoteBackupV2 } = await import('@/core/backup/backupRestore');
        if (remoteOwner === sourceOwner) {
          expect((await restoreFromRemoteBackupV2()).status).toBe('restored');
          expect(await db.getFirstAsync('SELECT title FROM todos')).toEqual({
            title: 'Remote account content',
          });
        } else {
          await expect(restoreFromRemoteBackupV2()).rejects.toThrow('IMPORT_ORIGIN_OWNER_CONFLICT');
          expect(await db.getAllAsync('SELECT * FROM app_meta ORDER BY key')).toEqual(before);
          expect(await db.getAllAsync('SELECT * FROM todos')).toEqual([]);
          expect(await db.getAllAsync('SELECT * FROM sync_outbox')).toEqual([]);
          const account = await import('@/core/auth/account.data');
          expect(account.getCachedLocalDatasetOwner()).toBeNull();
        }
      } finally {
        await db.closeAsync();
      }
    },
  );
});
