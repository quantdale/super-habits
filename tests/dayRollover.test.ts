import { describe, expect, it } from 'vitest';
import {
  didLocalDayRollOver,
  getMillisecondsUntilNextLocalMidnight,
  getNextLocalMidnight,
} from '@/core/providers/dayRollover';

describe('day rollover detection', () => {
  it('detects a local calendar-day boundary', () => {
    expect(didLocalDayRollOver('2026-08-03', '2026-08-04')).toBe(true);
  });

  it('does not bump for same-day checks or repeated visibility events', () => {
    expect(didLocalDayRollOver('2026-08-03', '2026-08-03')).toBe(false);
  });

  it('treats each new day as a single monotonic transition', () => {
    let generation = 0;
    let lastDay = '2026-08-03';
    for (const day of ['2026-08-03', '2026-08-04', '2026-08-04', '2026-08-05']) {
      if (didLocalDayRollOver(lastDay, day)) {
        lastDay = day;
        generation += 1;
      }
    }
    expect(generation).toBe(2);
    expect(lastDay).toBe('2026-08-05');
  });

  it('schedules the next local midnight without a one-second polling interval', () => {
    const now = new Date(2026, 7, 14, 23, 59, 30, 0);
    const next = getNextLocalMidnight(now);
    expect(next.getHours()).toBe(0);
    expect(next.getDate()).toBe(15);
    expect(getMillisecondsUntilNextLocalMidnight(now)).toBe(30_000);
  });

  it('handles a check exactly at midnight by scheduling the following boundary', () => {
    const now = new Date(2026, 7, 15, 0, 0, 0, 0);
    expect(getNextLocalMidnight(now).getDate()).toBe(16);
    expect(getMillisecondsUntilNextLocalMidnight(now)).toBe(24 * 60 * 60 * 1000);
  });
});
