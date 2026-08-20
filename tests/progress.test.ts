import { describe, expect, it } from 'vitest';
import {
  buildProgressDateRange,
  makePeriodStat,
  pctDelta,
  PROGRESS_WINDOW_OPTIONS,
  trendOf,
} from '@/features/progress/progress.domain';

describe('buildProgressDateRange', () => {
  it('defaults to a 7-day current window and a 7-day prior window', () => {
    const range = buildProgressDateRange(new Date('2026-08-20T15:00:00'));
    expect(range.currentEnd).toBe('2026-08-20');
    expect(range.currentStart).toBe('2026-08-14');
    expect(range.previousEnd).toBe('2026-08-13');
    expect(range.previousStart).toBe('2026-08-07');
  });

  it('supports 30-day windows', () => {
    const range = buildProgressDateRange(new Date('2026-08-20T15:00:00'), 30);
    expect(range.currentStart).toBe('2026-07-22');
    expect(range.currentEnd).toBe('2026-08-20');
    expect(range.previousStart).toBe('2026-06-22');
    expect(range.previousEnd).toBe('2026-07-21');
  });

  it('supports 90-day windows across year boundaries', () => {
    const range = buildProgressDateRange(new Date('2026-01-10T15:00:00'), 90);
    expect(range.currentStart).toBe('2025-10-13');
    expect(range.previousEnd).toBe('2025-10-12');
    expect(range.previousStart).toBe('2025-07-15');
  });

  it('produces half-open UTC bounds consistent with the local date keys', () => {
    const range = buildProgressDateRange(new Date('2026-08-20T15:00:00'), 7);
    expect(range.currentStartUtcIso < range.currentEndUtcExclusiveIso).toBe(true);
    expect(range.previousStartUtcIso < range.previousEndUtcExclusiveIso).toBe(true);
    // Windows are adjacent: previous end == current start.
    expect(range.previousEndUtcExclusiveIso).toBe(range.currentStartUtcIso);
  });

  it('clamps non-positive window sizes to a single day', () => {
    const range = buildProgressDateRange(new Date('2026-08-20T15:00:00'), -3);
    expect(range.currentStart).toBe('2026-08-20');
    expect(range.previousStart).toBe('2026-08-19');
  });
});

describe('trendOf', () => {
  it('reports strict increase as up', () => {
    expect(trendOf(5, 4)).toBe('up');
  });

  it('reports strict decrease as down', () => {
    expect(trendOf(3, 4)).toBe('down');
  });

  it('reports equality as flat, including zero vs zero', () => {
    expect(trendOf(4, 4)).toBe('flat');
    expect(trendOf(0, 0)).toBe('flat');
  });

  it('treats new activity from zero as up', () => {
    expect(trendOf(2, 0)).toBe('up');
  });
});

describe('pctDelta / makePeriodStat', () => {
  it('computes rounded percentage delta', () => {
    expect(pctDelta(12, 10)).toBe(20);
    expect(pctDelta(9, 12)).toBe(-25);
  });

  it('returns null when the previous window was empty but current is not', () => {
    expect(pctDelta(3, 0)).toBeNull();
  });

  it('returns 0 when both windows are empty', () => {
    expect(pctDelta(0, 0)).toBe(0);
  });

  it('makePeriodStat carries raw delta', () => {
    expect(makePeriodStat(8, 3)).toEqual({ current: 8, previous: 3, delta: 5 });
  });
});

describe('PROGRESS_WINDOW_OPTIONS', () => {
  it('offers exactly the 7/30/90-day windows', () => {
    expect([...PROGRESS_WINDOW_OPTIONS]).toEqual([7, 30, 90]);
  });
});
