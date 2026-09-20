import { describe, it, expect } from 'vitest';
import {
  getReviewWeek,
  validatePriorities,
  validateNewCommitments,
  validateReflection,
  validateTodoDecisions,
  validateReviewDraft,
  generateInsights,
  buildNextWeekPlanSuggestions,
  listWeekDateKeys,
  shiftDateKeyByDays,
  summarizeHabitWeekOccurrences,
  MAX_REFLECTION_LENGTH,
} from '@/features/weekly-review/weeklyReview.domain';
import { createHabitRule } from '@/features/habits/habits.domain';
import type {
  WeeklyReviewDraft,
  WeeklyReviewSummaryV1,
} from '@/features/weekly-review/weeklyReview.types';
import { dateKeyToLocalDate, toDateKey } from '@/lib/time';

describe('getReviewWeek', () => {
  it('returns Monday–Sunday week for a midweek date', () => {
    // Wednesday 2026-08-19
    const week = getReviewWeek('2026-08-19');
    expect(week.startDateKey).toBe('2026-08-17'); // Monday
    expect(week.endDateKey).toBe('2026-08-23'); // Sunday
    expect(week.weekKey).toBe('2026-08-17');
    expect(week.nextWeekStartDateKey).toBe('2026-08-24');
    expect(week.nextWeekEndDateKey).toBe('2026-08-30');
  });

  it('returns same week when given Monday', () => {
    const week = getReviewWeek('2026-08-17');
    expect(week.startDateKey).toBe('2026-08-17');
    expect(week.endDateKey).toBe('2026-08-23');
  });

  it('returns same week when given Sunday', () => {
    const week = getReviewWeek('2026-08-23');
    expect(week.startDateKey).toBe('2026-08-17');
    expect(week.endDateKey).toBe('2026-08-23');
  });

  it('handles year boundary (2026-01-01 is Thursday)', () => {
    const week = getReviewWeek('2026-01-01');
    expect(week.startDateKey).toBe('2025-12-29'); // Monday of that week
    expect(week.endDateKey).toBe('2026-01-04');
  });

  it('handles week spanning month boundary', () => {
    // 2026-08-31 is Monday
    const week = getReviewWeek('2026-08-31');
    expect(week.startDateKey).toBe('2026-08-31');
    expect(week.endDateKey).toBe('2026-09-06');
  });

  it('handles Saturday', () => {
    const week = getReviewWeek('2026-08-22');
    expect(week.startDateKey).toBe('2026-08-17');
    expect(week.endDateKey).toBe('2026-08-23');
  });
});

describe('validatePriorities', () => {
  it('passes with 1–5 priorities', () => {
    expect(validatePriorities([{ text: 'A' }])).toHaveLength(0);
    expect(
      validatePriorities([
        { text: 'A' },
        { text: 'B' },
        { text: 'C' },
        { text: 'D' },
        { text: 'E' },
      ]),
    ).toHaveLength(0);
  });

  it('fails with 0 priorities', () => {
    expect(validatePriorities([])).toHaveLength(1);
  });

  it('fails with >5 priorities', () => {
    const errors = validatePriorities(Array.from({ length: 6 }, (_, i) => ({ text: `P${i}` })));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails with empty text', () => {
    expect(validatePriorities([{ text: '  ' }])).toHaveLength(1);
  });
});

