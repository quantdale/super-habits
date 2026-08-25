import { describe, expect, it } from 'vitest';
import {
  ALL_HABIT_WEEKDAYS,
  applyHabitLifecycleTransition,
  buildAggregatedHabitHeatmap,
  buildDayCompletions,
  buildHabitActivityDays,
  buildHabitGrid,
  calculateCurrentStreak,
  calculateHabitProgress,
  calculateLongestStreak,
  calculateOverallConsistency,
  createHabitRule,
  filterHabits,
  formatHabitSchedule,
  getHabitRuleForDate,
  getHabitSchedulePreset,
  habitCreationDateKey,
  isHabitLifecycleMaskedOn,
  isHabitActionableOn,
  isHabitScheduledOn,
  parseHabitLifecycleHistory,
  parseHabitRuleHistory,
  serializeHabitLifecycleHistory,
  sortHabits,
  summarizeHabitLifecycle,
  type DayCompletion,
} from '@/features/habits/habits.domain';
import { dateKeyToLocalDate, timestampToLocalDateKey, toDateKey } from '@/lib/time';

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

  it('supports an explicit bounded window for derived read models', () => {
    const result = buildDayCompletions(
      [],
      1,
      undefined,
      [createHabitRule('2020-01-01', ALL_HABIT_WEEKDAYS, 1)],
      undefined,
      '2026-08-20',
      undefined,
      '2026-08-18',
    );
    expect(result.map((entry) => entry.dateKey)).toEqual([
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
    ]);
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
    { id: 'h2', name: 'Walk', category: 'evening', status: 'paused' as const },
    { id: 'h3', name: 'Meditate', category: 'anytime', status: 'archived' as const },
  ];

  it('filterHabits filters by category', () => {
    expect(filterHabits(habits, { category: 'morning' }).map((h) => h.id)).toEqual(['h1']);
    expect(filterHabits(habits, { category: 'all', status: 'all' })).toHaveLength(3);
  });

  it('filterHabits defaults to durable active rows only (missing status = active)', () => {
    expect(filterHabits(habits, {}).map((h) => h.id)).toEqual(['h1']);
  });

  it('filterHabits selects paused and archived rows by status', () => {
    expect(filterHabits(habits, { status: 'paused' }).map((h) => h.id)).toEqual(['h2']);
    expect(filterHabits(habits, { status: 'archived' }).map((h) => h.id)).toEqual(['h3']);
    expect(filterHabits(habits, { status: 'all' })).toHaveLength(3);
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

describe('durable lifecycle interval history', () => {
  it('parses and serializes valid intervals, dropping malformed entries', () => {
    const raw = JSON.stringify([
      { status: 'paused', from_date_key: '2026-08-10', to_date_key: '2026-08-14' },
      { status: 'nope', from_date_key: '2026-08-01', to_date_key: null },
      { status: 'archived', from_date_key: 'bad-key', to_date_key: null },
      null,
      { status: 'paused', from_date_key: '2026-08-20', to_date_key: 'not-a-date' },
      { status: 'archived', from_date_key: '2026-08-01', to_date_key: null },
    ]);
    expect(parseHabitLifecycleHistory(raw)).toEqual([
      { status: 'archived', from_date_key: '2026-08-01', to_date_key: null },
      { status: 'paused', from_date_key: '2026-08-10', to_date_key: '2026-08-14' },
    ]);
    expect(serializeHabitLifecycleHistory(raw)).toBe(
      JSON.stringify([
        { status: 'archived', from_date_key: '2026-08-01', to_date_key: null },
        { status: 'paused', from_date_key: '2026-08-10', to_date_key: '2026-08-14' },
      ]),
    );
    expect(parseHabitLifecycleHistory(null)).toEqual([]);
    expect(parseHabitLifecycleHistory('not json')).toEqual([]);
  });

  it('applyHabitLifecycleTransition opens an ongoing interval on pause and is idempotent', () => {
    expect(applyHabitLifecycleTransition([], 'paused', '2026-08-10')).toEqual([
      { status: 'paused', from_date_key: '2026-08-10', to_date_key: null },
    ]);
    const paused = applyHabitLifecycleTransition([], 'paused', '2026-08-10');
    expect(applyHabitLifecycleTransition(paused, 'paused', '2026-08-12')).toEqual(paused);
  });

  it('applyHabitLifecycleTransition closes the open interval on resume/unarchive', () => {
    const paused = [{ status: 'paused' as const, from_date_key: '2026-08-10', to_date_key: null }];
    expect(applyHabitLifecycleTransition(paused, 'active', '2026-08-15')).toEqual([
      { status: 'paused', from_date_key: '2026-08-10', to_date_key: '2026-08-15' },
    ]);
    // Resuming with no open interval is a harmless no-op.
    expect(
      applyHabitLifecycleTransition(
        [{ status: 'paused', from_date_key: '2026-08-10', to_date_key: '2026-08-12' }],
        'active',
        '2026-08-15',
      ),
    ).toEqual([{ status: 'paused', from_date_key: '2026-08-10', to_date_key: '2026-08-12' }]);
  });

  it('applyHabitLifecycleTransition archiving closes an open pause first', () => {
    const paused = [{ status: 'paused' as const, from_date_key: '2026-08-10', to_date_key: null }];
    expect(applyHabitLifecycleTransition(paused, 'archived', '2026-08-13')).toEqual([
      { status: 'paused', from_date_key: '2026-08-10', to_date_key: '2026-08-13' },
      { status: 'archived', from_date_key: '2026-08-13', to_date_key: null },
    ]);
    const archived = applyHabitLifecycleTransition([], 'archived', '2026-08-13');
    expect(applyHabitLifecycleTransition(archived, 'archived', '2026-08-14')).toEqual(archived);
  });

  it('isHabitLifecycleMaskedOn treats bounds inclusively and open intervals indefinitely', () => {
    const history = [
      { status: 'paused' as const, from_date_key: '2026-08-10', to_date_key: '2026-08-14' },
      { status: 'archived' as const, from_date_key: '2026-08-20', to_date_key: null },
    ];
    expect(isHabitLifecycleMaskedOn(history, '2026-08-09')).toBe(false);
    expect(isHabitLifecycleMaskedOn(history, '2026-08-10')).toBe(true);
    expect(isHabitLifecycleMaskedOn(history, '2026-08-14')).toBe(true);
    expect(isHabitLifecycleMaskedOn(history, '2026-08-15')).toBe(false);
    expect(isHabitLifecycleMaskedOn(history, '2026-08-20')).toBe(true);
    expect(isHabitLifecycleMaskedOn(history, '2027-01-01')).toBe(true);
    expect(isHabitLifecycleMaskedOn([], '2026-08-10')).toBe(false);
  });

  it('exposes a uniform creation-date fallback for empty rule histories', () => {
    // All streak/grid/insights surfaces resolve the same boundary value.
    expect(habitCreationDateKey('2026-08-05T10:00:00.000Z')).toBe(
      timestampToLocalDateKey('2026-08-05T10:00:00.000Z'),
    );
    expect(habitCreationDateKey(undefined)).toBeUndefined();
    expect(habitCreationDateKey('not-a-timestamp')).toBeUndefined();
  });
});

describe('paused-interval masking (F1)', () => {
  const mwf = [1, 3, 5] as const;
  const history = [createHabitRule('2026-08-03', mwf, 1)];
  // M/W/F dates: Aug 3, 5, 7, 10, 12, 14 in 2026.
  const pauseOverWednesday = [
    { status: 'paused' as const, from_date_key: '2026-08-11', to_date_key: '2026-08-13' },
  ];

  function completionsFor(dateKeys: string[]) {
    return dateKeys.map((dateKey) => ({
      id: `hcmp_${dateKey}`,
      habit_id: 'habit_1',
      date_key: dateKey,
      count: 1,
      created_at: `${dateKey}T12:00:00.000Z`,
      updated_at: `${dateKey}T12:00:00.000Z`,
    }));
  }

  it('masks dates inside a paused interval as unscheduled', () => {
    const days = buildDayCompletions(
      [],
      1,
      undefined,
      history,
      undefined,
      '2026-08-14',
      pauseOverWednesday,
    );
    const wednesday = days.find((day) => day.dateKey === '2026-08-12')!;
    expect(wednesday).toMatchObject({ scheduled: false, eligible: false, completed: false });
    // The denominator shrinks instead of counting a miss.
    expect(days.filter((day) => day.eligible)).toHaveLength(5);
  });

  it('bridges the current streak across a closed pause', () => {
    const completions = completionsFor(['2026-08-07', '2026-08-10', '2026-08-14']);
    const masked = buildDayCompletions(
      completions,
      1,
      undefined,
      history,
      undefined,
      '2026-08-14',
      pauseOverWednesday,
    );
    expect(calculateCurrentStreak(masked, '2026-08-14')).toBe(3);

    // Without the mask the same history breaks at the uncompleted Wednesday.
    const unmasked = buildDayCompletions(
      completions,
      1,
      undefined,
      history,
      undefined,
      '2026-08-14',
    );
    expect(calculateCurrentStreak(unmasked, '2026-08-14')).toBe(1);
  });

  it('bridges the longest streak across a closed pause', () => {
    const completions = completionsFor([
      '2026-08-03',
      '2026-08-05',
      '2026-08-07',
      '2026-08-10',
      '2026-08-14',
    ]);
    const masked = buildDayCompletions(
      completions,
      1,
      undefined,
      history,
      undefined,
      '2026-08-14',
      pauseOverWednesday,
    );
    expect(calculateLongestStreak(masked)).toBe(5);
    expect(calculateCurrentStreak(masked, '2026-08-14')).toBe(5);

    const unmasked = buildDayCompletions(
      completions,
      1,
      undefined,
      history,
      undefined,
      '2026-08-14',
    );
    expect(calculateLongestStreak(unmasked)).toBe(4);
  });

  it('masks grid cells via lifecycle_history and drops them from consistency/heatmap denominators', () => {
    const habit = {
      id: 'h1',
      name: 'Run',
      color: '#4f79ff',
      target_per_day: 1,
      created_at: '2026-08-03T00:00:00.000Z',
      lifecycle_history: serializeHabitLifecycleHistory(pauseOverWednesday),
    };
    const grid = buildHabitGrid([habit], [], 30, '2026-08-14');
    const wednesday = grid[0].cells.find((cell) => cell.dateKey === '2026-08-12')!;
    expect(wednesday.scheduled).toBe(false);

    // Every scheduled M/W/F cell before today except the masked one is
    // eligible; consistency counts only eligible cells.
    const eligibleCells = grid[0].cells.filter((cell) => cell.eligible);
    expect(eligibleCells.length).toBeGreaterThan(0);
    expect(eligibleCells.some((cell) => cell.dateKey === '2026-08-12')).toBe(false);

    // An ongoing pause covering today removes today from every aggregate.
    const pausedToday = buildHabitGrid(
      [
        {
          ...habit,
          lifecycle_history: serializeHabitLifecycleHistory([
            { status: 'paused', from_date_key: '2026-08-14', to_date_key: null },
          ]),
        },
      ],
      [],
      30,
      '2026-08-14',
    );
    expect(calculateOverallConsistency(pausedToday)).toBe(0);
    expect(buildAggregatedHabitHeatmap(pausedToday, 30).at(-1)?.value).toBe(0);
    expect(buildHabitActivityDays(pausedToday, 30).at(-1)).toMatchObject({
      active: false,
      value: 0,
    });
  });

  it('anchors the grid window on the injected todayKey (F7)', () => {
    const grid = buildHabitGrid(
      [{ id: 'h1', name: 'Run', color: '#4f79ff', target_per_day: 1 }],
      [{ habit_id: 'h1', date_key: '2026-08-11', count: 1 }],
      30,
      '2026-08-10',
    );
    expect(grid[0].cells).toHaveLength(30);
    expect(grid[0].cells.at(-1)?.dateKey).toBe('2026-08-10');
    expect(grid[0].cells.every((cell) => cell.dateKey <= '2026-08-10')).toBe(true);
    // A completion dated after the synthetic today falls outside the window.
    expect(grid[0].cells.some((cell) => cell.dateKey === '2026-08-11' && cell.count === 1)).toBe(
      false,
    );

    // The aggregated heatmap follows the same synthetic axis.
    const heatmap = buildAggregatedHabitHeatmap(grid, 30);
    expect(heatmap).toHaveLength(30);
    expect(heatmap.at(-1)?.dateKey).toBe('2026-08-10');
  });

  it('summarizeHabitLifecycle counts durable status buckets', () => {
    const habits = [
      { id: 'h1' },
      { id: 'h2', status: 'paused' as const },
      { id: 'h3', status: 'archived' as const },
      { id: 'h4' },
    ];
    expect(summarizeHabitLifecycle(habits)).toEqual({
      activeCount: 2,
      pausedCount: 1,
      archivedCount: 1,
    });
  });
});

describe('isHabitActionableOn (lifecycle write gate)', () => {
  const everyDay = JSON.stringify([
    { effective_from_date: '2026-04-01', weekdays: [1, 2, 3, 4, 5, 6, 7], target_per_day: 1 },
  ]);
  const weekdaysOnly = JSON.stringify([
    { effective_from_date: '2026-04-01', weekdays: [1, 2, 3, 4, 5], target_per_day: 1 },
  ]);

  it('accepts scheduled, on-or-after-effective, unmasked dates', () => {
    // 2026-04-14 is a Tuesday.
    expect(isHabitActionableOn(everyDay, '2026-04-14', 1, '2026-04-01')).toBe(true);
    expect(isHabitActionableOn(weekdaysOnly, '2026-04-14', 1, '2026-04-01')).toBe(true);
  });

  it('rejects unscheduled weekdays and pre-effective/pre-creation dates', () => {
    // 2026-04-11 is a Saturday.
    expect(isHabitActionableOn(weekdaysOnly, '2026-04-11', 1, '2026-04-01')).toBe(false);
    expect(isHabitActionableOn(everyDay, '2026-03-31', 1, '2026-04-01')).toBe(false);
  });

  it('rejects dates inside paused/archived intervals (inclusive bounds)', () => {
    const lifecycle = JSON.stringify([
      { status: 'paused', from_date_key: '2026-04-10', to_date_key: null },
    ]);
    expect(isHabitActionableOn(everyDay, '2026-04-14', 1, '2026-04-01')).toBe(true);
    expect(isHabitActionableOn(everyDay, '2026-04-14', 1, '2026-04-01', lifecycle)).toBe(false);
    // The day before the pause starts stays actionable (inclusive bounds).
    expect(isHabitActionableOn(everyDay, '2026-04-09', 1, '2026-04-01', lifecycle)).toBe(true);
  });
});
