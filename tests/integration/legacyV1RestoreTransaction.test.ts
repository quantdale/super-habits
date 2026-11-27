import { afterEach, describe, expect, it, vi } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Legacy V1 restore vs the scoped writer / commit-only cache contract.
 *
 * Restore V2 runs its import inside `withSQLiteTransaction`, which
 *   (a) serializes every other writer behind one FIFO,
 *   (b) hands the transaction a scoped capability so helpers and cache
 *       publications join the committing boundary, and
 *   (c) publishes cache changes with `afterSQLiteCommit` only.
 *
 * The legacy V1 path (a remote with no V2 manifest) instead opened a RAW
 * `db.withTransactionAsync` on the BASE handle. Three user-visible consequences
 * are pinned here against a real SQLite engine:
 *
 *  1. A local write issued while the import is open starts a second `BEGIN` on
 *     the same connection. The production adapter wraps `BEGIN` in its own
 *     `try`, so the nested-`BEGIN` failure ROLLS BACK the outer import
 *     transaction behind the restore's back. Every statement after that point
 *     autocommits individually: the restore rejects, the user's own local write
 *     is rejected too ("cannot start a transaction within a transaction"), and
 *     the restore marker plus the owner binding are nonetheless durable — a
 *     device that is claimed by an account with no restored content and can
 *     never be restored again because it is no longer empty.
 *  2. A standalone metadata write lands on the same connection and joins the
 *     open import transaction, so it is erased by that rollback although its
 *     own caller was already told it succeeded.
 *  3. The dataset-owner cache is published immediately, before the COMMIT it
 *     describes, so a failed commit leaves the process believing this device is
 *     bound to an account that was never durably bound.
 */

const stamp = '2026-11-14T00:00:00.000Z';
const OWNER = 'legacy_remote_owner';
const OTHER_OWNER = 'another_owner';
const OTHER_TODO_ID = 'todo_1785000000002_abcdef56';
const LEGACY_TODO_IDS = ['todo_1785000000000_abcdef12', 'todo_1785000000001_abcdef34'] as const;

/** Deterministic in-transaction interleaving points for the tests below. */
const interleave = vi.hoisted(() => ({
  onWrite: null as null | ((sql: string, params: readonly unknown[] | undefined) => void),
  failKey: null as string | null,
}));

/** Minimal legacy (manifest-less) remote: two todos, no V2 tables. */
function installLegacyRemote(
  options: {
    currentOwner?: () => string | null;
    onBackupRowsReceived?: () => void;
    onV2Probe?: () => void;
  } = {},
) {
  const tables: Record<string, Record<string, unknown>[]> = {
    todos: LEGACY_TODO_IDS.map((id, index) => ({
      id,
      user_id: OWNER,
      title: `Legacy remote todo ${index + 1}`,
      notes: null,
      completed: 0,
      due_date: null,
      priority: 'normal',
      sort_order: index + 1,
      recurrence: null,
      recurrence_id: null,
      created_at: stamp,
      updated_at: stamp,
      deleted_at: null,
    })),
    calorie_entries: [],
    workout_routines: [],
  };
  if (options.onV2Probe) {
    tables.todos.push({ ...tables.todos[0], id: OTHER_TODO_ID, user_id: OTHER_OWNER });
  }
  const client = {
    from: vi.fn((entity: string) => ({
      select: (_columns: string, queryOptions?: { head?: boolean; count?: string }) => {
        let rows = tables[entity] ?? [];
        const query = {
          eq: (column: string, value: unknown) => {
            rows = rows.filter((row) => row[column] === value);
            return query;
          },
          is: (column: string) => {
            rows = rows.filter((row) => row[column] == null);
            return query;
          },
          order: () => query,
          limit: async (count: number) => {
            if (entity === 'user_backup_settings') options.onV2Probe?.();
            if (
              entity === 'backup_manifest' ||
              entity === 'user_backup_settings' ||
              entity === 'backup_generation_head' ||
              entity === 'backup_generation'
            ) {
              return {
                data: null,
                error: {
                  code: 'PGRST205',
                  message: `Could not find the table 'public.${entity}' in the schema cache`,
                },
              };
            }
            return {
              data: rows.slice(0, count),
              ...(queryOptions?.count === 'exact' ? { count: rows.length } : {}),
              error: null,
            };
          },
          range: async (from: number, to: number) => {
            const data = rows.slice(from, to + 1);
            if (entity === 'todos') options.onBackupRowsReceived?.();
            return { data, error: null };
          },
        };
        return query;
      },
    })),
  };
  vi.doMock('@/lib/supabase', () => ({
    supabase: client,
    isRemoteEnabled: () => true,
    getSupabaseAuthUserId: async () => (options.currentOwner ? options.currentOwner() : OWNER),
    getSupabaseSessionUserId: async () => OWNER,
    setRemoteMode: vi.fn(),
    ensureAnonymousSession: async () => undefined,
  }));
}

