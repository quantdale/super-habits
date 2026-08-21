import { dateKeyToLocalDate, timestampToLocalDateKey, toDateKey } from '@/lib/time';
import type { HabitLifecycleStatus } from '@/core/db/types';
import {
  getHabitTargetForDate,
  isHabitScheduledOn,
  type HabitRuleHistoryInput,
} from '@/features/habits/habits.domain';
import {
  HABIT_REMINDER_DATA_KIND as SHARED_HABIT_REMINDER_DATA_KIND,
  HABIT_REMINDER_DATA_VERSION as SHARED_HABIT_REMINDER_DATA_VERSION,
  HABIT_REMINDER_MARK_COMPLETE_ACTION as SHARED_HABIT_REMINDER_MARK_COMPLETE_ACTION,
  HABIT_REMINDER_SNOOZE_ACTION as SHARED_HABIT_REMINDER_SNOOZE_ACTION,
} from '@/lib/notificationConstants';

export const HABIT_REMINDER_WINDOW_DAYS = 14;
export const HABIT_REMINDER_DATA_KIND = SHARED_HABIT_REMINDER_DATA_KIND;
export const HABIT_REMINDER_DATA_VERSION = SHARED_HABIT_REMINDER_DATA_VERSION;
export const HABIT_REMINDER_BODY = 'Time to complete your habit.';
export const HABIT_REMINDER_SNOOZE_MINUTES = 15;
export const HABIT_REMINDER_MARK_COMPLETE_ACTION = SHARED_HABIT_REMINDER_MARK_COMPLETE_ACTION;
export const HABIT_REMINDER_SNOOZE_ACTION = SHARED_HABIT_REMINDER_SNOOZE_ACTION;

export type HabitReminderTime = {
  hour: number;
  minute: number;
};

export type HabitReminderNotificationData = {
  kind: typeof HABIT_REMINDER_DATA_KIND;
  version: typeof HABIT_REMINDER_DATA_VERSION;
  habitId: string;
  dateKey: string;
  occurrenceId: string;
  time: string;
  snoozed?: boolean;
};

export type HabitReminderHabit = {
  id: string;
  name: string;
  target_per_day: number;
  reminder_time: string | null;
  created_at: string;
  deleted_at: string | null;
  rule_history?: HabitRuleHistoryInput;
  /** Durable lifecycle status (migration 20); absent in legacy rows = 'active'. */
  status?: HabitLifecycleStatus;
};

export type HabitReminderCompletion = {
  habit_id: string;
  date_key: string;
  count: number;
};

export type HabitReminderPlanItem = {
  identifier: string;
  habitId: string;
  dateKey: string;
  time: string;
  fireAt: Date;
  title: string;
  body: typeof HABIT_REMINDER_BODY;
  data: HabitReminderNotificationData;
};

export type BuildHabitReminderPlanInput = {
  habits: readonly HabitReminderHabit[];
  completions?: readonly HabitReminderCompletion[];
  now?: Date;
  windowDays?: number;
};

/** Parse only the canonical, persisted 24-hour local time representation. */
export function parseHabitReminderTime(value: string | null | undefined): HabitReminderTime | null {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function formatHabitReminderTime(value: HabitReminderTime): string {
  return `${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}`;
}

/** Construct a local wall-clock Date for a local calendar date key. */
export function buildLocalHabitReminderDate(
  dateKey: string,
  reminderTime: HabitReminderTime,
): Date {
  const date = dateKeyToLocalDate(dateKey);
  date.setHours(reminderTime.hour, reminderTime.minute, 0, 0);
  return date;
}

export function getHabitReminderIdentifier(habitId: string, dateKey: string): string {
  return `habit-reminder:${habitId}:${dateKey}`;
}

export function getHabitReminderSnoozeIdentifier(habitId: string, dateKey: string): string {
  return `habit-reminder-snooze:${habitId}:${dateKey}`;
}

export function getHabitReminderActionKey(
  habitId: string,
  dateKey: string,
  action: typeof HABIT_REMINDER_MARK_COMPLETE_ACTION | typeof HABIT_REMINDER_SNOOZE_ACTION,
): string {
  return `${getHabitReminderIdentifier(habitId, dateKey)}:${action}`;
}

export function isHabitReminderIdentifier(identifier: string): boolean {
  return identifier.startsWith('habit-reminder:') || isHabitReminderSnoozeIdentifier(identifier);
}

export function isHabitReminderSnoozeIdentifier(identifier: string): boolean {
  return identifier.startsWith('habit-reminder-snooze:');
}

export function isHabitReminderDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function safeCreationDateKey(createdAt: string): string | undefined {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime()) ? undefined : timestampToLocalDateKey(createdAt);
}

