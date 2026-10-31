import { beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * One completed focus session must be logged exactly once even when both
 * mount-time recovery paths hold a copy of it:
 *
 *  - crash reconciliation (`complete-unlogged`) recovers the durable intent,
 *  - the pending-log retry queue recovers a failed completion insert.
 *
 * A real failure leaves BOTH durable records behind: the completion insert
 * failed (so `enqueuePendingPomodoroLog` queued the session) and the
 * fire-and-forget `clearPomodoroActiveTimer` failed with it (so the intent
 * survived). Each recovery path inserts under its own row id, so without
 * session-identity (`started_at`) dedupe the retry replays the row the
 * reconciliation already logged — double focus minutes in stats/heatmap and
 * double focus XP (the reward ledger keys per row id).
 */
describe('pomodoro completion recovery dedupe', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await freshDatabase();
  });

  const startedAtIso = '2026-10-29T15:50:00.000Z'; // 23:50 Asia/Manila, before midnight
  const totalSeconds = 25 * 60;
  const endedAtIso = new Date(new Date(startedAtIso).getTime() + totalSeconds * 1000).toISOString();

  async function seedFailedCompletionState() {
    const { savePomodoroActiveTimer, enqueuePendingPomodoroLog } =
      await import('@/features/pomodoro/pomodoro.data');
    await savePomodoroActiveTimer({
      startedAtIso,
      mode: 'focus',
      totalSeconds,
      completedFocus: 2,
      notificationId: null,
      runningDeadlineIso: endedAtIso,
      pausedRemainingSeconds: null,
    });
    await enqueuePendingPomodoroLog({
      startedAtIso,
      endedAtIso,
      durationSeconds: totalSeconds,
      type: 'focus',
    });
  }

  async function recoverViaReconciliation() {
    const {
      getPomodoroActiveTimer,
      hasPomodoroSessionStartedAt,
      recordCompletedPomodoroSession,
      clearPomodoroActiveTimer,
    } = await import('@/features/pomodoro/pomodoro.data');
    const { planActiveTimerReconcile, resolveRunningDeadlineMs } =
      await import('@/features/pomodoro/pomodoro.domain');
    const intent = await getPomodoroActiveTimer();
    expect(intent).not.toBeNull();
    const plan = planActiveTimerReconcile(
      intent!,
      await hasPomodoroSessionStartedAt(intent!.startedAtIso),
      Date.now(),
    );
    // Mirror the screen: only `complete-unlogged` inserts a row.
    if (plan.kind === 'complete-unlogged') {
      await recordCompletedPomodoroSession({
        startedAtIso: intent!.startedAtIso,
        endedAtIso: new Date(resolveRunningDeadlineMs(intent!)).toISOString(),
        durationSeconds: intent!.totalSeconds,
        type: 'focus',
      });
    }
    await clearPomodoroActiveTimer();
    return plan.kind;
  }

  async function recoverViaPendingRetry() {
    const { retryPendingPomodoroLogs } = await import('@/features/pomodoro/pomodoro.data');
    return retryPendingPomodoroLogs();
  }

  it('logs one row when reconciliation recovers the session before the pending retry runs', async () => {
    await seedFailedCompletionState();
    await recoverViaReconciliation();
    await recoverViaPendingRetry();

    const rows = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM pomodoro_sessions WHERE started_at = ?',
      [startedAtIso],
    );
    expect(rows).toHaveLength(1);
  });

  it('logs one row when the pending retry runs before reconciliation', async () => {
    await seedFailedCompletionState();
    await recoverViaPendingRetry();
    const planKind = await recoverViaReconciliation();
    // The surviving intent must reconcile as already-logged, not re-log it.
    expect(planKind).toBe('already-logged');

    const rows = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM pomodoro_sessions WHERE started_at = ?',
      [startedAtIso],
    );
    expect(rows).toHaveLength(1);
    // The surviving intent must reconcile as already-logged, not re-log it.
    const all = await db.getAllAsync<{ id: string }>('SELECT id FROM pomodoro_sessions');
    expect(all).toHaveLength(1);
  });

  it('still logs a genuine pending retry when no row exists yet', async () => {
    const { enqueuePendingPomodoroLog, listPomodoroSessions } =
      await import('@/features/pomodoro/pomodoro.data');
    await enqueuePendingPomodoroLog({
      startedAtIso,
      endedAtIso,
      durationSeconds: totalSeconds,
      type: 'focus',
    });

    const result = await recoverViaPendingRetry();
    expect(result.succeeded).toBe(1);

    const rows = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM pomodoro_sessions WHERE started_at = ?',
      [startedAtIso],
    );
    expect(rows).toHaveLength(1);
    expect(await listPomodoroSessions()).toHaveLength(1);
  });
});
