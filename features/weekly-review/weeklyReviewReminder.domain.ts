/**
 * Pure scheduling/preference math for the weekly review reminder loop.
 *
 * No React, no DB, no notifications imports — everything here is unit-testable
 * and platform-independent. The native bridge lives in
 * `core/notifications/weeklyReviewReminderScheduler.ts`.
 */

/** Weekday follows the JS `Date.getDay()` convention: 0=Sunday … 6=Saturday. */
export type WeeklyReviewWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface WeeklyReviewReminderPreference {
  enabled: boolean;
  weekday: WeeklyReviewWeekday;
  /** 0–23 local wall-clock hour. */
  hour: number;
  /** 0–59 local wall-clock minute. */
  minute: number;
}

export const WEEKLY_REVIEW_REMINDER_STORAGE_KEY =
  'superhabits.notifications.weekly-review-reminder';

export const DEFAULT_WEEKLY_REVIEW_REMINDER: WeeklyReviewReminderPreference = {
  enabled: false,
  weekday: 0,
  hour: 18,
  minute: 0,
};

export function isValidWeekday(value: unknown): value is WeeklyReviewWeekday {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 6;
}

export function isValidWallClock(hour: unknown, minute: unknown): hour is number {
  return (
    typeof hour === 'number' &&
    Number.isInteger(hour) &&
    hour >= 0 &&
    hour <= 23 &&
    typeof minute === 'number' &&
    Number.isInteger(minute) &&
    minute >= 0 &&
    minute <= 59
  );
}

/**
 * The next occurrence of `weekday` at `minutesOfDay` (local wall-clock),
 * strictly after `now`. DST-safe by construction: candidates are built from
 * calendar parts (never millisecond arithmetic), so a spring-forward/fall-back
 * transition keeps the intended wall clock.
 */
export function nextWeeklyOccurrence(
  now: Date,
  weekday: WeeklyReviewWeekday,
  minutesOfDay: number,
): Date {
  if (!isValidWeekday(weekday)) {
    throw new Error(`Invalid weekday: ${String(weekday)}`);
  }
  if (!Number.isInteger(minutesOfDay) || minutesOfDay < 0 || minutesOfDay > 24 * 60 - 1) {
    throw new Error(`Invalid minutesOfDay: ${String(minutesOfDay)}`);
  }
  const hour = Math.floor(minutesOfDay / 60);
  const minute = minutesOfDay % 60;

  // Candidate this week at the target wall clock.
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0, 0);
  let deltaDays = (weekday - candidate.getDay() + 7) % 7;
  if (deltaDays === 0 && candidate.getTime() <= now.getTime()) {
    deltaDays = 7;
  }
  candidate.setDate(candidate.getDate() + deltaDays);
  return candidate;
}

export function encodeWeeklyReviewReminderPreference(
  preference: WeeklyReviewReminderPreference,
): string {
  return JSON.stringify(preference);
}

/** Malformed payloads fall back to the default instead of throwing. */
export function decodeWeeklyReviewReminderPreference(
  raw: string | null,
): WeeklyReviewReminderPreference {
  if (!raw) return { ...DEFAULT_WEEKLY_REVIEW_REMINDER };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return { ...DEFAULT_WEEKLY_REVIEW_REMINDER };
    }
    const obj = parsed as Record<string, unknown>;
    const weekday = obj.weekday;
    const hour = obj.hour;
    const minute = obj.minute;
    if (
      !isValidWeekday(weekday) ||
      typeof hour !== 'number' ||
      typeof minute !== 'number' ||
      !isValidWallClock(hour, minute)
    ) {
      return { ...DEFAULT_WEEKLY_REVIEW_REMINDER };
    }
    return {
      enabled: obj.enabled === true,
      weekday,
      hour,
      minute,
    };
  } catch {
    return { ...DEFAULT_WEEKLY_REVIEW_REMINDER };
  }
}
