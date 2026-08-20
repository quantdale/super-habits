import { Platform } from 'react-native';
import {
  cancelScheduledNotification,
  scheduleDailyPlanReminderNotification,
} from '@/lib/notifications';
import {
  DAILY_PLAN_REMINDER_DATA_KIND,
  DAILY_PLAN_REMINDER_DATA_VERSION,
} from '@/lib/notificationConstants';
import { DAILY_PLAN_REMINDER_IDENTIFIER } from './reminderPlanning';
import { getTodoRemindersEnabled, getDailyPlanReminderTime } from './notificationPreferences';

/**
 * Bridge for the repeating daily-plan reminder (a time-of-day nudge to review
 * the day's plan). Native-only; web degrades silently. The reminder is a
 * single repeating notification identified by `DAILY_PLAN_REMINDER_IDENTIFIER`;
 * changing the stored time re-schedules it.
 */

export type DailyPlanReminderSyncResult =
  | { status: 'scheduled'; identifier: string; hour: number; minute: number }
  | { status: 'cancelled' }
  | { status: 'skipped'; reason: 'disabled' | 'web' };

export async function syncDailyPlanReminder(): Promise<DailyPlanReminderSyncResult> {
  if (Platform.OS === 'web') return { status: 'skipped', reason: 'web' };

  const enabled = await getTodoRemindersEnabled();
  if (!enabled) {
    await cancelScheduledNotification(DAILY_PLAN_REMINDER_IDENTIFIER);
    return { status: 'cancelled' };
  }

  const time = await getDailyPlanReminderTime();
  const scheduled = await scheduleDailyPlanReminderNotification({
    identifier: DAILY_PLAN_REMINDER_IDENTIFIER,
    title: 'Daily plan',
    body: 'Take a moment to review your plan for today.',
    data: {
      kind: DAILY_PLAN_REMINDER_DATA_KIND,
      version: DAILY_PLAN_REMINDER_DATA_VERSION,
    },
    hour: time.hour,
    minute: time.minute,
  });
  if (!scheduled) return { status: 'skipped', reason: 'web' };
  return { status: 'scheduled', identifier: scheduled, hour: time.hour, minute: time.minute };
}
