import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type {
  NotificationRequest,
  NotificationResponse,
  NotificationTriggerInput,
} from 'expo-notifications';
import {
  DAILY_PLAN_REMINDER_CHANNEL_ID,
  HABIT_REMINDER_CATEGORY_ID,
  HABIT_REMINDER_MARK_COMPLETE_ACTION,
  HABIT_REMINDER_SNOOZE_ACTION,
  TODO_REMINDER_CATEGORY_ID,
  TODO_REMINDER_CHANNEL_ID,
  TODO_REMINDER_MARK_DONE_ACTION,
  TODO_REMINDER_SNOOZE_ACTION,
} from '@/lib/notificationConstants';

export const HABIT_REMINDER_CHANNEL_ID = 'habit-reminders';
export {
  HABIT_REMINDER_CATEGORY_ID,
  HABIT_REMINDER_MARK_COMPLETE_ACTION,
  HABIT_REMINDER_SNOOZE_ACTION,
};

export type NotificationPermissionState = 'not_determined' | 'granted' | 'denied' | 'unsupported';

Notifications.setNotificationHandler({
  handleNotification: () =>
    Promise.resolve({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
});

/**
 * Idempotent; must run before any notification is scheduled. Previously this
 * only happened on the permission-request path, so devices where permission
 * was already granted (e.g. Android <13 with no runtime prompt) never got a
 * channel and HIGH-importance delivery was not guaranteed.
 */
async function ensureAndroidNotificationChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export async function ensureHabitReminderChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(HABIT_REMINDER_CHANNEL_ID, {
      name: 'Habit reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      enableVibrate: true,
      vibrationPattern: [0, 250],
    });
  }
  await ensureHabitReminderCategory();
}

export async function ensureHabitReminderCategory(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.setNotificationCategoryAsync(HABIT_REMINDER_CATEGORY_ID, [
    {
      identifier: HABIT_REMINDER_MARK_COMPLETE_ACTION,
      buttonTitle: 'Mark complete',
      options: { opensAppToForeground: true },
    },
    {
      identifier: HABIT_REMINDER_SNOOZE_ACTION,
      buttonTitle: 'Snooze',
      options: { opensAppToForeground: true },
    },
  ]);
}

function classifyPermissionResponse(response: {
  granted?: boolean;
  status?: string;
}): Exclude<NotificationPermissionState, 'unsupported'> {
  if (response.granted === true || response.status === 'granted') return 'granted';
  if (response.status === 'undetermined' || response.status === 'notDetermined') {
    return 'not_determined';
  }
  // Some older/native test responses omit status until the OS has resolved it.
  if (response.status === undefined && response.granted === undefined) return 'not_determined';
  return 'denied';
}

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    return classifyPermissionResponse(await Notifications.getPermissionsAsync());
  } catch {
    return 'unsupported';
  }
}

export async function requestHabitReminderPermission(): Promise<NotificationPermissionState> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    await ensureHabitReminderChannel();
    return classifyPermissionResponse(await Notifications.requestPermissionsAsync());
  } catch {
    return 'unsupported';
  }
}

export async function ensureNotificationPermission(): Promise<boolean> {
  await ensureAndroidNotificationChannel();

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }

  const request = await Notifications.requestPermissionsAsync();
  return request.granted;
}

export async function scheduleTimerEndNotification(seconds: number, title: string, body: string) {
  if (Platform.OS === 'web') {
    return null;
  }
  const allowed = await ensureNotificationPermission();
  if (!allowed) {
    return null;
  }

  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  });
}

export async function cancelScheduledNotification(id: string | null | undefined): Promise<void> {
  if (!id || Platform.OS === 'web') {
    return;
  }
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Already fired or invalid id
  }
}

export async function listScheduledNotifications(): Promise<NotificationRequest[]> {
  if (Platform.OS === 'web') return [];
  return Notifications.getAllScheduledNotificationsAsync();
}

export async function scheduleHabitReminderNotification(input: {
  identifier: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  fireAt: Date;
}): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  return Notifications.scheduleNotificationAsync({
    identifier: input.identifier,
    content: {
      title: input.title,
      body: input.body,
      data: input.data,
      sound: 'default',
      categoryIdentifier: HABIT_REMINDER_CATEGORY_ID,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: input.fireAt,
      channelId: HABIT_REMINDER_CHANNEL_ID,
    },
  });
}

