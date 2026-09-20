import { beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';
import type { TestDatabase } from './helpers/db';

/**
 * Non-workout id-less award alignment.
 *
 * Regression cover for the "award oldest unrewarded" trap beyond workouts:
 * the fast path (`awardGamificationAction` without an explicit entityId) must
 * NOT silently credit the oldest unrewarded todo, focus session, daily plan,
 * or weekly review. A missed fast-path report degrades to reconcile backfill,
 * which always passes explicit ids. All live callers already pass exact ids
 * (TodosScreen passes `todo.id`, PomodoroScreen passes the completed session
 * id, command complete-todo returns the todo id); plan/review are
 * reconcile-only today, so the guard hardens a latent fallback.
 */

let db: TestDatabase;

beforeEach(async () => {
  db = await freshDatabase();
});

/**
 * Feature data layers must be imported AFTER `freshDatabase()` resets the
 * module registry — a static import would bind the previous test's database.
 */
async function loadModules() {
  const todos = await import('@/features/todos/todos.data');
  const pomodoro = await import('@/features/pomodoro/pomodoro.data');
  const dailyPlan = await import('@/features/daily-plan/dailyPlan.data');
  const weeklyReview = await import('@/features/weekly-review/weeklyReview.data');
  const gamification = await import('@/features/gamification/gamification.data');
  const time = await import('@/lib/time');
  return { todos, pomodoro, dailyPlan, weeklyReview, gamification, time };
}

async function countKindEvents(kind: string): Promise<number> {
  const row = await db.getFirstAsync<{ value: number }>(
    `SELECT COUNT(*) AS value FROM gamification_events WHERE event_kind = ?`,
    [kind],
  );
  return row?.value ?? 0;
}

async function completeTwoTodos(): Promise<{ firstId: string; secondId: string }> {
  const { todos } = await loadModules();
  await todos.addTodo({ title: 'Idless first todo' });
  await todos.addTodo({ title: 'Idless second todo' });
  const listed = await todos.listTodos();
  const first = listed.find((todo) => todo.title === 'Idless first todo');
  const second = listed.find((todo) => todo.title === 'Idless second todo');
  expect(first).toBeDefined();
  expect(second).toBeDefined();
  // Fresh todos are incomplete, so one toggle completes each of them.
  await todos.toggleTodo(first!);
  await todos.toggleTodo(second!);
  return { firstId: first!.id, secondId: second!.id };
}

async function logTwoFocusSessions(): Promise<{ oldestId: string; newestId: string }> {
  const { pomodoro, time } = await loadModules();
  const today = time.toDateKey();
  const oldestId = await pomodoro.logPomodoroSession(
    new Date(`${today}T09:00:00`).toISOString(),
    new Date(`${today}T09:25:00`).toISOString(),
    1500,
    'focus',
  );
  const newestId = await pomodoro.logPomodoroSession(
    new Date(`${today}T10:00:00`).toISOString(),
    new Date(`${today}T10:25:00`).toISOString(),
    1500,
    'focus',
  );
  expect(oldestId).not.toBe(newestId);
  return { oldestId, newestId };
}

describe('non-workout id-less award alignment', () => {
  it('a todo award without entityId is a miss; reconcile backfills both with exact ids', async () => {
    const { gamification, time } = await loadModules();
    const today = time.toDateKey();
    const { firstId, secondId } = await completeTwoTodos();

    // Two unrewarded todos: the old behavior awarded the FIRST (oldest) one.
    expect(await gamification.awardGamificationAction({ kind: 'todo' })).toBeNull();
    expect(await countKindEvents('todo')).toBe(0);

    const reconciled = await gamification.reconcileGamificationActivity({ todayKey: today });
    expect(reconciled.awarded).toBe(2);
    expect(await countKindEvents('todo')).toBe(2);
    const keys = await db.getAllAsync<{ source_key: string }>(
      `SELECT source_key FROM gamification_events WHERE event_kind = 'todo'`,
    );
    expect(keys.map((row) => row.source_key).sort()).toEqual([firstId, secondId].sort());
  });

  it('awarding the newest todo leaves the oldest for reconcile (no cross-attribution)', async () => {
    const { gamification, time } = await loadModules();
    const today = time.toDateKey();
    const { firstId, secondId } = await completeTwoTodos();

    const outcome = await gamification.awardGamificationAction({
      kind: 'todo',
      entityId: secondId,
    });
    expect(outcome?.result.events[0]).toMatchObject({ kind: 'todo', sourceKey: secondId });

    const reconciled = await gamification.reconcileGamificationActivity({ todayKey: today });
    expect(reconciled.awarded).toBe(1);
    const keys = await db.getAllAsync<{ source_key: string }>(
      `SELECT source_key FROM gamification_events WHERE event_kind = 'todo'`,
    );
    expect(keys.map((row) => row.source_key).sort()).toEqual([firstId, secondId].sort());
  });

  it('a focus award without entityId is a miss; the exact session id awards precisely', async () => {
    const { gamification, time } = await loadModules();
    const today = time.toDateKey();
    const { oldestId, newestId } = await logTwoFocusSessions();

    expect(await gamification.awardGamificationAction({ kind: 'focus' })).toBeNull();
    expect(await countKindEvents('focus')).toBe(0);

    const outcome = await gamification.awardGamificationAction({
      kind: 'focus',
      entityId: newestId,
    });
    expect(outcome?.result.events[0]).toMatchObject({ kind: 'focus', sourceKey: newestId });

    // The oldest session is still unrewarded and reconcile credits exactly it.
    const reconciled = await gamification.reconcileGamificationActivity({ todayKey: today });
    expect(reconciled.awarded).toBe(1);
    const keys = await db.getAllAsync<{ source_key: string }>(
      `SELECT source_key FROM gamification_events WHERE event_kind = 'focus'`,
    );
    expect(keys.map((row) => row.source_key).sort()).toEqual([oldestId, newestId].sort());
  });

  it('a plan award without entityId is a miss; the committed plan id awards exactly once', async () => {
    const { dailyPlan, gamification, time } = await loadModules();
    const today = time.toDateKey();

    const plan = await dailyPlan.commitDailyPlan(today);
    expect(plan.id).toMatch(/^dplan_/);

    expect(await gamification.awardGamificationAction({ kind: 'plan' })).toBeNull();
    expect(await countKindEvents('plan')).toBe(0);

    const outcome = await gamification.awardGamificationAction({
      kind: 'plan',
      entityId: plan.id,
    });
    expect(outcome?.result.events[0]).toMatchObject({ kind: 'plan', sourceKey: plan.id });

    // Re-awarding the same plan is a no-op and reconcile stays quiet.
    expect(
      await gamification.awardGamificationAction({ kind: 'plan', entityId: plan.id }),
    ).toBeNull();
    const reconciled = await gamification.reconcileGamificationActivity({ todayKey: today });
    expect(reconciled.awarded).toBe(0);
    expect(await countKindEvents('plan')).toBe(1);
  });

  it('a review award without entityId is a miss; the completed review id awards exactly once', async () => {
    const { weeklyReview, gamification, time } = await loadModules();
    const today = time.toDateKey();

    const reviewId = await weeklyReview.saveWeeklyReview({
      weekKey: '2026-09-14',
      weekStartDate: '2026-09-14',
      weekEndDate: '2026-09-20',
      nextWeekStartDate: '2026-09-21',
      summaryPayload: '{}',
      planPayload: '{"priorities":[]}',
      reflection: 'id-less alignment',
    });
    expect(reviewId).toMatch(/^wrev_/);

    expect(await gamification.awardGamificationAction({ kind: 'review' })).toBeNull();
    expect(await countKindEvents('review')).toBe(0);

    const outcome = await gamification.awardGamificationAction({
      kind: 'review',
      entityId: reviewId,
    });
    expect(outcome?.result.events[0]).toMatchObject({ kind: 'review', sourceKey: reviewId });

    expect(
      await gamification.awardGamificationAction({ kind: 'review', entityId: reviewId }),
    ).toBeNull();
    const reconciled = await gamification.reconcileGamificationActivity({ todayKey: today });
    expect(reconciled.awarded).toBe(0);
    expect(await countKindEvents('review')).toBe(1);
  });
});
