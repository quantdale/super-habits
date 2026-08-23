import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  reconcileWorkoutDayReminder,
  WORKOUT_REMINDER_IDENTIFIER_PREFIX,
} from '@/core/notifications/workoutReminderScheduler';

const getWorkoutPreferences = vi.fn();
const resolveWorkoutScheduleForDate = vi.fn();
const listScheduledNotifications = vi.fn();
const cancelScheduledNotification = vi.fn();
const scheduleWorkoutDayReminderNotification = vi.fn();

vi.mock('@/features/workout/workout.data', () => ({
  getWorkoutPreferences: (...args: unknown[]) => getWorkoutPreferences(...args),
  resolveWorkoutScheduleForDate: (...args: unknown[]) => resolveWorkoutScheduleForDate(...args),
}));

vi.mock('@/lib/notifications', () => ({
  listScheduledNotifications: (...args: unknown[]) => listScheduledNotifications(...args),
  cancelScheduledNotification: (...args: unknown[]) => cancelScheduledNotification(...args),
  scheduleWorkoutDayReminderNotification: (...args: unknown[]) =>
    scheduleWorkoutDayReminderNotification(...args),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2027, 2, 1, 8, 0, 0, 0));
  getWorkoutPreferences.mockReset();
  resolveWorkoutScheduleForDate.mockReset();
  listScheduledNotifications.mockReset();
  cancelScheduledNotification.mockReset();
  scheduleWorkoutDayReminderNotification.mockReset();
  getWorkoutPreferences.mockResolvedValue({
    effortScale: 'off',
    goalWeight: null,
    workoutReminder: { enabled: true, time: { hour: 9, minute: 0 } },
  });
  resolveWorkoutScheduleForDate.mockResolvedValue({
    dateKey: '2027-03-01',
    source: 'weekly',
    planKind: 'workout',
    routineId: 'routine_push',
    movedFromDateKey: null,
    note: null,
  });
  listScheduledNotifications.mockResolvedValue([
    { identifier: `${WORKOUT_REMINDER_IDENTIFIER_PREFIX}2027-02-28`, content: {}, trigger: null },
    { identifier: 'superhabits.pomodoro', content: {}, trigger: null },
  ]);
  cancelScheduledNotification.mockResolvedValue(undefined);
  scheduleWorkoutDayReminderNotification.mockResolvedValue('scheduled-id');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('reconcileWorkoutDayReminder', () => {
  it('cancels only its namespace and schedules future training days from the plan', async () => {
    const result = await reconcileWorkoutDayReminder();

    expect(result.status).toBe('scheduled');
    expect(result.scheduled).toBe(14);
    expect(cancelScheduledNotification).toHaveBeenCalledWith(
      `${WORKOUT_REMINDER_IDENTIFIER_PREFIX}2027-02-28`,
    );
    expect(cancelScheduledNotification).not.toHaveBeenCalledWith('superhabits.pomodoro');
    expect(scheduleWorkoutDayReminderNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: `${WORKOUT_REMINDER_IDENTIFIER_PREFIX}2027-03-01`,
        title: 'Workout day',
        body: 'Your scheduled training session is ready.',
      }),
    );
  });

  it('does not schedule configured rest days and cancels reminders when disabled', async () => {
    resolveWorkoutScheduleForDate.mockResolvedValue({
      dateKey: '2027-03-01',
      source: 'override',
      planKind: 'rest',
      routineId: null,
      movedFromDateKey: null,
      note: 'Recovery',
    });
    await expect(reconcileWorkoutDayReminder()).resolves.toMatchObject({
      status: 'scheduled',
      scheduled: 0,
    });
    expect(scheduleWorkoutDayReminderNotification).not.toHaveBeenCalled();

    getWorkoutPreferences.mockResolvedValue({
      effortScale: 'off',
      goalWeight: null,
      workoutReminder: { enabled: false, time: { hour: 9, minute: 0 } },
    });
    await expect(reconcileWorkoutDayReminder()).resolves.toEqual({
      status: 'disabled',
      scheduled: 0,
    });
  });
});
