import { Platform } from 'react-native';
import {
  cancelScheduledNotification,
  listScheduledNotifications,
  scheduleWorkoutDayReminderNotification,
} from '@/lib/notifications';
import {
  getWorkoutPreferences,
  resolveWorkoutScheduleForDate,
} from '@/features/workout/workout.data';

const IDENTIFIER_PREFIX = 'superhabits.workout-day:';
const LOOKAHEAD_DAYS = 14;

export type WorkoutReminderSyncResult =
  | { status: 'disabled' | 'unsupported' | 'permission_denied'; scheduled: number }
  | { status: 'scheduled'; scheduled: number };

function fireAtForDate(date: Date, hour: number, minute: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0, 0);
}

async function cancelExistingWorkoutReminders(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const scheduled = await listScheduledNotifications();
    await Promise.all(
      scheduled
        .map((request) => request.identifier)
        .filter((identifier) => identifier.startsWith(IDENTIFIER_PREFIX))
        .map((identifier) => cancelScheduledNotification(identifier)),
    );
  } catch {
    // Scheduling is best-effort; a later reconciliation retries cleanup.
  }
}

/** Reconcile a rolling native schedule from the authoritative local plan. */
export async function reconcileWorkoutDayReminder(): Promise<WorkoutReminderSyncResult> {
  const preferences = await getWorkoutPreferences();
  await cancelExistingWorkoutReminders();
  if (Platform.OS === 'web') return { status: 'unsupported', scheduled: 0 };
  if (!preferences.workoutReminder?.enabled) return { status: 'disabled', scheduled: 0 };

  const now = new Date();
  let scheduledCount = 0;
  let attempted = false;
  for (let offset = 0; offset < LOOKAHEAD_DAYS; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 12, 0, 0, 0);
    const dateKey = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
    const schedule = await resolveWorkoutScheduleForDate(dateKey);
    if (schedule.planKind === 'rest' || !schedule.routineId) continue;
    const fireAt = fireAtForDate(
      date,
      preferences.workoutReminder.time.hour,
      preferences.workoutReminder.time.minute,
    );
    if (fireAt.getTime() <= now.getTime()) continue;
    attempted = true;
    const id = await scheduleWorkoutDayReminderNotification({
      identifier: `${IDENTIFIER_PREFIX}${dateKey}`,
      title: 'Workout day',
      body: 'Your scheduled training session is ready.',
      fireAt,
    });
    if (id) scheduledCount += 1;
  }
  return attempted && scheduledCount === 0
    ? { status: 'permission_denied', scheduled: 0 }
    : { status: 'scheduled', scheduled: scheduledCount };
}

export { IDENTIFIER_PREFIX as WORKOUT_REMINDER_IDENTIFIER_PREFIX };