function buildWindowDateKeys(now: Date, windowDays: number): string[] {
  const count = Math.max(0, Math.floor(windowDays));
  const start = new Date(now.getTime());
  start.setHours(0, 0, 0, 0);
  const result: string[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const date = new Date(start.getTime());
    date.setDate(start.getDate() + offset);
    result.push(toDateKey(date));
  }
  return result;
}

function buildCompletionMap(completions: readonly HabitReminderCompletion[]): Map<string, number> {
  return new Map(
    completions.map((completion) => [
      `${completion.habit_id}:${completion.date_key}`,
      Math.max(0, completion.count),
    ]),
  );
}

/**
 * Compute the bounded set of future native reminder occurrences.
 *
 * Habit Engine V2 remains authoritative for both schedule eligibility and the
 * target active on each date. This function only turns eligible future dates
 * into local one-shot occurrences; it does not implement weekday rules.
 */
export function buildHabitReminderPlan({
  habits,
  completions = [],
  now = new Date(),
  windowDays = HABIT_REMINDER_WINDOW_DAYS,
}: BuildHabitReminderPlanInput): HabitReminderPlanItem[] {
  const completionMap = buildCompletionMap(completions);
  const dateKeys = buildWindowDateKeys(now, windowDays);
  const plan: HabitReminderPlanItem[] = [];

  for (const habit of habits) {
    if (habit.deleted_at !== null) continue;
    // A paused/archived habit has no obligations: no reminders for any date.
    if ((habit.status ?? 'active') !== 'active') continue;
    const parsedTime = parseHabitReminderTime(habit.reminder_time);
    if (!parsedTime) continue;

    const canonicalTime = formatHabitReminderTime(parsedTime);
    const creationDateKey = safeCreationDateKey(habit.created_at);

    for (const dateKey of dateKeys) {
      if (!isHabitScheduledOn(habit.rule_history, dateKey, habit.target_per_day, creationDateKey)) {
        continue;
      }

      const historicalTarget = getHabitTargetForDate(
        habit.rule_history,
        dateKey,
        habit.target_per_day,
        creationDateKey,
      );
      const count = completionMap.get(`${habit.id}:${dateKey}`) ?? 0;
      if (count >= historicalTarget) continue;

      const fireAt = buildLocalHabitReminderDate(dateKey, parsedTime);
      // A same-day edit/configuration after the wall-clock time takes effect
      // on the next eligible occurrence; it must not fire a stale notification.
      if (fireAt.getTime() <= now.getTime()) continue;

      const data: HabitReminderNotificationData = {
        kind: HABIT_REMINDER_DATA_KIND,
        version: HABIT_REMINDER_DATA_VERSION,
        habitId: habit.id,
        dateKey,
        occurrenceId: getHabitReminderIdentifier(habit.id, dateKey),
        snoozed: false,
        time: canonicalTime,
      };
      plan.push({
        identifier: getHabitReminderIdentifier(habit.id, dateKey),
        habitId: habit.id,
        dateKey,
        time: canonicalTime,
        fireAt,
        title: habit.name.trim() || 'Habit reminder',
        body: HABIT_REMINDER_BODY,
        data,
      });
    }
  }

  return plan.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}
