import type { Habit } from '@/features/habits/types';
import type { HabitDayStripDay } from '@/features/habits/HabitDayStrip';
import {
  getHabitTargetForDate,
  isHabitScheduledOn,
  parseHabitRuleHistory,
  type HabitRule,
} from '@/features/habits/habits.domain';
import { toDateKey } from '@/lib/time';

/**
 * Pure derivations behind the Habits surface's header and day strip.
 *
 * Why this module exists: `HabitsScreen` used to compute these on every render.
 * `activeHabits` had a fresh array identity each render, so the `stripDays` memo
 * (whose dependency was that array) recomputed on every render — and each of its
 * 7 × H iterations re-parsed the habit's rule history. Both aggregates are pure
 * functions of the data, so they live here and are computed once per data change
 * by the screen's memos.
 *
 * No behaviour change: the scheduled/completed definitions, the 7-day window,
 * and the row ordering are exactly what the screen computed inline.
 */

const STRIP_WEEKDAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/** Days shown in the strip, oldest first, ending at `today`. */
export const HABIT_STRIP_DAYS = 7;

/** Counts of habits (by id) that have a completion row for a date key. */
export type HabitCompletionCounts = Record<string, Record<string, number>>;

/**
 * Parse each active habit's rule history ONCE. The day loop reads this map
 * instead of re-parsing JSON per habit per day, and it is memoized on the active
 * list so a re-render with unchanged data parses nothing.
 */
export function buildHabitRuleHistoryIndex(
  activeHabits: readonly Habit[],
): Map<string, HabitRule[]> {
  const index = new Map<string, HabitRule[]>();
  for (const habit of activeHabits) {
    index.set(habit.id, parseHabitRuleHistory(habit.rule_history));
  }
  return index;
}

export type HabitTodaySummary = {
  scheduledTodayCount: number;
  completedTodayCount: number;
  todayProgress: number | null;
};

/**
 * Today's scheduled/completed counts over durable-active habits. Paused or
 * archived habits carry no obligation today, so they never enter either
 * denominator (F1).
 */
export function summarizeHabitsToday(input: {
  activeHabits: readonly Habit[];
  ruleHistoryById: ReadonlyMap<string, HabitRule[]>;
  countsByHabitDate: HabitCompletionCounts;
  todayKey: string;
}): HabitTodaySummary {
  let scheduledTodayCount = 0;
  let completedTodayCount = 0;

  for (const habit of input.activeHabits) {
    const history = input.ruleHistoryById.get(habit.id);
    if (!isHabitScheduledOn(history, input.todayKey, habit.target_per_day)) continue;
    scheduledTodayCount += 1;
    const completed = input.countsByHabitDate[habit.id]?.[input.todayKey] ?? 0;
    if (completed >= habit.target_per_day) completedTodayCount += 1;
  }

  return {
    scheduledTodayCount,
    completedTodayCount,
    todayProgress:
      scheduledTodayCount === 0
        ? null
        : Math.round((completedTodayCount / scheduledTodayCount) * 100),
  };
}

/**
 * The last `HABIT_STRIP_DAYS` local days ending at `today` (today anchored
 * last), with per-day scheduled/completed aggregates over durable-active habits
 * only. `today` is injectable so the window is deterministic under a seeded
 * corpus.
 */
export function buildHabitDayStrip(input: {
  activeHabits: readonly Habit[];
  ruleHistoryById: ReadonlyMap<string, HabitRule[]>;
  countsByHabitDate: HabitCompletionCounts;
  today: Date;
}): HabitDayStripDay[] {
  const strip: HabitDayStripDay[] = [];
  const todayKey = toDateKey(input.today);

  for (let offset = HABIT_STRIP_DAYS - 1; offset >= 0; offset -= 1) {
    const day = new Date(input.today);
    day.setDate(day.getDate() - offset);
    const dateKey = toDateKey(day);
    let scheduledCount = 0;
    let completedCount = 0;

    for (const habit of input.activeHabits) {
      const history = input.ruleHistoryById.get(habit.id);
      if (!isHabitScheduledOn(history, dateKey, habit.target_per_day)) continue;
      scheduledCount += 1;
      const target = getHabitTargetForDate(history, dateKey, habit.target_per_day);
      const completed = input.countsByHabitDate[habit.id]?.[dateKey] ?? 0;
      if (completed >= target) completedCount += 1;
    }

    strip.push({
      dateKey,
      weekdayLabel: STRIP_WEEKDAY_LETTERS[(day.getDay() === 0 ? 7 : day.getDay()) - 1],
      dayOfMonth: String(day.getDate()),
      scheduledCount,
      completedCount,
    });
  }

  // The strip always ends on the caller's today, inclusive.
  expectEndsOnToday(strip, todayKey);
  return strip;
}

function expectEndsOnToday(strip: HabitDayStripDay[], todayKey: string): void {
  if (strip.length > 0 && strip[strip.length - 1].dateKey !== todayKey) {
    throw new Error('habit day strip must end on the reference day');
  }
}
