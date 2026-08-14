import type { Habit, HabitCompletion } from './types';
import {
  buildDayCompletions,
  calculateCurrentStreak,
  calculateLongestStreak,
  type DayCompletion,
} from './habits.domain';
import { dateKeyToLocalDate, timestampToLocalDateKey, toDateKey } from '@/lib/time';

export type HabitInsightWindowDays = 7 | 30 | 90;

export type HabitInsightRate = {
  windowDays: HabitInsightWindowDays;
  eligibleOccurrences: number;
  completedOccurrences: number;
  targetTotal: number;
  actualTotal: number;
  percentage: number | null;
};

export type HabitInsightTrendKind = 'improving' | 'steady' | 'declining' | 'insufficient_data';

export type HabitInsightTrend = {
  kind: HabitInsightTrendKind;
  recentRate: number | null;
  previousRate: number | null;
  eligibleOccurrences: number;
  previousEligibleOccurrences: number;
};

export type HabitProgressInsights = {
  currentStreak: number;
  longestStreak: number;
  totalEligibleOccurrences: number;
  totalCompletedOccurrences: number;
  totalTarget: number;
  totalActual: number;
  last7: HabitInsightRate;
  last30: HabitInsightRate;
  last90: HabitInsightRate;
  trend: HabitInsightTrend;
  recentDays: DayCompletion[];
};

const TREND_WINDOW_DAYS = 7;
const TREND_MINIMUM_OCCURRENCES = 2;
const TREND_DELTA_THRESHOLD = 10;

function creationDateKeyFromTimestamp(timestamp: string | undefined): string | undefined {
  if (!timestamp || Number.isNaN(new Date(timestamp).getTime())) return undefined;
  return timestampToLocalDateKey(timestamp);
}

function startDateKeyForWindow(endDateKey: string, windowDays: number): string {
  const start = dateKeyToLocalDate(endDateKey);
  start.setDate(start.getDate() - (windowDays - 1));
  return toDateKey(start);
}

function daysBetween(
  days: DayCompletion[],
  startDateKey: string,
  endDateKey: string,
): DayCompletion[] {
  return days.filter((day) => day.dateKey >= startDateKey && day.dateKey <= endDateKey);
}

function daysForTrailingWindow(
  days: DayCompletion[],
  todayKey: string,
  windowDays: number,
): DayCompletion[] {
  return daysBetween(days, startDateKeyForWindow(todayKey, windowDays), todayKey);
}

function calculateRate(
  days: DayCompletion[],
  windowDays: HabitInsightWindowDays,
): HabitInsightRate {
  const eligibleDays = days.filter((day) => day.scheduled && day.eligible);
  const completedOccurrences = eligibleDays.filter((day) => day.completed).length;
  const eligibleOccurrences = eligibleDays.length;
  return {
    windowDays,
    eligibleOccurrences,
    completedOccurrences,
    targetTotal: eligibleDays.reduce((total, day) => total + day.targetPerDay, 0),
    actualTotal: eligibleDays.reduce((total, day) => total + day.count, 0),
    percentage:
      eligibleOccurrences === 0
        ? null
        : Math.round((completedOccurrences / eligibleOccurrences) * 100),
  };
}

function calculateTrend(days: DayCompletion[], todayKey: string): HabitInsightTrend {
  const recentStart = startDateKeyForWindow(todayKey, TREND_WINDOW_DAYS);
  const previousEndDate = dateKeyToLocalDate(recentStart);
  previousEndDate.setDate(previousEndDate.getDate() - 1);
  const previousEnd = toDateKey(previousEndDate);
  const previousStart = startDateKeyForWindow(previousEnd, TREND_WINDOW_DAYS);
  const recentDays = daysBetween(days, recentStart, todayKey);
  const previousDays = daysBetween(days, previousStart, previousEnd);
  const recentRate = calculateRate(recentDays, 7);
  const previousRate = calculateRate(previousDays, 7);
  const hasEnoughEvidence =
    recentRate.eligibleOccurrences >= TREND_MINIMUM_OCCURRENCES &&
    previousRate.eligibleOccurrences >= TREND_MINIMUM_OCCURRENCES;
  const delta =
    recentRate.percentage !== null && previousRate.percentage !== null
      ? recentRate.percentage - previousRate.percentage
      : null;

  return {
    kind: !hasEnoughEvidence
      ? 'insufficient_data'
      : delta !== null && delta >= TREND_DELTA_THRESHOLD
        ? 'improving'
        : delta !== null && delta <= -TREND_DELTA_THRESHOLD
          ? 'declining'
          : 'steady',
    recentRate: recentRate.percentage,
    previousRate: previousRate.percentage,
    eligibleOccurrences: recentRate.eligibleOccurrences,
    previousEligibleOccurrences: previousRate.eligibleOccurrences,
  };
}

/**
 * Calculate all per-habit progress metrics from one canonical Habit Engine
 * day history. The explicit date key keeps the calculation deterministic and
 * makes local timezone boundaries testable without changing production time.
 */
export function calculateHabitProgressInsights(
  habit: Habit,
  completions: Pick<HabitCompletion, 'date_key' | 'count'>[],
  todayKey = toDateKey(),
): HabitProgressInsights | null {
  if (habit.deleted_at !== null) return null;

  const creationDateKey = creationDateKeyFromTimestamp(habit.created_at);
  const days = buildDayCompletions(
    completions,
    habit.target_per_day,
    undefined,
    habit.rule_history,
    creationDateKey,
    todayKey,
  );
  const last7Days = daysForTrailingWindow(days, todayKey, 7);
  const last30Days = daysForTrailingWindow(days, todayKey, 30);
  const last90Days = daysForTrailingWindow(days, todayKey, 90);
  const eligibleDays = days.filter((day) => day.scheduled && day.eligible);

  return {
    currentStreak: calculateCurrentStreak(days, todayKey),
    longestStreak: calculateLongestStreak(days),
    totalEligibleOccurrences: eligibleDays.length,
    totalCompletedOccurrences: eligibleDays.filter((day) => day.completed).length,
    totalTarget: eligibleDays.reduce((total, day) => total + day.targetPerDay, 0),
    totalActual: eligibleDays.reduce((total, day) => total + day.count, 0),
    last7: calculateRate(last7Days, 7),
    last30: calculateRate(last30Days, 30),
    last90: calculateRate(last90Days, 90),
    trend: calculateTrend(days, todayKey),
    recentDays: days.slice(-30),
  };
}