/**
 * Model the PRODUCTION adapter's transaction shape — `BEGIN`/`COMMIT`/`ROLLBACK`
 * all inside the try, exactly like `expo-sqlite`'s `withTransactionAsync` — and
 * optionally inject a commit failure. The integration harness itself keeps
 * `BEGIN` outside the try, so this difference has to be modelled explicitly:
 * it is what turns a nested `BEGIN` into an unnoticed ROLLBACK of the caller.
 */
function modelProductionAdapter(db: TestDatabase, options: { failCommit?: boolean } = {}): void {
  const raw = db.raw;
  db.withTransactionAsync = async (task) => {
    try {
      raw.exec('BEGIN');
      await task();
      if (options.failCommit) throw new Error('injected commit failure');
      raw.exec('COMMIT');
    } catch (error) {
      raw.exec('ROLLBACK');
      throw error;
    }
  };
}

/** Fire a deterministic hook from a statement, and inject one app_meta failure. */
function instrumentWrites(db: TestDatabase): () => void {
  const original = db.runAsync.bind(db);
  db.runAsync = async (sql, params) => {
    const hook = interleave.onWrite;
    interleave.onWrite = null;
    hook?.(sql, params);
    if (interleave.failKey !== null && (params?.[0] as string | undefined) === interleave.failKey) {
      throw new Error(`injected storage write failure for ${interleave.failKey}`);
    }
    return original(sql, params);
  };
  return () => {
    db.runAsync = original;
  };
}

async function countTodosMatching(db: TestDatabase, title: string): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM todos WHERE title = ?',
    [title],
  );
  return Number(row?.count ?? 0);
}

async function legacyRemoteRowsPresent(db: TestDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM todos WHERE id IN (?, ?) ORDER BY id',
    [...LEGACY_TODO_IDS],
  );
  return rows.map((row) => row.id);
}

