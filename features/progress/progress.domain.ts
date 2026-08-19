import { toDateKey } from '@/lib/time';
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
 * 7 local days immediately before it.
 */
export function buildProgressDateRange(today: Date = new Date()): ProgressDateRange {
  const end = new Date(today);
  const currentStart = new Date(end);
  currentStart.setDate(currentStart.getDate() - (PROGRESS_WINDOW_DAYS - 1));

  const previousEndExclusive = new Date(currentStart);
  const previousStart = new Date(previousEndExclusive);
  previousStart.setDate(previousStart.getDate() - PROGRESS_WINDOW_DAYS);

  const currentStartKey = toDateKey(currentStart);
  const currentEndKey = toDateKey(end);
  const previousStartKey = toDateKey(previousStart);
  const previousEndKey = toDateKey(new Date(previousEndExclusive.getTime() - 1));

  // UTC ISO half-open bounds for timestamp columns.
  const currentStartUtc = new Date(currentStart);
  const currentEndUtc = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  const previousStartUtc = new Date(previousStart);
  const previousEndUtc = new Date(previousEndExclusive);

  return {
    currentStart: currentStartKey,
    currentEnd: currentEndKey,
    previousStart: previousStartKey,
    previousEnd: previousEndKey,
    currentStartUtcIso: currentStartUtc.toISOString(),
    currentEndUtcExclusiveIso: currentEndUtc.toISOString(),
    previousStartUtcIso: previousStartUtc.toISOString(),
    previousEndUtcExclusiveIso: previousEndUtc.toISOString(),
  };
}

export function makePeriodStat(current: number, previous: number): ProgressPeriodStat {
  return { current, previous, delta: current - previous };
}

export function pctDelta(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}
