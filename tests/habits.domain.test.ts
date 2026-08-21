import { describe, expect, it } from 'vitest';
import {
  ALL_HABIT_WEEKDAYS,
  buildAggregatedHabitHeatmap,
  buildDayCompletions,
  buildHabitActivityDays,
  buildHabitGrid,
  calculateCurrentStreak,
  calculateHabitProgress,
  calculateLongestStreak,
  calculateOverallConsistency,
  createHabitRule,
  formatHabitSchedule,
  getHabitRuleForDate,
  getHabitSchedulePreset,
  isHabitScheduledOn,
  parseHabitRuleHistory,
  type DayCompletion,
  filterHabits,
  sortHabits,
  toggleHabitLifecycleId,
  summarizeHabitLifecycle,
} from '@/features/habits/habits.domain';
import { dateKeyToLocalDate, toDateKey } from '@/lib/time';

function day(
  dateKey: string,
  count: number,
  target: number,
  options: { scheduled?: boolean; eligible?: boolean } = {},
): DayCompletion {
  const scheduled = options.scheduled ?? true;
  const eligible = options.eligible ?? scheduled;
  return {
    dateKey,
    count,
    targetPerDay: target,
    scheduled,
    eligible,
    completed: eligible && scheduled && target > 0 && count >= target,
  };
}

function offsetDateKey(offset: number, from = new Date()): string {
  const date = new Date(from);
  date.setDate(date.getDate() + offset);
  return toDateKey(date);
}

function completion(habitId: string, dateKey: string, count: number) {
  return {
    id: `hcmp_${dateKey}`,
    habit_id: habitId,
    date_key: dateKey,
    count,
    created_at: `${dateKey}T12:00:00.000Z`,
    updated_at: `${dateKey}T12:00:00.000Z`,
  };
}

describe('calculateHabitProgress', () => {
  it('caps complete progress at 1', () => {
    expect(calculateHabitProgress(4, 3)).toBe(1);
  });

  it('returns partial progress when below target', () => {
    expect(calculateHabitProgress(1, 4)).toBe(0.25);
  });
});

describe('habit rule history and schedule lookup', () => {
  const mwf = [1, 3, 5] as const;

  it.each([
    ['every day', ALL_HABIT_WEEKDAYS, 'every_day'],
    ['weekdays', [1, 2, 3, 4, 5], 'weekdays'],
    ['weekends', [6, 7], 'weekends'],
    ['custom', mwf, 'custom'],
  ])('recognizes the %s preset', (_label, weekdays, expected) => {
    expect(getHabitSchedulePreset(weekdays)).toBe(expected);
  });

  it('resolves M/W/F using local date weekdays', () => {
    const history = [createHabitRule('2026-08-01', mwf, 1)];
    expect(isHabitScheduledOn(history, '2026-08-03')).toBe(true); // Monday
    expect(isHabitScheduledOn(history, '2026-08-04')).toBe(false); // Tuesday
    expect(isHabitScheduledOn(history, '2026-08-05')).toBe(true); // Wednesday
  });

  it('does not resolve a rule before the habit creation/effective boundary', () => {
    const history = [createHabitRule('2026-08-05', ALL_HABIT_WEEKDAYS, 1)];
    expect(getHabitRuleForDate(history, '2026-08-04')).toBeNull();
    expect(getHabitRuleForDate(history, '2026-08-05')?.target_per_day).toBe(1);
  });

  it('uses the historical target and schedule rule for each date', () => {
    const history = [
      createHabitRule('2026-08-01', ALL_HABIT_WEEKDAYS, 1),
      createHabitRule('2026-08-06', mwf, 2),
    ];
    expect(getHabitRuleForDate(history, '2026-08-05')).toMatchObject({
      weekdays: [...ALL_HABIT_WEEKDAYS],
      target_per_day: 1,
    });
    expect(getHabitRuleForDate(history, '2026-08-06')).toMatchObject({
      weekdays: [...mwf],
      target_per_day: 2,
    });
  });

  it('parses and normalizes serialized history', () => {
    expect(
      parseHabitRuleHistory(
        JSON.stringify([
          { effective_from_date: '2026-08-02', weekdays: [7, 1, 1], target_per_day: 1 },
        ]),
      ),
    ).toEqual([createHabitRule('2026-08-02', [1, 7], 1)]);
  });

  it('formats custom schedule labels for the card/editor', () => {
    expect(formatHabitSchedule(mwf)).toBe('Mon / Wed / Fri');
  });
});

