import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CARD_LAYOUT,
  OVERVIEW_CARD_IDS,
  formatDueDateLabel,
  getGreeting,
  isCardVisible,
  moveCard,
  parseCardLayout,
  serializeCardLayout,
  shapeCaloriesSummary,
  shapeFocusWeekSummary,
  shapeGoalsSummary,
  shapeHabitsSummary,
  shapePlanProgressSummary,
  shapeProjectsSummary,
  shapeTodosSummary,
  shapeWorkoutSummary,
  toggleCardVisibility,
  type OverviewCardId,
} from '@/features/overview/overview.domain';
import type { DailyPlan } from '@/core/db/types';
import type { Todo } from '@/features/todos/types';

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: 'todo_1',
    title: 'Task',
    notes: null,
    completed: 0,
    due_date: null,
    priority: 'normal',
    sort_order: 0,
    recurrence: null,
    recurrence_id: null,
    project_id: null,
    goal_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('card layout persistence helpers', () => {
  it('returns the default layout for empty/null input', () => {
    expect(parseCardLayout(null)).toEqual(DEFAULT_CARD_LAYOUT);
    expect(parseCardLayout(undefined)).toEqual(DEFAULT_CARD_LAYOUT);
    expect(parseCardLayout('')).toEqual(DEFAULT_CARD_LAYOUT);
    expect(parseCardLayout('not json')).toEqual(DEFAULT_CARD_LAYOUT);
    expect(parseCardLayout('{"a":1}')).toEqual(DEFAULT_CARD_LAYOUT);
  });

  it('parses a valid layout and drops unknown ids and duplicates', () => {
    const raw = JSON.stringify(['todos', 'bogus', 'habits', 'todos']);
    expect(parseCardLayout(raw)).toEqual<OverviewCardId[]>(['todos', 'habits']);
  });

  it('honors an explicitly empty layout (hide everything)', () => {
    expect(parseCardLayout('[]')).toEqual([]);
  });

  it('serializes and round-trips', () => {
    const layout: OverviewCardId[] = ['focus', 'plan'];
    expect(serializeCardLayout(layout)).toBe(JSON.stringify(layout));
    expect(parseCardLayout(serializeCardLayout(layout))).toEqual(layout);
  });

  it('serialize dedupes and drops unknown ids', () => {
    expect(
      parseCardLayout(serializeCardLayout(['focus', 'nope' as OverviewCardId, 'focus'])),
    ).toEqual(['focus']);
  });

  it('isCardVisible reflects the layout', () => {
    expect(isCardVisible(['todos'], 'todos')).toBe(true);
    expect(isCardVisible(['todos'], 'habits')).toBe(false);
  });

  it('toggleCardVisibility removes and re-inserts at default position', () => {
    const full = [...OVERVIEW_CARD_IDS];
    const withoutHabits = toggleCardVisibility(full, 'habits');
    expect(withoutHabits).not.toContain('habits');
    expect(withoutHabits.length).toBe(full.length - 1);
    // Re-inserting lands before the first card whose default order comes later.
    const restored = toggleCardVisibility(withoutHabits, 'habits');
    expect(restored).toEqual(full);
  });

  it('moveCard swaps neighbors and is safe at boundaries', () => {
    const a = 'a' as OverviewCardId;
    const b = 'b' as OverviewCardId;
    const c = 'c' as OverviewCardId;
    const layout: OverviewCardId[] = [a, b, c];
    expect(moveCard(layout, b, -1)).toEqual([b, a, c]);
    expect(moveCard(layout, b, 1)).toEqual([a, c, b]);
    expect(moveCard(layout, a, -1)).toEqual([a, b, c]);
    expect(moveCard(layout, c, 1)).toEqual([a, b, c]);
    expect(moveCard(layout, 'zzz' as OverviewCardId, 1)).toEqual([a, b, c]);
  });
});

describe('greeting / date logic', () => {
  it('maps hours to greetings', () => {
    expect(getGreeting(4)).toBe('Good night');
    expect(getGreeting(5)).toBe('Good morning');
    expect(getGreeting(11)).toBe('Good morning');
    expect(getGreeting(12)).toBe('Good afternoon');
    expect(getGreeting(17)).toBe('Good afternoon');
    expect(getGreeting(18)).toBe('Good evening');
    expect(getGreeting(23)).toBe('Good evening');
  });

  it('labels due dates relative to today', () => {
    expect(formatDueDateLabel('2026-01-01', '2026-01-02')).toBe('Overdue');
    expect(formatDueDateLabel('2026-01-02', '2026-01-02')).toBe('Due today');
    expect(formatDueDateLabel('2026-01-03', '2026-01-02')).toBe('Due 2026-01-03');
  });
});

