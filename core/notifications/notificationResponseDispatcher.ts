import type { NotificationResponse } from 'expo-notifications';
import { getNotificationResponseData } from '@/lib/notifications';
import {
  HABIT_REMINDER_DATA_KIND,
  HABIT_REMINDER_MARK_COMPLETE_ACTION,
  HABIT_REMINDER_SNOOZE_ACTION,
  getHabitReminderActionKey,
  getHabitReminderIdentifier,
  isHabitReminderDateKey,
} from '@/features/habits/habitReminders.domain';
import {
  TODO_REMINDER_DATA_KIND,
  TODO_REMINDER_MARK_DONE_ACTION,
  TODO_REMINDER_SNOOZE_ACTION,
} from '@/lib/notificationConstants';
import { getTodoReminderActionKey, todoReminderIdentifier } from './reminderPlanning';

const DEFAULT_ACTION_IDENTIFIER = 'expo.modules.notifications.actions.DEFAULT';

export type HabitReminderResponseAction = 'open' | 'mark_complete' | 'snooze';

export type HabitReminderResponse = {
  kind: 'habit-reminder';
  action: HabitReminderResponseAction;
  actionIdentifier: string;
  habitId: string;
  dateKey: string;
  occurrenceId: string;
  notificationIdentifier: string;
  snoozed: boolean;
};

export type TodoReminderResponseAction = 'open' | 'mark_done' | 'snooze';

export type TodoReminderResponse = {
  kind: 'todo-reminder';
  action: TodoReminderResponseAction;
  actionIdentifier: string;
  todoId: string;
  /** Fire-time-scoped claim namespace; falls back to the legacy per-todo id. */
  occurrenceId: string;
  notificationIdentifier: string;
  snoozed: boolean;
};

export type ClassifiedNotificationResponse =
  HabitReminderResponse | TodoReminderResponse | { kind: 'unknown'; actionIdentifier: string };

export type NotificationResponseHandlers = {
  openHabit: (habitId: string) => void;
  markComplete: (input: {
    habitId: string;
    dateKey: string;
    actionKey: string;
    occurrenceId: string;
  }) => Promise<void>;
  snooze: (input: {
    habitId: string;
    dateKey: string;
    actionKey: string;
    occurrenceId: string;
  }) => Promise<void>;
  openTodo: (todoId: string) => void;
  markDone: (input: { todoId: string; actionKey: string; occurrenceId: string }) => Promise<void>;
  snoozeTodo: (input: { todoId: string; actionKey: string; occurrenceId: string }) => Promise<void>;
};

