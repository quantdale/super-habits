import { describe, expect, it } from 'vitest';
import { didLocalDayRollOver } from '@/core/providers/DayRolloverProvider';

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
});
