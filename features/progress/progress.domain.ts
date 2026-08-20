import { dateKeyToLocalDate, getUtcIsoRangeForLocalDateKeys, toDateKey } from '@/lib/time';
import type { ProgressPeriodStat } from '@/features/progress/progress.types';

export const PROGRESS_WINDOW_DAYS = 7;

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
 * Compute deterministic local 7-day windows using sanctioned local-date helpers.
 * Current window is the last 7 inclusive local days; the previous window is the
 * 7 local days immediately before it. UTC bounds are half-open local-midnight
 * instants derived via getUtcIsoRangeForLocalDateKeys (DST-safe via setDate).
 */
export function buildProgressDateRange(today: Date = new Date()): ProgressDateRange {
  const todayKey = toDateKey(today);
  const todayMidnight = dateKeyToLocalDate(todayKey);

  const currentStartMidnight = new Date(todayMidnight);
  currentStartMidnight.setDate(todayMidnight.getDate() - (PROGRESS_WINDOW_DAYS - 1));

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
