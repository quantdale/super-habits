export function nowIso(): string {
  return new Date().toISOString();
}

export function toDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function dateKeyToLocalDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function timestampToLocalDateKey(timestamp: string): string {
  return toDateKey(new Date(timestamp));
}

/**
 * Convert a local-calendar date-key range into UTC ISO bounds for querying
 * UTC timestamp columns. Uses a half-open interval: [start, endExclusive).
 */
export function getUtcIsoRangeForLocalDateKeys(
  startDateKey: string,
  endDateKey: string,
): {
  startUtcIso: string;
  endUtcExclusiveIso: string;
} {
  const startLocal = dateKeyToLocalDate(startDateKey);
  const endExclusiveLocal = dateKeyToLocalDate(endDateKey);
  endExclusiveLocal.setDate(endExclusiveLocal.getDate() + 1);

  return {
    startUtcIso: startLocal.toISOString(),
    endUtcExclusiveIso: endExclusiveLocal.toISOString(),
  };
}

/**
 * Build an array of date keys (YYYY-MM-DD) for the last N days,
 * ordered oldest first (index 0 = N-1 days ago, last = today).
 *
 * Used by domain files for heatmap and activity data generation.
 * Centralized here to avoid duplication across domain files.
 */
export function buildDateRangeOldestFirst(days: number): string[] {
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push(toDateKey(d));
  }
  return result;
}

/**
 * Build an array of date keys ordered today-first
 * (index 0 = today, last = N-1 days ago).
 */
export function buildDateRangeTodayFirst(days: number): string[] {
  return buildDateRangeOldestFirst(days).reverse();
}

/** Local calendar keys for the last `days` days, **today first** (most recent → older). */
export function buildDateRange(days: number): string[] {
  return buildDateRangeTodayFirst(days);
}
