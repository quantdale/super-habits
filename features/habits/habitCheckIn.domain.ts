import type { Habit, HabitCategory } from '@/features/habits/types';
import {
  formatHabitSchedule,
  getHabitRuleForDate,
  getHabitTargetForDate,
  habitCreationDateKey,
  isHabitActionableOn,
  isHabitLifecycleMaskedOn,
  isHabitScheduledOn,
} from '@/features/habits/habits.domain';
import {
  formatHabitReminderTime,
  parseHabitReminderTime,
} from '@/features/habits/habitReminders.domain';
import { dateKeyToLocalDate } from '@/lib/time';

export const HABIT_TIME_GROUP_ORDER = ['morning', 'afternoon', 'evening', 'anytime'] as const;

export const HABIT_TIME_GROUP_LABELS: Record<HabitCategory, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  anytime: 'Anytime',
};

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export type HabitCheckInBlockReason =
  'paused' | 'archived' | 'before_creation' | 'masked' | 'unscheduled';

export type HabitCheckInState = 'not_started' | 'in_progress' | 'complete' | 'inactive';

/** Danger is never a progress tone. Callers apply it only to a failed write. */
export type HabitCheckInTone = 'neutral' | 'accent' | 'complete' | 'inactive';

export type HabitCheckInRowModel = {
  habitId: string;
  name: string;
  category: HabitCategory;
  count: number;
  target: number;
  quantitative: boolean;
  actionable: boolean;
  blockReason: HabitCheckInBlockReason | null;
  state: HabitCheckInState;
  tone: HabitCheckInTone;
  scheduleLabel: string;
  reminderLabel: string | null;
  currentStreak: number;
  secondaryLabel: string | null;
  actionLabel: string;
  decrementLabel: string;
  detailsLabel: string;
};

export type HabitDateSummary = {
  dateKey: string;
  isToday: boolean;
  scheduledCount: number;
  completedCount: number;
  label: string;
  accessibilityLabel: string;
};

export type HabitCheckInGroup = {
  key: HabitCategory;
  label: string;
  rows: HabitCheckInRowModel[];
};

export function formatHabitCheckInDatePhrase(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return 'today';
  const date = dateKeyToLocalDate(dateKey);
  return `on ${WEEKDAY_SHORT[date.getDay()]} ${date.getDate()}`;
}

export function habitProgressTone(state: HabitCheckInState): HabitCheckInTone {
  if (state === 'complete') return 'complete';
  if (state === 'in_progress') return 'accent';
  if (state === 'inactive') return 'inactive';
  return 'neutral';
}

function blockReasonFor(habit: Habit, dateKey: string): HabitCheckInBlockReason | null {
  const status = habit.status ?? 'active';
  if (status === 'paused') return 'paused';
  if (status === 'archived') return 'archived';
  const creationKey = habitCreationDateKey(habit.created_at);
  if (isHabitLifecycleMaskedOn(habit.lifecycle_history, dateKey)) return 'masked';
  const rule = getHabitRuleForDate(habit.rule_history, dateKey, habit.target_per_day, creationKey);
  if (!rule) return 'before_creation';
  if (!isHabitScheduledOn(habit.rule_history, dateKey, habit.target_per_day, creationKey)) {
    return 'unscheduled';
  }
  return null;
}

function reasonSentence(reason: HabitCheckInBlockReason, dayPhrase: string): string {
  if (reason === 'paused') return `Paused. Check-in is unavailable ${dayPhrase}.`;
  if (reason === 'archived') return `Archived. Check-in is unavailable ${dayPhrase}.`;
  if (reason === 'before_creation') return `Not created yet ${dayPhrase}.`;
  if (reason === 'masked')
    return `Paused or archived on this date. Check-in is unavailable ${dayPhrase}.`;
  return `Not scheduled ${dayPhrase}. Rest day.`;
}

