import {
  ensureTodoReminderChannel,
  getNotificationPermissionState,
  listScheduledNotifications,
  type NotificationPermissionState,
  type NotificationRequest,
} from '@/lib/notifications';
import { claimNotificationAction } from '@/features/habits/notificationActions.data';
import type { LinkedActionProcessResult } from '@/core/linked-actions/linkedActions.types';
import { TODO_REMINDER_DATA_KIND, TODO_REMINDER_DATA_VERSION } from '@/lib/notificationConstants';
import {
  getTodoReminderSnoozeIdentifier,
  todoReminderIdentifier,
  TODO_REMINDER_SNOOZE_MINUTES,
} from './reminderPlanning';
import { TODO_REMINDER_BODY } from './todoReminderScheduler';

/**
 * Notification-side orchestration for todo reminder actions ("Mark done" /
 * "Snooze" buttons). The durable completion lives in
 * `features/todos/todoNotificationActions.data.ts`; this module reaches it
 * through a small interface so `core/notifications` never statically depends
 * on the todos data layer (the default adapter resolves it lazily).
 */

export type TodoReminderCompletionResult = {
  status: 'applied' | 'duplicate' | 'noop';
  linkedActions: Pick<LinkedActionProcessResult, 'matchedRuleCount' | 'notices'>;
};

export type TodoReminderActionDataAdapter = {
  completeTodoFromNotification: (input: {
    todoId: string;
    actionKey: string;
    occurrenceId: string;
    now?: Date;
  }) => Promise<TodoReminderCompletionResult>;
};

const defaultDataAdapter: TodoReminderActionDataAdapter = {
  completeTodoFromNotification: async (input) => {
    const { completeTodoFromNotification } =
      await import('@/features/todos/todoNotificationActions.data');
    return completeTodoFromNotification(input);
  },
};

/**
 * Apply a "Mark done" tap through the claim-in-transaction data layer.
 * Serialized by the data layer's own queue; replays are duplicates.
 */
export function completeTodoReminderAction(input: {
  todoId: string;
  actionKey: string;
  occurrenceId: string;
  now?: Date;
  adapter?: TodoReminderActionDataAdapter;
}): Promise<TodoReminderCompletionResult> {
  return (input.adapter ?? defaultDataAdapter).completeTodoFromNotification({
    todoId: input.todoId,
    actionKey: input.actionKey,
    occurrenceId: input.occurrenceId,
    now: input.now,
  });
}

export type TodoReminderActionNativeAdapter = {
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
  /** Current todo row for tap-time validation; null when missing. */
  loadTodo: (todoId: string) => Promise<{
    id: string;
    title: string;
    due_date: string | null;
    completed: 0 | 1;
    deleted_at: string | null;
  } | null>;
  getRemindersEnabled: () => Promise<boolean>;
};

async function defaultLoadTodo(todoId: string) {
  // Dynamic import keeps core free of a static edge into the todos layer.
  const { getDatabase } = await import('@/core/db/client');
  const db = await getDatabase();
  return db.getFirstAsync<{
    id: string;
    title: string;
    due_date: string | null;
    completed: 0 | 1;
    deleted_at: string | null;
  }>(
    `SELECT id, title, due_date, completed, deleted_at
     FROM todos
     WHERE id = ?
       AND deleted_at IS NULL`,
    [todoId],
  );
}

const defaultActionAdapter: TodoReminderActionNativeAdapter = {
  getPermissionState: getNotificationPermissionState,
  ensureChannel: ensureTodoReminderChannel,
  listScheduled: listScheduledNotifications,
  schedule: (item) =>
    import('@/lib/notifications').then(({ scheduleTodoReminderNotification }) =>
      scheduleTodoReminderNotification({
        identifier: item.identifier,
        title: item.title,
        body: item.body,
        data: item.data,
        fireAt: item.fireAt,
      }),
    ),
  cancel: (identifier) =>
    import('@/lib/notifications').then(({ cancelTodoReminderNotification }) =>
      cancelTodoReminderNotification(identifier),
    ),
  loadTodo: defaultLoadTodo,
  getRemindersEnabled: () =>
    import('./notificationPreferences').then(({ getTodoRemindersEnabled }) =>
      getTodoRemindersEnabled(),
    ),
};

export type TodoReminderSnoozeResult = {
  status: 'scheduled' | 'duplicate' | 'noop' | 'unsupported' | 'failed';
  identifier: string;
  error?: unknown;
};

function getNotificationData(request: NotificationRequest): Record<string, unknown> | null {
  const data = request.content.data;
  return data && typeof data === 'object' ? data : null;
}

function isSameLogicalSnooze(request: NotificationRequest, todoId: string): boolean {
  const data = getNotificationData(request);
  return (
    (request.identifier === getTodoReminderSnoozeIdentifier(todoId) || data?.snoozed === true) &&
    data?.kind === TODO_REMINDER_DATA_KIND &&
    data?.todoId === todoId
  );
}

