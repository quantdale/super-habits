import { describe, expect, it, vi } from 'vitest';
import {
  classifyNotificationResponse,
  dispatchNotificationResponse,
  getNotificationResponseFingerprint,
} from '@/core/notifications/notificationResponseDispatcher';
import {
  HABIT_REMINDER_MARK_COMPLETE_ACTION,
  HABIT_REMINDER_SNOOZE_ACTION,
} from '@/features/habits/habitReminders.domain';

const DEFAULT_ACTION = 'expo.modules.notifications.actions.DEFAULT';

function response(
  data: Record<string, unknown>,
  actionIdentifier = DEFAULT_ACTION,
  id = 'notification-1',
) {
  return {
    actionIdentifier,
    notification: {
      date: 1,
      request: {
        identifier: id,
        content: { data },
        trigger: null,
      },
    },
  } as never;
}

const normalData = {
  kind: 'habit-reminder',
  version: 2,
  habitId: 'habit_gym',
  dateKey: '2026-08-10',
  occurrenceId: 'habit-reminder:habit_gym:2026-08-10',
};

describe('notification response dispatcher', () => {
  it('classifies a body tap using ID metadata, never title text', () => {
    expect(classifyNotificationResponse(response({ ...normalData, title: 'Gym' }))).toMatchObject({
      kind: 'habit-reminder',
      action: 'open',
      habitId: 'habit_gym',
      dateKey: '2026-08-10',
    });
  });

  it.each([
    [HABIT_REMINDER_MARK_COMPLETE_ACTION, 'mark_complete'],
    [HABIT_REMINDER_SNOOZE_ACTION, 'snooze'],
  ])('classifies %s as %s', (identifier, action) => {
    expect(classifyNotificationResponse(response(normalData, identifier))).toMatchObject({
      kind: 'habit-reminder',
      action,
    });
  });

  it('rejects unknown actions and notification types safely', () => {
    expect(classifyNotificationResponse(response(normalData, 'future_action'))).toMatchObject({
      kind: 'unknown',
    });
    expect(
      classifyNotificationResponse(response({ kind: 'pomodoro', sessionId: 'pom_1' })),
    ).toMatchObject({
      kind: 'pomodoro',
    });
    expect(classifyNotificationResponse(response({ kind: 'other' }))).toMatchObject({
      kind: 'unknown',
    });
  });

  it('dispatches exact open, mark-complete, and snooze handlers', async () => {
    const openHabit = vi.fn();
    const markComplete = vi.fn().mockResolvedValue(undefined);
    const snooze = vi.fn().mockResolvedValue(undefined);

    await dispatchNotificationResponse(response(normalData), { openHabit, markComplete, snooze });
    await dispatchNotificationResponse(response(normalData, HABIT_REMINDER_MARK_COMPLETE_ACTION), {
      openHabit,
      markComplete,
      snooze,
    });
    await dispatchNotificationResponse(response(normalData, HABIT_REMINDER_SNOOZE_ACTION), {
      openHabit,
      markComplete,
      snooze,
    });

    expect(openHabit).toHaveBeenCalledWith('habit_gym');
    expect(markComplete).toHaveBeenCalledWith({
      habitId: 'habit_gym',
      dateKey: '2026-08-10',
      actionKey: 'habit-reminder:habit_gym:2026-08-10:habit_reminder_mark_complete',
      occurrenceId: 'habit-reminder:habit_gym:2026-08-10',
    });
    expect(snooze).toHaveBeenCalledWith({
      habitId: 'habit_gym',
      dateKey: '2026-08-10',
      actionKey: 'habit-reminder:habit_gym:2026-08-10:habit_reminder_snooze',
      occurrenceId: 'habit-reminder:habit_gym:2026-08-10',
    });
  });

  it('creates a stable replay fingerprint from notification occurrence and action', () => {
    const first = response(
      normalData,
      HABIT_REMINDER_MARK_COMPLETE_ACTION,
      'habit-reminder:habit_gym:2026-08-10',
    );
    const replay = response(
      normalData,
      HABIT_REMINDER_MARK_COMPLETE_ACTION,
      'habit-reminder:habit_gym:2026-08-10',
    );
    expect(getNotificationResponseFingerprint(first)).toBe(
      getNotificationResponseFingerprint(replay),
    );
  });
});
