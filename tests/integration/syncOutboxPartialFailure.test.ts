import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';

/**
 * Durable-outbox partial-failure contract (PA-02).
 *
 * The e2e journeys-sync lane asserts that after a per-entity partial push
 * (todos succeed, habits fail) only the failed entity remains in the durable
 * SQLite `sync_outbox`; the successful entity must be durably removed. The
 * in-memory engine test proves the queue drops succeeded records, but it uses
 * the no-op persistence — the real `removeOutbox` (delete by entity/id/revision)
 * is never exercised. This integration test locks that exact contract against a
 * real SQLite outbox so a regression in durable removal surfaces locally.
 */
describe('SQLite outbox durable partial-failure removal (PA-02)', () => {
  let db: Awaited<ReturnType<typeof freshDatabase>>;

  beforeEach(async () => {
    db = await freshDatabase();
  });

  afterEach(async () => {
    await db.closeAsync().catch(() => undefined);
  });

  it('durably removes only the succeeded entity and keeps the failed one', async () => {
    const { SqliteSyncPersistence } = await import('@/core/sync/syncPersistence');
    const { SyncEngine, SyncPushPartialFailureError } = await import('@/core/sync/sync.engine');

    const store = new SqliteSyncPersistence();

    const todo = {
      entity: 'todos' as const,
      id: 'todo_1',
      updatedAt: '2026-08-14T10:00:00.000Z',
      operation: 'update' as const,
      ownerUserId: 'user_a',
    };
    const habit = {
      entity: 'habits' as const,
      id: 'habit_1',
      updatedAt: '2026-08-14T10:00:00.000Z',
      operation: 'update' as const,
      ownerUserId: 'user_a',
    };

    type OutboxRecord = typeof todo | typeof habit;
    const adapter = {
      push: async (records: OutboxRecord[]) => {
        const failed = records.filter((r) => r.entity === 'habits');
        if (failed.length > 0) {
          throw new SyncPushPartialFailureError('habits failed', failed);
        }
      },
      pull: async () => [] as OutboxRecord[],
    };

    const engine = new SyncEngine(adapter, store);
    await engine.hydrate();
    engine.enqueue(todo);
    engine.enqueue(habit);

    // Let the durable enqueue writes settle before the flush.
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect(engine.flush()).rejects.toBeInstanceOf(SyncPushPartialFailureError);

    // The durable outbox must retain only the failed (habits) record.
    const remaining = (await store.loadOutbox()).map((r) => r.entity).sort();
    expect(remaining).toEqual(['habits']);

    // A subsequent flush must re-attempt only habits, never todos.
    const seen: string[][] = [];
    const adapter2 = {
      push: async (records: OutboxRecord[]) => {
        seen.push(records.map((r) => r.entity).sort());
      },
      pull: async () => [] as OutboxRecord[],
    };
    const engine2 = new SyncEngine(adapter2, store);
    await engine2.hydrate();
    await engine2.flush();

    expect(seen).toEqual([['habits']]);
  });
});
