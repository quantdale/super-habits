import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';
import type { Todo } from '@/core/db/types';

describe('daily-plan carry-forward uses committing task state', () => {
  let db: TestDatabase;
  beforeEach(async () => {
    db = await freshDatabase();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await db.closeAsync();
  });

  it.each(['complete', 'reopen'] as const)(
    'observes a %s after the outer read but before the writer starts',
    async (operation) => {
      const todos = await import('@/features/todos/todos.data');
      const plans = await import('@/features/daily-plan/dailyPlan.data');
      const id = await todos.addTodo({ title: 'Priority with concurrent completion' });
      let todo = (await db.getFirstAsync<Todo>('SELECT * FROM todos WHERE id = ?', [id]))!;
      if (operation === 'reopen') {
        await todos.toggleTodo(todo);
        todo = (await db.getFirstAsync<Todo>('SELECT * FROM todos WHERE id = ?', [id]))!;
      }
      await plans.upsertDailyPlan('2026-11-13', { topTodoIds: [id] });
      const before = await db.getAllAsync(
        "SELECT * FROM sync_outbox WHERE entity = 'daily_plans' ORDER BY id",
      );
      const transactions = await import('@/core/db/transactions');
      const original = transactions.withSQLiteTransaction;
      vi.spyOn(transactions, 'withSQLiteTransaction').mockImplementationOnce(
        async (database, task) => {
          // The real canonical completion writer commits while carry-forward is
          // queued. Its old pending-task snapshot must not decide the later write.
          await todos.toggleTodo(todo);
          return original(database, task);
        },
      );
      const result = await plans.carryForwardFromPreviousDay('2026-11-14');
      if (operation === 'complete') {
        expect(result).toBeNull();
        expect(await plans.getDailyPlan('2026-11-14')).toBeNull();
        expect(
          await db.getAllAsync(
            "SELECT * FROM sync_outbox WHERE entity = 'daily_plans' ORDER BY id",
          ),
        ).toEqual(before);
      } else {
        expect(JSON.parse(result!.top_todo_ids)).toEqual([id]);
        expect(JSON.parse(result!.top_todo_titles!)).toEqual([
          'Priority with concurrent completion',
        ]);
        expect(JSON.parse((await plans.getDailyPlan('2026-11-14'))!.top_todo_ids)).toEqual([id]);
        const repeated = await plans.carryForwardFromPreviousDay('2026-11-14');
        expect(JSON.parse(repeated!.top_todo_ids)).toEqual([id]);
      }
    },
  );
});

describe('daily-plan carry-forward merges an explicit editor draft atomically', () => {
  let db: TestDatabase;
  beforeEach(async () => {
    db = await freshDatabase();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await db.closeAsync();
  });

  it.each(['addition', 'removal'] as const)(
    'honors a draft %s and is idempotent on retry',
    async (edit) => {
      const todos = await import('@/features/todos/todos.data');
      const plans = await import('@/features/daily-plan/dailyPlan.data');
      const carried = await todos.addTodo({ title: 'Carry this' });
      const kept = await todos.addTodo({ title: 'Keep this' });
      const removed = await todos.addTodo({ title: 'Remove this' });
      const added = await todos.addTodo({ title: 'New priority' });
      await plans.upsertDailyPlan('2026-11-01', { topTodoIds: [carried] });
      await plans.upsertDailyPlan('2026-11-02', {
        topTodoIds: edit === 'addition' ? [kept] : [kept, removed, added],
        intention: 'Preserve my intention',
      });
      const draftIds = [kept, added];
      const result = await plans.carryForwardFromPreviousDay('2026-11-02', draftIds);
      expect(JSON.parse(result!.top_todo_ids)).toEqual([kept, added, carried]);
      expect(JSON.parse(result!.top_todo_titles!)).toEqual([
        'Keep this',
        'New priority',
        'Carry this',
      ]);
      expect(result!.intention).toBe('Preserve my intention');
      const beforeRetry = await db.getAllAsync(
        "SELECT * FROM sync_outbox WHERE entity = 'daily_plans' ORDER BY id",
      );
      const repeated = await plans.carryForwardFromPreviousDay('2026-11-02', [
        kept,
        added,
        carried,
      ]);
      expect(repeated).toEqual(result);
      expect(
        await db.getAllAsync("SELECT * FROM sync_outbox WHERE entity = 'daily_plans' ORDER BY id"),
      ).toEqual(beforeRetry);
      expect(
        await db.getFirstAsync<{ count: number }>(
          "SELECT COUNT(*) AS count FROM daily_plans WHERE date_key = '2026-11-02' AND deleted_at IS NULL",
        ),
      ).toEqual({ count: 1 });
    },
  );
});
