import { afterEach, describe, expect, it } from 'vitest';
import { toDateKey } from '@/lib/time';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Planning detail/history queries against real SQLite. These reads back the
 * planning surfaces (plan history, goal/project detail rollups, weekly-review
 * lookup); the previous campaign proved the create/rollup paths but left these
 * query functions exercised only through mocked databases or not at all.
 */

function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day + days, 12, 0, 0);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

describe('planning detail queries (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('daily-plan history windows are inclusive, ordered, and tombstone-aware', async () => {
    db = await freshDatabase();
    const plans = await import('@/features/daily-plan/dailyPlan.data');

    const todayKey = toDateKey();
    const recentKey = shiftDateKey(todayKey, -3);
    const oldKey = shiftDateKey(todayKey, -40);
    await plans.upsertDailyPlan(todayKey, { intention: 'today' });
    await plans.upsertDailyPlan(recentKey, { intention: 'recent' });
    await plans.upsertDailyPlan(oldKey, { intention: 'old' });

    const last30 = await plans.listRecentDailyPlans(30);
    expect(last30.map((plan) => plan.date_key)).toEqual([todayKey, recentKey]);

    const range = await plans.listDailyPlansInRange(recentKey, todayKey);
    expect(range.map((plan) => plan.date_key)).toEqual([todayKey, recentKey]);
    expect(await plans.listDailyPlansInRange(oldKey, oldKey)).toHaveLength(1);

    await plans.softDeleteDailyPlan(last30[0].id);
    expect((await plans.listRecentDailyPlans(30)).map((plan) => plan.date_key)).toEqual([
      recentKey,
    ]);
  });

  it('setGoalProgress clamps to 0..100 and enqueues the coalesced update', async () => {
    db = await freshDatabase();
    const goals = await import('@/features/goals/goals.data');

    const goalId = await goals.addGoal({ title: 'Run a 5k' });
    await goals.setGoalProgress(goalId, 150);
    expect(
      await db.getFirstAsync<{ progress_percent: number }>(
        `SELECT progress_percent FROM goals WHERE id = ?`,
        [goalId],
      ),
    ).toEqual({ progress_percent: 100 });

    await goals.setGoalProgress(goalId, -5);
    expect(
      await db.getFirstAsync<{ progress_percent: number }>(
        `SELECT progress_percent FROM goals WHERE id = ?`,
        [goalId],
      ),
    ).toEqual({ progress_percent: 0 });

    const intents = await db.getAllAsync<{ operation: string }>(
      `SELECT operation FROM sync_outbox WHERE entity = 'goals' AND id = ?`,
      [goalId],
    );
    expect(intents.map((row) => row.operation)).toEqual(['update']);
  });

  it('listTodosForGoal returns only live linked todos, pending first', async () => {
    db = await freshDatabase();
    const goals = await import('@/features/goals/goals.data');
    const todos = await import('@/features/todos/todos.data');

    const goalId = await goals.addGoal({ title: 'Ship v1' });
    const openId = await todos.addTodo({ title: 'Open task', goalId });
    const doneId = await todos.addTodo({ title: 'Done task', goalId });
    await todos.completeTodo(doneId);
    await todos.addTodo({ title: 'Unrelated task' });
    const removedId = await todos.addTodo({ title: 'Removed task', goalId });
    await todos.removeTodo(removedId);

    const rows = await goals.listTodosForGoal(goalId);
    expect(rows.map((row) => [row.title, row.completed])).toEqual([
      ['Open task', 0],
      ['Done task', 1],
    ]);
    expect(rows.map((row) => row.id)).toEqual([openId, doneId]);
  });

  it('project detail reads resolve the project, its habits, and its goals only', async () => {
    db = await freshDatabase();
    const projects = await import('@/features/projects/projects.data');
    const habits = await import('@/features/habits/habits.data');
    const goals = await import('@/features/goals/goals.data');

    const projectId = await projects.addProject({ name: 'Home renovation' });
    const linkedHabitId = await habits.addHabit(
      'Stretch',
      1,
      'anytime',
      undefined,
      undefined,
      undefined,
      null,
      projectId,
    );
    await habits.addHabit('Unlinked habit', 1);
    await goals.addGoal({ title: 'Linked goal', projectId });
    await goals.addGoal({ title: 'Unlinked goal' });

    expect(await projects.getProject(projectId)).toMatchObject({
      id: projectId,
      name: 'Home renovation',
    });
    expect(await projects.getProject('proj_missing')).toBeNull();

    const habitRows = await projects.listHabitsForProject(projectId);
    expect(habitRows).toEqual([{ id: linkedHabitId, name: 'Stretch' }]);

    const goalRows = await projects.listGoalsForProject(projectId);
    expect(goalRows.map((row) => [row.title, row.status, row.progress_percent])).toEqual([
      ['Linked goal', 'active', 0],
    ]);
  });

  it('weekly review lookup round-trips and respects the tombstone', async () => {
    db = await freshDatabase();
    const weekly = await import('@/features/weekly-review/weeklyReview.data');

    const id = await weekly.saveWeeklyReview({
      weekKey: '2026-W36',
      weekStartDate: '2026-08-31',
      weekEndDate: '2026-09-06',
      nextWeekStartDate: '2026-09-07',
      summaryPayload: '{}',
      planPayload: '{}',
      reflection: 'Solid week',
    });

    const review = await weekly.getWeeklyReviewById(id);
    expect(review).toMatchObject({
      id,
      week_key: '2026-W36',
      reflection: 'Solid week',
      status: 'completed',
    });
    expect(await weekly.getWeeklyReviewById('wrev_missing')).toBeNull();

    await weekly.deleteWeeklyReview(id);
    expect(await weekly.getWeeklyReviewById(id)).toBeNull();
    expect(await weekly.listWeeklyReviews()).toHaveLength(0);
  });
});
