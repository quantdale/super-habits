import { describe, expect, it, vi } from 'vitest';
import type { AccountAuthEvidence } from '@/core/auth/account.types';
import { freshDatabase } from './helpers/db';

function auth(overrides: Partial<AccountAuthEvidence> = {}): AccountAuthEvidence {
  return {
    sessionUserId: null,
    sessionIsAnonymous: null,
    verifiedUserId: null,
    verifiedIsAnonymous: null,
    verifiedEmail: null,
    ...overrides,
  };
}

describe('SQLite account recovery boundaries', () => {
  it('keeps a bound outbox owner through auth loss and resumes after the owner returns', async () => {
    const db = await freshDatabase();
    const { bindLocalDatasetOwner, inspectLocalAccountDataState } =
      await import('@/core/auth/account.data');
    const { upsertSyncOutboxRecord, SqliteSyncPersistence } =
      await import('@/core/sync/syncPersistence');
    const { runSyncedMutation } = await import('@/core/sync/syncedMutation');
    const { SyncEngine } = await import('@/core/sync/sync.engine');
    const { AccountCoordinator } = await import('@/core/auth/accountCoordinator');

    await db.runAsync(
      `INSERT INTO todos
         (id, title, notes, completed, due_date, priority, sort_order, recurrence, recurrence_id,
          created_at, updated_at, deleted_at)
       VALUES (?, ?, NULL, 0, NULL, 'normal', 1, NULL, NULL, ?, ?, NULL)`,
      [
        'todo_existing',
        'Existing local todo',
        '2026-08-14T10:00:00.000Z',
        '2026-08-14T10:00:00.000Z',
      ],
    );
    await bindLocalDatasetOwner(db as never, 'user_a');
    await upsertSyncOutboxRecord(
      db as never,
      {
        entity: 'todos',
        id: 'todo_existing',
        updatedAt: '2026-08-14T10:00:00.000Z',
        operation: 'create',
        ownerUserId: 'user_a',
      },
      1,
    );

    const currentAuth = { value: auth() };
    const ensureAnonymousSession = vi.fn();
    const coordinator = new AccountCoordinator({
      isConfigured: () => true,
      isRemoteEnabled: () => true,
      getDatabase: async () => db as never,
      getAuthEvidence: async () => currentAuth.value,
      ensureAnonymousSession,
      requestEmailProtection: async () => undefined,
      verifyEmailChangeOtp: async () => undefined,
      resendEmailChange: async () => undefined,
      requestExistingAccountRecovery: async () => undefined,
      resendExistingAccountRecovery: async () => undefined,
      verifyExistingAccountOtp: async () => undefined,
      signOut: async () => undefined,
      getRemoteFingerprint: async () => ({ counts: {}, ownerIds: [] }),
      now: () => new Date('2026-08-14T12:00:00.000Z'),
    });

    await expect(coordinator.bootstrap()).resolves.toMatchObject({ status: 'recovery_required' });
    expect(ensureAnonymousSession).not.toHaveBeenCalled();

    await runSyncedMutation({
      db: db as never,
      record: {
        entity: 'todos',
        id: 'todo_offline',
        updatedAt: '2026-08-14T12:05:00.000Z',
        operation: 'create',
      },
      mutate: async (transactionDb) => {
        await transactionDb.runAsync(
          `INSERT INTO todos
             (id, title, notes, completed, due_date, priority, sort_order, recurrence, recurrence_id,
              created_at, updated_at, deleted_at)
           VALUES (?, ?, NULL, 0, NULL, 'normal', 2, NULL, NULL, ?, ?, NULL)`,
          [
            'todo_offline',
            'Written while offline',
            '2026-08-14T12:05:00.000Z',
            '2026-08-14T12:05:00.000Z',
          ],
        );
        return { changed: true, value: undefined };
      },
    });

    const whileOffline = await inspectLocalAccountDataState(db as never);
    expect(whileOffline.ownerBinding).toBe('user_a');
    expect(whileOffline.outboxOwnerIds).toEqual(['user_a']);
    expect(whileOffline.pendingOutboxCount).toBe(2);

    currentAuth.value = auth({
      sessionUserId: 'user_a',
      sessionIsAnonymous: false,
      verifiedUserId: 'user_a',
      verifiedIsAnonymous: false,
      verifiedEmail: 'recover@example.com',
    });
    await expect(coordinator.refresh()).resolves.toMatchObject({ status: 'protected' });

    const pushed = vi.fn(async (records: { ownerUserId?: string | null }[]) => {
      expect(records.every((record) => record.ownerUserId === 'user_a')).toBe(true);
    });
    const engine = new SyncEngine(
      { push: pushed, pull: async () => [] },
      new SqliteSyncPersistence(),
    );
    await engine.hydrate();
    await engine.flush();

    expect(pushed).toHaveBeenCalledTimes(1);
    await expect(
      db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sync_outbox'),
    ).resolves.toEqual({ count: 0 });
  });
});
