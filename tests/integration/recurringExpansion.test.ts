import { expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';

/**
 * The recurring expansion path is intentionally exercised at its data-layer
 * insertion boundary: two callers can arrive with the same series/day before
 * the screen's snapshot refreshes. The row and sync queue must remain one-to-one.
 */
it('materializes one recurring instance and one outbox record per series/day', async () => {
  const db = await freshDatabase();
  const todos = await import('@/features/todos/todos.data');
  const { syncEngine } = await import('@/core/sync/sync.engine');

  await Promise.all(
    Array.from({ length: 3 }, () =>
      todos.createRecurringInstance({
        title: 'Daily review',
        notes: null,
        priority: 'normal',
        recurrenceId: 'rec_daily_review',
        dueDate: '2026-07-01',
      }),
    ),
  );

  const rows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM todos WHERE recurrence_id = ? AND due_date = ? AND deleted_at IS NULL',
    ['rec_daily_review', '2026-07-01'],
  );
  expect(rows).toHaveLength(1);
  expect(syncEngine.getPendingCount()).toBe(1);

  await db.closeAsync();
});