describe('buildDayCompletions', () => {
  it('returns the explicit requested number of entries', () => {
    expect(buildDayCompletions([], 1, 30)).toHaveLength(30);
  });

  it('marks scheduled completion against the target active on that date', () => {
    const today = toDateKey();
    const result = buildDayCompletions([completion('habit_test', today, 2)], 1, 1, [
      createHabitRule(today, ALL_HABIT_WEEKDAYS, 2),
    ]);
    expect(result[0]).toMatchObject({
      count: 2,
      targetPerDay: 2,
      scheduled: true,
      completed: true,
    });
  });

  it('marks off-days neutral even when an off-day completion row exists', () => {
    const result = buildDayCompletions(
      [completion('habit_test', '2026-08-04', 1)],
      1,
      undefined,
      [createHabitRule('2026-08-03', [1, 3, 5], 1)],
      undefined,
      '2026-08-04',
    );
    expect(result.at(-1)).toMatchObject({
      count: 1,
      scheduled: false,
      eligible: false,
      completed: false,
    });
  });

  it('excludes pre-creation dates from the generated eligible history', () => {
    const result = buildDayCompletions(
      [],
      1,
      undefined,
      [createHabitRule('2026-08-05', ALL_HABIT_WEEKDAYS, 1)],
      undefined,
      '2026-08-07',
    );
    expect(result.map((entry) => entry.dateKey)).toEqual([
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
    ]);
    expect(result.every((entry) => entry.eligible)).toBe(true);
  });
});

describe('calculateCurrentStreak', () => {
  it('returns 0 for empty completions', () => {
    expect(calculateCurrentStreak([], '2026-08-10')).toBe(0);
  });

  it('ignores unscheduled days for M/W/F', () => {
    const history = [createHabitRule('2026-08-03', [1, 3, 5], 1)];
    const days = buildDayCompletions(
      [
        completion('habit', '2026-08-03', 1),
        completion('habit', '2026-08-05', 1),
        completion('habit', '2026-08-07', 1),
        completion('habit', '2026-08-10', 1),
      ],
      1,
      undefined,
      history,
      undefined,
      '2026-08-10',
    );
    expect(calculateCurrentStreak(days, '2026-08-10')).toBe(4);
  });

  it('grants grace to an incomplete scheduled today', () => {
    const history = [createHabitRule('2026-08-03', [1, 3, 5], 1)];
    const days = buildDayCompletions(
      [
        completion('habit', '2026-08-03', 1),
        completion('habit', '2026-08-05', 1),
        completion('habit', '2026-08-07', 1),
      ],
      1,
      undefined,
      history,
      undefined,
      '2026-08-10',
    );
    expect(calculateCurrentStreak(days, '2026-08-10')).toBe(3);
  });

  it('breaks at a prior scheduled miss', () => {
    const history = [createHabitRule('2026-08-03', [1, 3, 5], 1)];
    const days = buildDayCompletions(
      [completion('habit', '2026-08-03', 1), completion('habit', '2026-08-07', 1)],
      1,
      undefined,
      history,
      undefined,
      '2026-08-07',
    );
    expect(calculateCurrentStreak(days, '2026-08-07')).toBe(1);
  });

  it('counts a long history without an arbitrary 30-occurrence cap', () => {
    const start = offsetDateKey(-40);
    const history = [createHabitRule(start, ALL_HABIT_WEEKDAYS, 1)];
    const completions = buildDayCompletions([], 1, undefined, history).map((entry) =>
      completion('habit', entry.dateKey, 1),
    );
    expect(
      calculateCurrentStreak(buildDayCompletions(completions, 1, undefined, history)),
    ).toBeGreaterThan(30);
  });
});

describe('calculateLongestStreak', () => {
  it('ignores unscheduled gaps and resets on a scheduled miss', () => {
    const days = [
      day('2026-08-03', 1, 1),
      day('2026-08-04', 0, 1, { scheduled: false, eligible: false }),
      day('2026-08-05', 1, 1),
      day('2026-08-07', 0, 1),
      day('2026-08-10', 1, 1),
    ];
    expect(calculateLongestStreak(days)).toBe(2);
  });
});

describe('buildHabitGrid and consistency', () => {
  const habits = [
    { id: 'h1', name: 'Run', color: '#4f79ff', target_per_day: 1 },
    { id: 'h2', name: 'Read', color: '#22c55e', target_per_day: 2 },
  ];

  it('returns one row per habit and preserves requested cells', () => {
    const grid = buildHabitGrid(habits, [], 30);
    expect(grid).toHaveLength(2);
    expect(grid.every((row) => row.cells.length === 30)).toBe(true);
  });

  it('uses historical targets and marks partial scheduled cells', () => {
    const today = toDateKey();
    const history = [
      createHabitRule(offsetDateKey(-5), ALL_HABIT_WEEKDAYS, 1),
      createHabitRule(today, ALL_HABIT_WEEKDAYS, 2),
    ];
    const grid = buildHabitGrid(
      [{ ...habits[0], rule_history: history }],
      [{ habit_id: 'h1', date_key: today, count: 1 }],
      30,
    );
    const todayCell = grid[0].cells.find((cell) => cell.dateKey === today)!;
    expect(todayCell).toMatchObject({
      targetPerDay: 2,
      completed: false,
      partial: true,
      eligible: true,
    });
  });

  it('uses only eligible scheduled cells in consistency', () => {
    const grid = [
      {
        habit: habits[0],
        cells: [
          {
            dateKey: '2026-01-01',
            count: 1,
            targetPerDay: 1,
            scheduled: true,
            eligible: true,
            completed: true,
            partial: false,
          },
          {
            dateKey: '2026-01-02',
            count: 0,
            targetPerDay: 1,
            scheduled: false,
            eligible: false,
            completed: false,
            partial: false,
          },
          {
            dateKey: '2026-01-03',
            count: 0,
            targetPerDay: 1,
            scheduled: true,
            eligible: true,
            completed: false,
            partial: false,
          },
        ],
      },
    ];
    expect(calculateOverallConsistency(grid)).toBe(50);
  });
});