/**
 * Test-build-only short-horizon delivery probe. Production reminder plans
 * never call this path; the explicit build flag keeps the near-term trigger
 * out of release/dev builds that do not opt into native E2E support.
 */
export async function scheduleTestHabitReminderNotification(input: {
  habitId: string;
  title: string;
  dateKey: string;
  occurrenceId: string;
}): Promise<string | null> {
  if (Platform.OS === 'web' || process.env.EXPO_PUBLIC_HABIT_REMINDER_E2E_TEST !== 'true') {
    return null;
  }
  await ensureHabitReminderChannel();
  const identifier = `habit-reminder-test:${input.habitId}:${Date.now()}`;
  return Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: input.title.trim() || 'Habit reminder',
      body: 'Time to complete your habit.',
      data: {
        kind: 'habit-reminder',
        version: 2,
        habitId: input.habitId,
        dateKey: input.dateKey,
        occurrenceId: input.occurrenceId,
        snoozed: false,
      },
      sound: 'default',
      categoryIdentifier: HABIT_REMINDER_CATEGORY_ID,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 20_000),
      channelId: HABIT_REMINDER_CHANNEL_ID,
    },
  });
}

export async function cancelHabitReminderNotification(identifier: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelScheduledNotification(identifier);
}

export {
  DAILY_PLAN_REMINDER_CHANNEL_ID,
  TODO_REMINDER_CATEGORY_ID,
  TODO_REMINDER_CHANNEL_ID,
  TODO_REMINDER_MARK_DONE_ACTION,
  TODO_REMINDER_SNOOZE_ACTION,
};

export async function ensureTodoReminderChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(TODO_REMINDER_CHANNEL_ID, {
      name: 'Todo reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
      enableVibrate: true,
      vibrationPattern: [0, 250],
    });
  }
  await ensureTodoReminderCategory();
}

export async function ensureTodoReminderCategory(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.setNotificationCategoryAsync(TODO_REMINDER_CATEGORY_ID, [
    {
      identifier: TODO_REMINDER_MARK_DONE_ACTION,
      buttonTitle: 'Mark done',
      options: { opensAppToForeground: true },
    },
    {
      identifier: TODO_REMINDER_SNOOZE_ACTION,
      buttonTitle: 'Snooze',
      options: { opensAppToForeground: true },
    },
  ]);
}

export async function requestTodoReminderPermission(): Promise<NotificationPermissionState> {
  if (Platform.OS === 'web') return 'unsupported';
  try {
    await ensureTodoReminderChannel();
    return classifyPermissionResponse(await Notifications.requestPermissionsAsync());
  } catch {
    return 'unsupported';
  }
}

export async function scheduleTodoReminderNotification(input: {
  identifier: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  fireAt: Date;
}): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const allowed = await ensureNotificationPermission();
  if (!allowed) return null;
  return Notifications.scheduleNotificationAsync({
    identifier: input.identifier,
    content: {
      title: input.title,
      body: input.body,
      data: input.data,
      sound: 'default',
      categoryIdentifier: TODO_REMINDER_CATEGORY_ID,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: input.fireAt,
      channelId: TODO_REMINDER_CHANNEL_ID,
    },
  });
}

export async function cancelTodoReminderNotification(identifier: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelScheduledNotification(identifier);
}

export async function ensureDailyPlanReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(DAILY_PLAN_REMINDER_CHANNEL_ID, {
    name: 'Daily plan reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    enableVibrate: true,
  });
}

/**
 * Schedules (or reschedules) the repeating daily-plan reminder at a local
 * `HH:mm` time-of-day. Repeating daily triggers are calendar-based on native
 * platforms; web degrades silently by returning null.
 */
export async function scheduleDailyPlanReminderNotification(input: {
  identifier: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  hour: number;
  minute: number;
}): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const allowed = await ensureNotificationPermission();
  if (!allowed) return null;
  if (Platform.OS === 'android') {
    await ensureDailyPlanReminderChannel();
  }
  return Notifications.scheduleNotificationAsync({
    identifier: input.identifier,
    content: {
      title: input.title,
      body: input.body,
      data: input.data,
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: input.hour,
      minute: input.minute,
      channelId: DAILY_PLAN_REMINDER_CHANNEL_ID,
    },
  });
}

export function getNotificationResponseData(
  response: NotificationResponse | null | undefined,
): Record<string, unknown> | null {
  const data = response?.notification.request.content.data;
  return data && typeof data === 'object' ? data : null;
}

export type { NotificationRequest, NotificationResponse, NotificationTriggerInput };
