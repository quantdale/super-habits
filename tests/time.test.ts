import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addLocalDays,
  buildDateRange,
  buildDateRangeOldestFirst,
  buildDateRangeTodayFirst,
  diffLocalDays,
  getUtcIsoRangeForLocalDateKeys,
  inclusiveWindowStartDateKey,
  parseLocalDateKey,
  timestampToLocalDateKey,
  toDateKey,
} from '@/lib/time';

describe('buildDateRange / buildDateRangeTodayFirst', () => {
  it('returns today first then older days', () => {
    const today = toDateKey();
    const range = buildDateRange(3);
    expect(range).toHaveLength(3);
    expect(range[0]).toBe(today);
    const y = new Date();
    y.setDate(y.getDate() - 1);
    expect(range[1]).toBe(toDateKey(y));
  });

  it('buildDateRange matches buildDateRangeTodayFirst', () => {
    expect(buildDateRangeTodayFirst(5)).toEqual(buildDateRange(5));
  });
});

describe('buildDateRangeOldestFirst', () => {
  it('returns oldest day first and today last', () => {
    const range = buildDateRangeOldestFirst(3);
    expect(range).toHaveLength(3);
    const oldest = new Date();
    oldest.setDate(oldest.getDate() - 2);
    expect(range[0]).toBe(toDateKey(oldest));
    expect(range[2]).toBe(toDateKey());
  });
});

describe('local day UTC range helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 2, 12, 0, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('round-trips a just-after-midnight local timestamp into the same date key window', () => {
    const justAfterMidnight = new Date(2026, 0, 2, 0, 30, 0, 0);
    const timestamp = justAfterMidnight.toISOString();
    const dateKey = timestampToLocalDateKey(timestamp);
    const { startUtcIso, endUtcExclusiveIso } = getUtcIsoRangeForLocalDateKeys(dateKey, dateKey);

    expect(dateKey).toBe('2026-01-02');
    expect(startUtcIso <= timestamp).toBe(true);
    expect(timestamp < endUtcExclusiveIso).toBe(true);
  });

  it('uses the next local midnight as the exclusive upper bound', () => {
    const { startUtcIso, endUtcExclusiveIso } = getUtcIsoRangeForLocalDateKeys(
      '2026-01-02',
      '2026-01-02',
    );

    expect(startUtcIso).toBe(new Date(2026, 0, 2, 0, 0, 0, 0).toISOString());
    expect(endUtcExclusiveIso).toBe(new Date(2026, 0, 3, 0, 0, 0, 0).toISOString());
    expect(new Date(2026, 0, 2, 23, 59, 59, 999).toISOString() < endUtcExclusiveIso).toBe(true);
    expect(new Date(2026, 0, 3, 0, 0, 0, 0).toISOString() < endUtcExclusiveIso).toBe(false);
  });
});

/**
 * Inclusive "last N local days" window starts. The repo forbids blind
 * `24 * 60 * 60 * 1000` window arithmetic (archived productivity-expansion
 * design note), because a DST boundary inside the window shifts the computed
 * start onto the wrong calendar day and every inclusive lower bound then spans
 * N+1 (or N-1) local days.
 *
 * These run under a forced America/New_York, whose spring-forward day is 23 h
 * long and whose fall-back day is 25 h. Same technique as
 * `tests/calories.domain.test.ts`'s DST block: Node re-reads `process.env.TZ`
 * per Date operation, so the assertion below proves the zone applied.
 */
