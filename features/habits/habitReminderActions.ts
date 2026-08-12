import {
  cancelHabitReminderNotification,
  ensureHabitReminderChannel,
  getNotificationPermissionState,
  listScheduledNotifications,
  scheduleHabitReminderNotification,
  type NotificationPermissionState,
  type NotificationRequest,
} from '@/lib/notifications';
import { claimNotificationAction } from '@/features/habits/notificationActions.data';
import {
  HABIT_REMINDER_BODY,
  HABIT_REMINDER_DATA_KIND,
  HABIT_REMINDER_DATA_VERSION,
  HABIT_REMINDER_SNOOZE_MINUTES,
  getHabitReminderIdentifier,
  getHabitReminderSnoozeIdentifier,
  parseHabitReminderTime,
  type HabitReminderNotificationData,
  type HabitReminderPlanItem,
} from '@/features/habits/habitReminders.domain';
import {
  getHabitTargetForDate,
  isHabitScheduledOn,
  parseHabitRuleHistory,
} from '@/features/habits/habits.domain';
import {
  getHabitCountByDate,
  listHabits,
  type NotificationHabitCompletionResult,
  completeHabitFromNotification,
} from '@/features/habits/habits.data';
import { toDateKey } from '@/lib/time';

export type HabitReminderActionNativeAdapter = {
  getPermissionState: () => Promise<NotificationPermissionState>;
  ensureChannel: () => Promise<void>;
  listScheduled: () => Promise<NotificationRequest[]>;
  schedule: (item: HabitReminderPlanItem) => Promise<string | null>;
  cancel: (identifier: string) => Promise<void>;
};

export type HabitReminderSnoozeResult = {
  status: 'scheduled' | 'duplicate' | 'noop' | 'unsupported' | 'failed';
  identifier: string;
  error?: unknown;
};

const defaultActionAdapter: HabitReminderActionNativeAdapter = {
  getPermissionState: getNotificationPermissionState,
  ensureChannel: ensureHabitReminderChannel,
  listScheduled: listScheduledNotifications,
  schedule: (item) =>
    scheduleHabitReminderNotification({
      identifier: item.identifier,
      title: item.title,
      body: item.body,
      data: item.data,
      fireAt: item.fireAt,
    }),
  cancel: cancelHabitReminderNotification,
};

function getNotificationData(request: NotificationRequest): Record<string, unknown> | null {
  const data = request.content.data;
  return data && typeof data === 'object' ? data : null;
}

function getTriggerDate(request: NotificationRequest): Date | null {
  const trigger = request.trigger;
  if (!trigger || typeof trigger !== 'object' || !('date' in trigger)) {
    return null;
  }
  if (!('date' in trigger)) return null;
  const value: unknown = trigger.date;
  const timestamp = value instanceof Date ? value.getTime() : value;
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return null;
  return new Date(timestamp);
}

function isSameLogicalSnooze(request: NotificationRequest, habitId: string, dateKey: string) {
  const data = getNotificationData(request);
  return (
    (request.identifier === getHabitReminderSnoozeIdentifier(habitId, dateKey) ||
      data?.snoozed === true) &&
    data?.kind === HABIT_REMINDER_DATA_KIND &&
    data?.habitId === habitId &&
    data?.dateKey === dateKey
  );
}

export async function completeHabitReminderAction(input: {
  habitId: string;
  dateKey: string;
  actionKey: string;
  occurrenceId: string;
  now?: Date;
}): Promise<NotificationHabitCompletionResult> {
  return completeHabitFromNotification(input);
}

let snoozeQueue: Promise<void> = Promise.resolve();

