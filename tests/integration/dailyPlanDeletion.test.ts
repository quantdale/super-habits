import { afterEach, describe, expect, it } from 'vitest';
import { toDateKey } from '@/lib/time';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * Daily-plan deletion contract against real SQLite: the soft delete removes
 * the plan from history and adherence, carries exactly one coalesced durable
 * delete intent, and never touches the referenced todos.
 */
describe('daily plan deletion (real SQLite)', () => {
  let db: TestDatabase;

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('soft-deletes the plan, removes it from history/adherence, and leaves todos untouched', async () => {
    db = await freshDatabase();
    const plans = await import('@/features/daily-plan/dailyPlan.data');
    const todos = await import('@/features/todos/todos.data');

    const todayKey = toDateKey();
    const todoId = await todos.addTodo({ title: 'Priority task' });
    await plans.upsertDailyPlan(todayKey, {
      intention: 'Ship the fix',
      topTodoIds: [todoId],
    });
    await plans.commitDailyPlan(todayKey);

    const plan = await plans.getDailyPlan(todayKey);
    expect(plan).not.toBeNull();

    const before = await plans.getDailyPlanAdherence();
    expect(before.committedStreak).toBeGreaterThanOrEqual(1);

    await plans.softDeleteDailyPlan(plan!.id);

    expect(await plans.getDailyPlan(todayKey)).toBeNull();
    expect(await plans.listRecentDailyPlans(30)).toHaveLength(0);
    const after = await plans.getDailyPlanAdherence();
    expect(after.committedStreak).toBe(0);

    const intents = await db.getAllAsync<{ operation: string }>(
      `SELECT operation FROM sync_outbox WHERE entity = 'daily_plans' AND id = ?`,
      [plan!.id],
    );
    expect(intents.map((row) => row.operation)).toEqual(['delete']);

    const todo = await db.getFirstAsync<{ deleted_at: string | null; title: string }>(
      'SELECT deleted_at, title FROM todos WHERE id = ?',
      [todoId],
    );
    expect(todo).toEqual({ deleted_at: null, title: 'Priority task' });
  });

  it('is a no-op for an already-deleted plan (no second intent)', async () => {
    db = await freshDatabase();
    const plans = await import('@/features/daily-plan/dailyPlan.data');

    const dateKey = toDateKey();
    await plans.upsertDailyPlan(dateKey, { intention: 'one-off' });
    const plan = await plans.getDailyPlan(dateKey);

    await plans.softDeleteDailyPlan(plan!.id);
    await plans.softDeleteDailyPlan(plan!.id);

    const intents = await db.getAllAsync<{ operation: string }>(
      `SELECT operation FROM sync_outbox WHERE entity = 'daily_plans' AND id = ?`,
      [plan!.id],
    );
    expect(intents.map((row) => row.operation)).toEqual(['delete']);
  });
});
