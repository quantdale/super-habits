import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncPushPartialFailureError } from '@/core/sync/syncErrors';
import type { SyncRecord } from '@/core/sync/sync.engine';

type AdapterSetupOptions = {
  supabase?: { from: ReturnType<typeof vi.fn> } | null;
};

async function setupAdapter(options: AdapterSetupOptions) {
  vi.resetModules();

  const db = {
    getAllAsync: vi.fn(),
  };
  const getDatabase = vi.fn().mockResolvedValue(db);
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ upsert });

  vi.doMock('@/core/db/client', () => ({
    getDatabase,
  }));

  const supabase = options.supabase === undefined ? { from } : options.supabase;
  vi.doMock('@/lib/supabase', () => ({ supabase }));

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
  };
}

function record(entity: string, id: string): SyncRecord {
  return {
    entity,
    id,
    updatedAt: '2026-04-07T12:00:00.000Z',
    operation: 'update',
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

describe('SupabaseSyncAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns early for an empty push batch', async () => {
    const { adapter, getDatabase } = await setupAdapter({});

    await adapter.push([]);

    expect(getDatabase).not.toHaveBeenCalled();
  });

  it('returns early when supabase is unavailable', async () => {
    const { adapter, getDatabase } = await setupAdapter({
      supabase: null,
    });

    await adapter.push([record('todos', 'todo_1')]);

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
    expect(upsert).toHaveBeenCalledWith(rows, { onConflict: 'id' });
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
    const supabase = {
      from: vi.fn().mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: null }) }),
    };
    const { adapter, db } = await setupAdapter({ supabase });
    db.getAllAsync
      .mockResolvedValueOnce([{ id: 'todo_1' }])
      .mockResolvedValueOnce([{ id: 'cal_1' }]);

    await adapter.push([record('todos', 'todo_1'), record('calorie_entries', 'cal_1')]);

    expect(db.getAllAsync).toHaveBeenCalledTimes(2);
    expect(supabase.from).toHaveBeenNthCalledWith(1, 'todos');
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'calorie_entries');
  });

  it('a poisoned entity does not block other entities in the same batch from pushing', async () => {
    const habitsUpsert = vi.fn().mockResolvedValue({ error: null });
    const todosUpsert = vi.fn().mockResolvedValue({ error: new Error('schema drift') });
    const from = vi.fn((entity: string) =>
      entity === 'todos' ? { upsert: todosUpsert } : { upsert: habitsUpsert },
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
    expect(habitsUpsert).toHaveBeenCalledWith([{ id: 'habit_1' }], { onConflict: 'id' });
  });

  it('pull currently returns an empty array', async () => {
    const { adapter } = await setupAdapter({});

    await expect(adapter.pull(null)).resolves.toEqual([]);
    await expect(adapter.pull('2026-04-07T00:00:00.000Z')).resolves.toEqual([]);
  });
});
