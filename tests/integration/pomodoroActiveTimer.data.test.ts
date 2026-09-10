import { afterEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Durable active-timer intent and session dedupe against real SQLite. The
 * intent is local operational state (app_meta, deliberately outside the backup
 * allowlist); these functions were previously covered only through mocked DBs.
 */
describe('pomodoro active timer (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('persists, normalizes, and clears the durable timer intent', async () => {
    db = await freshDatabase();
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');

    expect(await pomodoro.getPomodoroActiveTimer()).toBeNull();

    await pomodoro.savePomodoroActiveTimer({
      mode: 'focus',
      startedAtIso: '2026-09-10T01:00:00.000Z',
      totalSeconds: 1500,
      completedFocus: 0,
      notificationId: 'notif-1',
      pausedRemainingSeconds: null,
    });
    const stored = await pomodoro.getPomodoroActiveTimer();
    expect(stored).toEqual({
      mode: 'focus',
      startedAtIso: '2026-09-10T01:00:00.000Z',
      totalSeconds: 1500,
      completedFocus: 0,
      notificationId: 'notif-1',
      pausedRemainingSeconds: null,
    });

    // An invalid intent is rejected silently and the stored one survives.
    await pomodoro.savePomodoroActiveTimer({ nonsense: true } as never);
    expect((await pomodoro.getPomodoroActiveTimer())?.totalSeconds).toBe(1500);

    await pomodoro.clearPomodoroActiveTimer();
    expect(await pomodoro.getPomodoroActiveTimer()).toBeNull();
  });

  it('detects an already-logged session by its exact started_at value', async () => {
    db = await freshDatabase();
    const pomodoro = await import('@/features/pomodoro/pomodoro.data');

    expect(await pomodoro.hasPomodoroSessionStartedAt('2026-09-10T01:00:00.000Z')).toBe(false);

    await pomodoro.recordCompletedPomodoroSession({
      id: 'pom_timer_1',
      startedAtIso: '2026-09-10T01:00:00.000Z',
      endedAtIso: '2026-09-10T01:25:00.000Z',
      durationSeconds: 1500,
      type: 'focus',
    });

    expect(await pomodoro.hasPomodoroSessionStartedAt('2026-09-10T01:00:00.000Z')).toBe(true);
    expect(await pomodoro.hasPomodoroSessionStartedAt('2026-09-10T02:00:00.000Z')).toBe(false);
  });
});