async function readMeta(db: TestDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

afterEach(() => {
  interleave.onWrite = null;
  interleave.failKey = null;
});

describe('legacy V1 restore — a local write during the import', () => {
  it('commits the whole import instead of failing a nested transaction under the user write', async () => {
    installLegacyRemote();
    const db = await freshDatabase();
    modelProductionAdapter(db);
    const restoreWrite = instrumentWrites(db);
    try {
      const { appMetaKeys } = await import('@/core/db/appMeta');
      const { restoreFromRemoteBackup } = await import('@/core/sync/restore.coordinator');
      const { addTodo } = await import('@/features/todos/todos.data');

      // The user adds a todo while the import transaction is open: fire on the
      // FIRST imported row write, i.e. exactly when the restore owns the
      // connection and has committed nothing yet.
      let pendingWrite: Promise<unknown> | null = null;
      interleave.onWrite = (sql) => {
        if (!sql.includes('INSERT OR REPLACE INTO todos')) return;
        pendingWrite = addTodo({ title: 'typed while restore was running' });
      };

      const settled = await restoreFromRemoteBackup().then(
        (result) => ({ status: result.status, threw: null as Error | null }),
        (error: unknown) => ({ status: 'threw', threw: error as Error }),
      );
      const writeOutcome = await (pendingWrite as Promise<unknown> | null)?.then(
        () => ({ ok: true as const }),
        (error: unknown) => ({ ok: false as const, error: error as Error }),
      );

      const importedRows = await legacyRemoteRowsPresent(db);
      const ownerBinding = await readMeta(db, appMetaKeys.accountOwnerUserId.key);
      const restoreMarker = await readMeta(db, appMetaKeys.lastRestoreAt.key);

      // The import must commit COMPLETELY and report it. A rejected restore that
      // leaves a fragment of the backup behind is worse than either honest
      // outcome: the UI says "your local data was left unchanged" while the
      // device now holds imported rows, a restore marker and an owner binding,
      // and is no longer empty — so the retry the user was promised can never
      // run again.
      expect(settled.status, `restore threw: ${settled.threw?.message}`).toBe('restored');
      expect(importedRows).toEqual([...LEGACY_TODO_IDS]);
      expect(ownerBinding).toBe(OWNER);
      expect(restoreMarker).not.toBeNull();

      // The user's own write must not be refused by a transaction it never
      // opened: the restore owns the writer, so the local write is serialized
      // behind it instead of executed inside it.
      expect(writeOutcome, 'concurrent local write must not fail').toMatchObject({ ok: true });
      expect(await countTodosMatching(db, 'typed while restore was running')).toBe(1);
      // And the imported rows survived the interleaving.
      expect(await legacyRemoteRowsPresent(db)).toEqual([...LEGACY_TODO_IDS]);
    } finally {
      restoreWrite();
      await db.closeAsync();
    }
  }, 30_000);
});

describe('legacy V1 restore — a standalone metadata write during the import', () => {
  it('does not erase a write whose own caller was already told it succeeded', async () => {
    installLegacyRemote();
    const db = await freshDatabase();
    const restoreWrite = instrumentWrites(db);
    try {
      const { appMetaKeys, getAppMetaText, setAppMetaText } = await import('@/core/db/appMeta');
      const { restoreFromRemoteBackup } = await import('@/core/sync/restore.coordinator');

      let pendingWrite: Promise<unknown> | null = null;
      interleave.onWrite = (sql) => {
        if (!sql.includes('INSERT OR REPLACE INTO todos')) return;
        // Any standalone metadata write that lands while the import transaction
        // is open: a settings save from another surface, a sync-status marker.
        pendingWrite = setAppMetaText(db as never, appMetaKeys.syncStatus, '{"interleaved":true}');
      };
      // The import fails AFTER the metadata write was accepted, so the import
      // transaction rolls back.
      interleave.failKey = appMetaKeys.lastRestoreSignature.key;

      const settled = await restoreFromRemoteBackup().then(
        () => ({ threw: false as const }),
        (error: unknown) => ({ threw: true as const, error: error as Error }),
      );
      const writeOutcome = await (pendingWrite as Promise<unknown> | null)?.then(
        () => ({ ok: true as const }),
        (error: unknown) => ({ ok: false as const, error: error as Error }),
      );

      // The restore failed, so its imported rows must be gone...
      expect(settled.threw).toBe(true);
      expect(await legacyRemoteRowsPresent(db)).toEqual([]);

      // ...but the standalone write that RESOLVED must still be durable. A
      // write that joins an import transaction and is erased by its rollback is
      // silent data loss after a false success.
      expect(writeOutcome).toMatchObject({ ok: true });
      expect(await getAppMetaText(db as never, appMetaKeys.syncStatus)).toBe(
        '{"interleaved":true}',
      );
    } finally {
      restoreWrite();
      await db.closeAsync();
    }
  }, 30_000);
});

describe('legacy V1 restore — the owner cache follows the commit boundary', () => {
  it('does not publish a dataset owner binding that a failed commit rolled back', async () => {
    installLegacyRemote();
    const db = await freshDatabase();
    modelProductionAdapter(db, { failCommit: true });
    const restoreWrite = instrumentWrites(db);
    try {
      const account = await import('@/core/auth/account.data');
      const { restoreFromRemoteBackup } = await import('@/core/sync/restore.coordinator');

      await expect(restoreFromRemoteBackup()).rejects.toThrow('injected commit failure');

      // The cache assertion must come FIRST: a later `getLocalDatasetOwner()`
      // re-primes the cache from durable state and would hide the defect. A
      // stale `OWNER` here makes the next write believe this device is already
      // bound — `readSessionOwnerCandidate` short-circuits on a cached owner
      // without re-reading durable state — so its intents are stamped with an
      // owner that was never durably bound.
      expect(account.getCachedLocalDatasetOwner()).not.toBe(OWNER);
      expect(account.getCachedLocalDatasetOwner()).toBeNull();

      // Nothing survived the rollback, including the owner binding.
      expect(await account.getLocalDatasetOwner(db as never)).toBeNull();
      expect(await legacyRemoteRowsPresent(db)).toEqual([]);
    } finally {
      restoreWrite();
      await db.closeAsync();
    }
  }, 30_000);
});

describe('legacy V1 restore — account changes', () => {
  it.each([null, OTHER_OWNER])(
    'aborts if the current account becomes %s while rows arrive',
    async (nextOwner) => {
      let owner: string | null = OWNER;
      installLegacyRemote({
        currentOwner: () => owner,
        onBackupRowsReceived: () => {
          owner = nextOwner;
        },
      });
      const db = await freshDatabase();
      try {
        const { appMetaKeys } = await import('@/core/db/appMeta');
        const { restoreFromRemoteBackup } = await import('@/core/sync/restore.coordinator');

        await expect(restoreFromRemoteBackup()).resolves.toMatchObject({
          status: 'invalid',
          message: expect.stringMatching(/authenticated owner changed/i),
        });
        expect(await legacyRemoteRowsPresent(db)).toEqual([]);
        expect(await readMeta(db, appMetaKeys.accountOwnerUserId.key)).toBeNull();
        expect(await readMeta(db, appMetaKeys.lastRestoreAt.key)).toBeNull();
      } finally {
        await db.closeAsync();
      }
    },
  );

  it('does not switch to another account’s backup after the V2 capability check', async () => {
    let owner = OWNER;
    installLegacyRemote({
      currentOwner: () => owner,
      onV2Probe: () => {
        owner = OTHER_OWNER;
      },
    });
    const db = await freshDatabase();
    try {
      const { getLocalDatasetOwner } = await import('@/core/auth/account.data');
      const { restoreFromRemoteBackup } = await import('@/core/sync/restore.coordinator');

      await expect(restoreFromRemoteBackup()).resolves.toMatchObject({
        status: 'invalid',
        message: expect.stringMatching(/authenticated owner changed/i),
      });
      expect(await db.getAllAsync('SELECT id FROM todos')).toEqual([]);
      expect(await getLocalDatasetOwner(db as never)).toBeNull();
    } finally {
      await db.closeAsync();
    }
  });

  it('cannot replace a provisional account after its restore fills the device', async () => {
    installLegacyRemote();
    const db = await freshDatabase();
    try {
      const {
        bindProvisionalLocalDatasetOwner,
        replaceProvisionalLocalDatasetOwner,
        getLocalDatasetOwner,
      } = await import('@/core/auth/account.data');
      const { restoreFromRemoteBackup } = await import('@/core/sync/restore.coordinator');
      await bindProvisionalLocalDatasetOwner(db as never, OWNER);

      await expect(restoreFromRemoteBackup()).resolves.toMatchObject({ status: 'restored' });
      await expect(
        replaceProvisionalLocalDatasetOwner(db as never, 'another_owner'),
      ).rejects.toThrow(/owner.*conflict/i);

      expect(await getLocalDatasetOwner(db as never)).toBe(OWNER);
      expect(await legacyRemoteRowsPresent(db)).toEqual([...LEGACY_TODO_IDS]);
    } finally {
      await db.closeAsync();
    }
  });
});
