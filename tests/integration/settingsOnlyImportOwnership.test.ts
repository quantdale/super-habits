import { describe, expect, it, vi } from 'vitest';
import { freshDatabase } from './helpers/db';

vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '1.0.0' } } }));
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));
const OWNER = 'protected-source-owner';
const TEMP = 'temporary-unrelated-session';

async function importSettingsOnly() {
  const source = await freshDatabase();
  const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
  await setLocalDatasetOwner(source as never, OWNER);
  const { exportPortableBackup } = await import('@/core/portable/portableExport');
  const exported = await exportPortableBackup();
  if (!exported.ok) throw new Error(exported.error);
  await source.closeAsync();
  const db = await freshDatabase();
  const account = await import('@/core/auth/account.data');
  await account.bindProvisionalLocalDatasetOwner(db as never, TEMP);
  const { preparePortableImport, confirmPortableImport } =
    await import('@/core/portable/portableImport');
  const prepared = await preparePortableImport({
    fileName: exported.fileName,
    text: exported.json,
  });
  expect(prepared.status).toBe('ready');
  if (prepared.status !== 'ready') throw new Error('settings-only import was not ready');
  expect(prepared.preview.totalRows).toBe(0);
  expect((await confirmPortableImport({ file: prepared.file })).status).toBe('restored');
  expect((await account.inspectLocalAccountDataState(db as never)).ownerBinding).toBeNull();
  const { getSupabaseSessionUserId } = await import('@/lib/supabase');
  vi.mocked(getSupabaseSessionUserId).mockResolvedValue(TEMP);
  return db;
}

describe('settings-only protected import ownership', () => {
  it('does not consult Auth for a known durable owner on the local-write path', async () => {
    const db = await freshDatabase();
    try {
      const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
      await setLocalDatasetOwner(db as never, OWNER);
      const { getSupabaseSessionUserId } = await import('@/lib/supabase');
      const session = vi.mocked(getSupabaseSessionUserId);
      session.mockClear();
      session.mockRejectedValue(new Error('Auth unavailable'));
      const { addTodo } = await import('@/features/todos/todos.data');
      await addTodo({ title: 'Local writes do not depend on Auth' });
      expect(session).not.toHaveBeenCalled();
      expect(await db.getFirstAsync('SELECT owner_user_id FROM sync_outbox')).toEqual({
        owner_user_id: OWNER,
      });
    } finally {
      await db.closeAsync();
    }
  });

  it.each(['todo', 'settings'] as const)(
    'keeps an ordinary %s write local and unowned until matching-owner recovery',
    async (kind) => {
      const db = await importSettingsOnly();
      try {
        const { addTodo } = await import('@/features/todos/todos.data');
        const { runRecoverableSettingsMutation } = await import('@/core/sync/syncedMutation');
        const { appMetaKeys, setAppMetaText } = await import('@/core/db/appMeta');
        if (kind === 'todo') await addTodo({ title: 'Must not claim imported data' });
        else
          await runRecoverableSettingsMutation({
            db: db as never,
            mutate: (tx) => setAppMetaText(tx, appMetaKeys.calorieGoal, '2100'),
          });
        const account = await import('@/core/auth/account.data');
        const local = await account.inspectLocalAccountDataState(db as never);
        expect(local.ownerBinding).toBeNull();
        expect(local.outboxOwnerIds).toEqual([]);
        expect(local.unownedOutboxCount).toBe(1);
        const { portableOwnerFingerprint } = await import('@/lib/portableOwnerFingerprint');
        expect(await account.readImportOriginFingerprint(db as never)).toBe(
          portableOwnerFingerprint(OWNER),
        );
        await account.bindLocalDatasetOwner(db as never, OWNER, { adoptUnownedOutbox: true });
        const recovered = await account.inspectLocalAccountDataState(db as never);
        expect(recovered.ownerBinding).toBe(OWNER);
        expect(recovered.outboxOwnerIds).toEqual([OWNER]);
        expect(recovered.unownedOutboxCount).toBe(0);
      } finally {
        await db.closeAsync();
      }
    },
  );

  it('fails closed when the protected-origin read is unavailable, while preserving a local write', async () => {
    const db = await importSettingsOnly();
    const original = db.getFirstAsync.bind(db);
    const read = vi.spyOn(db, 'getFirstAsync').mockImplementation(async (sql, params) => {
      if (params?.[0] === 'portable.last_import_owner_fingerprint')
        throw new Error('one metadata key unreadable');
      return original(sql, params);
    });
    try {
      const { addTodo } = await import('@/features/todos/todos.data');
      await addTodo({ title: 'Still usable offline' });
      expect(await db.getFirstAsync('SELECT title FROM todos')).toEqual({
        title: 'Still usable offline',
      });
      expect(await db.getFirstAsync('SELECT owner_user_id FROM sync_outbox')).toEqual({
        owner_user_id: null,
      });
    } finally {
      read.mockRestore();
      await db.closeAsync();
    }
  });

  it('rechecks the durable origin when a new protected import lands after owner resolution', async () => {
    const db = await freshDatabase();
    const { getSupabaseSessionUserId } = await import('@/lib/supabase');
    vi.mocked(getSupabaseSessionUserId).mockResolvedValue(TEMP);
    const { addTodo } = await import('@/features/todos/todos.data');
    const transactions = await import('@/core/db/transactions');
    const originalTransaction = transactions.withSQLiteTransaction;
    const { appMetaKeys, setAppMetaText } = await import('@/core/db/appMeta');
    const { portableOwnerFingerprint } = await import('@/lib/portableOwnerFingerprint');
    const transaction = vi
      .spyOn(transactions, 'withSQLiteTransaction')
      .mockImplementationOnce(async (database, task) => {
        // Exact stale-decision boundary: the session candidate was resolved but
        // the authoritative mutation has not yet entered the writer transaction.
        await setAppMetaText(
          database,
          appMetaKeys.portableLastImportOwnerFingerprint,
          portableOwnerFingerprint(OWNER),
        );
        return originalTransaction(database, task);
      });
    try {
      await addTodo({ title: 'Queued before imported-origin change' });
      expect(await db.getFirstAsync('SELECT owner_user_id FROM sync_outbox')).toEqual({
        owner_user_id: null,
      });
      const { getLocalDatasetOwner } = await import('@/core/auth/account.data');
      expect(await getLocalDatasetOwner(db as never)).toBeNull();
    } finally {
      transaction.mockRestore();
      await db.closeAsync();
    }
  });
});