function getScheduledDateMs(request: NotificationRequest): number | null {
  const trigger = request.trigger;
  if (!trigger || typeof trigger !== 'object' || !('date' in trigger)) return null;
  const value: unknown = trigger.date;
  if (value instanceof Date) return value.getTime();
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

let snoozeQueue: Promise<void> = Promise.resolve();

/**
 * Serialize snooze inventory checks so duplicate foreground/cold-start paths
 * cannot race. Mirrors the habit snooze queue.
 */
export function snoozeTodoReminderAction(
  input: {
    todoId: string;
    actionKey: string;
    occurrenceId: string;
    now?: Date;
  },
  adapter: TodoReminderActionNativeAdapter = defaultActionAdapter,
): Promise<TodoReminderSnoozeResult> {
  const run = snoozeQueue.then(() => runSnooze(input, adapter));
  snoozeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function runSnooze(
  input: {
    todoId: string;
    actionKey: string;
    occurrenceId: string;
    now?: Date;
  },
  adapter: TodoReminderActionNativeAdapter,
): Promise<TodoReminderSnoozeResult> {
  const identifier = getTodoReminderSnoozeIdentifier(input.todoId);
  const now = input.now ?? new Date();
  try {
    // Claim first: a consumed-but-unapplied snooze claim only suppresses a
    // retry of the SAME delivered notification, which is correct.
    await claimNotificationAction({
      actionKey: input.actionKey,
      kind: TODO_REMINDER_DATA_KIND,
      actionName: 'snooze',
      occurrenceId: input.occurrenceId,
      processedAt: now.toISOString(),
    });

    const todo = await adapter.loadTodo(input.todoId);
    const enabled = await adapter.getRemindersEnabled();

    // Todos are due-moment based, not calendar-day based: unlike habit
    // reminders, a snooze MAY cross local midnight (a 23:50 todo snoozed 15
    // minutes is legitimate). Validity is "todo still pending and the feature
    // still enabled", never "same dateKey".
    const valid =
      Boolean(todo && todo.deleted_at === null && todo.completed === 0 && todo.due_date !== null) &&
      enabled;

    // Tap-time validation: the payload must still describe the todo's current
    // due moment. An edited todo was rescheduled under a fresh occurrence, so
    // a mismatching delivered notification is stale and must not snooze.
    if (valid && todo) {
      const dueAtMs = new Date(todo.due_date ?? '').getTime();
      const legacyOccurrenceId = todoReminderIdentifier(input.todoId);
      if (!Number.isNaN(dueAtMs)) {
        const expectedOccurrenceId = `${legacyOccurrenceId}:${dueAtMs}`;
        if (
          input.occurrenceId !== expectedOccurrenceId &&
          input.occurrenceId !== legacyOccurrenceId
        ) {
          await adapter.cancel(todoReminderIdentifier(input.todoId));
          await adapter.cancel(identifier);
          return { status: 'noop', identifier };
        }
      }
    }

    if (!valid) {
      await adapter.cancel(todoReminderIdentifier(input.todoId));
      await adapter.cancel(identifier);
      return { status: 'noop', identifier };
    }

    if ((await adapter.getPermissionState()) !== 'granted') {
      return { status: 'unsupported', identifier };
    }
    await adapter.ensureChannel();

    const existing = (await adapter.listScheduled()).filter((request) =>
      isSameLogicalSnooze(request, input.todoId),
    );
    const matching = existing.find((request) => {
      const triggerMs = getScheduledDateMs(request);
      return request.identifier === identifier && triggerMs !== null && triggerMs > now.getTime();
    });
    if (matching) {
      for (const duplicate of existing) {
        if (duplicate.identifier !== matching.identifier) {
          await adapter.cancel(duplicate.identifier);
        }
      }
      return { status: 'duplicate', identifier };
    }
    // Replace the base reminder with the snoozed one so it cannot also fire.
    await adapter.cancel(todoReminderIdentifier(input.todoId));
    for (const stale of existing) await adapter.cancel(stale.identifier);

    const fireAt = new Date(now.getTime() + TODO_REMINDER_SNOOZE_MINUTES * 60 * 1000);
    await adapter.schedule({
      identifier,
      title: todo!.title.trim() || 'Todo reminder',
      body: TODO_REMINDER_BODY,
      // The replacement carries the BASE occurrence's id so its actions land
      // in the same claim namespace as the original delivery.
      data: {
        kind: TODO_REMINDER_DATA_KIND,
        version: TODO_REMINDER_DATA_VERSION,
        todoId: input.todoId,
        occurrenceId: input.occurrenceId,
        dueAt: fireAt.toISOString(),
        snoozed: true,
      },
      fireAt,
    });
    return { status: 'scheduled', identifier };
  } catch (error) {
    return { status: 'failed', identifier, error };
  }
}
