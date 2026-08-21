import { Platform } from 'react-native';
import {
  cancelTodoReminderNotification,
  getNotificationPermissionState,
  listScheduledNotifications,
  scheduleTodoReminderNotification,
  ensureTodoReminderChannel,
  type NotificationPermissionState,
  type NotificationRequest,
} from '@/lib/notifications';
import { TODO_REMINDER_DATA_KIND, TODO_REMINDER_DATA_VERSION } from '@/lib/notificationConstants';
import {
  computeTodoReminderFireAt,
  getTodoReminderSnoozeIdentifier,
  todoReminderIdentifier,
  TODO_REMINDER_DEFAULT_LEAD_MINUTES,
} from './reminderPlanning';
import { getTodoRemindersEnabled } from './notificationPreferences';

/**
 * Documented bridge API for todo due-date reminders.
 *
 * `features/todos` is owned by another worker, so this module never statically
 * imports it. Instead the todos data layer (or a host component in
 * `app/_layout.tsx`) calls these functions with plain todo snapshots:
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
  | {
      status: 'skipped';
      reason: 'disabled' | 'web' | 'permission-denied' | 'past-due' | 'completed' | 'missing-due';
    };

/** Native seam for `reconcileTodoReminders`; injectable for tests. */
export type TodoReminderNativeAdapter = {
  getPermissionState: () => Promise<NotificationPermissionState>;
  ensureChannel: () => Promise<void>;
  listScheduled: () => Promise<NotificationRequest[]>;
  schedule: (item: {
    identifier: string;
    title: string;
    body: string;
    data: Record<string, unknown>;
    fireAt: Date;
  }) => Promise<string | null>;
  cancel: (identifier: string) => Promise<void>;
};

export type TodoReminderPlanItem = {
  identifier: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  fireAt: Date;
};

export type TodoReminderReconciliationResult = {
  status: 'reconciled' | 'permission_denied' | 'unsupported' | 'failed';
  scheduled: number;
  cancelled: number;
  error?: unknown;
};

export type ReconcileTodoRemindersInput = {
  now?: Date;
  adapter?: TodoReminderNativeAdapter;
  /** Supplies the todo inventory; defaults to all non-deleted todos. */
  loadTodos?: () => Promise<TodoReminderSnapshot[]>;
};

const defaultAdapter: TodoReminderNativeAdapter = {
  getPermissionState: getNotificationPermissionState,
  ensureChannel: ensureTodoReminderChannel,
  listScheduled: listScheduledNotifications,
  schedule: (item) =>
    scheduleTodoReminderNotification({
      identifier: item.identifier,
      title: item.title,
      body: item.body,
      data: item.data,
      fireAt: item.fireAt,
    }),
  cancel: cancelTodoReminderNotification,
};

async function defaultLoadTodos(): Promise<TodoReminderSnapshot[]> {
  // Dynamic import: the todos data layer calls back into this module, so a
  // static edge would create an initialization cycle.
  const { listTodos } = await import('@/features/todos/todos.data');
  const rows = await listTodos();
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    dueDate: row.due_date ?? '',
    completedAt: row.completed_at ?? null,
  }));
}

export function isTodoReminderIdentifier(identifier: string): boolean {
  return identifier.startsWith('todo-reminder:') || identifier.startsWith('todo-reminder-snooze:');
}

function getNotificationData(request: NotificationRequest): Record<string, unknown> | null {
  const data = request.content.data;
  return data && typeof data === 'object' ? data : null;
}

/**
 * Partition ONLY the todo-reminder namespace. Habit, daily-plan, pomodoro, and
 * any other app notifications are never considered — and therefore never
 * cancelled — by this module's diffs.
 */
function isTodoReminderRequest(request: NotificationRequest): boolean {
  const data = getNotificationData(request);
  return data?.kind === TODO_REMINDER_DATA_KIND || isTodoReminderIdentifier(request.identifier);
}

/** Body used by every todo due-date notification (base and snooze). */
export const TODO_REMINDER_BODY = 'This todo is due now.';

