import type * as SQLite from 'expo-sqlite';
import { expect, it, vi } from 'vitest';
import { freshDatabase } from './helpers/db';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => undefined) },
}));

it('does not schedule a restored completed todo when its backup predates completed_at', async () => {
  const db = await freshDatabase();
  try {
    const { applyRemoteTodos } = await import('@/features/todos/todos.data');
    const { setTodoRemindersEnabled } =
      await import('@/core/notifications/notificationPreferences');
    const { reconcileTodoReminders } = await import('@/core/notifications/todoReminderScheduler');
    const timestamp = '2026-08-11T00:00:00.000Z';
    await applyRemoteTodos(db as unknown as SQLite.SQLiteDatabase, [
      {
        id: 'todo_1',
        title: 'Pack the bag',
        notes: null,
        completed: 1,
        due_date: '2026-08-13',
        priority: 'normal',
        sort_order: 0,
        recurrence: null,
        recurrence_id: null,
        project_id: null,
        goal_id: null,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
      },
    ]);
    await setTodoRemindersEnabled(true);
    const schedule = vi.fn(async () => 'scheduled');
    const result = await reconcileTodoReminders({
      now: new Date(2026, 7, 12, 12),
      adapter: {
        getPermissionState: async () => 'granted',
        ensureChannel: async () => undefined,
        listScheduled: async () => [],
        schedule,
        cancel: async () => undefined,
      },
    });

    expect(result).toMatchObject({ status: 'reconciled', scheduled: 0 });
    expect(schedule).not.toHaveBeenCalled();
  } finally {
    await db.closeAsync();
  }
});
