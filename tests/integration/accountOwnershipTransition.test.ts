import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
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

async function insertTodo(
  db: Awaited<ReturnType<typeof freshDatabase>>,
  id: string,
  title: string,
  sortOrder: number,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO todos
       (id, title, notes, completed, due_date, priority, sort_order, recurrence, recurrence_id,
        created_at, updated_at, deleted_at)
     VALUES (?, ?, NULL, 0, NULL, 'normal', ?, NULL, NULL, ?, ?, NULL)`,
    [id, title, sortOrder, '2026-08-14T10:00:00.000Z', '2026-08-14T10:00:00.000Z'],
  );
}

describe('real SQLite first-activity ownership transitions', () => {
  it('first synced write on a fresh anonymous install is owned, never ownerless', async () => {
    const db = await freshDatabase();
    const { bindProvisionalLocalDatasetOwner, inspectLocalAccountDataState } =
      await import('@/core/auth/account.data');
    const { runSyncedMutation } = await import('@/core/sync/syncedMutation');

    // Bootstrap claimed the pristine dataset for temporary anonymous A.
    await bindProvisionalLocalDatasetOwner(db as never, 'anon_a');

    await runSyncedMutation({
      db: db as never,
      record: {
        entity: 'todos',
        id: 'todo_first',
        updatedAt: '2026-08-14T10:00:00.000Z',
        operation: 'create',
      },
      mutate: async (transactionDb) => {
        await insertTodo(transactionDb as never, 'todo_first', 'First todo', 1);
        return { changed: true, value: undefined };
      },
    });

    const inspected = await inspectLocalAccountDataState(db as never);
    expect(inspected.ownerBinding).toBe('anon_a');
    expect(inspected.ownerBindingProvisional).toBe(false);
    expect(inspected.outboxOwnerIds).toEqual(['anon_a']);
    expect(inspected.pendingOutboxCount).toBe(1);

    const row = await db.getFirstAsync<{ owner_user_id: string | null }>(
      'SELECT owner_user_id FROM sync_outbox WHERE id = ?',
      ['todo_first'],
    );
    expect(row?.owner_user_id).toBe('anon_a');
  });

  it('local-only-first (pomodoro) then a synced todo both belong to the anonymous owner', async () => {
    const db = await freshDatabase();
    const { bindProvisionalLocalDatasetOwner, inspectLocalAccountDataState } =
      await import('@/core/auth/account.data');
    const { runSyncedMutation } = await import('@/core/sync/syncedMutation');
    const { logPomodoroSession } = await import('@/features/pomodoro/pomodoro.data');

    await bindProvisionalLocalDatasetOwner(db as never, 'anon_a');
    await logPomodoroSession('2026-08-14T10:00:00.000Z', '2026-08-14T10:25:00.000Z', 1500, 'focus');

    const afterPomodoro = await inspectLocalAccountDataState(db as never);
    expect(afterPomodoro.hasUserData).toBe(true);
    // First local-only activity durably promoted the provisional claim.
    expect(afterPomodoro.ownerBinding).toBe('anon_a');
    expect(afterPomodoro.ownerBindingProvisional).toBe(false);

    await runSyncedMutation({
      db: db as never,
      record: {
        entity: 'todos',
        id: 'todo_after_pomodoro',
        updatedAt: '2026-08-14T10:30:00.000Z',
        operation: 'create',
      },
      mutate: async (transactionDb) => {
        await insertTodo(transactionDb as never, 'todo_after_pomodoro', 'Todo after pomodoro', 1);
        return { changed: true, value: undefined };
      },
    });

    const inspected = await inspectLocalAccountDataState(db as never);
    expect(inspected.ownerBinding).toBe('anon_a');
    expect(inspected.outboxOwnerIds).toEqual(['anon_a']);
  });

  it('workout local history first also claims the dataset for the anonymous owner', async () => {
    const db = await freshDatabase();
    const { bindProvisionalLocalDatasetOwner, inspectLocalAccountDataState } =
      await import('@/core/auth/account.data');
    const { runSyncedMutation } = await import('@/core/sync/syncedMutation');
    const { logWorkoutSession } = await import('@/features/workout/workout.data');
    const { addRoutine } = await import('@/features/workout/workout.data');

    await bindProvisionalLocalDatasetOwner(db as never, 'anon_a');
    await addRoutine('Push day', '');
    await logWorkoutSession({
      routineId: 'wrk_push',
      exercises: [{ exerciseName: 'Bench press', setsCompleted: 3 }],
    });

    const afterWorkout = await inspectLocalAccountDataState(db as never);
    expect(afterWorkout.hasUserData).toBe(true);
    expect(afterWorkout.ownerBinding).toBe('anon_a');
    expect(afterWorkout.ownerBindingProvisional).toBe(false);

    await runSyncedMutation({
      db: db as never,
      record: {
        entity: 'todos',
        id: 'todo_after_workout',
        updatedAt: '2026-08-14T11:00:00.000Z',
        operation: 'create',
      },
      mutate: async (transactionDb) => {
        await insertTodo(transactionDb as never, 'todo_after_workout', 'Todo after workout', 1);
        return { changed: true, value: undefined };
      },
    });

    const inspected = await inspectLocalAccountDataState(db as never);
    expect(inspected.ownerBinding).toBe('anon_a');
    expect(inspected.outboxOwnerIds).toEqual(['anon_a']);
  });

  it('session loss after first local-only data creates no new anonymous identity', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-account-first-local-'));
    const file = path.join(dir, 'superhabits.db');
    try {
      const first = await freshDatabase(file);
      const { bindProvisionalLocalDatasetOwner } = await import('@/core/auth/account.data');
      const { logPomodoroSession } = await import('@/features/pomodoro/pomodoro.data');
      await bindProvisionalLocalDatasetOwner(first as never, 'anon_a');
      await logPomodoroSession(
        '2026-08-14T10:00:00.000Z',
        '2026-08-14T10:25:00.000Z',
        1500,
        'focus',
      );
      await first.closeAsync();

      // Restart with auth storage wiped: no session, populated dataset.
      const restarted = await freshDatabase(file);
      const { AccountCoordinator } = await import('@/core/auth/accountCoordinator');
      const { runSyncedMutation } = await import('@/core/sync/syncedMutation');
      const { inspectLocalAccountDataState } = await import('@/core/auth/account.data');

      const currentAuth = { value: auth() };
      const ensureAnonymousSession = vi.fn();
      const coordinator = new AccountCoordinator({
        isConfigured: () => true,
        isRemoteEnabled: () => true,
        getDatabase: async () => restarted as never,
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

      await expect(coordinator.bootstrap()).resolves.toMatchObject({
        status: 'recovery_required',
      });
      expect(ensureAnonymousSession).not.toHaveBeenCalled();

      // Offline synced write keeps the original anonymous owner.
      await runSyncedMutation({
        db: restarted as never,
        record: {
          entity: 'todos',
          id: 'todo_offline_after_local',
          updatedAt: '2026-08-14T12:05:00.000Z',
          operation: 'create',
        },
        mutate: async (transactionDb) => {
          await insertTodo(
            transactionDb as never,
            'todo_offline_after_local',
            'Offline after local-only',
            1,
          );
          return { changed: true, value: undefined };
        },
      });

      const inspected = await inspectLocalAccountDataState(restarted as never);
      expect(inspected.ownerBinding).toBe('anon_a');
      expect(inspected.outboxOwnerIds).toEqual(['anon_a']);
      expect(inspected.hasUserData).toBe(true);
      await restarted.closeAsync();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('owner binding, local content, and outbox owner survive restart and flush under owner A', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'superhabits-account-restart-flush-'));
    const file = path.join(dir, 'superhabits.db');
    try {
      const first = await freshDatabase(file);
      const { bindProvisionalLocalDatasetOwner } = await import('@/core/auth/account.data');
      const { logPomodoroSession } = await import('@/features/pomodoro/pomodoro.data');
      const { runSyncedMutation } = await import('@/core/sync/syncedMutation');
      await bindProvisionalLocalDatasetOwner(first as never, 'anon_a');
      await logPomodoroSession(
        '2026-08-14T10:00:00.000Z',
        '2026-08-14T10:25:00.000Z',
        1500,
        'focus',
      );
      await runSyncedMutation({
        db: first as never,
        record: {
          entity: 'todos',
          id: 'todo_restart_flush',
          updatedAt: '2026-08-14T10:30:00.000Z',
          operation: 'create',
        },
        mutate: async (transactionDb) => {
          await insertTodo(transactionDb as never, 'todo_restart_flush', 'Restart flush todo', 1);
          return { changed: true, value: undefined };
        },
      });
      await first.closeAsync();

      const restarted = await freshDatabase(file);
      const { inspectLocalAccountDataState } = await import('@/core/auth/account.data');
      const { SqliteSyncPersistence } = await import('@/core/sync/syncPersistence');
      const { SyncEngine } = await import('@/core/sync/sync.engine');

      const inspected = await inspectLocalAccountDataState(restarted as never);
      expect(inspected.ownerBinding).toBe('anon_a');
      expect(inspected.ownerBindingProvisional).toBe(false);
      expect(inspected.hasUserData).toBe(true);
      expect(inspected.outboxOwnerIds).toEqual(['anon_a']);
      expect(inspected.pendingOutboxCount).toBe(1);

      // Owner A returns; flush pushes only owner-A records.
      const pushed = vi.fn(async (records: { ownerUserId?: string | null }[]) => {
        expect(records.every((record) => record.ownerUserId === 'anon_a')).toBe(true);
      });
      const engine = new SyncEngine(
        { push: pushed, pull: async () => [] },
        new SqliteSyncPersistence(),
      );
      await engine.hydrate();
      await engine.flush();
      expect(pushed).toHaveBeenCalledTimes(1);
      await expect(
        restarted.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM sync_outbox'),
      ).resolves.toEqual({ count: 0 });
      await restarted.closeAsync();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('never writes an ownerless outbox row on a configured fresh anonymous install', async () => {
    const db = await freshDatabase();
    const { bindProvisionalLocalDatasetOwner } = await import('@/core/auth/account.data');
    const { runSyncedMutation } = await import('@/core/sync/syncedMutation');
    const { upsertSyncOutboxRecord } = await import('@/core/sync/syncPersistence');
    const { inspectLocalAccountDataState } = await import('@/core/auth/account.data');

    await bindProvisionalLocalDatasetOwner(db as never, 'anon_a');
    await runSyncedMutation({
      db: db as never,
      record: {
        entity: 'habits',
        id: 'habit_first',
        updatedAt: '2026-08-14T10:00:00.000Z',
        operation: 'create',
      },
      mutate: async (transactionDb) => {
        await transactionDb.runAsync(
          `INSERT INTO habits
             (id, name, color, icon, target_per_day, category, created_at, updated_at, deleted_at)
           VALUES (?, ?, 'red', 'star', 1, 'anytime', ?, ?, NULL)`,
          ['habit_first', 'First habit', '2026-08-14T10:00:00.000Z', '2026-08-14T10:00:00.000Z'],
        );
        return { changed: true, value: undefined };
      },
    });

    const ownerless = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM sync_outbox
       WHERE owner_user_id IS NULL OR owner_user_id = ''`,
    );
    expect(Number(ownerless?.count ?? 0)).toBe(0);

    const inspected = await inspectLocalAccountDataState(db as never);
    expect(inspected.outboxOwnerIds).toEqual(['anon_a']);
    expect(inspected.unownedOutboxCount).toBe(0);

    // The outbox write path refuses to rebind an existing pending intent to a
    // different owner — the low-level guard behind the fresh-install invariant.
    await expect(
      upsertSyncOutboxRecord(
        db as never,
        {
          entity: 'habits',
          id: 'habit_first',
          updatedAt: '2026-08-14T11:00:00.000Z',
          operation: 'update',
          ownerUserId: 'user_b',
        },
        100,
      ),
    ).rejects.toThrow(/owner/i);
    const unchanged = await db.getFirstAsync<{ owner_user_id: string | null }>(
      'SELECT owner_user_id FROM sync_outbox WHERE id = ?',
      ['habit_first'],
    );
    expect(unchanged?.owner_user_id).toBe('anon_a');
  });
});
