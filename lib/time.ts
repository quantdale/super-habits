export function nowIso(): string {
  return new Date().toISOString();
}

export function toDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
