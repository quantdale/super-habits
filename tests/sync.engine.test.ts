import { describe, expect, it, vi } from 'vitest';
import {
  SyncEngine,
  SyncPushPartialFailureError,
  type SyncPersistence,
  type SyncRecord,
  type SyncStatus,
} from '@/core/sync/sync.engine';

function fakePersistence(): SyncPersistence & {
  outbox: SyncRecord[];
  status: SyncStatus | null;
} {
  return {
    outbox: [],
    status: null,
    async loadOutbox() {
      return this.outbox;
    },
    async saveOutbox(records) {
      this.outbox = records;
    },
    async loadStatus() {
      return this.status;
    },
    async saveStatus(status) {
      this.status = status;
    },
  };
}

describe('SyncEngine', () => {
  it('preserves records enqueued while a flush is in flight', async () => {
    const pushedBatches: SyncRecord[][] = [];
    let releasePush: (() => void) | undefined;
    const pushBlocked = new Promise<void>((resolve) => {
      releasePush = resolve;
    });

    const adapter = {
      push: vi.fn(async (records: SyncRecord[]) => {
        pushedBatches.push(records);
        await pushBlocked;
      }),
      pull: vi.fn(async () => []),
    };

    const engine = new SyncEngine(adapter);
    const first: SyncRecord = {
      entity: 'todos',
      id: 'todo_1',
      updatedAt: '2026-04-06T10:00:00.000Z',
      operation: 'create',
    };
    const second: SyncRecord = {
      entity: 'todos',
      id: 'todo_2',
      updatedAt: '2026-04-06T10:00:01.000Z',
      operation: 'update',
    };

    engine.enqueue(first);
    const flushing = engine.flush();
    engine.enqueue(second);

    releasePush?.();
    await flushing;
    await engine.flush();

    expect(adapter.push).toHaveBeenCalledTimes(2);
    expect(pushedBatches).toEqual([[first], [second]]);
  });

  it('restores original records when push fails after adapter mutates the batch array', async () => {
    const first: SyncRecord = {
      entity: 'todos',
      id: 'todo_1',
      updatedAt: '2026-04-06T10:00:00.000Z',
      operation: 'create',
    };
    const during: SyncRecord = {
      entity: 'todos',
      id: 'todo_2',
      updatedAt: '2026-04-06T10:00:01.000Z',
      operation: 'update',
    };

    const batchesAtPushStart: SyncRecord[][] = [];
    let attempt = 0;

    let engine!: SyncEngine;
    const adapter = {
      push: vi.fn(async (records: SyncRecord[]) => {
        attempt += 1;
        batchesAtPushStart.push([...records]);
        if (attempt === 1) {
          records.length = 0;
          engine.enqueue(during);
          throw new Error('push failed');
        }
      }),
      pull: vi.fn(async () => []),
    };

    engine = new SyncEngine(adapter);

    engine.enqueue(first);
    await expect(engine.flush()).rejects.toThrow('push failed');
    await engine.flush();

    expect(adapter.push).toHaveBeenCalledTimes(2);
    expect(batchesAtPushStart[0]).toEqual([first]);
    expect(batchesAtPushStart[1]).toEqual([first, during]);
  });

  it('retries failed records on the next flush', async () => {
    const recordForRetry: SyncRecord = {
      entity: 'todos',
      id: 'todo_retry',
      updatedAt: '2026-04-06T10:00:00.000Z',
      operation: 'update',
    };

    const pushedBatches: SyncRecord[][] = [];
    let attempt = 0;
    const adapter = {
      push: vi.fn(async (records: SyncRecord[]) => {
        attempt += 1;
        pushedBatches.push([...records]);
        if (attempt === 1) {
          throw new Error('transient failure');
        }
      }),
      pull: vi.fn(async () => []),
    };

    const engine = new SyncEngine(adapter);
    engine.enqueue(recordForRetry);

    await expect(engine.flush()).rejects.toThrow('transient failure');
    await engine.flush();

    expect(adapter.push).toHaveBeenCalledTimes(2);
    expect(pushedBatches).toEqual([[recordForRetry], [recordForRetry]]);
  });

  it('reports the current pending count for Settings to surface', async () => {
    const adapter = {
      push: vi.fn().mockRejectedValue(new Error('offline')),
      pull: vi.fn(async () => []),
    };
    const engine = new SyncEngine(adapter);
    expect(engine.getPendingCount()).toBe(0);

    engine.enqueue({
      entity: 'todos',
      id: 'todo_1',
      updatedAt: '2026-04-06T10:00:00.000Z',
      operation: 'create',
    });
    expect(engine.getPendingCount()).toBe(1);

    await expect(engine.flush()).rejects.toThrow('offline');
    expect(engine.getPendingCount()).toBe(1);
  });

  it('dedupes by (entity,id): a later enqueue replaces the still-pending earlier one', async () => {
    const pushedBatches: SyncRecord[][] = [];
    const adapter = {
      push: vi.fn(async (records: SyncRecord[]) => {
        pushedBatches.push([...records]);
      }),
      pull: vi.fn(async () => []),
    };

    const engine = new SyncEngine(adapter);
    engine.enqueue({
      entity: 'todos',
      id: 'todo_1',
      updatedAt: '2026-04-06T10:00:00.000Z',
      operation: 'update',
    });
    engine.enqueue({
      entity: 'todos',
      id: 'todo_1',
      updatedAt: '2026-04-06T10:00:05.000Z',
      operation: 'update',
    });

    await engine.flush();

    expect(pushedBatches).toEqual([
      [
        {
          entity: 'todos',
          id: 'todo_1',
          updatedAt: '2026-04-06T10:00:05.000Z',
          operation: 'update',
        },
      ],
    ]);
  });

  it('only requeues the records an adapter reports as failed, not the whole batch', async () => {
    const succeeded: SyncRecord = {
      entity: 'habits',
      id: 'habit_1',
      updatedAt: '2026-04-06T10:00:00.000Z',
      operation: 'update',
    };
    const poisoned: SyncRecord = {
      entity: 'todos',
      id: 'todo_poison',
      updatedAt: '2026-04-06T10:00:00.000Z',
      operation: 'update',
    };

    const pushedBatches: SyncRecord[][] = [];
    let attempt = 0;
    const adapter = {
      push: vi.fn(async (records: SyncRecord[]) => {
        attempt += 1;
        pushedBatches.push([...records]);
        if (attempt === 1) {
          throw new SyncPushPartialFailureError('one entity failed', [poisoned]);
        }
      }),
      pull: vi.fn(async () => []),
    };

    const engine = new SyncEngine(adapter);
    engine.enqueue(succeeded);
    engine.enqueue(poisoned);

    await expect(engine.flush()).rejects.toThrow('one entity failed');
    await engine.flush();

    expect(adapter.push).toHaveBeenCalledTimes(2);
    // Second attempt only retries the poisoned record — `succeeded` was
    // already accepted and must not be re-sent.
    expect(pushedBatches[1]).toEqual([poisoned]);
  });

  it('persists the outbox and status through a durable store, and hydrate() restores them', async () => {
    const persistence = fakePersistence();
    const pushError = new Error('offline');
    const adapter = {
      push: vi.fn().mockRejectedValue(pushError),
      pull: vi.fn(async () => []),
    };

    const engine = new SyncEngine(adapter, persistence);
    const pending: SyncRecord = {
      entity: 'todos',
      id: 'todo_1',
      updatedAt: '2026-04-06T10:00:00.000Z',
      operation: 'create',
    };
    engine.enqueue(pending);
    await expect(engine.flush()).rejects.toThrow('offline');

    // A killed process restarts as a fresh engine instance — hydrate() must
    // recover exactly what was pending and why the last attempt failed.
    const restarted = new SyncEngine(adapter, persistence);
    await restarted.hydrate();

    expect(restarted.getStatus().consecutiveFailures).toBe(1);
    expect(restarted.getStatus().lastErrorMessage).toBe('offline');
    expect(restarted.shouldAttemptFlush()).toBe(false);

    adapter.push.mockResolvedValueOnce(undefined);
    await restarted.flush();
    expect(adapter.push).toHaveBeenLastCalledWith([pending]);
    expect(restarted.getStatus().consecutiveFailures).toBe(0);
    expect(restarted.getStatus().lastSuccessAt).not.toBeNull();
  });

  it('backs off for longer after consecutive failures, and clears on success', async () => {
    const persistence = fakePersistence();
    const adapter = {
      push: vi.fn().mockRejectedValue(new Error('down')),
      pull: vi.fn(async () => []),
    };
    const engine = new SyncEngine(adapter, persistence);
    engine.enqueue({
      entity: 'todos',
      id: 'todo_1',
      updatedAt: '2026-04-06T10:00:00.000Z',
      operation: 'create',
    });

    await expect(engine.flush()).rejects.toThrow('down');
    const firstDelay = new Date(engine.getStatus().nextRetryAt!).getTime() - Date.now();

    await expect(engine.flush()).rejects.toThrow('down');
    const secondDelay = new Date(engine.getStatus().nextRetryAt!).getTime() - Date.now();

    expect(secondDelay).toBeGreaterThan(firstDelay);
    expect(engine.shouldAttemptFlush()).toBe(false);

    adapter.push.mockResolvedValueOnce(undefined);
    await engine.flush();
    expect(engine.getStatus().nextRetryAt).toBeNull();
    expect(engine.shouldAttemptFlush()).toBe(true);
  });

  it('concurrent flush() calls share the same in-flight push instead of racing', async () => {
    let pushCount = 0;
    let releasePush: (() => void) | undefined;
    const pushBlocked = new Promise<void>((resolve) => {
      releasePush = resolve;
    });
    const adapter = {
      push: vi.fn(async () => {
        pushCount += 1;
        await pushBlocked;
      }),
      pull: vi.fn(async () => []),
    };

    const engine = new SyncEngine(adapter);
    engine.enqueue({
      entity: 'todos',
      id: 'todo_1',
      updatedAt: '2026-04-06T10:00:00.000Z',
      operation: 'create',
    });

    const first = engine.flush();
    const second = engine.flush();
    releasePush?.();
    await Promise.all([first, second]);

    expect(pushCount).toBe(1);
  });
});
