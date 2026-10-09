import { afterEach, describe, expect, it, vi } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';
import {
  planTimerStartup,
  runTimerStartup,
  type SessionClaims,
  type TimerStartupEffects,
} from '@/features/pomodoro/pomodoro.startup';
import { DEFAULT_SETTINGS } from '@/features/pomodoro/pomodoro.domain';

/**
 * Durable-intent coherence for a raced or failed timer startup, against real
 * SQLite. The unit lane (`tests/pomodoro.startup.test.ts`) proves the guard and
 * the sequence in memory; this lane proves that what the sequence ends up
 * persisting is exactly the session that ran — and that a rejected startup
 * leaves nothing behind to reconcile.
 */
describe('pomodoro startup durable intent (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('persists an intent that matches the session the startup actually started', async () => {
    db = await freshDatabase();
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');
    const startedAt = new Date('2026-10-09T10:00:00.000Z');

    const plan = planTimerStartup(
      {},
      { mode: 'focus', settings: DEFAULT_SETTINGS, completedFocus: 2 },
      startedAt,
    );

    const outcome = await runTimerStartup(
      plan,
      {
        scheduleTimerEndNotification: async () => 'notif_started',
        platform: 'native',
        cancelScheduledNotification: async () => undefined,
      },
      {
        cancelPreviousNotification: () => undefined,
        commit: async ({ notificationId }) => {
          // Exactly what the screen persists on a successful commit.
          await pomodoro.savePomodoroActiveTimer({ ...plan.intent, notificationId });
        },
        reportScheduleWarning: () => undefined,
        recover: async () => undefined,
      },
    );

    expect(outcome.outcome).toBe('started');
    expect(await pomodoro.getPomodoroActiveTimer()).toEqual({
      mode: 'focus',
      startedAtIso: startedAt.toISOString(),
      totalSeconds: DEFAULT_SETTINGS.focusMinutes * 60,
      completedFocus: 2,
      notificationId: 'notif_started',
      pausedRemainingSeconds: null,
    });
  });

  it('writes no intent and clears any stale one when scheduling rejects', async () => {
    db = await freshDatabase();
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');
    const startedAt = new Date('2026-10-09T11:00:00.000Z');

    const plan = planTimerStartup(
      {},
      { mode: 'focus', settings: DEFAULT_SETTINGS, completedFocus: 0 },
      startedAt,
    );

    // A session that was already intended, whose restart then failed.
    await pomodoro.savePomodoroActiveTimer({
      ...plan.intent,
      notificationId: 'notif_stale',
    });

    const cancelled: (string | null)[] = [];
    const cleared = vi.fn(async () => pomodoro.clearPomodoroActiveTimer());

    const outcome = await runTimerStartup(
      plan,
      {
        scheduleTimerEndNotification: async () => {
          throw new Error('permission prompt dismissed');
        },
        platform: 'native',
        cancelScheduledNotification: async (id) => {
          cancelled.push(id);
        },
      },
      {
        cancelPreviousNotification: () => undefined,
        commit: async () => undefined,
        reportScheduleWarning: () => undefined,
        recover: async () => cleared(),
      },
    );

    expect(outcome).toEqual({
      outcome: 'failed',
      message: 'permission prompt dismissed',
    });
    expect(cleared).toHaveBeenCalledTimes(1);
    // No phantom intent survives, so the next launch cannot reconcile a
    // session that never ran.
    expect(await pomodoro.getPomodoroActiveTimer()).toBeNull();
  });

  it('persists a permission-denied start with a null notification id', async () => {
    db = await freshDatabase();
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');
    const startedAt = new Date('2026-10-09T12:00:00.000Z');
    const plan = planTimerStartup(
      { requestedDurationMinutes: 45 },
      { mode: 'short_break', settings: DEFAULT_SETTINGS, completedFocus: 1 },
      startedAt,
    );

    const outcome = await runTimerStartup(
      plan,
      {
        scheduleTimerEndNotification: async () => null,
        platform: 'native',
        cancelScheduledNotification: async () => undefined,
      },
      {
        cancelPreviousNotification: () => undefined,
        commit: async ({ notificationId }) => {
          await pomodoro.savePomodoroActiveTimer({ ...plan.intent, notificationId });
        },
        reportScheduleWarning: () => undefined,
        recover: async () => undefined,
      },
    );

    expect(outcome.outcome).toBe('started');
    expect(await pomodoro.getPomodoroActiveTimer()).toEqual({
      mode: 'focus',
      startedAtIso: startedAt.toISOString(),
      totalSeconds: 45 * 60,
      completedFocus: 1,
      notificationId: null,
      pausedRemainingSeconds: null,
    });
  });

  it('leaves a failed startup startable and the intent clear afterwards', async () => {
    db = await freshDatabase();
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');

    const run = async (
      fail: boolean,
      claims: SessionClaims,
      commit: TimerStartupEffects['commit'],
    ) => {
      const startedAt = new Date();
      const plan = planTimerStartup(
        {},
        { mode: 'focus', settings: DEFAULT_SETTINGS, completedFocus: 0 },
        startedAt,
      );
      // The guard the screen applies before it even builds a plan.
      if (claims.starting || claims.active) return { outcome: 'conflict' as const };
      return runTimerStartup(
        plan,
        {
          scheduleTimerEndNotification: async () => {
            if (fail) throw new Error('native scheduling unavailable');
            return 'notif_ok';
          },
          platform: 'native',
          cancelScheduledNotification: async () => undefined,
        },
        {
          cancelPreviousNotification: () => undefined,
          commit,
          reportScheduleWarning: () => undefined,
          recover: async () => {
            await pomodoro.clearPomodoroActiveTimer();
          },
        },
      );
    };

    const failed = await run(true, { starting: false, active: false }, async () => undefined);
    expect(failed.outcome).toBe('failed');
    expect(await pomodoro.getPomodoroActiveTimer()).toBeNull();

    // A press racing the failed startup must conflict, not start a second one.
    const racing = await run(false, { starting: true, active: false }, async () => undefined);
    expect(racing.outcome).toBe('conflict');
    expect(await pomodoro.getPomodoroActiveTimer()).toBeNull();

    const retried = await run(
      false,
      { starting: false, active: false },
      async ({ plan: p, notificationId }) => {
        await pomodoro.savePomodoroActiveTimer({ ...p.intent, notificationId });
      },
    );
    expect(retried.outcome).toBe('started');
    expect(await pomodoro.getPomodoroActiveTimer()).not.toBeNull();
  });
});
