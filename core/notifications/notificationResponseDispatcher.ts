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

export type ClassifiedNotificationResponse =
  HabitReminderResponse | { kind: 'pomodoro' | 'unknown'; actionIdentifier: string };

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
};

export function classifyNotificationResponse(
  response: NotificationResponse | null | undefined,
): ClassifiedNotificationResponse {
  const data = getNotificationResponseData(response);
  const actionIdentifier = response?.actionIdentifier ?? '';

  if (data?.kind !== HABIT_REMINDER_DATA_KIND) {
    return {
      kind: data?.kind === 'pomodoro' ? 'pomodoro' : 'unknown',
      actionIdentifier,
    };
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
