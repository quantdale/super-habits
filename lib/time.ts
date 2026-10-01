export function nowIso(): string {
  return new Date().toISOString();
}

export const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateKey(value: string): boolean {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
  return (
    dt.getFullYear() === y &&
    dt.getMonth() === m - 1 &&
    dt.getDate() === d &&
    toDateKey(dt) === value
  );
}

export function toDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dateKeyToLocalDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
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
 * Local-calendar date key for the inclusive START of a "last N local days"
 * window that ends on `reference`'s local day (default: now).
 *
 * Walks calendar days with `setDate` — never a fixed millisecond count — so the
 * window spans exactly N local days even when it crosses a daylight-saving
 * boundary: a spring-forward local day is 23 hours long and a fall-back day is
 * 25, so `now - (N-1) * 86_400_000` lands a different calendar day from the one
 * intended and every inclusive lower bound silently spans N+1 (or N-1) days.
 * The archived productivity-expansion design note
 * (`openspec/changes/archive/2026-08-30-harden-productivity-expansion-wave-v1/design.md`)
 * records that rule against blind `24 * 60 * 60 * 1000` window arithmetic.
 *
 * Pass an explicit `reference` (from the `nowIso()` seam) to keep a read path
 * deterministic under a seeded fixture.
 */
export function inclusiveWindowStartDateKey(days: number, reference: Date = new Date()): string {
  const start = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
  start.setDate(start.getDate() - (days - 1));
  return toDateKey(start);
}

/**
 * Build an array of date keys (YYYY-MM-DD) for the last N days,
 * ordered oldest first (index 0 = N-1 days ago, last = today).
 *
 * Used by domain files for heatmap and activity data generation.
 * Centralized here to avoid duplication across domain files.
 *
 * `reference` defaults to now; the walk is the same local-calendar arithmetic
 * `inclusiveWindowStartDateKey` uses, so index 0 is that function's answer.
 */
export function buildDateRangeOldestFirst(days: number, reference: Date = new Date()): string[] {
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());
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