describe('schedule-aware heatmaps and activity', () => {
  it('does not dilute a completed scheduled habit with an unscheduled habit', () => {
    const today = toDateKey();
    const grid = [
      {
        habit: { id: 'h1', name: 'Gym', color: '#0f0', target_per_day: 1 },
        cells: [
          {
            dateKey: today,
            count: 1,
            targetPerDay: 1,
            scheduled: true,
            eligible: true,
            completed: true,
            partial: false,
          },
        ],
      },
      {
        habit: { id: 'h2', name: 'Weekend', color: '#00f', target_per_day: 1 },
        cells: [
          {
            dateKey: today,
            count: 0,
            targetPerDay: 1,
            scheduled: false,
            eligible: false,
            completed: false,
            partial: false,
          },
        ],
      },
    ];
    expect(buildAggregatedHabitHeatmap(grid, 1)[0].value).toBe(3);
  });

  it('returns neutral activity on a no-obligation day', () => {
    const today = toDateKey();
    const grid = [
      {
        habit: { id: 'h1', name: 'Gym', color: '#0f0', target_per_day: 1 },
        cells: [
          {
            dateKey: today,
            count: 0,
            targetPerDay: 1,
            scheduled: false,
            eligible: false,
            completed: false,
            partial: false,
          },
        ],
      },
    ];
    expect(buildHabitActivityDays(grid, 1)[0]).toMatchObject({ active: false, value: 0 });
  });
});

describe('date boundaries', () => {
  it('handles leap day and year boundary as local date keys', () => {
    const history = [createHabitRule('2024-02-28', ALL_HABIT_WEEKDAYS, 1)];
    expect(getHabitRuleForDate(history, '2024-02-29')).not.toBeNull();
    expect(getHabitRuleForDate(history, '2025-01-01')).not.toBeNull();
    expect(dateKeyToLocalDate('2024-02-29').getDate()).toBe(29);
  });
});

describe('habit list filtering / sorting', () => {
  const habits = [
    { id: 'h1', name: 'Read', category: 'morning' },
    { id: 'h2', name: 'Walk', category: 'evening' },
    { id: 'h3', name: 'Meditate', category: 'anytime' },
  ];

  it('filterHabits filters by category', () => {
    expect(filterHabits(habits, { category: 'morning' }).map((h) => h.id)).toEqual(['h1']);
    expect(filterHabits(habits, { category: 'all' })).toHaveLength(3);
  });

  it('filterHabits defaults to active only', () => {
    const result = filterHabits(habits, {}, ['h2'], ['h3']);
    expect(result.map((h) => h.id)).toEqual(['h1']);
  });

  it('filterHabits selects paused and archived sets', () => {
    expect(filterHabits(habits, { status: 'paused' }, ['h2'], []).map((h) => h.id)).toEqual(['h2']);
    expect(filterHabits(habits, { status: 'archived' }, [], ['h3']).map((h) => h.id)).toEqual(['h3']);
    expect(filterHabits(habits, { status: 'all' }, ['h2'], ['h3'])).toHaveLength(3);
  });

  it('sortHabits sorts by name without mutating input', () => {
    const sorted = sortHabits(habits, 'name');
    expect(sorted.map((h) => h.name)).toEqual(['Meditate', 'Read', 'Walk']);
    expect(habits[0].name).toBe('Read');
  });

  it('sortHabits sorts by streak descending with missing streaks last', () => {
    const sorted = sortHabits(habits, 'streak', { h3: 4, h1: 2 });
    expect(sorted.map((h) => h.id)).toEqual(['h3', 'h1', 'h2']);
  });

  it('sortHabits default preserves order', () => {
    expect(sortHabits(habits, 'default').map((h) => h.id)).toEqual(['h1', 'h2', 'h3']);
  });
});

describe('habit lifecycle sets', () => {
  it('toggleHabitLifecycleId adds and removes ids immutably', () => {
    expect(toggleHabitLifecycleId([], 'h1')).toEqual(['h1']);
    expect(toggleHabitLifecycleId(['h1', 'h2'], 'h1')).toEqual(['h2']);
  });

  it('summarizeHabitLifecycle counts each bucket once', () => {
    const habits = [{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }, { id: 'h4' }];
    expect(summarizeHabitLifecycle(habits, ['h2'], ['h3'])).toEqual({
      activeCount: 2,
      pausedCount: 1,
      archivedCount: 1,
    });
  });
});