describe('inclusiveWindowStartDateKey at DST boundaries (forced America/New_York)', () => {
  const previousTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = 'America/New_York';
  });

  afterEach(() => {
    if (previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = previousTz;
  });

  it('the forced zone really is DST-observing on this Node', () => {
    // Mar 8 2026 is the US spring-forward (02:00 EST -> 03:00 EDT).
    expect(new Date('2026-03-08T12:00:00Z').getTimezoneOffset()).toBe(240); // EDT, UTC-4
    // Nov 1 2026 is the fall-back (02:00 EDT -> 01:00 EST).
    expect(new Date('2026-11-01T12:00:00Z').getTimezoneOffset()).toBe(300); // EST, UTC-5
  });

  it('crosses a spring-forward boundary without shifting the calendar start', () => {
    // 00:30 local on Mar 9 — the morning after the 23-hour day. The
    // fixed-millisecond answer would be 2026-02-07, one day too early.
    const reference = new Date('2026-03-09T04:30:00Z');
    expect(toDateKey(reference)).toBe('2026-03-09');

    expect(inclusiveWindowStartDateKey(30, reference)).toBe('2026-02-08');
    expect(inclusiveWindowStartDateKey(7, reference)).toBe('2026-03-03');
    expect(inclusiveWindowStartDateKey(1, reference)).toBe('2026-03-09');

    // Exactly 30 local days span the window, inclusive of the end day.
    expect(localDaysBetween('2026-02-08', '2026-03-09')).toBe(29);
  });

  it('crosses a fall-back boundary without shifting the calendar start', () => {
    // 00:30 local on Nov 2 — the morning after the 25-hour day. A reference
    // late in that local day is the case fixed-millisecond arithmetic loses.
    const reference = new Date('2026-11-02T05:30:00Z');
    expect(toDateKey(reference)).toBe('2026-11-02');

    expect(inclusiveWindowStartDateKey(30, reference)).toBe('2026-10-04');
    expect(inclusiveWindowStartDateKey(7, reference)).toBe('2026-10-27');

    // Late-evening reference: the 25-hour day pushes a fixed-millisecond start
    // forward across midnight, silently dropping a day from the window.
    const lateEvening = new Date('2026-11-02T23:30:00-05:00');
    expect(inclusiveWindowStartDateKey(30, lateEvening)).toBe('2026-10-04');
    expect(localDaysBetween('2026-10-04', '2026-11-02')).toBe(29);
  });

  it('matches the previous fixed-millisecond arithmetic on an ordinary-length day', () => {
    const reference = new Date('2026-06-15T13:00:00Z');
    for (const days of [1, 7, 14, 30, 365]) {
      const legacy = toDateKey(new Date(reference.getTime() - (days - 1) * 86_400_000));
      expect(inclusiveWindowStartDateKey(days, reference)).toBe(legacy);
    }
  });

  it('buildDateRangeOldestFirst accepts an injected reference and agrees with the window start', () => {
    const reference = new Date('2026-03-09T04:30:00Z');
    const range = buildDateRangeOldestFirst(30, reference);
    expect(range).toHaveLength(30);
    expect(range[0]).toBe(inclusiveWindowStartDateKey(30, reference));
    expect(range[29]).toBe('2026-03-09');
    // Existing callers keep the "now" default behaviour.
    expect(buildDateRangeOldestFirst(3)[2]).toBe(toDateKey());
  });
});

