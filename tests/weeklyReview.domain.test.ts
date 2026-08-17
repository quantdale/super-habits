import { describe, it, expect } from 'vitest';
import {
  getReviewWeek,
  validatePriorities,
  validateNewCommitments,
  validateReflection,
  validateTodoDecisions,
  validateReviewDraft,
  generateInsights,
  MAX_REFLECTION_LENGTH,
} from '@/features/weekly-review/weeklyReview.domain';
import type {
  WeeklyReviewDraft,
  WeeklyReviewSummaryV1,
} from '@/features/weekly-review/weeklyReview.types';

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
