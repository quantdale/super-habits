import { dateKeyToLocalDate, getUtcIsoRangeForLocalDateKeys, toDateKey } from '@/lib/time';
import type { ProgressPeriodStat } from '@/features/progress/progress.types';

export const PROGRESS_WINDOW_DAYS = 7;

/** Selectable insight windows, in local days. */
export const PROGRESS_WINDOW_OPTIONS = [7, 30, 90] as const;
export type ProgressWindowDays = (typeof PROGRESS_WINDOW_OPTIONS)[number];

export type TrendDirection = 'up' | 'down' | 'flat';

/**
 * Plain directional trend vs the previous window. No composite scoring: a
 * metric is "up" only when it strictly increased, "down" only when it
 * strictly decreased.
 */
export function trendOf(current: number, previous: number): TrendDirection {
  if (current > previous) return 'up';
  if (current < previous) return 'down';
  return 'flat';
}

export type ProgressDateRange = {
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
  /** UTC ISO bounds for the current window (half-open). */
  currentStartUtcIso: string;
  currentEndUtcExclusiveIso: string;
  /** UTC ISO bounds for the prior window (half-open). */
  previousStartUtcIso: string;
  previousEndUtcExclusiveIso: string;
};

/**
 * Compute deterministic local N-day windows using sanctioned local-date
 * helpers. Current window is the last `windowDays` inclusive local days; the
 * previous window is the same number of local days immediately before it.
 * UTC bounds are half-open local-midnight instants derived via
 * getUtcIsoRangeForLocalDateKeys (DST-safe via setDate).
 */
export function buildProgressDateRange(
  today: Date = new Date(),
  windowDays: number = PROGRESS_WINDOW_DAYS,
): ProgressDateRange {
  const days = Math.max(1, Math.floor(windowDays));
  const todayKey = toDateKey(today);
  const todayMidnight = dateKeyToLocalDate(todayKey);

  const currentStartMidnight = new Date(todayMidnight);
  currentStartMidnight.setDate(todayMidnight.getDate() - (days - 1));

  const currentStartKey = toDateKey(currentStartMidnight);
  const currentEndKey = todayKey;

  const previousEndExclusiveMidnight = new Date(currentStartMidnight);
  const previousStartMidnight = new Date(previousEndExclusiveMidnight);
  previousStartMidnight.setDate(previousEndExclusiveMidnight.getDate() - PROGRESS_WINDOW_DAYS);
  const previousStartKey = toDateKey(previousStartMidnight);
  const previousEndMidnight = new Date(previousEndExclusiveMidnight);
  previousEndMidnight.setDate(previousEndExclusiveMidnight.getDate() - 1);
  const previousEndKey = toDateKey(previousEndMidnight);

  const currentUtc = getUtcIsoRangeForLocalDateKeys(currentStartKey, currentEndKey);
  const previousUtc = getUtcIsoRangeForLocalDateKeys(previousStartKey, previousEndKey);

  return {
    currentStart: currentStartKey,
    currentEnd: currentEndKey,
    previousStart: previousStartKey,
    previousEnd: previousEndKey,
    currentStartUtcIso: currentUtc.startUtcIso,
    currentEndUtcExclusiveIso: currentUtc.endUtcExclusiveIso,
    previousStartUtcIso: previousUtc.startUtcIso,
    previousEndUtcExclusiveIso: previousUtc.endUtcExclusiveIso,
  };
}

export function makePeriodStat(current: number, previous: number): ProgressPeriodStat {
  return { current, previous, delta: current - previous };
}

export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}
