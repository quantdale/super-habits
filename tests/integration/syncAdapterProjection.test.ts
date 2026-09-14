import { describe, expect, it, vi } from 'vitest';
import { freshDatabase } from './helpers/db';
import { BACKUP_ENTITY_COLUMNS } from '@/core/backup/backup.types';

/**
 * Sync adapter push projection (audit F5): the adapter must upsert each local
 * row projected onto the entity's canonical `BACKUP_ENTITY_COLUMNS` (+ user_id)
 * so an extra local column (a freshly migrated device pushing against an
 * un-migrated remote) can never break push with an unknown-column rejection.
 */

type UpsertCall = { entity: string; rows: Record<string, unknown>[] };
type DeleteCall = { entity: string; ids: string[]; userId: string };

const upserted: UpsertCall[] = [];
const deleted: DeleteCall[] = [];

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((entity: string) => ({
      upsert: vi.fn(async (rows: Record<string, unknown>[]) => {
        upserted.push({ entity, rows: Array.isArray(rows) ? rows : [rows] });
        return { error: null };
      }),
      delete: vi.fn(() => ({
        in: vi.fn((_column: string, ids: string[]) => ({
          eq: vi.fn(async (column: string, value: string) => {
            if (column === 'user_id') deleted.push({ entity, ids, userId: value });
            return { error: null };
          }),
        })),
      })),
    })),
  },
  isRemoteEnabled: vi.fn(() => true),
  getSupabaseAuthUserId: vi.fn().mockResolvedValue('user_a'),
  getSupabaseSessionUserId: vi.fn().mockResolvedValue('user_a'),
  setRemoteMode: vi.fn(),
  ensureAnonymousSession: vi.fn().mockResolvedValue(undefined),
}));

describe('SupabaseSyncAdapter push projection', () => {
  it('upserts only canonical columns when the local row carries an extra unknown column', async () => {
    upserted.length = 0;
    const db = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(db as never, 'user_a');

    const todos = await import('@/features/todos/todos.data');
    const todoId = await todos.addTodo({ title: 'Projected row', priority: 'normal' });

    // Simulate a NEWER local schema: a column the remote does not know yet.
    await db.execAsync('ALTER TABLE todos ADD COLUMN brand_new_local_column TEXT');
    await db.runAsync('UPDATE todos SET brand_new_local_column = ? WHERE id = ?', [
      'future-value',
      todoId,
    ]);

    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    const adapter = new SupabaseSyncAdapter();
    await adapter.push([
      {
        entity: 'todos',
        id: todoId,
        updatedAt: '2026-08-20T12:00:00.000Z',
        operation: 'create',
        ownerUserId: 'user_a',
      },
    ]);

    expect(upserted).toHaveLength(1);
    expect(upserted[0]?.entity).toBe('todos');
    const payload = upserted[0]?.rows[0] ?? {};

    // The unknown local column never reaches the wire.
    expect('brand_new_local_column' in payload).toBe(false);

    // Every sent key is a canonical backup column (plus the injected owner).
    const allowed = new Set([...BACKUP_ENTITY_COLUMNS.todos, 'user_id']);
    for (const key of Object.keys(payload)) {
      expect(allowed.has(key), key).toBe(true);
    }
    expect(payload.id).toBe(todoId);
    expect(payload.user_id).toBe('user_a');
    expect(payload.title).toBe('Projected row');

    // Explicit local NULLs are still sent (they must overwrite remote values).
    expect(payload.deleted_at).toBeNull();
    expect(payload.project_id).toBeNull();

    await db.closeAsync();
  });

  it('treats a workout-log delete as an owner-scoped hard delete, not an illegal append-only delete', async () => {
    upserted.length = 0;
    deleted.length = 0;
    const db = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(db as never, 'user_a');

    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    const adapter = new SupabaseSyncAdapter();
    await adapter.push([
      {
        entity: 'workout_logs',
        id: 'wrk_deleted_accident',
        updatedAt: '2026-08-20T12:00:00.000Z',
        operation: 'delete',
        ownerUserId: 'user_a',
      },
      {
        entity: 'workout_session_sets',
        id: 'sset_deleted_accident',
        updatedAt: '2026-08-20T12:00:00.000Z',
        operation: 'delete',
        ownerUserId: 'user_a',
      },
    ]);

    // The rows are gone locally, so nothing is upserted; the delete path
    // issues one owner-scoped remote DELETE per entity instead of throwing.
    expect(upserted).toHaveLength(0);
    expect(deleted).toContainEqual({
      entity: 'workout_logs',
      ids: ['wrk_deleted_accident'],
      userId: 'user_a',
    });
    expect(deleted).toContainEqual({
      entity: 'workout_session_sets',
      ids: ['sset_deleted_accident'],
      userId: 'user_a',
    });

    await db.closeAsync();
  });

  it('still refuses a delete queued for a never-deleted pomodoro session', async () => {
    upserted.length = 0;
    deleted.length = 0;
    const db = await freshDatabase();
    const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
    await setLocalDatasetOwner(db as never, 'user_a');

    const { SupabaseSyncAdapter } = await import('@/core/sync/supabase.adapter');
    const adapter = new SupabaseSyncAdapter();
    await expect(
      adapter.push([
        {
          entity: 'pomodoro_sessions',
          id: 'pom_never_deleted',
          updatedAt: '2026-08-20T12:00:00.000Z',
          operation: 'delete',
          ownerUserId: 'user_a',
        },
      ]),
    ).rejects.toThrow(/Illegal delete intent/);
    expect(deleted).toHaveLength(0);

    await db.closeAsync();
  });
});
