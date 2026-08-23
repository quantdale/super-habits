import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WEEKLY_REVIEW_REMINDER,
  decodeWeeklyReviewReminderPreference,
  encodeWeeklyReviewReminderPreference,
  isValidWallClock,
  isValidWeekday,
  nextWeeklyOccurrence,
} from '@/features/weekly-review/weeklyReviewReminder.domain';

describe('weeklyReviewReminder.domain', () => {
  describe('nextWeeklyOccurrence', () => {
    it('returns the same day later time when it is still ahead', () => {
      // Wednesday 2026-08-19, 10:00 local.
      const now = new Date(2026, 7, 19, 10, 0, 0, 0);
      const next = nextWeeklyOccurrence(now, 3, 18 * 60 + 30);
      expect(next.getFullYear()).toBe(2026);
      expect(next.getMonth()).toBe(7);
      expect(next.getDate()).toBe(19);
      expect(next.getHours()).toBe(18);
      expect(next.getMinutes()).toBe(30);
      expect(next.getTime()).toBeGreaterThan(now.getTime());
    });

    it('rolls to the following week when the same-day slot already passed', () => {
      const now = new Date(2026, 7, 19, 19, 0, 0, 0);
      const next = nextWeeklyOccurrence(now, 3, 18 * 60 + 30);
      expect(next.getDate()).toBe(26); // Wednesday next week
      expect(next.getHours()).toBe(18);
    });

    it('lands on the requested weekday across month boundaries', () => {
      // Saturday 2026-08-01 → target Monday.
      const now = new Date(2026, 7, 1, 8, 0, 0, 0);
      const next = nextWeeklyOccurrence(now, 1, 9 * 60);
      expect(next.getMonth()).toBe(7);
      expect(next.getDate()).toBe(3); // Monday Aug 3
      expect(next.getDay()).toBe(1);
    });

    it('keeps the intended wall clock across a DST spring-forward week', () => {
      // America/New_York: DST starts Sun 2026-03-08; schedule Sundays 07:00.
      // Weekday math must land on the transition Sunday, and construction from
      // calendar parts keeps the 07:00 wall clock regardless of the host TZ
      // (hosts without DST cannot observe an offset change, so only parts are
      // asserted portably).
      const now = new Date(2026, 2, 5, 12, 0, 0, 0); // Thu Mar 5
      const next = nextWeeklyOccurrence(now, 0, 7 * 60);
      expect(next.getDate()).toBe(8); // the transition Sunday
      expect(next.getHours()).toBe(7);
      expect(next.getMinutes()).toBe(0);
      const following = nextWeeklyOccurrence(next, 0, 7 * 60);
      expect(following.getHours()).toBe(7);
      expect(following.getMinutes()).toBe(0);
      expect(following.getDay()).toBe(0);
    });

    it('throws for invalid inputs', () => {
      const now = new Date(2026, 7, 19, 10, 0, 0, 0);
      expect(() => nextWeeklyOccurrence(now, 7 as never, 600)).toThrow();
      expect(() => nextWeeklyOccurrence(now, 3, 1440)).toThrow();
      expect(() => nextWeeklyOccurrence(now, 3, -1)).toThrow();
    });
  });

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
