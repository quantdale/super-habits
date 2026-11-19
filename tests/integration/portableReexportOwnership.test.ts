import { describe, expect, it, vi } from 'vitest';
import { freshDatabase } from './helpers/db';
import { portableOwnerFingerprint } from '@/lib/portableOwnerFingerprint';

vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '1.0.0' } } }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

const SOURCE_OWNER = 'source-account';

async function exportFile() {
  const { exportPortableBackup } = await import('@/core/portable/portableExport');
  const exported = await exportPortableBackup();
  if (!exported.ok) throw new Error(exported.error);
  return exported;
}

describe('portable re-export retains protected import ownership', () => {
  it.each([false, true])(
    'preserves the source owner across an unclaimed device (entity rows: %s)',
    async (withRows) => {
      const source = await freshDatabase();
      const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
      await setLocalDatasetOwner(source as never, SOURCE_OWNER);
      if (withRows) {
        const { addTodo } = await import('@/features/todos/todos.data');
        await addTodo({ title: 'Keep the source account' });
      }
      const original = await exportFile();
      await source.closeAsync();

      const intermediate = await freshDatabase();
      const { preparePortableImport, confirmPortableImport } =
        await import('@/core/portable/portableImport');
      const prepared = await preparePortableImport({
        fileName: original.fileName,
        text: original.json,
      });
      expect(prepared.status).toBe('ready');
      if (prepared.status !== 'ready') throw new Error('source file rejected');
      expect((await confirmPortableImport({ file: prepared.file })).status).toBe('restored');
      const reexported = await exportFile();
      expect
        .soft(JSON.parse(reexported.json).source.ownerFingerprint)
        .toBe(portableOwnerFingerprint(SOURCE_OWNER));
      await intermediate.closeAsync();

      const unrelated = await freshDatabase();
      try {
        const account = await import('@/core/auth/account.data');
        await account.setLocalDatasetOwner(unrelated as never, 'unrelated-account');
        const importer = await import('@/core/portable/portableImport');
        const rejected = await importer.preparePortableImport({
          fileName: reexported.fileName,
          text: reexported.json,
        });
        expect(rejected.status).toBe('rejected');
        expect((await account.inspectLocalAccountDataState(unrelated as never)).hasUserData).toBe(
          false,
        );
      } finally {
        await unrelated.closeAsync();
      }
    },
  );

  it.each(['unreadable', 'malformed'])('refuses to erase an %s recorded origin', async (kind) => {
    const db = await freshDatabase();
    try {
      await db.runAsync('INSERT INTO app_meta (key, value) VALUES (?, ?)', [
        'portable.last_import_owner_fingerprint',
        kind === 'malformed' ? 'damaged-origin' : portableOwnerFingerprint(SOURCE_OWNER),
      ]);
      if (kind === 'unreadable') {
        const original = db.getFirstAsync.bind(db);
        vi.spyOn(db, 'getFirstAsync').mockImplementation(async (sql, params) => {
          if (params?.[0] === 'portable.last_import_owner_fingerprint') {
            throw new Error('origin storage unavailable');
          }
          return original(sql, params);
        });
      }
      const { exportPortableBackup } = await import('@/core/portable/portableExport');
      const result = await exportPortableBackup();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/origin/i);
    } finally {
      vi.restoreAllMocks();
      await db.closeAsync();
    }
  });
});
