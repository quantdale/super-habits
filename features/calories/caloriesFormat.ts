import { addLocalDays, toDateKey } from '@/lib/time';

/** Locale-formatted kcal/secondary metric for the Calories surfaces. */
export function formatKcal(kcal: number): string {
  if (!Number.isFinite(kcal)) return '0';
  return Math.round(kcal).toLocaleString('en-US');
}

/** Whole-gram display for macro sums (raw float adds like 0.1 + 0.2 must not render). */
export function formatGrams(grams: number): string {
  if (!Number.isFinite(grams)) return '0';
  return String(Math.round(grams));
}

/** "Today" / "Yesterday" / "Mon, Oct 5" for the hero's context line. */
export function formatDayContext(dateKey: string, today: Date = new Date()): string {
  const todayKey = toDateKey(today);
  if (dateKey === todayKey) return 'Today';
  // Calendar-day math, not a fixed millisecond subtraction: a fall-back day is
  // 25 hours long, so `setDate(-1)` walking is the only way to name the local
  // day before `today` in every zone.
  if (dateKey === addLocalDays(todayKey, -1)) return 'Yesterday';
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Long-form day label: "Monday, October 12". */
export function formatDayContextLabel(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}
