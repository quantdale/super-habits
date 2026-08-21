import { describe, expect, it } from 'vitest';
import type { Habit, HabitCompletion } from '@/features/habits/types';
import {
  ALL_HABIT_WEEKDAYS,
  createHabitRule,
  type HabitRule,
} from '@/features/habits/habits.domain';
import {
  calculateHabitProgressInsights,
  type HabitProgressInsights,
} from '@/features/habits/habitInsights.domain';
import { dateKeyToLocalDate, toDateKey } from '@/lib/time';

function habit(
  effectiveFromDate: string,
  rules: HabitRule[] = [createHabitRule(effectiveFromDate, ALL_HABIT_WEEKDAYS, 1)],
  overrides: Partial<Habit> = {},
): Habit {
  return {
    id: 'habit_insights',
    name: 'Insights habit',
    target_per_day: rules[0]?.target_per_day ?? 1,
    reminder_time: null,
    category: 'anytime',
    icon: 'check-circle',
    color: '#2563eb',
    rule_history: JSON.stringify(rules),
    project_id: null,
    goal_id: null,
    created_at: `${effectiveFromDate}T12:00:00.000Z`,
    updated_at: `${effectiveFromDate}T12:00:00.000Z`,
    deleted_at: null,
    ...overrides,
  };
}

function completion(dateKey: string, count = 1, id = dateKey): HabitCompletion {
  return {
    id: `hcmp_${id}`,
    habit_id: 'habit_insights',
    date_key: dateKey,
    count,
    created_at: `${dateKey}T12:00:00.000Z`,
    updated_at: `${dateKey}T12:00:00.000Z`,
  };
}