export function buildHabitCheckInRow(input: {
  habit: Habit;
  dateKey: string;
  todayKey: string;
  count: number;
  currentStreak?: number;
}): HabitCheckInRowModel {
  const creationKey = habitCreationDateKey(input.habit.created_at);
  const blockReason = blockReasonFor(input.habit, input.dateKey);
  const actionable =
    blockReason === null &&
    isHabitActionableOn(
      input.habit.rule_history,
      input.dateKey,
      input.habit.target_per_day,
      creationKey,
      input.habit.lifecycle_history,
    );
  const rule = getHabitRuleForDate(
    input.habit.rule_history,
    input.dateKey,
    input.habit.target_per_day,
    creationKey,
  );
  const target = actionable
    ? getHabitTargetForDate(
        input.habit.rule_history,
        input.dateKey,
        input.habit.target_per_day,
        creationKey,
      )
    : (rule?.target_per_day ?? input.habit.target_per_day);
  const count = Math.max(0, input.count);
  const quantitative = target > 1;
  const state: HabitCheckInState = !actionable
    ? 'inactive'
    : count <= 0
      ? 'not_started'
      : count >= target
        ? 'complete'
        : 'in_progress';
  const dayPhrase = formatHabitCheckInDatePhrase(input.dateKey, input.todayKey);
  const scheduleLabel = formatHabitSchedule(rule?.weekdays ?? []);
  const reminder = parseHabitReminderTime(input.habit.reminder_time);
  const reminderLabel = reminder ? formatHabitReminderTime(reminder) : null;
  const streak = input.currentStreak ?? 0;
  const progress = `${input.habit.name}: ${count} of ${target} ${dayPhrase}`;
  const actionLabel = actionable
    ? quantitative
      ? `${progress}. Add one.`
      : count >= target
        ? `${progress}. Complete. Activate to undo.`
        : `${progress}. Check in.`
    : `${input.habit.name}: ${reasonSentence(blockReason ?? 'unscheduled', dayPhrase)}`;

  let secondaryLabel: string | null = null;
  if (quantitative) secondaryLabel = `${count} of ${target}`;
  else if (streak > 0) secondaryLabel = `Current streak ${streak}`;
  else if (state === 'complete') secondaryLabel = 'Complete';

  return {
    habitId: input.habit.id,
    name: input.habit.name,
    category: input.habit.category ?? 'anytime',
    count,
    target,
    quantitative,
    actionable,
    blockReason: actionable ? null : blockReason,
    state,
    tone: habitProgressTone(state),
    scheduleLabel,
    reminderLabel,
    currentStreak: streak,
    secondaryLabel,
    actionLabel,
    decrementLabel: `${input.habit.name}: remove one. ${count} of ${target} ${dayPhrase}.`,
    detailsLabel: `Open ${input.habit.name} details`,
  };
}

export function summarizeHabitsForDate(input: {
  habits: readonly Habit[];
  countsByHabitDate: Readonly<Record<string, Readonly<Record<string, number>>>>;
  dateKey: string;
  todayKey: string;
}): HabitDateSummary {
  let scheduledCount = 0;
  let completedCount = 0;
  for (const habit of input.habits) {
    if ((habit.status ?? 'active') !== 'active') continue;
    const creationKey = habitCreationDateKey(habit.created_at);
    if (
      !isHabitActionableOn(
        habit.rule_history,
        input.dateKey,
        habit.target_per_day,
        creationKey,
        habit.lifecycle_history,
      )
    ) {
      continue;
    }
    scheduledCount += 1;
    const target = getHabitTargetForDate(
      habit.rule_history,
      input.dateKey,
      habit.target_per_day,
      creationKey,
    );
    const count = input.countsByHabitDate[habit.id]?.[input.dateKey] ?? 0;
    if (count >= target) completedCount += 1;
  }
  const phrase = formatHabitCheckInDatePhrase(input.dateKey, input.todayKey);
  const label =
    scheduledCount === 0
      ? input.dateKey === input.todayKey
        ? 'Nothing scheduled today'
        : `Nothing scheduled ${phrase}`
      : input.dateKey === input.todayKey
        ? `${completedCount} of ${scheduledCount} done today`
        : `${completedCount} of ${scheduledCount} done ${phrase}`;
  return {
    dateKey: input.dateKey,
    isToday: input.dateKey === input.todayKey,
    scheduledCount,
    completedCount,
    label,
    accessibilityLabel:
      scheduledCount === 0
        ? label
        : `${label}. ${completedCount} of ${scheduledCount} scheduled habits complete.`,
  };
}

export function groupHabitCheckInRows(rows: readonly HabitCheckInRowModel[]): HabitCheckInGroup[] {
  return HABIT_TIME_GROUP_ORDER.map((key) => ({
    key,
    label: HABIT_TIME_GROUP_LABELS[key],
    rows: rows.filter((row) => row.category === key),
  })).filter((group) => group.rows.length > 0);
}