function getScheduledDateMs(request: NotificationRequest): number | null {
  const trigger = request.trigger;
  if (!trigger || typeof trigger !== 'object' || !('date' in trigger)) return null;
  const value: unknown = trigger.date;
  if (value instanceof Date) return value.getTime();
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * The notification payload for one occurrence. `occurrenceId` embeds the fire
 * time so each reschedule opens a fresh claim namespace for notification
 * actions; `dueAt` records the fire moment for tap-time validation. Snooze
 * replacements carry the BASE occurrence's `occurrenceId` with
 * `snoozed: true`.
 */
function buildReminderData(
  todoId: string,
  fireAt: Date,
  occurrenceId: string,
  snoozed: boolean,
): Record<string, unknown> {
  return {
    kind: TODO_REMINDER_DATA_KIND,
    version: TODO_REMINDER_DATA_VERSION,
    todoId,
    occurrenceId,
    dueAt: fireAt.toISOString(),
    snoozed,
  };
}

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
    body: TODO_REMINDER_BODY,
    data: buildReminderData(todo.id, fireAt, `${identifier}:${fireAt.getTime()}`, false),
    fireAt,
  });
  if (scheduled === 'web') return { status: 'skipped', reason: 'web' };
  if (scheduled === 'permission-denied') {
    return { status: 'skipped', reason: 'permission-denied' };
  }
  if (!scheduled) return { status: 'skipped', reason: 'web' };
  return { status: 'scheduled', identifier, fireAt };
}

/**
 * Cancel-on-complete / cancel-on-delete support. Cancels BOTH the base
 * reminder and any live snooze replacement so completing or deleting a todo
 * right after snoozing cannot leave a "due now" notification firing for a
 * settled todo. Web-safe no-op.
 */
export async function cancelTodoDueReminder(todoId: string): Promise<void> {
  await cancelTodoReminderNotification(todoReminderIdentifier(todoId));
  await cancelTodoReminderNotification(getTodoReminderSnoozeIdentifier(todoId));
}

/**
 * Best-effort variant for data-layer mutation paths: reminder failures must
 * never break a write. Exposed for callers outside this module (the todos
 * data layer wraps its sync points with this).
 */
export async function cancelTodoReminderSafely(todoId: string): Promise<void> {
  try {
    await cancelTodoDueReminder(todoId);
  } catch {
    // Ignore reminder cancellation failures.
  }
}

function isCorrectBaseRequest(request: NotificationRequest, item: TodoReminderPlanItem): boolean {
  const data = getNotificationData(request);
  return (
    request.identifier === item.identifier &&
    data?.kind === item.data.kind &&
    data?.version === item.data.version &&
    data?.todoId === item.data.todoId &&
    data?.occurrenceId === item.data.occurrenceId &&
    getScheduledDateMs(request) === item.fireAt.getTime()
  );
}

/**
 * Diff-and-cancel reconcile for the whole todo-reminder namespace (audit F3).
 *
 * - Preference off → every todo-reminder request is cancelled.
 * - Permission not granted → every todo-reminder request is cancelled and the
 *   result says so, so callers do not mass-reschedule in a loop.
 * - Preference on → desired = pending, non-deleted todos with future fire
 *   times; correct live requests are preserved, everything else (stale fire
 *   times, deleted/completed/past-due todos, restore-shaped leftovers,
 *   duplicate or orphaned snoozes) is cancelled.
 *
 * Never touches other namespaces (see `isTodoReminderRequest`).
 */
