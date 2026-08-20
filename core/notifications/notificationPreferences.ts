import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseTimeOfDay, type TimeOfDay } from './reminderPlanning';

/**
 * Local notification preferences for reminders beyond habits. Stored in
 * AsyncStorage under the `superhabits.notifications.` prefix; these are
 * device-local settings, never synced.
 */

export const TODO_REMINDERS_ENABLED_KEY = 'superhabits.notifications.todo-reminders-enabled';
export const DAILY_PLAN_REMINDER_TIME_KEY = 'superhabits.notifications.daily-plan-reminder-time';

export const DEFAULT_TODO_REMINDERS_ENABLED = false;
export const DEFAULT_DAILY_PLAN_REMINDER_TIME: TimeOfDay = { hour: 8, minute: 0 };

let cachedTodoRemindersEnabled: boolean | null = null;
let cachedDailyPlanTime: TimeOfDay | null = null;

export async function getTodoRemindersEnabled(): Promise<boolean> {
  if (cachedTodoRemindersEnabled !== null) return cachedTodoRemindersEnabled;
  try {
    const stored = await AsyncStorage.getItem(TODO_REMINDERS_ENABLED_KEY);
    cachedTodoRemindersEnabled = stored === 'enabled';
  } catch {
    cachedTodoRemindersEnabled = DEFAULT_TODO_REMINDERS_ENABLED;
  }
  return cachedTodoRemindersEnabled;
}

export async function setTodoRemindersEnabled(enabled: boolean): Promise<void> {
  cachedTodoRemindersEnabled = enabled;
  try {
    if (enabled) {
      await AsyncStorage.setItem(TODO_REMINDERS_ENABLED_KEY, 'enabled');
    } else {
      await AsyncStorage.removeItem(TODO_REMINDERS_ENABLED_KEY);
    }
  } catch (error) {
    // Keep the runtime cache in sync with the user's last selection even if
    // persistence fails; surface the error to the caller for UI feedback.
    throw error;
  }
}

export async function getDailyPlanReminderTime(): Promise<TimeOfDay> {
  if (cachedDailyPlanTime !== null) return cachedDailyPlanTime;
  try {
    const stored = await AsyncStorage.getItem(DAILY_PLAN_REMINDER_TIME_KEY);
    const parsed = parseTimeOfDay(stored);
    cachedDailyPlanTime = parsed ?? DEFAULT_DAILY_PLAN_REMINDER_TIME;
  } catch {
    cachedDailyPlanTime = DEFAULT_DAILY_PLAN_REMINDER_TIME;
  }
  return cachedDailyPlanTime;
}

export async function setDailyPlanReminderTime(time: TimeOfDay): Promise<void> {
  cachedDailyPlanTime = time;
  try {
    await AsyncStorage.setItem(DAILY_PLAN_REMINDER_TIME_KEY, `${time.hour}:${time.minute}`);
  } catch (error) {
    throw error;
  }
}

/** Test-only: clears in-memory preference caches. */
export function resetNotificationPreferenceCaches(): void {
  cachedTodoRemindersEnabled = null;
  cachedDailyPlanTime = null;
}
