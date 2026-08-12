import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getDatabase } from '@/core/db/client';
import { SqliteSyncPersistence } from '@/core/sync/syncPersistence';

vi.mock('@/core/db/client', () => ({
  getDatabase: vi.fn(),
}));

const db = {
  getFirstAsync: vi.fn(),
  runAsync: vi.fn(),
};

describe('SqliteSyncPersistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDatabase).mockResolvedValue(db as never);
  });

  it('drops malformed and wrong-shaped outbox entries instead of breaking hydration', async () => {
    db.getFirstAsync.mockResolvedValueOnce({
      value: JSON.stringify([
        {
          entity: 'todos',
          id: 'todo_1',
          updatedAt: '2026-08-12T00:00:00.000Z',
          operation: 'update',
        },
        { entity: 'todos', id: 'todo_2', operation: 'update' },
        { entity: 'todos', id: 'todo_3', updatedAt: 'not-a-timestamp', operation: 'unknown' },
        { not: 'an outbox' },
      ]),
    });

    await expect(new SqliteSyncPersistence().loadOutbox()).resolves.toEqual([
      {
        entity: 'todos',
        id: 'todo_1',
        updatedAt: '2026-08-12T00:00:00.000Z',
        operation: 'update',
      },
    ]);
  });

  it('uses an empty outbox for invalid JSON and a null status for invalid status shape', async () => {
    db.getFirstAsync
      .mockResolvedValueOnce({ value: '{broken json}' })
      .mockResolvedValueOnce({ value: JSON.stringify({ consecutiveFailures: 'many' }) });

    const persistence = new SqliteSyncPersistence();
    await expect(persistence.loadOutbox()).resolves.toEqual([]);
    await expect(persistence.loadStatus()).resolves.toBeNull();
  });

  it('keeps a complete persisted status', async () => {
    const status = {
      lastSuccessAt: '2026-08-12T00:00:00.000Z',
      consecutiveFailures: 2,
      lastErrorMessage: 'temporary backend failure',
      nextRetryAt: '2026-08-12T00:05:00.000Z',
    };
    db.getFirstAsync.mockResolvedValueOnce({ value: JSON.stringify(status) });

    await expect(new SqliteSyncPersistence().loadStatus()).resolves.toEqual(status);
  });
});
