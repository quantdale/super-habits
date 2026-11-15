import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('dataset owner cache follows SQLite commit boundaries', () => {
  let db: TestDatabase;
  beforeEach(async () => {
    db = await freshDatabase();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await db.closeAsync();
  });

  function failNextOutboxWrite() {
    const original = db.runAsync.bind(db);
    return vi.spyOn(db, 'runAsync').mockImplementation(async (sql, params) => {
      if (sql.includes('INSERT INTO sync_outbox')) throw new Error('injected outbox failure');
      return original(sql, params);
    });
  }

  async function firstContent() {
    const { runSyncedMutation } = await import('@/core/sync/syncedMutation');
    return runSyncedMutation({
      db: db as never,
      record: {
        entity: 'todos',
        id: 'todo_atomic',
        operation: 'create',
        updatedAt: '2026-11-14T00:00:00.000Z',
      },
      mutate: async (tx) => {
        await tx.runAsync(
          `INSERT INTO todos (id, title, created_at, updated_at) VALUES ('todo_atomic', 'Atomic content', '2026-11-14T00:00:00.000Z', '2026-11-14T00:00:00.000Z')`,
        );
        return { value: undefined, changed: true };
      },
    });
  }

  it('does not cache an owner from a failed first-content adoption', async () => {
    const account = await import('@/core/auth/account.data');
    const { getSupabaseSessionUserId } = await import('@/lib/supabase');
    vi.mocked(getSupabaseSessionUserId).mockResolvedValue('owner_a');
    failNextOutboxWrite();
    await expect(firstContent()).rejects.toThrow('injected outbox failure');
    expect(
      await db.getFirstAsync("SELECT value FROM app_meta WHERE key = 'account.owner_user_id'"),
    ).toBeNull();
    expect(await db.getAllAsync('SELECT * FROM todos')).toEqual([]);
    expect(await db.getAllAsync('SELECT * FROM sync_outbox')).toEqual([]);
    expect(account.getCachedLocalDatasetOwner()).not.toBe('owner_a');
  });

  it('does not cache a permanent promotion when the first content rolls back', async () => {
    const account = await import('@/core/auth/account.data');
    await account.bindProvisionalLocalDatasetOwner(db as never, 'owner_a');
    failNextOutboxWrite();
    await expect(firstContent()).rejects.toThrow('injected outbox failure');
    expect(
      await db.getFirstAsync(
        "SELECT value FROM app_meta WHERE key = 'account.owner_binding_state'",
      ),
    ).toEqual({ value: 'provisional' });
    expect(account.getCachedLocalDatasetOwner()).toBe('owner_a');
    expect(account.getCachedOwnerBindingProvisional()).toBe(true);
  });

  it.each(['clear', 'replace', 'promote'] as const)(
    'does not publish %s from an aborted caller transaction',
    async (operation) => {
      const account = await import('@/core/auth/account.data');
      await account.bindProvisionalLocalDatasetOwner(db as never, 'owner_a');
      const { withSQLiteTransaction } = await import('@/core/db/transactions');
      await expect(
        withSQLiteTransaction(db as never, async (tx) => {
          if (operation === 'clear') await account.clearLocalDatasetOwner(tx);
          else if (operation === 'replace')
            await account.replaceProvisionalLocalDatasetOwner(tx, 'owner_b');
          else await account.promoteLocalDatasetOwnerIfProvisional(tx);
          throw new Error('abort caller');
        }),
      ).rejects.toThrow('abort caller');
      expect(
        await db.getFirstAsync("SELECT value FROM app_meta WHERE key = 'account.owner_user_id'"),
      ).toEqual({ value: 'owner_a' });
      expect(
        await db.getFirstAsync(
          "SELECT value FROM app_meta WHERE key = 'account.owner_binding_state'",
        ),
      ).toEqual({ value: 'provisional' });
      expect(account.getCachedLocalDatasetOwner()).toBe('owner_a');
      expect(account.getCachedOwnerBindingProvisional()).toBe(true);
    },
  );

  it('does not retain a failed account bind when outbox adoption detects a conflict', async () => {
    const account = await import('@/core/auth/account.data');
    await db.runAsync(
      `INSERT INTO sync_outbox (entity, id, updated_at, operation, revision, owner_user_id) VALUES ('todos', 'todo_other', '2026-11-14T00:00:00.000Z', 'create', 1, 'owner_b')`,
    );
    await expect(
      account.bindLocalDatasetOwner(db as never, 'owner_a', { adoptUnownedOutbox: true }),
    ).rejects.toThrow('SYNC_OUTBOX_OWNER_CONFLICT');
    expect(
      await db.getFirstAsync("SELECT value FROM app_meta WHERE key = 'account.owner_user_id'"),
    ).toBeNull();
    expect(account.getCachedLocalDatasetOwner()).not.toBe('owner_a');
  });

  it('a base-handle owner reader waits for an in-flight writer instead of caching its tentative binding', async () => {
    const account = await import('@/core/auth/account.data');
    await account.getLocalDatasetOwner(db as never);
    const { withSQLiteTransaction } = await import('@/core/db/transactions');
    const started = deferred();
    const release = deferred();
    const writing = withSQLiteTransaction(db as never, async (tx) => {
      await account.setLocalDatasetOwner(tx, 'owner_a');
      started.resolve();
      await release.promise;
      throw new Error('abort adoption');
    });
    await started.promise;
    const reading = account.getLocalDatasetOwner(db as never);
    release.resolve();
    await expect(writing).rejects.toThrow('abort adoption');
    expect(await reading).toBeNull();
    expect(account.getCachedLocalDatasetOwner()).toBeNull();
  });

  it('does not publish cache changes when the adapter fails before commit', async () => {
    const account = await import('@/core/auth/account.data');
    await account.bindProvisionalLocalDatasetOwner(db as never, 'owner_a');
    const original = db.withTransactionAsync.bind(db);
    vi.spyOn(db, 'withTransactionAsync').mockImplementation((task) =>
      original(async () => {
        await task();
        expect(account.getCachedOwnerBindingProvisional()).toBe(true);
        throw new Error('injected commit failure');
      }),
    );
    await expect(firstContent()).rejects.toThrow('injected commit failure');
    expect(account.getCachedOwnerBindingProvisional()).toBe(true);
    expect(
      await db.getFirstAsync(
        "SELECT value FROM app_meta WHERE key = 'account.owner_binding_state'",
      ),
    ).toEqual({ value: 'provisional' });
    expect(await db.getAllAsync('SELECT * FROM todos')).toEqual([]);
  });

  it('does not mistake a rolled-back no-active-transaction error for a successful account bind', async () => {
    const account = await import('@/core/auth/account.data');
    await db.runAsync(
      `INSERT INTO sync_outbox (entity, id, updated_at, operation, revision, owner_user_id) VALUES ('todos', 'todo_unowned', '2026-11-14T00:00:00.000Z', 'create', 1, NULL)`,
    );
    const original = db.runAsync.bind(db);
    vi.spyOn(db, 'runAsync').mockImplementation(async (sql, params) => {
      if (sql.startsWith('UPDATE sync_outbox SET owner_user_id'))
        throw new Error('cannot rollback - no transaction is active');
      return original(sql, params);
    });
    await expect(
      account.bindLocalDatasetOwner(db as never, 'owner_a', { adoptUnownedOutbox: true }),
    ).rejects.toThrow('no transaction is active');
    expect(account.getCachedLocalDatasetOwner()).not.toBe('owner_a');
    expect(
      await db.getFirstAsync("SELECT value FROM app_meta WHERE key = 'account.owner_user_id'"),
    ).toBeNull();
    expect(await db.getFirstAsync('SELECT owner_user_id FROM sync_outbox')).toEqual({
      owner_user_id: null,
    });
  });

  it('accepts a genuine post-commit cosmetic error only after verifying durable adoption', async () => {
    const account = await import('@/core/auth/account.data');
    await db.runAsync(
      `INSERT INTO sync_outbox (entity, id, updated_at, operation, revision, owner_user_id) VALUES ('todos', 'todo_unowned', '2026-11-14T00:00:00.000Z', 'create', 1, NULL)`,
    );
    const original = db.withTransactionAsync.bind(db);
    vi.spyOn(db, 'withTransactionAsync').mockImplementation(async (task) => {
      await original(task);
      throw new Error('cannot rollback - no transaction is active');
    });
    await expect(
      account.bindLocalDatasetOwner(db as never, 'owner_a', { adoptUnownedOutbox: true }),
    ).resolves.toBeUndefined();
    expect(account.getCachedLocalDatasetOwner()).toBe('owner_a');
    expect(account.getCachedOwnerBindingProvisional()).toBe(false);
    expect(await db.getFirstAsync('SELECT owner_user_id FROM sync_outbox')).toEqual({
      owner_user_id: 'owner_a',
    });
  });

  it.each(['exclusive', 'portable'] as const)(
    'publishes successful owner promotion after the %s commit',
    async (mode) => {
      if (mode === 'exclusive') {
        Object.assign(db, {
          withExclusiveTransactionAsync: async (
            task: (transactionDb: TestDatabase) => Promise<void>,
          ) => {
            await db.withTransactionAsync(() => task(db));
          },
        });
      }
      const account = await import('@/core/auth/account.data');
      await account.bindProvisionalLocalDatasetOwner(db as never, 'owner_a');
      await firstContent();
      expect(account.getCachedLocalDatasetOwner()).toBe('owner_a');
      expect(account.getCachedOwnerBindingProvisional()).toBe(false);
      expect(await db.getFirstAsync('SELECT owner_user_id FROM sync_outbox')).toEqual({
        owner_user_id: 'owner_a',
      });
    },
  );
});
