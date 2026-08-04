/**
 * Controllable clock backing the fixture seeders (task 2.11).
 *
 * The seeders must call the REAL data-layer functions with an injected clock,
 * because the data layers derive every timestamp/date key from `nowIso()` and
 * `toDateKey()` in `lib/time.ts`. `vi.mock('@/lib/time')` (registered in
 * `seeders.ts`) routes those two functions through this module:
 *
 * - `nowIso()`        → `clock.nowIso()`   (the clock's current instant)
 * - `toDateKey(date?)` → `clock.toDateKey(date)` (local-calendar key, same
 *   semantics as the real implementation)
 *
 * All other `lib/time` exports stay real (spread through in the mock), so
 * helper functions like `getUtcIsoRangeForLocalDateKeys` are untouched.
 *
 * ## State lifecycle
 *
 * The clock's state lives at module scope, so `vi.resetModules()` re-importing
 * this module yields a fresh clock. The fixture seeders run
 * `vi.resetModules()` once at the start and then `await import('./clock')` —
 * the seeders and the `lib/time` mock factory resolve the SAME module entry,
 * so they share state and the injected time is visible to every data-layer
 * call during seeding. NEVER call `vi.resetModules()` mid-seed, or the mock
 * factory would pick up a different clock instance.
 *
 * `clock.setLocalDateTime` interprets values in the process's LOCAL calendar
 * day (like the real `toDateKey`), so seeds produce consistent date keys under
 * any `TZ`.
 */

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

let current: Date = new Date(2026, 0, 1, 12, 0, 0, 0);

export const clock = {
  /** A copy of the clock's current instant. */
  now(): Date {
    return new Date(current);
  },

  /** UTC ISO string for the clock's current instant (like `new Date().toISOString()`). */
  nowIso(): string {
    return current.toISOString();
  },

  /** Local-calendar `YYYY-MM-DD` for the given date, or the clock's current instant. */
  toDateKey(date?: Date): string {
    return localDateKey(date ?? current);
  },

  /** Sets the clock to an explicit instant. */
  set(date: Date): void {
    current = new Date(date);
  },

  /** Sets the clock to a LOCAL calendar date/time (month is 1-based). */
  setLocalDateTime(year: number, month: number, day: number, hour = 12, minute = 0): void {
    current = new Date(year, month - 1, day, hour, minute, 0, 0);
  },

  /** Advances the clock by whole days, keeping the time-of-day (uses local calendar arithmetic). */
  advanceDays(days: number): void {
    current.setDate(current.getDate() + days);
  },

  /** Advances the clock by minutes. */
  advanceMinutes(minutes: number): void {
    current = new Date(current.getTime() + minutes * 60_000);
  },
};
