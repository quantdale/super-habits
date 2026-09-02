import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';

/**
 * Offline/reconnect outbox torture (Production Hardening V1 §6).
 *
 * The engine unit tests cover single-failure retry, single-flight flush
 * sharing, and backoff in isolation. These integration tests close the two
 * combined gaps against real SQLite: (6.1) real data-layer mutations made
 * while offline survive a process restart and flush exactly once on
 * reconnect; (6.2) repeated offline→online flapping with concurrent flush
 * triggers never duplicates or loses records and keeps retry metadata sane.
 */

describe('sync outbox offline/restart/reconnect torture', () => {
  it('offline data-layer writes survive restart and flush exactly once on reconnect', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-outbox-torture-'));
    const file = path.join(dir, 'superhabits.db');
    try {
      // Offline phase: real data-layer writes with no remote. The durable
      // outbox rows land in the same transactions as the todos.
      let db = await freshDatabase(file);
      const todos = await import('@/features/todos/todos.data');
      const firstId = await todos.addTodo({ title: 'offline one' });
      const secondId = await todos.addTodo({ title: 'offline two' });
      const queued = await db.getAllAsync<{ id: string }>(
        'SELECT id FROM sync_outbox WHERE entity = ?',
        ['todos'],
      );
      expect(new Set(queued.map((r) => r.id))).toEqual(new Set([firstId, secondId]));
      await db.closeAsync();

      // Restart: fresh modules over the SAME file, then hydrate a new engine
      // and flush through a recovering adapter.
      db = await freshDatabase(file);
      const { SyncEngine } = await import('@/core/sync/sync.engine');
      const { SqliteSyncPersistence } = await import('@/core/sync/syncPersistence');
      const delivered: string[] = [];
      const engine = new SyncEngine(
        {
          push: async (records: { id: string }[]) => {
            delivered.push(...records.map((r) => r.id));
          },
          pull: async () => [],
        },
        new SqliteSyncPersistence(),
      );
      await engine.hydrate();
      expect(engine.getPendingCount()).toBe(2);

      await engine.flush();
      expect([...delivered].sort()).toEqual([firstId, secondId].sort());

      // A second flush delivers nothing: successes were removed by exact
      // revision, not just dropped from memory.
      await engine.flush();
      expect(delivered).toHaveLength(2);
      const remaining = await db.getAllAsync<{ id: string }>('SELECT id FROM sync_outbox');
      expect(remaining).toHaveLength(0);

      // Local product data survived the restart untouched.
      const titles = await db.getAllAsync<{ title: string }>(
        'SELECT title FROM todos WHERE deleted_at IS NULL ORDER BY title ASC',
      );
      expect(titles.map((t) => t.title)).toEqual(['offline one', 'offline two']);
      await db.closeAsync();
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });

  it('repeated offline/online flapping with concurrent flushes loses and duplicates nothing', async () => {
    const db = await freshDatabase();
    try {
      const { SyncEngine } = await import('@/core/sync/sync.engine');
      const { SqliteSyncPersistence } = await import('@/core/sync/syncPersistence');

      let online = false;
      let pushCalls = 0;
      const pushedBatches: string[][] = [];
      const engine = new SyncEngine(
        {
          push: async (records: { id: string }[]) => {
            pushCalls += 1;
            pushedBatches.push(records.map((r) => r.id));
            if (!online) throw new Error('simulated offline');
          },
          pull: async () => [],
        },
        new SqliteSyncPersistence(),
      );

      const record = (n: number) => ({
        entity: 'todos',
        id: `todo_flap_${n}`,
        updatedAt: '2026-04-01T10:00:00.000Z',
        operation: 'create' as const,
      });

      // Cycle 1 (offline): 3 records, 3 concurrent flush triggers (interval +
      // visibility + reconnect). Single-flight shares ONE push; all retained.
      engine.enqueue(record(1));
      engine.enqueue(record(2));
      engine.enqueue(record(3));
      await Promise.allSettled([engine.flush(), engine.flush(), engine.flush()]);
      expect(pushCalls).toBe(1);
      expect(engine.getPendingCount()).toBe(3);
      expect(engine.getStatus()).toMatchObject({ consecutiveFailures: 1 });
      const retryAfterFirst = engine.getStatus().nextRetryAt;
      expect(retryAfterFirst).not.toBeNull();
      expect(engine.shouldAttemptFlush()).toBe(false);

      // Cycle 2 (still offline, one more write arrives): 2 concurrent flushes
      // still share one push; backoff grows; nothing lost.
      engine.enqueue(record(4));
      await Promise.allSettled([engine.flush(), engine.flush()]);
      expect(pushCalls).toBe(2);
      expect(engine.getPendingCount()).toBe(4);
      expect(engine.getStatus()).toMatchObject({ consecutiveFailures: 2 });
      const retryAfterSecond = engine.getStatus().nextRetryAt;
      expect(retryAfterSecond).not.toBeNull();
      expect(Date.parse(retryAfterSecond!).valueOf()).toBeGreaterThan(
        Date.parse(retryAfterFirst!).valueOf(),
      );

      // Cycle 3 (reconnect): one flush delivers all 4 exactly once each and
      // resets the retry metadata.
      online = true;
      await engine.flush();
      expect(pushCalls).toBe(3);
      expect(pushedBatches[2].slice().sort()).toEqual(
        ['todo_flap_1', 'todo_flap_2', 'todo_flap_3', 'todo_flap_4'].sort(),
      );
      expect(engine.getPendingCount()).toBe(0);
      expect(engine.getStatus()).toMatchObject({
        consecutiveFailures: 0,
        lastErrorMessage: null,
        nextRetryAt: null,
      });
      expect(engine.getStatus().lastSuccessAt).not.toBeNull();
      const remaining = await db.getAllAsync<{ id: string }>('SELECT id FROM sync_outbox');
      expect(remaining).toHaveLength(0);

      // Cycle 4 (clean): a further flush with an empty queue issues no push.
      await engine.flush();
      expect(pushCalls).toBe(3);
    } finally {
      await db.closeAsync().catch(() => undefined);
    }
  });
});