export async function reconcileTodoReminders(
  input: ReconcileTodoRemindersInput = {},
): Promise<TodoReminderReconciliationResult> {
  const adapter = input.adapter ?? defaultAdapter;
  const now = input.now ?? new Date();
  try {
    const existing = await adapter.listScheduled();
    const todoRequests = existing.filter(isTodoReminderRequest);

    const permission = await adapter.getPermissionState();
    if (permission !== 'granted') {
      let cancelled = 0;
      for (const request of todoRequests) {
        await adapter.cancel(request.identifier);
        cancelled += 1;
      }
      return {
        status: permission === 'unsupported' ? 'unsupported' : 'permission_denied',
        scheduled: 0,
        cancelled,
      };
    }

    const enabled = await getTodoRemindersEnabled();
    if (!enabled) {
      let cancelled = 0;
      for (const request of todoRequests) {
        await adapter.cancel(request.identifier);
        cancelled += 1;
      }
      return { status: 'reconciled', scheduled: 0, cancelled };
    }

    await adapter.ensureChannel();
    const todos = input.loadTodos ? await input.loadTodos() : await defaultLoadTodos();

    let scheduled = 0;
    let cancelled = 0;
    const handledIdentifiers = new Set<string>();

    for (const todo of todos) {
      if (todo.completedAt) continue;
      const dueAt = toDate(todo.dueDate);
      if (!dueAt) continue;
      const fireAt = computeTodoReminderFireAt(
        dueAt,
        todo.leadMinutes ?? TODO_REMINDER_DEFAULT_LEAD_MINUTES,
        now,
      );
      if (!fireAt) continue;

      const identifier = todoReminderIdentifier(todo.id);
      const item: TodoReminderPlanItem = {
        identifier,
        title: todo.title.trim() || 'Todo reminder',
        body: TODO_REMINDER_BODY,
        data: buildReminderData(todo.id, fireAt, `${identifier}:${fireAt.getTime()}`, false),
        fireAt,
      };
      const candidates = todoRequests.filter((request) => request.identifier === identifier);
      const correct = candidates.find((candidate) => isCorrectBaseRequest(candidate, item));
      if (correct) {
        handledIdentifiers.add(correct.identifier);
        continue;
      }
      for (const stale of candidates) {
        await adapter.cancel(stale.identifier);
        cancelled += 1;
      }
      await adapter.schedule(item);
      handledIdentifiers.add(identifier);
      scheduled += 1;
    }

    // Cancel stale base reminders: deleted/completed/past-due/no-due-date
    // todos, wrong fire times, and restore-shaped leftovers for todos that no
    // longer exist locally.
    for (const request of todoRequests) {
      if (handledIdentifiers.has(request.identifier)) continue;
      if (isTodoReminderSnoozeRequest(request)) continue;
      await adapter.cancel(request.identifier);
      cancelled += 1;
    }

    // A live snooze stays valid while its todo is still pending; keep one
    // request per todo (preferring the canonical identifier) and repair
    // duplicates/stale entries.
    const snoozeRequests = todoRequests.filter(isTodoReminderSnoozeRequest);
    const pendingIds = new Set(todos.filter((todo) => !todo.completedAt).map((todo) => todo.id));
    const snoozeByTodo = new Map<string, NotificationRequest[]>();
    for (const request of snoozeRequests) {
      const todoId = getSnoozeTodoId(request);
      if (todoId === null) {
        await adapter.cancel(request.identifier);
        cancelled += 1;
        continue;
      }
      const rows = snoozeByTodo.get(todoId) ?? [];
      rows.push(request);
      snoozeByTodo.set(todoId, rows);
    }
    for (const [todoId, requests] of snoozeByTodo) {
      const canonicalIdentifier = getTodoReminderSnoozeIdentifier(todoId);
      const keep = pendingIds.has(todoId)
        ? (requests.find((request) => request.identifier === canonicalIdentifier) ?? requests[0])
        : null;
      for (const request of requests) {
        if (keep && request.identifier === keep.identifier) {
          handledIdentifiers.add(request.identifier);
          continue;
        }
        await adapter.cancel(request.identifier);
        cancelled += 1;
      }
    }

    return { status: 'reconciled', scheduled, cancelled };
  } catch (error) {
    return { status: 'failed', scheduled: 0, cancelled: 0, error };
  }
}

function isTodoReminderSnoozeRequest(request: NotificationRequest): boolean {
  return (
    request.identifier.startsWith('todo-reminder-snooze:') ||
    (getNotificationData(request)?.snoozed === true &&
      getNotificationData(request)?.kind === TODO_REMINDER_DATA_KIND)
  );
}

function getSnoozeTodoId(request: NotificationRequest): string | null {
  const data = getNotificationData(request);
  if (typeof data?.todoId === 'string' && data.todoId.length > 0) return data.todoId;
  const parts = request.identifier.split(':');
  return parts.length === 2 && parts[0] === 'todo-reminder-snooze' ? parts[1] : null;
}