function addDays(dateKey: string, amount: number): string {
  const date = dateKeyToLocalDate(dateKey);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

function daysBetween(startDateKey: string, endDateKey: string): string[] {
  const result: string[] = [];
  for (let cursor = startDateKey; cursor <= endDateKey; cursor = addDays(cursor, 1)) {
    result.push(cursor);
    if (cursor === endDateKey) break;
  }
  return result;
}

function datesWithCount(startDateKey: string, endDateKey: string, count: number) {
  return daysBetween(startDateKey, endDateKey).map((dateKey) => completion(dateKey, count));
}

function day(insights: HabitProgressInsights, dateKey: string) {
  return insights.recentDays.find((entry) => entry.dateKey === dateKey);
}

describe('calculateHabitProgressInsights', () => {
  it('uses current-day grace for current streak and preserves the full longest streak', () => {
    const result = calculateHabitProgressInsights(
      habit('2026-08-01'),
      datesWithCount('2026-08-01', '2026-08-05', 1),
      '2026-08-06',
    );

    expect(result).toMatchObject({
      currentStreak: 5,
      longestStreak: 5,
      totalEligibleOccurrences: 6,
      totalCompletedOccurrences: 5,
    });
  });

  it('counts M/W/F scheduled occurrences, ignores off-day activity, and breaks after a miss', () => {
    const result = calculateHabitProgressInsights(
      habit('2026-08-03', [createHabitRule('2026-08-03', [1, 3, 5], 1)]),
      [
        completion('2026-08-03'),
        completion('2026-08-04'),
        completion('2026-08-05'),
        completion('2026-08-10'),
      ],
      '2026-08-10',
    );

    expect(result).toMatchObject({
      currentStreak: 1,
      longestStreak: 2,
      totalEligibleOccurrences: 4,
      totalCompletedOccurrences: 3,
    });
    expect(day(result!, '2026-08-04')).toMatchObject({
      count: 1,
      scheduled: false,
      eligible: false,
      completed: false,
    });
    expect(result!.last7).toMatchObject({
      eligibleOccurrences: 3,
      completedOccurrences: 2,
      percentage: 67,
    });
  });

  it('uses historical targets and schedules for target-vs-actual rows', () => {
    const result = calculateHabitProgressInsights(
      habit('2026-08-01', [
        createHabitRule('2026-08-01', ALL_HABIT_WEEKDAYS, 1),
        createHabitRule('2026-08-05', [1, 2, 3, 4, 5], 2),
      ]),
      [completion('2026-08-04', 1), completion('2026-08-05', 1), completion('2026-08-06', 2)],
      '2026-08-07',
    );

    expect(day(result!, '2026-08-04')).toMatchObject({
      targetPerDay: 1,
      count: 1,
      completed: true,
    });
    expect(day(result!, '2026-08-05')).toMatchObject({
      targetPerDay: 2,
      count: 1,
      completed: false,
    });
    expect(day(result!, '2026-08-06')).toMatchObject({
      targetPerDay: 2,
      count: 2,
      completed: true,
    });
  });

  it.each([
    ['weekdays', [1, 2, 3, 4, 5] as const, '2026-08-09'],
    ['weekends', [6, 7] as const, '2026-08-09'],
  ])('supports %s schedules using scheduled denominators', (_name, weekdays, todayKey) => {
    const result = calculateHabitProgressInsights(
      habit('2026-08-03', [createHabitRule('2026-08-03', weekdays, 1)]),
      [completion('2026-08-08')],
      todayKey,
    );

    expect(result).not.toBeNull();
    expect(result!.last7.eligibleOccurrences).toBe(_name === 'weekends' ? 2 : 5);
    expect(result!.last7.completedOccurrences).toBe(_name === 'weekends' ? 1 : 0);
  });

  it('excludes pre-creation dates from rates and reports empty windows honestly', () => {
    const result = calculateHabitProgressInsights(
      habit('2026-08-28'),
      [completion('2026-08-28')],
      '2026-08-28',
    );

    expect(result).toMatchObject({
      totalEligibleOccurrences: 1,
      totalCompletedOccurrences: 1,
      last90: { eligibleOccurrences: 1, percentage: 100 },
      trend: { kind: 'insufficient_data' },
    });
    expect(result!.last7).toMatchObject({ eligibleOccurrences: 1, completedOccurrences: 1 });
  });

  it('excludes paused dates from insight windows spanning a pause', () => {
    const result = calculateHabitProgressInsights(
      habit('2026-08-01', undefined, {
        lifecycle_history: JSON.stringify([
          { status: 'paused', from_date_key: '2026-08-04', to_date_key: '2026-08-06' },
        ]),
      }),
      datesWithCount('2026-08-07', '2026-08-10', 1),
      '2026-08-10',
    );

    // The last-7 window (Aug 4–10) contains three paused days: they leave the
    // denominator entirely instead of counting as misses.
    expect(result!.last7).toMatchObject({
      eligibleOccurrences: 4,
      completedOccurrences: 4,
      percentage: 100,
    });
    expect(day(result!, '2026-08-05')).toMatchObject({ scheduled: false, eligible: false });
    expect(result!.currentStreak).toBe(4);
  });

  it('reports an empty rate when no scheduled date exists in a window', () => {
    const result = calculateHabitProgressInsights(
      habit('2026-08-10', [createHabitRule('2026-08-10', [6, 7], 1)]),
      [],
      '2026-08-14',
    );

    expect(result!.last7).toMatchObject({ eligibleOccurrences: 0, percentage: null });
    expect(result!.recentDays.every((entry) => !entry.eligible)).toBe(true);
  });

  it('requires evidence in both comparison windows before labeling a trend', () => {
    const result = calculateHabitProgressInsights(
      habit('2026-08-03', [createHabitRule('2026-08-03', [6, 7], 1)]),
      [completion('2026-08-08'), completion('2026-08-09')],
      '2026-08-14',
    );

    expect(result!.trend).toMatchObject({
      kind: 'insufficient_data',
      recentRate: 100,
      previousRate: null,
      eligibleOccurrences: 2,
      previousEligibleOccurrences: 0,
    });
  });

  it('labels a supported improvement using comparable seven-day windows', () => {
    const previous = datesWithCount('2026-08-01', '2026-08-07', 0);
    const recent = datesWithCount('2026-08-08', '2026-08-13', 1);
    const result = calculateHabitProgressInsights(
      habit('2026-08-01'),
      [...previous, ...recent],
      '2026-08-14',
    );

    expect(result!.trend).toEqual({
      kind: 'improving',
      recentRate: 86,
      previousRate: 0,
      eligibleOccurrences: 7,
      previousEligibleOccurrences: 7,
    });
  });

  it('calculates a long streak without a 30-occurrence cap', () => {
    const start = '2026-07-01';
    const result = calculateHabitProgressInsights(
      habit(start),
      datesWithCount(start, '2026-08-10', 1),
      '2026-08-10',
    );

    expect(result!.currentStreak).toBeGreaterThan(30);
    expect(result!.longestStreak).toBeGreaterThan(30);
  });

  it('handles leap-day and year-boundary local date keys', () => {
    const result = calculateHabitProgressInsights(
      habit('2024-02-28'),
      [completion('2024-02-28'), completion('2024-02-29'), completion('2024-03-01')],
      '2024-03-01',
    );

    expect(result).toMatchObject({ currentStreak: 3, longestStreak: 3 });
    expect(result!.recentDays.map((entry) => entry.dateKey)).toEqual([
      '2024-02-28',
      '2024-02-29',
      '2024-03-01',
    ]);
  });

  it('does not calculate insights for a deleted habit', () => {
    expect(
      calculateHabitProgressInsights(
        habit('2026-08-01', undefined, { deleted_at: '2026-08-10T00:00:00.000Z' }),
        [],
        '2026-08-10',
      ),
    ).toBeNull();
  });
});
