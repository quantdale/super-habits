import { describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';

describe('SyncEngine hydration-before-revision (SH-AUD-002)', () => {
  it('gates revision allocation behind durable hydrate and survives restart + flush', async () => {
    const db = await freshDatabase();
    const { SqliteSyncPersistence } = await import('@/core/sync/syncPersistence');
    const { SyncEngine } = await import('@/core/sync/sync.engine');
    const store = new SqliteSyncPersistence();
    const HIGH_REV = 5000;
    await store.upsertOutbox(
      {
        entity: 'todos',
        id: 'todo_preseed',
        updatedAt: '2026-08-14T10:00:00.000Z',
        operation: 'create',
        ownerUserId: 'user_a',
      } as never,
      HIGH_REV,
    );

    const engine = new SyncEngine(
      {
        push: async () => {},
        pull: async () => [],
      },
      store,
    );

    await engine.hydrate();
    const prepared = engine.prepare({
      entity: 'todos',
      id: 'todo_new',
      updatedAt: '2026-08-14T11:00:00.000Z',
      operation: 'create',
      ownerUserId: 'user_a',
    } as never);
    expect(prepared.revision).toBeGreaterThan(HIGH_REV);

    await store.upsertOutbox(prepared, prepared.revision);
    engine.enqueuePrepared(prepared, { durablyPersisted: true });

    const store2 = new SqliteSyncPersistence();
    const engine2 = new SyncEngine(
      {
        push: async () => {},
        pull: async () => [],
      },
      store2,
    );
    await engine2.hydrate();
    const outbox = await store2.loadOutbox();
    expect(outbox.some((r) => r.id === 'todo_new')).toBe(true);
    expect(outbox.some((r) => r.id === 'todo_preseed')).toBe(true);
    const rows = await db.getAllAsync<{ revision: number }>(
      `SELECT revision FROM sync_outbox WHERE id = 'todo_new'`,
    );
    expect(rows[0]?.revision).toBeGreaterThan(HIGH_REV);

    const delivered: string[] = [];
    const engine3 = new SyncEngine(
      {
        push: async (records: { id: string }[]) => {
          delivered.push(...records.map((r) => r.id));
        },
        pull: async () => [],
      },
      store2,
    );
    await engine3.hydrate();
    await engine3.flush();
    expect(delivered).toEqual(expect.arrayContaining(['todo_new', 'todo_preseed']));

    await db.closeAsync().catch(() => undefined);
  }, 10000);
});
