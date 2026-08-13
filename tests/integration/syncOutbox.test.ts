import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';

describe('SQLite sync outbox durability', () => {
  it('keeps the newest revision and survives a real process restart', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-sync-outbox-'));
    const file = path.join(dir, 'superhabits.db');
    try {
      const db = await freshDatabase(file);
      const persistence = await import('@/core/sync/syncPersistence');
      const store = new persistence.SqliteSyncPersistence();

      await store.upsertOutbox(
        {
          entity: 'todos',
          id: 'todo_1',
          updatedAt: '2026-08-14T10:00:00.000Z',
          operation: 'update',
        },
        2,
      );
      await store.upsertOutbox(
        {
          entity: 'todos',
          id: 'todo_1',
          updatedAt: '2026-08-14T10:01:00.000Z',
          operation: 'delete',
        },
        3,
      );
      // A delayed older writer cannot resurrect the stale snapshot.
      await store.upsertOutbox(
        {
          entity: 'todos',
          id: 'todo_1',
          updatedAt: '2026-08-14T09:59:00.000Z',
          operation: 'update',
        },
        2,
      );

      expect(await store.loadOutbox()).toEqual([
        {
          entity: 'todos',
          id: 'todo_1',
          updatedAt: '2026-08-14T10:01:00.000Z',
          operation: 'delete',
          revision: 3,
        },
      ]);

      await store.removeOutbox([
        {
          entity: 'todos',
          id: 'todo_1',
          updatedAt: '2026-08-14T10:00:00.000Z',
          operation: 'update',
          revision: 2,
        },
      ]);
      expect(await store.loadOutbox()).toHaveLength(1);
      await db.closeAsync();

      const restarted = await freshDatabase(file);
      const restartedStore = new (
        await import('@/core/sync/syncPersistence')
      ).SqliteSyncPersistence();
      expect(await restartedStore.loadOutbox()).toEqual([
        {
          entity: 'todos',
          id: 'todo_1',
          updatedAt: '2026-08-14T10:01:00.000Z',
          operation: 'delete',
          revision: 3,
        },
      ]);
      await restarted.closeAsync();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