/** Serialize snooze inventory checks so duplicate foreground/cold-start paths cannot race. */
export function snoozeHabitReminderAction(
  input: {
    habitId: string;
    dateKey: string;
    actionKey: string;
    occurrenceId: string;
    now?: Date;
  },
  adapter: HabitReminderActionNativeAdapter = defaultActionAdapter,
): Promise<HabitReminderSnoozeResult> {
  const run = snoozeQueue.then(async () => runSnooze(input, adapter));
  const result = run;
  snoozeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function runSnooze(
  input: {
    habitId: string;
    dateKey: string;
    actionKey: string;
    occurrenceId: string;
    now?: Date;
  },
  adapter: HabitReminderActionNativeAdapter,
): Promise<HabitReminderSnoozeResult> {
  const identifier = getHabitReminderSnoozeIdentifier(input.habitId, input.dateKey);
  const now = input.now ?? new Date();
  try {
    await claimNotificationAction({
      actionKey: input.actionKey,
      kind: HABIT_REMINDER_DATA_KIND,
      actionName: 'snooze',
      occurrenceId: input.occurrenceId,
      processedAt: now.toISOString(),
    });
    const habits = await listHabits();
    const habit = habits.find((candidate) => candidate.id === input.habitId);
    const parsedTime = parseHabitReminderTime(habit?.reminder_time);
    const fireAt = new Date(now.getTime() + HABIT_REMINDER_SNOOZE_MINUTES * 60 * 1000);
    const currentDateKey = toDateKey(now);
    const valid = Boolean(
      habit &&
      parsedTime &&
      input.dateKey === currentDateKey &&
      toDateKey(fireAt) === input.dateKey &&
      isHabitScheduledOn(
        habit.rule_history,
        input.dateKey,
        habit.target_per_day,
        toDateKey(new Date(habit.created_at)),
      ),
    );
    const count = valid ? await getHabitCountByDate(input.habitId, input.dateKey) : 0;
    const target = valid
      ? getHabitTargetForDate(
          parseHabitRuleHistory(habit!.rule_history),
          input.dateKey,
          habit!.target_per_day,
          toDateKey(new Date(habit!.created_at)),
        )
      : 0;
    if (!valid || count >= target) {
      await adapter.cancel(getHabitReminderIdentifier(input.habitId, input.dateKey));
      await adapter.cancel(identifier);
      return { status: 'noop', identifier };
    }

    if ((await adapter.getPermissionState()) !== 'granted') {
      return { status: 'unsupported', identifier };
    }
    await adapter.ensureChannel();
    const existing = (await adapter.listScheduled()).filter((request) =>
      isSameLogicalSnooze(request, input.habitId, input.dateKey),
    );
    const matching = existing.find((request) => {
      const triggerDate = getTriggerDate(request);
      return (
        request.identifier === identifier &&
        triggerDate !== null &&
        triggerDate.getTime() > now.getTime() &&
        toDateKey(triggerDate) === input.dateKey
      );
    });
    if (matching) {
      for (const duplicate of existing) {
        if (duplicate.identifier !== matching.identifier)
          await adapter.cancel(duplicate.identifier);
      }
      return { status: 'duplicate', identifier };
    }
    for (const stale of existing) await adapter.cancel(stale.identifier);

    const data: HabitReminderNotificationData = {
      kind: HABIT_REMINDER_DATA_KIND,
      version: HABIT_REMINDER_DATA_VERSION,
      habitId: input.habitId,
      dateKey: input.dateKey,
      occurrenceId: getHabitReminderIdentifier(input.habitId, input.dateKey),
      time: formatConfiguredTime(habit!.reminder_time),
      snoozed: true,
    };
    await adapter.schedule({
      identifier,
      habitId: input.habitId,
      dateKey: input.dateKey,
      time: data.time,
      fireAt,
      title: habit!.name.trim() || 'Habit reminder',
      body: HABIT_REMINDER_BODY,
      data,
    });
    return { status: 'scheduled', identifier };
  } catch (error) {
    return { status: 'failed', identifier, error };
  }
}

function formatConfiguredTime(value: string | null): string {
  return value && parseHabitReminderTime(value) ? value : '00:00';
}
