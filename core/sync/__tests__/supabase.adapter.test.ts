import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncPushPartialFailureError } from '@/core/sync/syncErrors';
import type { SyncRecord } from '@/core/sync/sync.engine';

type AdapterSetupOptions = {
  supabase?: { from: ReturnType<typeof vi.fn> } | null;
  authUserId?: string | null;
  authError?: Error;
  localOwnerUserId?: string | null;
};

/**
 * A fake remote table surface that stores what it is upserted AND can answer the
 * push read-back the adapter performs (harden-silent-failure-certification 3.1).
 * Without the read chain, every push in these tests would fail for a reason that
 * has nothing to do with what they assert.
 */
function storingFrom(
  upsertImpl?: (
    rows: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string },
  ) => Promise<unknown>,
) {
  const stored = new Set<string>();
  const upsert = vi.fn(
    async (
      rows: Record<string, unknown> | Record<string, unknown>[],
      options?: { onConflict?: string },
    ) => {
      for (const row of Array.isArray(rows) ? rows : [rows]) stored.add(String(row.id));
      return upsertImpl ? await upsertImpl(rows, options) : { error: null };
    },
  );
  const select = vi.fn(() => ({
    in: vi.fn((_column: string, ids: string[]) => ({
      eq: vi.fn(async () => ({
        data: ids.filter((id) => stored.has(id)).map((id) => ({ id })),
        error: null,
      })),
    })),
  }));
  return { upsert, select };
}

async function setupAdapter(options: AdapterSetupOptions) {
  vi.resetModules();

  const db = {
    getAllAsync: vi.fn(),
    getFirstAsync: vi
      .fn()
      .mockResolvedValue(
        options.localOwnerUserId === null ? null : { value: options.localOwnerUserId ?? 'user_a' },
      ),
  };
  const getDatabase = vi.fn().mockResolvedValue(db);
  // The adapter verifies each push by reading the ids it just wrote back,
  // scoped to the pushing owner (harden-silent-failure-certification 3.1), so
  // the fake remote must be able to ANSWER that read. Rows the upsert received
  // are recorded and served back, which is the honest default: this fake remote
  // stores what it is given.
  const storedRows = new Set<string>();
  const upsert = vi.fn(async (rows: Record<string, unknown> | Record<string, unknown>[]) => {
    for (const row of Array.isArray(rows) ? rows : [rows]) storedRows.add(String(row.id));
    return { error: null };
  });
  const select = vi.fn(() => ({
    in: vi.fn((_column: string, ids: string[]) => ({
      eq: vi.fn(async () => ({
        data: ids.filter((id) => storedRows.has(id)).map((id) => ({ id })),
        error: null,
      })),
    })),
  }));
  const from = vi.fn().mockReturnValue({ upsert, select });

  vi.doMock('@/core/db/client', () => ({
    getDatabase,
  }));

  const supabase = options.supabase === undefined ? { from } : options.supabase;
  const getSupabaseAuthUserId = options.authError
    ? vi.fn().mockRejectedValue(options.authError)
    : vi.fn().mockResolvedValue(options.authUserId === undefined ? 'user_a' : options.authUserId);
  vi.doMock('@/lib/supabase', () => ({ supabase, getSupabaseAuthUserId }));

  const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
  // Import from the same freshly-reset module registry as the adapter —
  // a static top-level import would resolve to a different class identity
  // than the one the adapter itself throws, breaking `instanceof` checks.
  const { SyncPushPartialFailureError } = await import('@/core/sync/syncErrors');
  return {
    adapter: new SupabaseSyncAdapter(),
    SyncPushPartialFailureError,
    db,
    getDatabase,
    from,
    upsert,
    getSupabaseAuthUserId,
  };
}

function record(entity: string, id: string, ownerUserId: string | null = 'user_a'): SyncRecord {
  return {
    entity,
    id,
    updatedAt: '2026-04-07T12:00:00.000Z',
    operation: 'update',
    ownerUserId,
  };
}

