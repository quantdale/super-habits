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

export function encodeWeeklyReviewReminderPreference(
  preference: WeeklyReviewReminderPreference,
): string {
  return JSON.stringify(preference);
}

/** The recoverable-payload shape carried inside backup settings snapshots. */
export interface RecoverableWeeklyReviewReminder {
  enabled: boolean;
  weekday: WeeklyReviewWeekday;
  hour: number;
  minute: number;
}

/**
 * Validate/normalize an untrusted recoverable payload field. Absent or
 * malformed input normalizes to null (the restore-apply layer then leaves the
 * local preference untouched), mirroring how sibling optional settings keys
 * behave in `normalizeRecoverableSettings`.
 */
export function normalizeRecoverableWeeklyReviewReminder(
  value: unknown,
): RecoverableWeeklyReviewReminder | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const weekday = candidate.weekday;
  const hour = candidate.hour;
  const minute = candidate.minute;
  if (!isValidWeekday(weekday) || typeof minute !== 'number' || !isValidWallClock(hour, minute)) {
    return null;
  }
  return {
    enabled: candidate.enabled === true,
    weekday,
    hour,
    minute,
  };
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
