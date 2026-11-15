import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

describe('planning writes match their persisted outcome', () => {
  let db: TestDatabase;
  beforeEach(async () => {
    db = await freshDatabase();
  });
  afterEach(async () => {
    await db.closeAsync();
  });

  it.each(['create', 'update'] as const)(
    'keeps normalized priority IDs and title snapshots aligned on %s',
    async (mode) => {
      const { addTodo } = await import('@/features/todos/todos.data');
      const plans = await import('@/features/daily-plan/dailyPlan.data');
      const ids: string[] = [];
      for (const title of ['Alpha', 'Beta', 'Gamma', 'Delta']) ids.push(await addTodo({ title }));
      if (mode === 'update')
        await plans.upsertDailyPlan('2026-11-16', { intention: 'existing plan' });
      const plan = await plans.upsertDailyPlan('2026-11-16', {
        topTodoIds: [ids[0], ids[0], ...ids.slice(1)],
      });
      expect(JSON.parse(plan.top_todo_ids)).toEqual(ids.slice(0, 3));
      expect(JSON.parse(plan.top_todo_titles!)).toEqual(['Alpha', 'Beta', 'Gamma']);
      const { resolveTopTodoTitles } = await import('@/features/daily-plan/dailyPlan.domain');
      expect(
        resolveTopTodoTitles({
          selectedIds: ids.slice(0, 3),
          savedIds: JSON.parse(plan.top_todo_ids),
          savedTitles: JSON.parse(plan.top_todo_titles!),
          liveTitleFor: () => undefined,
        }),
      ).toEqual(['Alpha', 'Beta', 'Gamma']);
    },
  );

  it('reports missing/deleted suggestions as failures, without creating an empty plan or backup intent', async () => {
    const { addTodo, removeTodo } = await import('@/features/todos/todos.data');
    const deleted = await addTodo({ title: 'Deleted after review preview' });
    await removeTodo(deleted);
    const before = await db.getAllAsync('SELECT * FROM sync_outbox ORDER BY entity, id');
    const { applyNextWeekPlanSuggestions } =
      await import('@/features/weekly-review/weeklyReview.data');
    const result = await applyNextWeekPlanSuggestions([
      { dateKey: '2026-11-16', todoIds: ['todo_missing', deleted] },
    ]);
    expect(result.addedCount).toBe(0);
    expect(result.appliedDateKeys).toEqual([]);
    expect(result.failed).toEqual([
      { dateKey: '2026-11-16', todoId: 'todo_missing', error: 'Task is no longer available.' },
      { dateKey: '2026-11-16', todoId: deleted, error: 'Task is no longer available.' },
    ]);
    expect(await db.getAllAsync('SELECT * FROM daily_plans')).toEqual([]);
    expect(await db.getAllAsync('SELECT * FROM sync_outbox ORDER BY entity, id')).toEqual(before);
  });

  it('counts only the live, deduplicated suggestions actually persisted', async () => {
    const { addTodo, removeTodo } = await import('@/features/todos/todos.data');
    const live = await addTodo({ title: 'Keep me' });
    const deleted = await addTodo({ title: 'Gone' });
    await removeTodo(deleted);
    const { applyNextWeekPlanSuggestions } =
      await import('@/features/weekly-review/weeklyReview.data');
    const result = await applyNextWeekPlanSuggestions([
      { dateKey: '2026-11-16', todoIds: ['todo_missing', live, deleted, live] },
    ]);
    expect(result.addedCount).toBe(1);
    expect(result.appliedDateKeys).toEqual(['2026-11-16']);
    expect(result.failed.map((entry) => entry.todoId)).toEqual(['todo_missing', deleted]);
    expect(result.skipped).toEqual([
      { dateKey: '2026-11-16', todoId: live, reason: 'already_selected' },
    ]);
    const { getDailyPlan } = await import('@/features/daily-plan/dailyPlan.data');
    expect(JSON.parse((await getDailyPlan('2026-11-16'))!.top_todo_ids)).toEqual([live]);
  });
});
