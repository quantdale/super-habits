import { describe, expect, it } from 'vitest';
import { buildHeatmapWeekColumns } from '@/features/shared/githubHeatmap.domain';
import type { HeatmapDay } from '@/features/shared/activityTypes';

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysFrom(start: Date, count: number): HeatmapDay[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    return { dateKey: dateKey(date), value: 0 };
  });
}

describe('buildHeatmapWeekColumns', () => {
  it('caps a padded 364-day window at the explicit 52-week contract', () => {
    // 2026-08-10 is a Monday; moving the window one day earlier produces a
    // Sunday-starting 364-day range that otherwise needs a 53rd partial column.
    const columns = buildHeatmapWeekColumns(daysFrom(new Date(2025, 8, 21), 364), 52);

    expect(columns).toHaveLength(52);
  });

  it('keeps a naturally aligned 52-week window intact', () => {
    const columns = buildHeatmapWeekColumns(daysFrom(new Date(2025, 8, 22), 364), 52);

    expect(columns).toHaveLength(52);
  });
});