export function classifyNotificationResponse(
  response: NotificationResponse | null | undefined,
): ClassifiedNotificationResponse {
  const data = getNotificationResponseData(response);
  const actionIdentifier = response?.actionIdentifier ?? '';

  if (data?.kind === TODO_REMINDER_DATA_KIND) {
    const todoId = data.todoId;
    if (typeof todoId !== 'string' || todoId.length === 0) {
      return { kind: 'unknown', actionIdentifier };
    }

    // Unknown actions are not treated as body taps. This prevents a future or
    // malformed action from opening the app or mutating a todo by accident.
    const action: TodoReminderResponseAction | null =
      actionIdentifier === TODO_REMINDER_MARK_DONE_ACTION
        ? 'mark_done'
        : actionIdentifier === TODO_REMINDER_SNOOZE_ACTION
          ? 'snooze'
          : actionIdentifier === DEFAULT_ACTION_IDENTIFIER || actionIdentifier.length === 0
            ? 'open'
            : null;
    if (action === null) return { kind: 'unknown', actionIdentifier };

    return {
      kind: 'todo-reminder',
      action,
      actionIdentifier,
      todoId,
      occurrenceId:
        typeof data.occurrenceId === 'string' && data.occurrenceId.length > 0
          ? data.occurrenceId
          : // Legacy V1 payloads carry no occurrence; derive the stable
            // per-todo identifier so they keep working until the next
            // reschedule replaces them.
            todoReminderIdentifier(todoId),
      notificationIdentifier: response?.notification.request.identifier ?? '',
      snoozed: data.snoozed === true,
    };
  }

  if (data?.kind !== HABIT_REMINDER_DATA_KIND) {
    return { kind: 'unknown', actionIdentifier };
  }

  const habitId = data.habitId;
  const dateKey = data.dateKey;
  if (
    typeof habitId !== 'string' ||
    habitId.length === 0 ||
    typeof dateKey !== 'string' ||
    !isHabitReminderDateKey(dateKey)
  ) {
    return { kind: 'unknown', actionIdentifier };
  }

  const notificationIdentifier = response?.notification.request.identifier ?? '';
  const occurrenceId =
    typeof data.occurrenceId === 'string' && data.occurrenceId.length > 0
      ? data.occurrenceId
      : getHabitReminderIdentifier(habitId, dateKey);
  const action: HabitReminderResponseAction =
    actionIdentifier === HABIT_REMINDER_MARK_COMPLETE_ACTION
      ? 'mark_complete'
      : actionIdentifier === HABIT_REMINDER_SNOOZE_ACTION
        ? 'snooze'
        : actionIdentifier === DEFAULT_ACTION_IDENTIFIER || actionIdentifier.length === 0
          ? 'open'
          : 'open';

  // Unknown actions are not treated as body taps. This prevents a future or
  // malformed action from opening the app or mutating a habit by accident.
  if (
    actionIdentifier !== HABIT_REMINDER_MARK_COMPLETE_ACTION &&
    actionIdentifier !== HABIT_REMINDER_SNOOZE_ACTION &&
    actionIdentifier !== DEFAULT_ACTION_IDENTIFIER &&
    actionIdentifier.length > 0
  ) {
    return { kind: 'unknown', actionIdentifier };
  }

  return {
    kind: 'habit-reminder',
    action,
    actionIdentifier,
    habitId,
    dateKey,
    occurrenceId,
    notificationIdentifier,
    snoozed: data.snoozed === true,
  };
}

export function getNotificationResponseFingerprint(response: NotificationResponse): string {
  return `${response.notification.request.identifier}:${response.actionIdentifier}`;
}

/** The only response interpreter used by the app's listener and cold-start path. */
export async function dispatchNotificationResponse(
  response: NotificationResponse | null | undefined,
  handlers: NotificationResponseHandlers,
): Promise<ClassifiedNotificationResponse> {
  const classified = classifyNotificationResponse(response);

  if (classified.kind === 'todo-reminder') {
    if (classified.action === 'open') {
      handlers.openTodo(classified.todoId);
    } else if (classified.action === 'mark_done') {
      await handlers.markDone({
        todoId: classified.todoId,
        actionKey: getTodoReminderActionKey(
          classified.occurrenceId,
          TODO_REMINDER_MARK_DONE_ACTION,
        ),
        occurrenceId: classified.occurrenceId,
      });
    } else if (classified.action === 'snooze') {
      await handlers.snoozeTodo({
        todoId: classified.todoId,
        actionKey: getTodoReminderActionKey(classified.occurrenceId, TODO_REMINDER_SNOOZE_ACTION),
        occurrenceId: classified.occurrenceId,
      });
    }
    return classified;
  }

  if (classified.kind !== 'habit-reminder') return classified;

  if (classified.action === 'open') {
    handlers.openHabit(classified.habitId);
  } else if (classified.action === 'mark_complete') {
    await handlers.markComplete({
      habitId: classified.habitId,
      dateKey: classified.dateKey,
      actionKey: getHabitReminderActionKey(
        classified.habitId,
        classified.dateKey,
        HABIT_REMINDER_MARK_COMPLETE_ACTION,
      ),
      occurrenceId: classified.occurrenceId,
    });
  } else if (classified.action === 'snooze') {
    await handlers.snooze({
      habitId: classified.habitId,
      dateKey: classified.dateKey,
      actionKey: getHabitReminderActionKey(
        classified.habitId,
        classified.dateKey,
        HABIT_REMINDER_SNOOZE_ACTION,
      ),
      occurrenceId: classified.occurrenceId,
    });
  }

  return classified;
}

export function isHabitReminderResponse(
  response: NotificationResponse | null | undefined,
): response is NotificationResponse {
  return classifyNotificationResponse(response).kind === 'habit-reminder';
}
