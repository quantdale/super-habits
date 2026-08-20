import { describe, expect, it } from 'vitest';
import {
  computeGoalRollup,
  describeGoalHorizon,
  filterGoalRows,
  parseGoalProgressText,
  sortGoalRows,
  type GoalListRow,
} from '@/features/goals/goals.domain';
import type { Goal } from '@/core/db/types';

function makeGoal(overrides: Partial<Goal> = {}): Goal {
  return {
    id: 'goal_1',
    project_id: null,
    title: 'Test Goal',
    description: null,
    horizon: 'month',
    target_date: null,
    status: 'active',
    completed_at: null,
    progress_percent: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted_at: null,
    ...overrides,
  };
}

function makeRow(goal: Partial<Goal>): GoalListRow {
  return { goal: makeGoal(goal), projectName: null };
}

describe('describeGoalHorizon', () => {
  it('maps each horizon to a fixed window except custom', () => {
    expect(describeGoalHorizon('week').windowDays).toBe(7);
    expect(describeGoalHorizon('month').windowDays).toBe(30);
    expect(describeGoalHorizon('quarter').windowDays).toBe(91);
    expect(describeGoalHorizon('year').windowDays).toBe(365);
    expect(describeGoalHorizon('custom').windowDays).toBeNull();
  });

  it('always provides a label and cadence hint', () => {
    for (const horizon of ['week', 'month', 'quarter', 'year', 'custom'] as const) {
      const p = describeGoalHorizon(horizon);
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.cadenceHint.length).toBeGreaterThan(0);
    }
  });
});

describe('computeGoalRollup', () => {
  it('returns empty when no linked entities', () => {
    const r = computeGoalRollup({
      todos: { total: 0, done: 0 },
      habits: { habitCount: 0, completionsInWindow: 0, windowDays: 30 },
    });
    expect(r.isEmpty).toBe(true);
    expect(r.suggestedPercent).toBe(0);
  });

  it('computes linked-todo done/total ratio', () => {
    const r = computeGoalRollup({
      todos: { total: 4, done: 3 },
      habits: { habitCount: 0, completionsInWindow: 0, windowDays: 30 },
    });
    expect(r.todoRatio).toBeCloseTo(0.75);
    expect(r.suggestedPercent).toBe(75);
  });

  it('computes habit consistency capped at 1', () => {
    const over = computeGoalRollup({
      todos: { total: 0, done: 0 },
      habits: { habitCount: 1, completionsInWindow: 50, windowDays: 30 },
    });
    expect(over.habitConsistency).toBe(1);

    const half = computeGoalRollup({
      todos: { total: 0, done: 0 },
      habits: { habitCount: 2, completionsInWindow: 30, windowDays: 30 },
    });
    expect(half.habitConsistency).toBeCloseTo(0.5);
    expect(half.suggestedPercent).toBe(50);
  });

  it('blends todo ratio and habit consistency evenly', () => {
    const r = computeGoalRollup({
      todos: { total: 2, done: 1 }, // 0.5
      habits: { habitCount: 1, completionsInWindow: 15, windowDays: 30 }, // 0.5
    });
    expect(r.suggestedPercent).toBe(50);
  });
});

describe('parseGoalProgressText', () => {
  it('accepts plain and percent-suffixed integers', () => {
    expect(parseGoalProgressText('42')).toEqual({ ok: true, value: 42 });
    expect(parseGoalProgressText(' 7% ')).toEqual({ ok: true, value: 7 });
    expect(parseGoalProgressText('0')).toEqual({ ok: true, value: 0 });
    expect(parseGoalProgressText('100')).toEqual({ ok: true, value: 100 });
  });

  it('rejects non-integers, negatives, and out-of-range values', () => {
    expect(parseGoalProgressText('').ok).toBe(false);
    expect(parseGoalProgressText('abc').ok).toBe(false);
    expect(parseGoalProgressText('12.5').ok).toBe(false);
    expect(parseGoalProgressText('-3').ok).toBe(false);
    expect(parseGoalProgressText('101').ok).toBe(false);
  });
});

describe('filterGoalRows / sortGoalRows', () => {
  const rows = [
    makeRow({ id: 'a', status: 'active', horizon: 'week', progress_percent: 10 }),
    makeRow({ id: 'b', status: 'completed', horizon: 'year', progress_percent: 90 }),
    makeRow({ id: 'c', status: 'active', horizon: 'year', progress_percent: 50 }),
  ];

  it('filters by status and horizon independently and together', () => {
    expect(filterGoalRows(rows, { status: 'all', horizon: 'all' })).toHaveLength(3);
    expect(
      filterGoalRows(rows, { status: 'active', horizon: 'all' }).map((r) => r.goal.id),
    ).toEqual(['a', 'c']);
    expect(
      filterGoalRows(rows, { status: 'all', horizon: 'year' }).map((r) => r.goal.id),
    ).toEqual(['b', 'c']);
    expect(
      filterGoalRows(rows, { status: 'completed', horizon: 'year' }).map((r) => r.goal.id),
    ).toEqual(['b']);
  });

  it('sorts by progress descending and target date ascending with undated last', () => {
    expect(sortGoalRows(rows, 'progress').map((r) => r.goal.id)).toEqual(['b', 'c', 'a']);
    const dated = [
      makeRow({ id: 'x', target_date: '2026-12-01' }),
      makeRow({ id: 'y', target_date: null }),
      makeRow({ id: 'z', target_date: '2026-06-01' }),
    ];
    expect(sortGoalRows(dated, 'target_date').map((r) => r.goal.id)).toEqual([
      'z',
      'x',
      'y',
    ]);
  });

  it('sorts by title and preserves created order for the created key', () => {
    const titled = [makeRow({ id: '1', title: 'Beta' }), makeRow({ id: '2', title: 'Alpha' })];
    expect(sortGoalRows(titled, 'title').map((r) => r.goal.title)).toEqual([
      'Alpha',
      'Beta',
    ]);
    expect(sortGoalRows(titled, 'created').map((r) => r.goal.id)).toEqual(['1', '2']);
  });
});