describe('shapeTodosSummary', () => {
  const today = '2026-03-10';
  it('buckets overdue, due-today, and pending; preview bounded to 4', () => {
    const todos = [
      makeTodo({ id: '1', title: 'old', due_date: '2026-03-08' }),
      makeTodo({ id: '2', title: 'today', due_date: today }),
      makeTodo({ id: '3', title: 'future', due_date: '2026-03-12' }),
      makeTodo({ id: '4', title: 'someday' }),
      makeTodo({ id: '5', title: 'done', completed: 1 }),
      makeTodo({ id: '6', title: 'extra-pending' }),
    ];
    const summary = shapeTodosSummary(todos, today);
    expect(summary.overdueCount).toBe(1);
    expect(summary.dueTodayCount).toBe(1);
    expect(summary.pendingCount).toBe(5);
    expect(summary.preview.map((t) => t.id)).toEqual(['1', '2', '3', '4']);
  });

  it('handles an empty list', () => {
    const summary = shapeTodosSummary([], today);
    expect(summary.pendingCount).toBe(0);
    expect(summary.preview).toEqual([]);
  });
});

describe('shapePlanProgressSummary', () => {
  function makePlan(overrides: Partial<DailyPlan> = {}): DailyPlan {
    return {
      id: 'plan_1',
      date_key: '2026-03-10',
      intention: 'Ship it',
      top_todo_ids: '["t1","t2","missing"]',
      focus_target_minutes: 120,
      notes: '',
      reflection: '',
      energy_score: null,
      status: 'committed',
      completed_at: null,
      created_at: '',
      updated_at: '',
      deleted_at: null,
      ...overrides,
    };
  }

  it('counts only existing top todos and their completion', () => {
    const todos = [makeTodo({ id: 't1', completed: 1 }), makeTodo({ id: 't2' })];
    const summary = shapePlanProgressSummary(makePlan(), todos);
    expect(summary.hasPlan).toBe(true);
    expect(summary.totalPriorities).toBe(2);
    expect(summary.completedPriorities).toBe(1);
    expect(summary.intention).toBe('Ship it');
    expect(summary.status).toBe('committed');
  });

  it('reports no plan when null', () => {
    expect(shapePlanProgressSummary(null, [])).toEqual({
      hasPlan: false,
      status: null,
      intention: null,
      totalPriorities: 0,
      completedPriorities: 0,
    });
  });
});

describe('shapeHabitsSummary', () => {
  const today = '2026-03-10'; // a Tuesday
  const everyDayHistory = JSON.stringify([
    { effective_from_date: '2026-01-01', weekdays: [1, 2, 3, 4, 5, 6, 7], target_per_day: 2 },
  ]);

  it('builds rings for scheduled habits with today counts capped at target', () => {
    const habits = [
      { id: 'h1', name: 'Water', color: '#00f', target_per_day: 2, rule_history: everyDayHistory },
      { id: 'h2', name: 'Read', color: '#0f0', target_per_day: 1, rule_history: everyDayHistory },
    ];
    const completions = [
      { habit_id: 'h1', date_key: today, count: 5 },
      { habit_id: 'h2', date_key: '2026-03-09', count: 1 },
    ];
    const summary = shapeHabitsSummary(habits, completions, today);
    expect(summary.scheduledToday).toBe(2);
    expect(summary.rings).toEqual([
      { id: 'h1', name: 'Water', color: '#00f', count: 2, target: 2 },
      { id: 'h2', name: 'Read', color: '#0f0', count: 0, target: 1 },
    ]);
    expect(summary.completedToday).toBe(1);
    expect(summary.progressRatio).toBeCloseTo((1 + 0) / 2, 5);
  });

  it('excludes unscheduled habits', () => {
    const weekdayOnly = JSON.stringify([
      { effective_from_date: '2026-01-01', weekdays: [1, 3], target_per_day: 1 }, // Mon/Wed only
    ]);
    const summary = shapeHabitsSummary(
      [{ id: 'h1', name: 'X', color: '#000', target_per_day: 1, rule_history: weekdayOnly }],
      [],
      today,
    );
    expect(summary.scheduledToday).toBe(0);
    expect(summary.rings).toEqual([]);
  });
});

