import type { HeatmapDay } from './activityTypes';

const DEFAULT_WEEKS = 52;

function parseLocalDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function buildCalendarGrid(days: HeatmapDay[]): (HeatmapDay | null)[][] {
  if (days.length === 0) return [];

  const firstDate = parseLocalDate(days[0].dateKey);
  const firstDow = (firstDate.getDay() + 6) % 7;
  const padded: (HeatmapDay | null)[] = [
    ...new Array<HeatmapDay | null>(firstDow).fill(null),
    ...days,
  ];

  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    const week = padded.slice(i, i + 7);
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

/** Build visible Monday–Sunday heatmap columns under the explicit width cap. */
export function buildHeatmapWeekColumns(
  days: HeatmapDay[],
  weeks: number = DEFAULT_WEEKS,
): (HeatmapDay | null)[][] {
  const maxDays = weeks * 7;
  const trimmedDays = days.length > maxDays ? days.slice(-maxDays) : days;
  const calendarGrid = buildCalendarGrid(trimmedDays);
  return calendarGrid.length > weeks ? calendarGrid.slice(-weeks) : calendarGrid;
}

function firstDayInWeek(week: (HeatmapDay | null)[]): HeatmapDay | null {
  for (const day of week) {
    if (day) return day;
  }
  return null;
}

export function monthLabelsForHeatmapWeeks(weeksGrid: (HeatmapDay | null)[][]): string[] {
  let previousKey: string | null = null;
  return weeksGrid.map((week) => {
    const first = firstDayInWeek(week);
    if (!first) return '';
    const date = parseLocalDate(first.dateKey);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (key !== previousKey) {
      previousKey = key;
      return date.toLocaleDateString('en', { month: 'short' });
    }
    return '';
  });
}
