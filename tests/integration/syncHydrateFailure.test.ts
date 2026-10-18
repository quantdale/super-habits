import { describe, expect, it, vi } from 'vitest';
import { freshDatabase } from './helpers/db';

/**
 * A3 — sync-outbox revision-floor recovery after a failed hydrate.
 *
 * `hydrate()` restores the persisted max revision so new intents allocate
 * ABOVE anything already durable (the outbox upsert only accepts
 * `excluded.revision > sync_outbox.revision`). If the outbox read fails and
 * bootstrap swallows the error, the floor stayed at 0 — every new intent then
 * allocated revision 1..n, silently lost the guard, and left the old durable
 * record dangling (its exact-revision removal can never match), starving the
 * backup completeness checkpoint and stranding hard-delete intents.
 *
 * These tests pin the proven valid-mutation rejection (the control) and the
 * recovered behavior against real SQLite.
 */

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn() },
  isRemoteEnabled: vi.fn(() => true),
  getSupabaseAuthUserId: vi.fn().mockResolvedValue('user_a'),
  getSupabaseSessionUserId: vi.fn().mockResolvedValue('user_a'),
  setRemoteMode: vi.fn(),
  ensureAnonymousSession: vi.fn().mockResolvedValue(undefined),
}));

const DURABLE_REVISION = 50;

async function loadOwnedDatabase() {
  const db = await freshDatabase();
  const { setLocalDatasetOwner } = await import('@/core/auth/account.data');
  await setLocalDatasetOwner(db as never, 'user_a');
  return db;
}

describe('outbox revision floor after a failed hydrate', () => {
  it('loses a low-revision intent at the durable guard (the failure mode being fixed)', async () => {
    const db = await loadOwnedDatabase();
    const { upsertSyncOutboxRecord } = await import('@/core/sync/syncPersistence');

    const record = {
      entity: 'todos',
      id: 'todo_control',
      updatedAt: '2026-10-17T00:00:00.000Z',
      operation: 'update' as const,
    };
    await upsertSyncOutboxRecord(db as never, record, DURABLE_REVISION);

    // With a cold engine (hydrate failed, floor 0) the next intent allocates 1.
    await upsertSyncOutboxRecord(
      db as never,
      { ...record, updatedAt: '2026-10-17T01:00:00.000Z' },
      1,
    );

    const row = await db.getFirstAsync<{ revision: number; updated_at: string }>(
      "SELECT revision, updated_at FROM sync_outbox WHERE id = 'todo_control'",
    );
    // The newer write was silently discarded by the monotonic guard.
    expect(row?.revision).toBe(DURABLE_REVISION);
    expect(row?.updated_at).toBe('2026-10-17T00:00:00.000Z');

    await db.closeAsync();
  });

  it('recovers the floor from the durable max revision so the next intent wins the guard', async () => {
    const db = await loadOwnedDatabase();
    const { SqliteSyncPersistence, upsertSyncOutboxRecord } =
      await import('@/core/sync/syncPersistence');
    const { SyncEngine, NoopSyncAdapter } = await import('@/core/sync/sync.engine');

    const record = {
      entity: 'todos',
      id: 'todo_recovered',
      updatedAt: '2026-10-17T01:00:00.000Z',
      operation: 'update' as const,
    };
    await upsertSyncOutboxRecord(db as never, record, DURABLE_REVISION);

    class FlakyPersistence extends SqliteSyncPersistence {
      failureInjected = false;
      override async loadOutbox() {
        if (!this.failureInjected) {
          this.failureInjected = true;
          throw new Error('simulated outbox read failure');
        }
        return super.loadOutbox();
      }
    }

    const persistence = new FlakyPersistence();
    const engine = new SyncEngine(new NoopSyncAdapter(), persistence);

    // The failed load is surfaced (bootstrap logs it) but the floor is restored
    // before the rejection propagates.
    await expect(engine.hydrate()).rejects.toThrow('simulated outbox read failure');

    const prepared = engine.prepare(record);
    expect(prepared.revision).toBeGreaterThan(DURABLE_REVISION);

    await upsertSyncOutboxRecord(db as never, prepared, prepared.revision);
    const row = await db.getFirstAsync<{ revision: number; updated_at: string }>(
      "SELECT revision, updated_at FROM sync_outbox WHERE id = 'todo_recovered'",
    );
    expect(row?.revision).toBe(prepared.revision);
    expect(row?.updated_at).toBe(record.updatedAt);

    // Exact-revision removal now matches: the success path can drain the row.
    await persistence.removeOutbox([prepared]);
    const gone = await db.getFirstAsync("SELECT id FROM sync_outbox WHERE id = 'todo_recovered'");
    expect(gone).toBeNull();

    await db.closeAsync();
  });

  it('a successful hydrate keeps allocating above the restored durable revision', async () => {
    const db = await loadOwnedDatabase();
    const { SqliteSyncPersistence, upsertSyncOutboxRecord } =
      await import('@/core/sync/syncPersistence');
    const { SyncEngine, NoopSyncAdapter } = await import('@/core/sync/sync.engine');

    await upsertSyncOutboxRecord(
      db as never,
      {
        entity: 'todos',
        id: 'todo_loaded',
        updatedAt: '2026-10-17T00:00:00.000Z',
        operation: 'update',
      },
      DURABLE_REVISION,
    );

    const engine = new SyncEngine(new NoopSyncAdapter(), new SqliteSyncPersistence());
    await engine.hydrate();
    expect(engine.getPendingCount()).toBe(1);

    const prepared = engine.prepare({
      entity: 'todos',
      id: 'todo_after_load',
      updatedAt: '2026-10-17T02:00:00.000Z',
      operation: 'update',
    });
    expect(prepared.revision).toBeGreaterThan(DURABLE_REVISION);

    await db.closeAsync();
  });
});