/** Whole local calendar days between two date keys (inclusive count - 1). */
function localDaysBetween(startKey: string, endKey: string): number {
  const [sy, sm, sd] = startKey.split('-').map(Number);
  const [ey, em, ed] = endKey.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/**
 * The shared local-day utility (audit C #9): ONE local parser, ONE day adder,
 * ONE calendar-day differ. Every assertion here is a property the duplicated
 * builders and the `Math.round(diff / 86_400_000)` helpers could not hold.
 */
describe('parseLocalDateKey', () => {
  it('names the local calendar day of an instant (not the UTC one)', () => {
    // 23:30 local on Jan 31 — a UTC key would already be the next month for
    // any negative offset, so this is the case `toISOString().slice(0, 10)`
    // gets wrong.
    const lateEvening = new Date(2026, 0, 31, 23, 30, 0, 0);
    expect(toDateKey(lateEvening)).toBe('2026-01-31');
    expect(parseLocalDateKey(toDateKey(lateEvening))).toEqual(new Date(2026, 0, 31, 0, 0, 0, 0));
  });

  it('parseLocalDateKey returns LOCAL midnight, not UTC midnight', () => {
    const parsed = parseLocalDateKey('2026-03-04');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(2);
    expect(parsed.getDate()).toBe(4);
    expect(parsed.getHours()).toBe(0);
    expect(parsed.getMinutes()).toBe(0);
    expect(parsed.getTime()).toBe(new Date(2026, 2, 4, 0, 0, 0, 0).getTime());
    // The bug this replaces: ECMA-262 parses date-only strings as UTC.
    expect(parsed.getTime()).not.toBe(Date.parse('2026-03-04'));
  });

  it('parseLocalDateKey round-trips every day of a leap year without drift', () => {
    const days = buildDateRangeOldestFirst(366, new Date(2028, 11, 31, 12));
    for (const dateKey of days) expect(toDateKey(parseLocalDateKey(dateKey))).toBe(dateKey);
    expect(days).toContain('2028-02-29');
  });

  it('parseLocalDateKey rejects malformed and non-existent days', () => {
    for (const bad of [
      '',
      '2026-3-4',
      '2026-13-01',
      '2026-02-30',
      'today',
      '2026-03-04T00:00:00',
    ]) {
      expect(() => parseLocalDateKey(bad)).toThrow(RangeError);
    }
  });
});

describe('addLocalDays', () => {
  it('walks calendar days across month and year boundaries', () => {
    expect(addLocalDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addLocalDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addLocalDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addLocalDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(addLocalDays('2026-06-15', 0)).toBe('2026-06-15');
  });
});

describe('diffLocalDays', () => {
  it('counts whole local calendar days, signed', () => {
    expect(diffLocalDays('2026-03-04', '2026-03-04')).toBe(0);
    expect(diffLocalDays('2026-03-04', '2026-03-05')).toBe(1);
    expect(diffLocalDays('2026-03-05', '2026-03-04')).toBe(-1);
    expect(diffLocalDays('2026-02-28', '2026-03-01')).toBe(1);
    expect(diffLocalDays('2026-01-01', '2026-12-31')).toBe(364);
  });

  it('agrees with addLocalDays over a full year', () => {
    for (let offset = -400; offset <= 400; offset += 7) {
      expect(diffLocalDays('2026-06-15', addLocalDays('2026-06-15', offset))).toBe(offset);
    }
  });
});

/**
 * DST correctness for the shared utility. Forced America/New_York, whose
 * spring-forward day is 23 h and fall-back day 25 h — the two lengths where
 * `Math.round(ms / 86_400_000)` stops counting calendar days.
 */
describe('DST boundaries (forced America/New_York)', () => {
  const previousTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = 'America/New_York';
  });

  afterEach(() => {
    if (previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = previousTz;
  });

  it('parseLocalDateKey lands on local midnight on both DST days', () => {
    // Spring forward: 2026-03-08 is 23 h long, local midnight still exists.
    const spring = parseLocalDateKey('2026-03-08');
    expect(spring.getDate()).toBe(8);
    expect(spring.getHours()).toBe(0);
    // Fall back: 2026-11-01 is 25 h long.
    const fall = parseLocalDateKey('2026-11-01');
    expect(fall.getDate()).toBe(1);
    expect(fall.getHours()).toBe(0);
  });

  it('diffLocalDays reports 1 between the two sides of a DST day', () => {
    // The exact case `Math.round(diff / 86_400_000)` gets wrong on the
    // 23-hour spring-forward day: 0.958 rounds UP to 1 for the SAME day.
    expect(diffLocalDays('2026-03-08', '2026-03-09')).toBe(1);
    expect(diffLocalDays('2026-03-07', '2026-03-08')).toBe(1);
    // A 23-hour span never survives as 0 days.
    expect(diffLocalDays('2026-03-08', '2026-03-08')).toBe(0);
    // Fall back: the 25-hour day is still exactly one calendar day.
    expect(diffLocalDays('2026-11-01', '2026-11-02')).toBe(1);
    expect(diffLocalDays('2026-10-31', '2026-11-01')).toBe(1);
  });

  it('addLocalDays never repeats or skips a key across a DST boundary', () => {
    const keys: string[] = [];
    let cursor = '2026-03-06';
    for (let i = 0; i < 6; i += 1) {
      keys.push(cursor);
      cursor = addLocalDays(cursor, 1);
    }
    expect(keys).toEqual([
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
      '2026-03-10',
      '2026-03-11',
    ]);

    const fallKeys: string[] = [];
    let fallCursor = '2026-10-30';
    for (let i = 0; i < 5; i += 1) {
      fallKeys.push(fallCursor);
      fallCursor = addLocalDays(fallCursor, 1);
    }
    expect(fallKeys).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ]);
  });
});