describe('shapeFocusWeekSummary', () => {
  it('sums focus minutes per day across the week, ignoring breaks', () => {
    const weekKeys = ['2026-03-09', '2026-03-10'];
    const sessions = [
      { started_at: '2026-03-09T09:00:00', duration_seconds: 1500, session_type: 'focus' },
      { started_at: '2026-03-09T11:00:00', duration_seconds: 600, session_type: 'short_break' },
      { started_at: '2026-03-10T08:00:00', duration_seconds: 3000, session_type: 'focus' },
    ];
    const summary = shapeFocusWeekSummary(sessions, weekKeys);
    expect(summary.perDayMinutes).toEqual([
      { dateKey: '2026-03-09', minutes: 25 },
      { dateKey: '2026-03-10', minutes: 50 },
    ]);
    expect(summary.focusMinutes).toBe(75);
    expect(summary.sessionCount).toBe(2);
  });

  it('zero-fills days without sessions', () => {
    const summary = shapeFocusWeekSummary([], ['2026-03-09']);
    expect(summary.focusMinutes).toBe(0);
    expect(summary.sessionCount).toBe(0);
    expect(summary.perDayMinutes).toEqual([{ dateKey: '2026-03-09', minutes: 0 }]);
  });
});

describe('shapeWorkoutSummary', () => {
  it('counts this-week sessions and finds the last workout by date key', () => {
    const names = new Map([['r1', 'Push Day']]);
    const logs = [
      { date_key: '2026-03-04', routine_id: 'r1' },
      { date_key: '2026-03-09', routine_id: 'r1' },
      { date_key: '2026-03-10', routine_id: 'r9' },
    ];
    const summary = shapeWorkoutSummary(logs, names, ['2026-03-09', '2026-03-10']);
    expect(summary.sessionsThisWeek).toBe(2);
    expect(summary.lastWorkoutDateKey).toBe('2026-03-10');
    expect(summary.lastWorkoutName).toBeNull();
  });

  it('falls back to created_at when date_key is absent', () => {
    const summary = shapeWorkoutSummary(
      [{ created_at: '2026-03-09T07:00:00.000Z', routine_id: 'r1' }],
      new Map([['r1', 'Legs']]),
      ['2026-03-09'],
    );
    expect(summary.sessionsThisWeek).toBe(1);
    expect(summary.lastWorkoutName).toBe('Legs');
  });
});

describe('shapeCaloriesSummary', () => {
  it('computes consumed, remaining, and ratio', () => {
    const summary = shapeCaloriesSummary([{ calories: 300 }, { calories: 500 }], 2000);
    expect(summary.consumed).toBe(800);
    expect(summary.remaining).toBe(1200);
    expect(summary.ratio).toBeCloseTo(0.4, 5);
  });

  it('clamps remaining at zero when over goal', () => {
    const summary = shapeCaloriesSummary([{ calories: 2500 }], 2000);
    expect(summary.remaining).toBe(0);
    expect(summary.ratio).toBeGreaterThan(1);
  });
});

describe('shapeProjectsSummary / shapeGoalsSummary', () => {
  it('keeps active projects only, bounded preview', () => {
    const projects = [
      { id: 'p1', name: 'A', color: '#111', status: 'active' },
      { id: 'p2', name: 'B', color: '#222', status: 'paused' },
      { id: 'p3', name: 'C', color: '#333', status: 'active' },
    ] as never[];
    const summary = shapeProjectsSummary(projects);
    expect(summary.activeCount).toBe(2);
    expect(summary.preview.map((p) => p.id)).toEqual(['p1', 'p3']);
  });

  it('averages goal progress over active goals', () => {
    const goals = [
      { id: 'g1', title: 'G1', status: 'active', progress_percent: 40 },
      { id: 'g2', title: 'G2', status: 'active', progress_percent: 80 },
      { id: 'g3', title: 'Done', status: 'completed', progress_percent: 100 },
    ] as never[];
    const summary = shapeGoalsSummary(goals);
    expect(summary.activeCount).toBe(2);
    expect(summary.averageProgress).toBe(60);
    expect(summary.preview.map((g) => g.id)).toEqual(['g1', 'g2']);
  });

  it('handles empty inputs', () => {
    expect(shapeProjectsSummary([])).toEqual({ activeCount: 0, preview: [] });
    expect(shapeGoalsSummary([])).toEqual({ activeCount: 0, averageProgress: 0, preview: [] });
  });
});
