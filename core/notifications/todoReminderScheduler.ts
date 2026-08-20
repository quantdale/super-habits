import { Platform } from 'react-native';
import {
  cancelTodoReminderNotification,
  scheduleTodoReminderNotification,
} from '@/lib/notifications';
import { TODO_REMINDER_DATA_KIND, TODO_REMINDER_DATA_VERSION } from '@/lib/notificationConstants';
import {
  computeTodoReminderFireAt,
  todoReminderIdentifier,
  TODO_REMINDER_DEFAULT_LEAD_MINUTES,
} from './reminderPlanning';
import { getTodoRemindersEnabled } from './notificationPreferences';

/**
 * Documented bridge API for todo due-date reminders.
 *
 * `features/todos` is owned by another worker, so this module never imports
 * it. Instead the todos data layer (or a host component in `app/_layout.tsx`)
 * calls these functions with plain todo snapshots:
 *
 * - After creating/updating a todo with a due date:
 *     `await syncTodoDueReminder({ id, title, dueDate, completedAt: null })`
 * - When completing a todo:      `await cancelTodoDueReminder(todoId)`
 * - When deleting a todo:        `await cancelTodoDueReminder(todoId)`
 *
 * All paths are native-only; on web every call degrades silently to a no-op.
 * Reminders respect the `superhabits.notifications.todo-reminders-enabled`
 * preference and never fire for past-due or already-completed todos.
 */

export type TodoReminderSnapshot = {
  id: string;
  title: string;
  /** Local due moment. ISO string or Date. */
  dueDate: string | Date;
  /** Non-null means the todo is complete — no reminder is scheduled. */
  completedAt?: string | null;
  /** Minutes before the due moment to fire; defaults to at-due-time. */
  leadMinutes?: number;
};

export type TodoReminderSyncResult =
  | { status: 'scheduled'; identifier: string; fireAt: Date }
  | { status: 'cancelled' }
  | { status: 'skipped'; reason: 'disabled' | 'web' | 'past-due' | 'completed' | 'missing-due' };

function toDate(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Single entry point for keeping one todo's reminder in sync with its data.
 * Idempotent: safe to call repeatedly with the same snapshot.
 */
export async function syncTodoDueReminder(
  todo: TodoReminderSnapshot,
): Promise<TodoReminderSyncResult> {
  if (Platform.OS === 'web') return { status: 'skipped', reason: 'web' };
  if (todo.completedAt) {
    await cancelTodoDueReminder(todo.id);
    return { status: 'cancelled' };
  }
  if (!todo.dueDate) return { status: 'skipped', reason: 'missing-due' };

  const enabled = await getTodoRemindersEnabled();
  if (!enabled) {
    // Preference off: make sure no stale reminder lingers from an earlier
    // enabled period.
    await cancelTodoDueReminder(todo.id);
    return { status: 'skipped', reason: 'disabled' };
  }

  const dueAt = toDate(todo.dueDate);
  if (!dueAt) return { status: 'skipped', reason: 'missing-due' };

  const fireAt = computeTodoReminderFireAt(
    dueAt,
    todo.leadMinutes ?? TODO_REMINDER_DEFAULT_LEAD_MINUTES,
  );
  if (!fireAt) {
    await cancelTodoDueReminder(todo.id);
    return { status: 'skipped', reason: 'past-due' };
  }

  const identifier = todoReminderIdentifier(todo.id);
  const scheduled = await scheduleTodoReminderNotification({
    identifier,
    title: todo.title.trim() || 'Todo reminder',
    body: 'This todo is due now.',
    data: {
      kind: TODO_REMINDER_DATA_KIND,
      version: TODO_REMINDER_DATA_VERSION,
      todoId: todo.id,
    },
    fireAt,
  });
  if (!scheduled) return { status: 'skipped', reason: 'web' };
  return { status: 'scheduled', identifier, fireAt };
}

/** Cancel-on-complete / cancel-on-delete support. Web-safe no-op. */
export async function cancelTodoDueReminder(todoId: string): Promise<void> {
  await cancelTodoReminderNotification(todoReminderIdentifier(todoId));
}
