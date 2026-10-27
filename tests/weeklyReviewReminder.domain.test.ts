import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WEEKLY_REVIEW_REMINDER,
  decodeWeeklyReviewReminderPreference,
  encodeWeeklyReviewReminderPreference,
  isValidWallClock,
  isValidWeekday,
} from '@/features/weekly-review/weeklyReviewReminder.domain';

describe('weeklyReviewReminder.domain', () => {
  describe('preference codec', () => {
    it('round-trips a valid preference', () => {
      const pref = { enabled: true, weekday: 3, hour: 8, minute: 45 } as const;
      const decoded = decodeWeeklyReviewReminderPreference(
        encodeWeeklyReviewReminderPreference(pref),
      );
      expect(decoded).toEqual(pref);
    });

    it('falls back to defaults for malformed payloads', () => {
      expect(decodeWeeklyReviewReminderPreference(null)).toEqual(DEFAULT_WEEKLY_REVIEW_REMINDER);
      expect(decodeWeeklyReviewReminderPreference('not json')).toEqual(
        DEFAULT_WEEKLY_REVIEW_REMINDER,
      );
      expect(decodeWeeklyReviewReminderPreference('"str"')).toEqual(DEFAULT_WEEKLY_REVIEW_REMINDER);
      expect(decodeWeeklyReviewReminderPreference('{"weekday":9,"hour":8,"minute":0}')).toEqual(
        DEFAULT_WEEKLY_REVIEW_REMINDER,
      );
      expect(decodeWeeklyReviewReminderPreference('{"weekday":1,"hour":25,"minute":0}')).toEqual(
        DEFAULT_WEEKLY_REVIEW_REMINDER,
      );
    });
  });

  describe('guards', () => {
    it('validates weekday and wall-clock ranges', () => {
      expect(isValidWeekday(0)).toBe(true);
      expect(isValidWeekday(6)).toBe(true);
      expect(isValidWeekday(7)).toBe(false);
      expect(isValidWeekday(-1)).toBe(false);
      expect(isValidWeekday(1.5)).toBe(false);
      expect(isValidWallClock(23, 59)).toBe(true);
      expect(isValidWallClock(24, 0)).toBe(false);
      expect(isValidWallClock(7, 60)).toBe(false);
    });
  });
});