describe('validateNewCommitments', () => {
  it('passes with valid commitments', () => {
    expect(validateNewCommitments([{ id: '1', title: 'Test', priority: 'normal' }])).toHaveLength(
      0,
    );
  });

  it('fails with >10 commitments', () => {
    const errors = validateNewCommitments(
      Array.from({ length: 11 }, (_, i) => ({
        id: `${i}`,
        title: `T${i}`,
        priority: 'normal' as const,
      })),
    );
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails with invalid due date', () => {
    const errors = validateNewCommitments([
      { id: '1', title: 'Test', dueDate: 'not-a-date', priority: 'normal' },
    ]);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('validateReflection', () => {
  it('passes with short text', () => {
    expect(validateReflection('Good week')).toHaveLength(0);
  });

  it('fails with too-long text', () => {
    expect(validateReflection('x'.repeat(MAX_REFLECTION_LENGTH + 1))).toHaveLength(1);
  });
});

describe('validateTodoDecisions', () => {
  it('passes with valid decisions', () => {
    const decisions = [
      { todoId: 'todo_1', action: 'leave' as const },
      { todoId: 'todo_2', action: 'reschedule' as const, dueDate: '2026-08-24' },
      { todoId: 'todo_3', action: 'carry_forward' as const },
    ];
    expect(validateTodoDecisions(decisions)).toHaveLength(0);
  });

  it('fails on duplicate todo IDs', () => {
    const decisions = [
      { todoId: 'todo_1', action: 'leave' as const },
      { todoId: 'todo_1', action: 'leave' as const },
    ];
    expect(validateTodoDecisions(decisions).length).toBeGreaterThan(0);
  });

  it('fails on reschedule without due date', () => {
    const decisions = [{ todoId: 'todo_1', action: 'reschedule' as const, dueDate: '' }];
    expect(validateTodoDecisions(decisions).length).toBeGreaterThan(0);
  });
});

describe('validateReviewDraft', () => {
  it('passes with a complete valid draft', () => {
    const draft: WeeklyReviewDraft = {
      weekKey: '2026-08-17',
      todoDecisions: [{ todoId: 't1', action: 'leave' }],
      priorities: [{ id: 'p1', text: 'Ship feature' }],
      newCommitments: [],
      reflection: 'Good week',
    };
    expect(validateReviewDraft(draft)).toHaveLength(0);
  });

  it('fails when priorities are empty', () => {
    const draft: WeeklyReviewDraft = {
      weekKey: '2026-08-17',
      todoDecisions: [],
      priorities: [],
      newCommitments: [],
      reflection: '',
    };
    expect(validateReviewDraft(draft).length).toBeGreaterThan(0);
  });
});

describe('generateInsights', () => {
  const baseSummary: WeeklyReviewSummaryV1 = {
    version: 1,
    week: {
      weekKey: '2026-08-17',
      startDateKey: '2026-08-17',
      endDateKey: '2026-08-23',
      nextWeekStartDateKey: '2026-08-24',
      nextWeekEndDateKey: '2026-08-30',
    },
    todos: {
      completedCount: 0,
      incompleteCount: 0,
      overdueCount: 0,
      dueNextWeekCount: 0,
      carryForwardCandidates: [],
    },
    habits: {
      scheduledOccurrences: 0,
      completedOccurrences: 0,
      consistencyPercent: null,
      attention: [],
    },
    focus: { sessions: 0, minutes: 0, priorWeekMinutes: null },
    workouts: { sessions: 0, priorWeekSessions: null, routines: [] },
    calories: {
      loggedDays: 0,
      averageCaloriesOnLoggedDays: null,
      configuredGoal: null,
    },
    wins: [],
    attention: [],
  };

  it('generates win for completed todos', () => {
    const summary = {
      ...baseSummary,
      todos: { ...baseSummary.todos, completedCount: 5 },
    };
    const { wins } = generateInsights(summary);
    expect(wins.some((w) => w.kind === 'todos_completed')).toBe(true);
  });

  it('generates attention for overdue todos', () => {
    const summary = {
      ...baseSummary,
      todos: { ...baseSummary.todos, overdueCount: 3 },
    };
    const { attention } = generateInsights(summary);
    expect(attention.some((a) => a.kind === 'todos_overdue')).toBe(true);
  });

  it('generates win for high habit consistency', () => {
    const summary = {
      ...baseSummary,
      habits: { ...baseSummary.habits, consistencyPercent: 90 },
    };
    const { wins } = generateInsights(summary);
    expect(wins.some((w) => w.kind === 'habit_consistency_high')).toBe(true);
  });

  it('generates attention for low habit consistency', () => {
    const summary = {
      ...baseSummary,
      habits: { ...baseSummary.habits, consistencyPercent: 30 },
    };
    const { attention } = generateInsights(summary);
    expect(attention.some((a) => a.kind === 'habit_consistency_low')).toBe(true);
  });

  it('generates attention for focus decline', () => {
    const summary = {
      ...baseSummary,
      focus: { sessions: 0, minutes: 0, priorWeekMinutes: 120 },
    };
    const { attention } = generateInsights(summary);
    expect(attention.some((a) => a.kind === 'focus_decline')).toBe(true);
  });

  it('generates win for workouts', () => {
    const summary = {
      ...baseSummary,
      workouts: { ...baseSummary.workouts, sessions: 3 },
    };
    const { wins } = generateInsights(summary);
    expect(wins.some((w) => w.kind === 'workout_sessions')).toBe(true);
  });

  it('generates attention for workout decline', () => {
    const summary = {
      ...baseSummary,
      workouts: { ...baseSummary.workouts, sessions: 0, priorWeekSessions: 3 },
    };
    const { attention } = generateInsights(summary);
    expect(attention.some((a) => a.kind === 'workout_decline')).toBe(true);
  });
});

describe('listWeekDateKeys / shiftDateKeyByDays (F5 local-calendar arithmetic)', () => {
  it('lists seven consecutive local date keys starting at the week start', () => {
    expect(listWeekDateKeys('2026-08-17')).toEqual([
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
      '2026-08-21',
      '2026-08-22',
      '2026-08-23',
    ]);
  });

  it('honors a custom day count', () => {
    expect(listWeekDateKeys('2026-08-17', 3)).toEqual(['2026-08-17', '2026-08-18', '2026-08-19']);
  });

  it('crosses month and year boundaries on the local calendar', () => {
    expect(listWeekDateKeys('2026-08-30', 3)).toEqual(['2026-08-30', '2026-08-31', '2026-09-01']);
    expect(shiftDateKeyByDays('2025-12-29', 7)).toBe('2026-01-05');
  });

  it('shifts backwards across month boundaries', () => {
    expect(shiftDateKeyByDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftDateKeyByDays('2026-08-17', -7)).toBe('2026-08-10');
  });
});

describe('weekly-review date keys stay on the local calendar west of UTC (F5)', () => {
  // Red/green proof (F5): `new Date("YYYY-MM-DD")` parses as UTC midnight per
  // the ES spec, while `toDateKey()` formats in local time. West of UTC (e.g.
  // America/New_York, Pacific/Honolulu) the UTC parse localizes to the prior
  // calendar day — `new Date("2026-08-17").getDate() === 16` there — so a
  // habit window / prior-week range built on it shifts a day. East of UTC
  // (including CI's TZ=Asia/Manila) the round-trip is identity, hiding the
  // regression. Every assertion below pins the local-calendar contract, so it
  // passes with `dateKeyToLocalDate` in all matrix zones but FAILS west of UTC
  // if the implementation ever regresses to `new Date(dateKey)`. This block is
  // executed under each zone in `scripts/qa-timezones.mjs`.
  it('round-trips date keys through local midnight in every zone', () => {
    for (const key of ['2026-08-17', '2026-03-08', '2026-11-01', '2025-12-31']) {
      const local = dateKeyToLocalDate(key);
      expect(local.getHours()).toBe(0);
      expect(local.getMinutes()).toBe(0);
      expect(toDateKey(local)).toBe(key);
    }
    expect(dateKeyToLocalDate('2026-08-17').getDate()).toBe(17);
  });

  it('pins the Monday-start review week on the local calendar', () => {
    const week = getReviewWeek('2026-08-19');
    expect(week.startDateKey).toBe('2026-08-17');
    expect(week.endDateKey).toBe('2026-08-23');
    expect(week.weekKey).toBe('2026-08-17');
    // Monday-start invariant resolved locally: a UTC-parse regression west of
    // UTC would resolve the anchor to Sunday and break both of these.
    expect(dateKeyToLocalDate(week.startDateKey).getDay()).toBe(1);
    expect(dateKeyToLocalDate(week.endDateKey).getDay()).toBe(0);
    expect(week.nextWeekStartDateKey).toBe('2026-08-24');
    expect(week.nextWeekEndDateKey).toBe('2026-08-30');
  });

  it('pins the DST spring-forward week (US 2026-03-08) on the local calendar', () => {
    // Week Mon 2026-03-02 – Sun 2026-03-08 contains the spring-forward Sunday.
    const week = getReviewWeek('2026-03-08');
    expect(week.startDateKey).toBe('2026-03-02');
    expect(week.endDateKey).toBe('2026-03-08');
    expect(listWeekDateKeys(week.startDateKey, 7)).toEqual([
      '2026-03-02',
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
    ]);
    expect(shiftDateKeyByDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(shiftDateKeyByDays('2026-03-08', 1)).toBe('2026-03-09');
  });

  it('pins the DST fall-back week (US 2026-11-01) on the local calendar', () => {
    // Week Mon 2026-10-26 – Sun 2026-11-01 contains the fall-back Sunday.
    const week = getReviewWeek('2026-11-01');
    expect(week.startDateKey).toBe('2026-10-26');
    expect(week.endDateKey).toBe('2026-11-01');
    expect(listWeekDateKeys(week.startDateKey, 7)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
    expect(shiftDateKeyByDays('2026-11-01', 1)).toBe('2026-11-02');
    expect(shiftDateKeyByDays('2026-11-02', -1)).toBe('2026-11-01');
  });

  it('pins prior-week bounds used by focus/workout comparisons', () => {
    const week = getReviewWeek('2026-08-19');
    expect(shiftDateKeyByDays(week.startDateKey, -7)).toBe('2026-08-10');
    expect(shiftDateKeyByDays(week.endDateKey, -7)).toBe('2026-08-16');
    // Prior-week window stays a contiguous local 7-day run.
    expect(listWeekDateKeys(shiftDateKeyByDays(week.startDateKey, -7), 7)).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
      '2026-08-13',
      '2026-08-14',
      '2026-08-15',
      '2026-08-16',
    ]);
  });
});

describe('summarizeHabitWeekOccurrences schedule-aware counts (F6)', () => {
  // Week Mon 2026-08-17 – Sun 2026-08-23 (Mon=1 … Sun=7).
  const weekKeys = listWeekDateKeys('2026-08-17', 7);
  const mwfHistory = JSON.stringify([createHabitRule('2026-08-01', [1, 3, 5], 1)]);
  const dailyHistory = JSON.stringify([createHabitRule('2026-08-01', [1, 2, 3, 4, 5, 6, 7], 1)]);
  const CREATED = '2026-08-01T12:00:00.000Z';

  it('counts only scheduled days for an M/W/F habit completed on all of them', () => {
    // Red proof for F6: the old `daysInWeek = 7` logic reported 7 scheduled /
    // 3 completed / 43% plus a false `no_completions` flag here.
    const summary = summarizeHabitWeekOccurrences(
      [
        {
          id: 'h-mwf',
          name: 'Gym',
          target_per_day: 1,
          rule_history: mwfHistory,
          created_at: CREATED,
        },
      ],
      [
        { habit_id: 'h-mwf', date_key: '2026-08-17', count: 1 },
        { habit_id: 'h-mwf', date_key: '2026-08-19', count: 1 },
        { habit_id: 'h-mwf', date_key: '2026-08-21', count: 1 },
      ],
      weekKeys,
    );
    expect(summary.scheduledOccurrences).toBe(3);
    expect(summary.completedOccurrences).toBe(3);
    expect(summary.consistencyPercent).toBe(100);
    expect(summary.attention).toEqual([]);
  });

  it('ignores off-day completions and flags a habit with no scheduled-day completions', () => {
    const summary = summarizeHabitWeekOccurrences(
      [
        {
          id: 'h-mwf',
          name: 'Gym',
          target_per_day: 1,
          rule_history: mwfHistory,
          created_at: CREATED,
        },
      ],
      [
        // Tuesday is an off day: must move neither numerator nor denominator.
        { habit_id: 'h-mwf', date_key: '2026-08-18', count: 5 },
      ],
      weekKeys,
    );
    expect(summary.scheduledOccurrences).toBe(3);
    expect(summary.completedOccurrences).toBe(0);
    expect(summary.consistencyPercent).toBe(0);
    expect(summary.attention).toEqual([
      expect.objectContaining({ habitId: 'h-mwf', kind: 'no_completions' }),
    ]);
  });

  it('mixes daily and M/W/F habits into one schedule-aware denominator', () => {
    const summary = summarizeHabitWeekOccurrences(
      [
        {
          id: 'h-daily',
          name: 'Read',
          target_per_day: 1,
          rule_history: dailyHistory,
          created_at: CREATED,
        },
        {
          id: 'h-mwf',
          name: 'Gym',
          target_per_day: 1,
          rule_history: mwfHistory,
          created_at: CREATED,
        },
      ],
      [
        ...weekKeys.map((date_key) => ({ habit_id: 'h-daily', date_key, count: 1 })),
        { habit_id: 'h-mwf', date_key: '2026-08-17', count: 1 },
        { habit_id: 'h-mwf', date_key: '2026-08-19', count: 1 },
      ],
      weekKeys,
    );
    expect(summary.scheduledOccurrences).toBe(10);
    expect(summary.completedOccurrences).toBe(9);
    expect(summary.consistencyPercent).toBe(90);
    expect(summary.attention).toEqual([]);
  });

  it('gives a habit scheduled zero days this week no occurrences and no attention flag', () => {
    const summary = summarizeHabitWeekOccurrences(
      [
        {
          id: 'h-daily',
          name: 'Read',
          target_per_day: 1,
          rule_history: dailyHistory,
          created_at: CREATED,
        },
        {
          id: 'h-future',
          name: 'Future',
          target_per_day: 1,
          // Effective after the reviewed week: no rule covers any week date.
          rule_history: JSON.stringify([createHabitRule('2026-08-24', [1, 2, 3, 4, 5, 6, 7], 1)]),
          created_at: '2026-08-24T12:00:00.000Z',
        },
      ],
      weekKeys.map((date_key) => ({ habit_id: 'h-daily', date_key, count: 1 })),
      weekKeys,
    );
    expect(summary.scheduledOccurrences).toBe(7);
    expect(summary.completedOccurrences).toBe(7);
    expect(summary.consistencyPercent).toBe(100);
    expect(summary.attention).toEqual([]);
  });

  it('returns null consistency when nothing was scheduled at all', () => {
    const summary = summarizeHabitWeekOccurrences(
      [
        {
          id: 'h-future',
          name: 'Future',
          target_per_day: 1,
          rule_history: JSON.stringify([createHabitRule('2026-08-24', [1, 2, 3, 4, 5, 6, 7], 1)]),
          created_at: '2026-08-24T12:00:00.000Z',
        },
      ],
      [],
      weekKeys,
    );
    expect(summary.scheduledOccurrences).toBe(0);
    expect(summary.completedOccurrences).toBe(0);
    expect(summary.consistencyPercent).toBeNull();
    expect(summary.attention).toEqual([]);
  });

  it('resolves the per-date rule target when the schedule changes mid-week', () => {
    const history = JSON.stringify([
      createHabitRule('2026-08-01', [1, 2, 3, 4, 5, 6, 7], 1),
      // Friday onward the target doubles.
      createHabitRule('2026-08-21', [1, 2, 3, 4, 5, 6, 7], 2),
    ]);
    const summary = summarizeHabitWeekOccurrences(
      [
        {
          id: 'h',
          name: 'Pushups',
          target_per_day: 1,
          rule_history: history,
          created_at: CREATED,
        },
      ],
      [
        // One rep completes Mon–Thu (target 1) but not Fri–Sun (target 2).
        ...weekKeys.map((date_key) => ({ habit_id: 'h', date_key, count: 1 })),
      ],
      weekKeys,
    );
    expect(summary.scheduledOccurrences).toBe(7);
    expect(summary.completedOccurrences).toBe(4);
    expect(summary.consistencyPercent).toBe(57);
    expect(summary.attention).toEqual([]);
  });

  it('masks paused lifecycle dates so pauses never count as misses', () => {
    const summary = summarizeHabitWeekOccurrences(
      [
        {
          id: 'h',
          name: 'Read',
          target_per_day: 1,
          rule_history: dailyHistory,
          created_at: CREATED,
          status: 'active',
          lifecycle_history: JSON.stringify([
            { status: 'paused', from_date_key: '2026-08-18', to_date_key: '2026-08-19' },
          ]),
        },
      ],
      [
        { habit_id: 'h', date_key: '2026-08-17', count: 1 },
        { habit_id: 'h', date_key: '2026-08-20', count: 1 },
        { habit_id: 'h', date_key: '2026-08-21', count: 1 },
        { habit_id: 'h', date_key: '2026-08-22', count: 1 },
        { habit_id: 'h', date_key: '2026-08-23', count: 1 },
      ],
      weekKeys,
    );
    expect(summary.scheduledOccurrences).toBe(5);
    expect(summary.completedOccurrences).toBe(5);
    expect(summary.consistencyPercent).toBe(100);
    expect(summary.attention).toEqual([]);
  });

  it('masks a fully paused week with no occurrences and no attention flag', () => {
    const summary = summarizeHabitWeekOccurrences(
      [
        {
          id: 'h',
          name: 'Read',
          target_per_day: 1,
          rule_history: dailyHistory,
          created_at: CREATED,
          status: 'paused',
          lifecycle_history: JSON.stringify([
            { status: 'paused', from_date_key: '2026-08-17', to_date_key: null },
          ]),
        },
      ],
      [],
      weekKeys,
    );
    expect(summary.scheduledOccurrences).toBe(0);
    expect(summary.consistencyPercent).toBeNull();
    expect(summary.attention).toEqual([]);
  });

  it('pins M/W/F scheduled days to local Mon/Wed/Fri in every timezone matrix zone', () => {
    // Executed under each zone in `scripts/qa-timezones.mjs`: weekday
    // resolution must use local-midnight semantics (`dateKeyToLocalDate`), so
    // the scheduled set stays {Mon, Wed, Fri} west of UTC too. A UTC-parse
    // regression would shift the window a day and drop completions.
    const week = getReviewWeek('2026-08-19');
    const keys = listWeekDateKeys(week.startDateKey, 7);
    expect(keys).toEqual([
      '2026-08-17',
      '2026-08-18',
      '2026-08-19',
      '2026-08-20',
      '2026-08-21',
      '2026-08-22',
      '2026-08-23',
    ]);
    const summary = summarizeHabitWeekOccurrences(
      [
        {
          id: 'h-mwf',
          name: 'Gym',
          target_per_day: 1,
          rule_history: mwfHistory,
          created_at: CREATED,
        },
      ],
      [
        { habit_id: 'h-mwf', date_key: '2026-08-17', count: 1 },
        { habit_id: 'h-mwf', date_key: '2026-08-19', count: 1 },
        { habit_id: 'h-mwf', date_key: '2026-08-21', count: 1 },
      ],
      keys,
    );
    expect(summary.scheduledOccurrences).toBe(3);
    expect(summary.completedOccurrences).toBe(3);
    expect(summary.consistencyPercent).toBe(100);
  });
});

describe('buildNextWeekPlanSuggestions', () => {
  it('returns empty for no candidates', () => {
    expect(
      buildNextWeekPlanSuggestions({ candidateTodoIds: [], nextWeekStartDateKey: '2026-08-24' }),
    ).toEqual([]);
  });

  it('distributes at most 3 candidates per day in input order', () => {
    const suggestions = buildNextWeekPlanSuggestions({
      candidateTodoIds: ['t1', 't2', 't3', 't4', 't5'],
      nextWeekStartDateKey: '2026-08-24',
    });
    expect(suggestions).toEqual([
      { dateKey: '2026-08-24', todoIds: ['t1', 't2', 't3'] },
      { dateKey: '2026-08-25', todoIds: ['t4', 't5'] },
    ]);
  });

  it('caps at 7 days and drops the remainder beyond a full week', () => {
    const candidateTodoIds = Array.from({ length: 25 }, (_, i) => `t${i + 1}`);
    const suggestions = buildNextWeekPlanSuggestions({
      candidateTodoIds,
      nextWeekStartDateKey: '2026-08-24',
    });
    expect(suggestions).toHaveLength(7);
    const total = suggestions.reduce((sum, s) => sum + s.todoIds.length, 0);
    expect(total).toBe(21); // 7 days x 3
  });

  it('deduplicates candidate ids deterministically', () => {
    const suggestions = buildNextWeekPlanSuggestions({
      candidateTodoIds: ['t1', 't1', 't2'],
      nextWeekStartDateKey: '2026-08-24',
    });
    expect(suggestions).toEqual([{ dateKey: '2026-08-24', todoIds: ['t1', 't2'] }]);
  });

  it('returns empty for an invalid start date key', () => {
    expect(
      buildNextWeekPlanSuggestions({ candidateTodoIds: ['t1'], nextWeekStartDateKey: 'nope' }),
    ).toEqual([]);
  });

  it('crosses month boundaries using local-calendar arithmetic', () => {
    const suggestions = buildNextWeekPlanSuggestions({
      candidateTodoIds: ['t1', 't2', 't3', 't4', 't5', 't6', 't7'],
      nextWeekStartDateKey: '2026-08-30',
    });
    // The function only shifts local-calendar days, so day 3 crosses into September.
    expect(suggestions[0].dateKey).toBe('2026-08-30');
    expect(suggestions[1].dateKey).toBe('2026-08-31');
    expect(suggestions[2].dateKey).toBe('2026-09-01');
  });
});
