import { describe, expect, it } from 'vitest';
import {
  buildHeatmapWeekColumns,
  longestActiveStreak,
  monthLabelsForHeatmapWeeks,
} from '@/features/shared/githubHeatmap.domain';
import type { HeatmapDay } from '@/features/shared/activityTypes';

/**
 * The heatmap's screen-reader caption used to own a fourth streak walk (its own
 * consecutive-key loop over `YYYY-MM-DD` strings). It is derived state like any
 * other streak number, so it now delegates to the ONE streak definition
 * (`computeStreakRun`, audit C #10) and these tests pin that it agrees with it
 * — including on days a millisecond-delta walk would classify as consecutive
 * (a spring-forward boundary is still exactly one calendar day).
 */

function heatmapDays(keys: string[], value: (key: string) => number = () => 1): HeatmapDay[] {
  return keys.map((dateKey) => ({ dateKey, value: value(dateKey) }));
}

describe('longestActiveStreak (heatmap caption)', () => {
  it('counts consecutive active days and restarts after a gap', () => {
    const days = heatmapDays([
      '2026-03-01',
      '2026-03-02',
      '2026-03-03',
      '2026-03-06',
      '2026-03-07',
    ]);
    expect(longestActiveStreak(days)).toBe(3);
  });

  it('returns 0 for a history with no activity', () => {
    expect(longestActiveStreak(heatmapDays(['2026-03-01', '2026-03-02'], () => 0))).toBe(0);
    expect(longestActiveStreak([])).toBe(0);
  });

  it('treats a DST spring-forward boundary as one calendar day, not 23 hours', () => {
    // US spring forward 2026-03-08: the local day is 23 hours long, so a
    // millisecond-delta walk would break the run here.
    const days = heatmapDays(['2026-03-07', '2026-03-08', '2026-03-09']);
    expect(longestActiveStreak(days)).toBe(3);
  });

  it('breaks the run at an inactive day inside the history', () => {
    const days = heatmapDays(['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04'], (key) =>
      key === '2026-03-02' ? 0 : 1,
    );
    // 03-01 | gap | 03-03, 03-04 → the longest run is 2, not 3.
    expect(longestActiveStreak(days)).toBe(2);
  });
});

describe('heatmap grid building', () => {
  it('buckets days into Monday-first week columns under the width cap', () => {
    const days = heatmapDays(['2026-03-02', '2026-03-03', '2026-03-04']);
    const weeks = buildHeatmapWeekColumns(days, 4);
    expect(weeks.length).toBeGreaterThan(0);
    expect(weeks.flat().filter(Boolean)).toHaveLength(3);
    // 2026-03-02 is a Monday, so it starts a column at row 0.
    expect(weeks[0][0]?.dateKey).toBe('2026-03-02');
  });

  it('labels the month each column starts in', () => {
    // Dense history (the heatmap receives one entry per local day).
    const keys: string[] = [];
    for (let day = 23; day <= 28; day += 1) keys.push(`2026-02-${day}`);
    for (let day = 1; day <= 15; day += 1) keys.push(`2026-03-${String(day).padStart(2, '0')}`);
    const weeks = buildHeatmapWeekColumns(heatmapDays(keys), 8);
    const labels = monthLabelsForHeatmapWeeks(weeks);

    // One label per column, emitted only where the month changes.
    expect(labels).toHaveLength(weeks.length);
    expect(labels.filter(Boolean)).toEqual(['Feb', 'Mar']);
  });
});
