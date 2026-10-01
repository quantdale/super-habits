import { describe, expect, it, vi } from 'vitest';
import { freshDatabase } from './helpers/db';

/**
 * Push verification (`harden-silent-failure-certification` 3.1-3.4).
 *
 * THE DEFECT: `upsert(rows, { onConflict: 'id' })` returns HTTP 200 while
 * affecting ZERO rows when a row with the same `id` already exists and belongs
 * to ANOTHER owner — the owner's RLS policy turns the write into a no-op instead
 * of an error. The push looked successful, the outbox record was dropped, and
 * the manifest then certified a count and checksum for a row the remote never
 * stored. Restore on another device would fail its integrity check with nothing
 * to explain why.
 *
 * The fix is a read-back of the ids just written, scoped to the pushing owner.
 * These tests drive the real adapter against a fake remote that reproduces the
 * silent skip, and assert the three things that matter: the push FAILS, the
 * failure names the entity, and the record is NOT dropped.
 */
type UpsertCall = { entity: string; rows: Record<string, unknown>[] };
type ReadBackCall = { entity: string; ids: string[]; userId: string };

const upserted: UpsertCall[] = [];
const readBacks: ReadBackCall[] = [];
/** Ids the remote pretends to have stored; anything else is a silent skip. */
let storeable: (entity: string, id: string, userId: string) => boolean = () => true;

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((entity: string) => ({
      upsert: vi.fn(async (rows: Record<string, unknown>[]) => {
        const rowList = Array.isArray(rows) ? rows : [rows];
        upserted.push({ entity, rows: rowList });
        // The remote answers 200 either way: a foreign-owner conflict is a
        // silent no-op, not an error. That is the whole defect.
        return { error: null };
      }),
      select: vi.fn((_columns: string) => ({
        in: vi.fn((_column: string, ids: string[]) => ({
          eq: vi.fn(async (_eqColumn: string, value: string) => {
            readBacks.push({ entity, ids, userId: value });
            const data = ids.filter((id) => storeable(entity, id, value)).map((id) => ({ id }));
            return { data, error: null };
          }),
        })),
      })),
      delete: vi.fn(() => ({
        in: vi.fn(() => ({
          eq: vi.fn(async () => ({ error: null })),
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

async function seedOneTodo() {
  const db = await freshDatabase();
  const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
  await setLocalDatasetOwner(db as never, 'user_a');
  const { addTodo } = await import('@/features/todos/todos.data');
  const todoId = await addTodo({ title: 'Conflicting row', priority: 'normal' });
  return { db, todoId };
}

/** Enqueue with the owner the local dataset is bound to (the adapter refuses an unowned record). */
function enqueueTodo(todoId: string) {
  return {
    entity: 'todos',
    id: todoId,
    updatedAt: new Date().toISOString(),
    operation: 'update' as const,
    ownerUserId: 'user_a',
  };
}

describe('push verification rejects a silently skipped write', () => {
  it('fails the entity push and keeps the outbox record when the remote stored nothing', async () => {
    upserted.length = 0;
    readBacks.length = 0;
    // The remote accepts the statement but stores nothing for this owner: the
    // same id exists, owned by somebody else.
    storeable = () => false;

    const { db, todoId } = await seedOneTodo();
    const { syncEngine } = await import('@/core/sync/sync.engine');
    syncEngine.enqueue(enqueueTodo(todoId));

    // The adapter must reject rather than report a successful push. The error
    // is matched by name, not `instanceof`, because the dynamically imported
    // module registry hands each import its own class object.
    const thrown = await syncEngine.flush().catch((error: unknown) => error);
    expect((thrown as Error).name).toBe('SyncPushPartialFailureError');
    expect((thrown as { failedRecords?: unknown[] }).failedRecords?.length).toBeGreaterThan(0);

    // The failure names the entity and explains the silent skip, so the log is
    // diagnosable rather than a bare exit code.
    expect(String((thrown as Error).message)).toContain('todos');
    expect(String((thrown as Error).message)).toMatch(
      /push verification failed|not stored for this owner/i,
    );

    // The record is NOT dropped: it is still pending, because nothing reached
    // the remote.
    expect(syncEngine.getPendingCount()).toBeGreaterThan(0);
    const queued = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM sync_outbox',
    );
    expect(queued?.count ?? 0).toBeGreaterThan(0);

    // And the read-back was scoped to the pushing owner, for the written ids.
    expect(readBacks.length).toBeGreaterThan(0);
    expect(readBacks.every((call) => call.userId === 'user_a')).toBe(true);
    expect(readBacks.flatMap((call) => call.ids)).toContain(todoId);
    await db.closeAsync();
  });

  it('accepts the push and drains the record when the remote stored the rows', async () => {
    upserted.length = 0;
    readBacks.length = 0;
    storeable = () => true;

    const { db, todoId } = await seedOneTodo();
    const { syncEngine } = await import('@/core/sync/sync.engine');
    syncEngine.enqueue(enqueueTodo(todoId));

    await syncEngine.flush();

    // The non-vacuity control: the verification does not fail a healthy push.
    expect(readBacks.length).toBeGreaterThan(0);
    const queued = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM sync_outbox',
    );
    expect(queued?.count ?? 0).toBe(0);
    await db.closeAsync();
  });

  it('adds exactly one read-back per pushed entity, per flush (3.4)', async () => {
    upserted.length = 0;
    readBacks.length = 0;
    storeable = () => true;

    const { db, todoId } = await seedOneTodo();
    const { syncEngine } = await import('@/core/sync/sync.engine');
    syncEngine.enqueue(enqueueTodo(todoId));
    await syncEngine.flush();

    // One upsert and one read-back for the single entity: the added request is
    // bounded per entity, not per row, so the flush cost stays flat as the batch
    // grows (the ids travel in the existing `.in()` filter).
    const todoUpserts = upserted.filter((call) => call.entity === 'todos');
    const todoReadBacks = readBacks.filter((call) => call.entity === 'todos');
    expect(todoUpserts.length).toBe(1);
    expect(todoReadBacks.length).toBe(1);
    // The read-back is additive and bounded, never one request per row.
    expect(todoReadBacks[0]?.ids.length).toBe(todoUpserts[0]?.rows.length);
    await db.closeAsync();
  });
});
