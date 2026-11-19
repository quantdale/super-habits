import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

describe('weekly carry-forward rechecks unfinished eligibility', () => {
  let db: TestDatabase;
  beforeEach(async () => {
    db = await freshDatabase();
  });
  afterEach(async () => {
    await db.closeAsync();
  });

  it.each([false, true])(
    'rejects a completed candidate with other live candidates=%s',
    async (mixed) => {
      const todos = await import('@/features/todos/todos.data');
      const reviews = await import('@/features/weekly-review/weeklyReview.data');
      const plans = await import('@/features/daily-plan/dailyPlan.data');
      const stale = await todos.addTodo({ title: 'Finished while reviewing' });
      const live = await todos.addTodo({ title: 'Still unfinished' });
      // The review captured its candidates before this separate completion.
      const candidates = mixed ? [stale, live] : [stale];
      await todos.completeTodo(stale);
      const result = await reviews.applyNextWeekPlanSuggestions([
        { dateKey: '2026-11-23', todoIds: candidates },
      ]);
      expect(result.addedCount).toBe(mixed ? 1 : 0);
      expect(result.failed).toEqual([
        { dateKey: '2026-11-23', todoId: stale, error: 'Task is no longer available.' },
      ]);
      const plan = await plans.getDailyPlan('2026-11-23');
      if (mixed) {
        expect(JSON.parse(plan!.top_todo_ids)).toEqual([live]);
      } else {
        expect(plan).toBeNull();
        expect(
          await db.getAllAsync("SELECT * FROM sync_outbox WHERE entity = 'daily_plans'"),
        ).toEqual([]);
      }
      expect(await db.getFirstAsync('SELECT completed FROM todos WHERE id = ?', [stale])).toEqual({
        completed: 1,
      });
    },
  );
});