async function expectPartialFailure(
  push: Promise<void>,
  errorClass: typeof SyncPushPartialFailureError,
  expected: { messageContains: string; failedRecords: SyncRecord[] },
) {
  let caught: unknown;
  try {
    await push;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(errorClass);
  const partialFailure = caught as SyncPushPartialFailureError;
  expect(partialFailure.message).toContain(expected.messageContains);
  expect(partialFailure.failedRecords).toEqual(expected.failedRecords);
}

// The adapter module (and its Supabase/sync-engine imports) is loaded once at
// COLLECTION time: `setupAdapter` calls `vi.resetModules()` per test, so without
// this the FIRST test of the file pays the whole cold-load cost inside its 5s
// budget — tight when the unit project runs in parallel. The warm-up only
// populates the transform cache; each test still gets its own module instance.
await import('@/core/sync/supabase.adapter');

describe('SupabaseSyncAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns early for an empty push batch', async () => {
    const { adapter, getDatabase } = await setupAdapter({});

    await adapter.push([]);

    expect(getDatabase).not.toHaveBeenCalled();
  });

  it('fails the push when supabase is unavailable so the engine retains the records', async () => {
    const { adapter, getDatabase } = await setupAdapter({
      supabase: null,
    });

    await expect(adapter.push([record('todos', 'todo_1')])).rejects.toThrow(
      'Supabase is not configured',
    );

    expect(getDatabase).not.toHaveBeenCalled();
  });

  it('reports unknown entities as a failed record so the sync engine retains it', async () => {
    const { adapter, db, from, SyncPushPartialFailureError } = await setupAdapter({});
    const unknownRecord = record('unknown_table', 'row_1');

    await expectPartialFailure(adapter.push([unknownRecord]), SyncPushPartialFailureError, {
      messageContains: 'Unknown entity in queue: unknown_table',
      failedRecords: [unknownRecord],
    });

    expect(db.getAllAsync).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it('deduplicates IDs per entity when building the SQL query', async () => {
    const { adapter, db } = await setupAdapter({});
    db.getAllAsync.mockResolvedValue([{ id: 'todo_1' }, { id: 'todo_2' }]);

    await adapter.push([
      record('todos', 'todo_1'),
      record('todos', 'todo_1'),
      record('todos', 'todo_2'),
    ]);

    expect(db.getAllAsync).toHaveBeenCalledTimes(1);
    const [sql, ids] = db.getAllAsync.mock.calls[0];
    expect(sql).toContain('SELECT * FROM todos WHERE id IN (?, ?)');
    expect(ids).toEqual(['todo_1', 'todo_2']);
  });

  it('calls upsert with selected rows and onConflict id', async () => {
    const { adapter, db, from, upsert } = await setupAdapter({});
    const rows = [{ id: 'todo_1', title: 'Ship tests' }];
    db.getAllAsync.mockResolvedValue(rows);

    await adapter.push([record('todos', 'todo_1')]);

    expect(from).toHaveBeenCalledWith('todos');
    expect(upsert).toHaveBeenCalledWith(
      [{ id: 'todo_1', title: 'Ship tests', user_id: 'user_a' }],
      { onConflict: 'id' },
    );
  });

  it('derives the owner from the current Auth user and strips a local owner override', async () => {
    const { adapter, db, upsert } = await setupAdapter({});
    db.getAllAsync.mockResolvedValue([{ id: 'todo_1', user_id: 'user_b', title: 'Private' }]);

    await adapter.push([record('todos', 'todo_1')]);

    expect(upsert).toHaveBeenCalledWith([{ id: 'todo_1', title: 'Private', user_id: 'user_a' }], {
      onConflict: 'id',
    });
  });

  it('keeps the durable batch when Auth has no current user', async () => {
    const { adapter, db, from } = await setupAdapter({ authUserId: null });
    const pending = record('todos', 'todo_1');

    await expect(adapter.push([pending])).rejects.toThrow(
      'Supabase auth user is unavailable; keeping the outbox intact',
    );

    expect(db.getAllAsync).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it('fails closed when a pending intent belongs to a different Auth user', async () => {
    const { adapter, db, from } = await setupAdapter({
      authUserId: 'user_b',
    });
    const pending = record('todos', 'todo_1', 'user_a');
    db.getAllAsync.mockResolvedValue([{ id: 'todo_1', title: 'Private' }]);

    await expect(adapter.push([pending])).rejects.toThrow('Local dataset owner does not match');

    expect(from).not.toHaveBeenCalled();
  });

  it('fails closed when the local owner binding is missing', async () => {
    const { adapter, from } = await setupAdapter({ localOwnerUserId: null });

    await expect(adapter.push([record('todos', 'todo_1')])).rejects.toThrow(
      'Local dataset owner is unavailable',
    );
    expect(from).not.toHaveBeenCalled();
  });

  it('keeps the batch retryable when current Auth verification fails', async () => {
    const { adapter, db, from } = await setupAdapter({
      authError: new Error('session refresh failed'),
    });

    await expect(adapter.push([record('todos', 'todo_1')])).rejects.toThrow(
      'Supabase auth is unavailable; keeping the outbox intact: session refresh failed',
    );

    expect(db.getAllAsync).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it('reports missing local rows as a failed record for that entity', async () => {
    const { adapter, db, from, SyncPushPartialFailureError } = await setupAdapter({});
    db.getAllAsync.mockResolvedValue([]);
    const missingRecord = record('todos', 'todo_1');

    await expectPartialFailure(adapter.push([missingRecord]), SyncPushPartialFailureError, {
      messageContains: 'Missing local rows for todos: todo_1',
      failedRecords: [missingRecord],
    });

    expect(from).not.toHaveBeenCalled();
  });

  it('reports the whole entity batch as failed when only part of it loads locally', async () => {
    const { adapter, db, from, SyncPushPartialFailureError } = await setupAdapter({});
    db.getAllAsync.mockResolvedValue([{ id: 'todo_1', title: 'Only one row' }]);
    const records = [record('todos', 'todo_1'), record('todos', 'todo_2')];

    await expectPartialFailure(adapter.push(records), SyncPushPartialFailureError, {
      messageContains: 'Missing local rows for todos: todo_2',
      failedRecords: records,
    });

    expect(from).not.toHaveBeenCalled();
  });

  it('reports Supabase upsert errors as a failed record for that entity', async () => {
    const upsertError = new Error('timeout');
    const supabase = {
      from: vi.fn().mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: upsertError }) }),
    };
    const { adapter, db, SyncPushPartialFailureError } = await setupAdapter({ supabase });
    db.getAllAsync.mockResolvedValue([{ id: 'todo_1' }]);
    const upsertRecord = record('todos', 'todo_1');

    await expectPartialFailure(adapter.push([upsertRecord]), SyncPushPartialFailureError, {
      messageContains: 'Supabase upsert failed for todos: timeout',
      failedRecords: [upsertRecord],
    });
  });

  it('reports transport failures (like network timeout) as a failed record', async () => {
    const timeoutError = new Error('network timeout');
    const supabase = {
      from: vi.fn().mockReturnValue({ upsert: vi.fn().mockRejectedValue(timeoutError) }),
    };
    const { adapter, db, SyncPushPartialFailureError } = await setupAdapter({ supabase });
    db.getAllAsync.mockResolvedValue([{ id: 'habit_1' }]);
    const habitRecord = record('habits', 'habit_1');

    await expectPartialFailure(adapter.push([habitRecord]), SyncPushPartialFailureError, {
      messageContains: 'network timeout',
      failedRecords: [habitRecord],
    });
  });

  it('reports database read failures as a failed record', async () => {
    const dbError = new Error('db read failed');
    const { adapter, db, from, SyncPushPartialFailureError } = await setupAdapter({});
    db.getAllAsync.mockRejectedValue(dbError);
    const todoRecord = record('todos', 'todo_1');

    await expectPartialFailure(adapter.push([todoRecord]), SyncPushPartialFailureError, {
      messageContains: 'db read failed',
      failedRecords: [todoRecord],
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('processes each known entity in the same batch separately', async () => {
    // ONE shared storing surface for the whole test: the read-back re-enters
    // `from()` for the same entity, and each entity's rows must be visible to
    // its own verification.
    const store = storingFrom();
    // The shared store is returned for every entity, and its upsert spy is
    // cleared per entity so call-order assertions stay meaningful across the
    // read-back's re-entry into `from()`.
    const entities = vi.fn((_entity: string) => {
      store.upsert.mockClear();
      return store;
    });
    const supabase = { from: entities };
    const { adapter, db } = await setupAdapter({ supabase });
    db.getAllAsync
      .mockResolvedValueOnce([{ id: 'todo_1' }])
      .mockResolvedValueOnce([{ id: 'cal_1' }]);

    await adapter.push([record('todos', 'todo_1'), record('calorie_entries', 'cal_1')]);

    expect(db.getAllAsync).toHaveBeenCalledTimes(2);
    // The read-back re-enters `from()` for each entity, so the distinct
    // entities pushed are asserted in first-seen order rather than by call index.
    const pushedEntities = entities.mock.calls.map(([entity]) => entity);
    expect([...new Set(pushedEntities)]).toEqual(['todos', 'calorie_entries']);
  });

  it('a poisoned entity does not block other entities in the same batch from pushing', async () => {
    const habitsUpsert = vi.fn(
      async (
        _rows: Record<string, unknown> | Record<string, unknown>[],
        _options?: { onConflict?: string },
      ) => ({ error: null }),
    );
    const todosUpsert = vi.fn().mockResolvedValue({ error: new Error('schema drift') });
    // The healthy entity's store is shared across its upsert AND its read-back
    // (so the healthy push still verifies), while its upsert stays the spy this
    // test asserts on.
    const healthyStore = storingFrom(habitsUpsert);
    const from = vi.fn((entity: string) =>
      entity === 'todos' ? { upsert: todosUpsert } : healthyStore,
    );
    const supabase = { from };
    const { adapter, db, SyncPushPartialFailureError } = await setupAdapter({ supabase });
    db.getAllAsync
      .mockResolvedValueOnce([{ id: 'todo_1' }])
      .mockResolvedValueOnce([{ id: 'habit_1' }]);

    const poisonedRecord = record('todos', 'todo_1');
    const healthyRecord = record('habits', 'habit_1');

    await expectPartialFailure(
      adapter.push([poisonedRecord, healthyRecord]),
      SyncPushPartialFailureError,
      {
        messageContains: 'Supabase upsert failed for todos: schema drift',
        failedRecords: [poisonedRecord],
      },
    );

    // The healthy entity still pushed even though todos failed.
    expect(habitsUpsert).toHaveBeenCalledWith([{ id: 'habit_1', user_id: 'user_a' }], {
      onConflict: 'id',
    });
  });

  it('batches hard-delete intents into one remote delete round trip per entity', async () => {
    const deleteIntents: { ids: string[]; userId: string }[] = [];
    const from = vi.fn((entity: string) =>
      entity === 'saved_meals'
        ? {
            delete: vi.fn(() => ({
              in: vi.fn((_column: string, ids: string[]) => ({
                eq: vi.fn(async (_column2: string, userId: string) => {
                  deleteIntents.push({ ids, userId });
                  return { error: null };
                }),
              })),
            })),
          }
        : {},
    );
    const { adapter, db } = await setupAdapter({ supabase: { from } });

    const deleted = (id: string): SyncRecord => ({
      entity: 'saved_meals',
      id,
      updatedAt: '2026-04-07T12:00:00.000Z',
      operation: 'delete',
      ownerUserId: 'user_a',
    });

    await adapter.push([deleted('smeal_1'), deleted('smeal_2'), deleted('smeal_1')]);

    // One round trip total — not one per row — and duplicate intents coalesce.
    expect(deleteIntents).toEqual([{ ids: ['smeal_1', 'smeal_2'], userId: 'user_a' }]);
    expect(db.getAllAsync).not.toHaveBeenCalled();
  });

  it('upserts surviving rows when a batch mixes hard deletes and updates', async () => {
    const deleteIntents: string[][] = [];
    const store = storingFrom();
    const upsert = store.upsert;
    const from = vi.fn((entity: string) =>
      entity === 'saved_meals'
        ? {
            delete: vi.fn(() => ({
              in: vi.fn((_column: string, ids: string[]) => ({
                eq: vi.fn(async () => {
                  deleteIntents.push(ids);
                  return { error: null };
                }),
              })),
            })),
            ...store,
          }
        : store,
    );
    const { adapter, db } = await setupAdapter({ supabase: { from } });
    db.getAllAsync.mockResolvedValue([{ id: 'smeal_2', food_name: 'Keep' }]);

    await adapter.push([
      {
        entity: 'saved_meals',
        id: 'smeal_1',
        updatedAt: '2026-04-07T12:00:00.000Z',
        operation: 'delete',
        ownerUserId: 'user_a',
      },
      record('saved_meals', 'smeal_2'),
    ]);

    expect(deleteIntents).toEqual([['smeal_1']]);
    expect(upsert).toHaveBeenCalledWith([{ id: 'smeal_2', food_name: 'Keep', user_id: 'user_a' }], {
      onConflict: 'id',
    });
  });

  it('pull currently returns an empty array', async () => {
    const { adapter } = await setupAdapter({});

    await expect(adapter.pull(null)).resolves.toEqual([]);
    await expect(adapter.pull('2026-04-07T00:00:00.000Z')).resolves.toEqual([]);
  });
});
