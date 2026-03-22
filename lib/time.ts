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
 * Returns an array of YYYY-MM-DD keys, newest first (today first).
 * Length equals `days`.
 */
export function buildDateRange(days: number): string[] {
  const result: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push(toDateKey(d));
  }
  return result;
}

/**
 * Returns an array of YYYY-MM-DD keys, oldest first (today last).
 * Length equals `days`.
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
