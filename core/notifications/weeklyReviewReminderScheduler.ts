import { Platform } from 'react-native';
import {
  cancelScheduledNotification,
  scheduleWeeklyReviewReminderNotification,
} from '@/lib/notifications';
import { WEEKLY_REVIEW_REMINDER_DATA_KIND } from '@/lib/notificationConstants';
import { getWeeklyReviewReminder } from './notificationPreferences';

/**
 * Bridge for the repeating weekly review reminder. Native-only; web degrades
 * silently (the settings UI states this honestly). A single fixed identifier
 * keeps the loop replace-not-duplicate across preference changes.
 */

export const WEEKLY_REVIEW_REMINDER_IDENTIFIER = 'weekly-review-reminder:weekly';

export type WeeklyReviewReminderSyncResult =
  | { status: 'scheduled'; identifier: string; weekday: number; hour: number; minute: number }
  | { status: 'cancelled' }
  | { status: 'skipped'; reason: 'disabled' | 'web' | 'permission-denied' };

export async function syncWeeklyReviewReminder(): Promise<WeeklyReviewReminderSyncResult> {
  if (Platform.OS === 'web') return { status: 'skipped', reason: 'web' };

  const preference = await getWeeklyReviewReminder();
  if (!preference.enabled) {
    await cancelScheduledNotification(WEEKLY_REVIEW_REMINDER_IDENTIFIER);
    return { status: 'cancelled' };
  }

  // Cancel first so changing the weekday/time can never leave an old weekly
  // trigger alongside the new one, even on native versions that do not treat
  // a caller-supplied identifier as an upsert key.
  await cancelScheduledNotification(WEEKLY_REVIEW_REMINDER_IDENTIFIER);
  const scheduled = await scheduleWeeklyReviewReminderNotification({
    identifier: WEEKLY_REVIEW_REMINDER_IDENTIFIER,
    title: 'Weekly review',
    body: 'Take a few minutes to close out your week and plan the next one.',
    data: { kind: WEEKLY_REVIEW_REMINDER_DATA_KIND, version: 1 },
    jsWeekday: preference.weekday,
    hour: preference.hour,
    minute: preference.minute,
  });
  if (scheduled === 'permission-denied') return { status: 'skipped', reason: 'permission-denied' };
  if (!scheduled || scheduled === 'web') return { status: 'skipped', reason: 'web' };
  return {
    status: 'scheduled',
    identifier: scheduled,
    weekday: preference.weekday,
    hour: preference.hour,
    minute: preference.minute,
  };
}
