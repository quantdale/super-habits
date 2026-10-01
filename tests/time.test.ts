import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDateRange,
  buildDateRangeOldestFirst,
  buildDateRangeTodayFirst,
  getUtcIsoRangeForLocalDateKeys,
  inclusiveWindowStartDateKey,
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
