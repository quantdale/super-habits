import { describe, it, expect } from 'vitest';
import {
  computeCarryForwardIds,
  computeAdherenceStreaks,
} from '@/features/daily-plan/dailyPlan.domain';

describe('computeCarryForwardIds', () => {
  const unfinished = (ids: string[]) => (todoId: string) => ids.includes(todoId);

  it('carries unfinished previous priorities not already selected', () => {
    expect(
      computeCarryForwardIds({
        previousPlanTopTodoIds: ['a', 'b', 'c'],
        currentPlanTopTodoIds: [],
        isTodoUnfinished: unfinished(['a', 'c']),
      }),
    ).toEqual(['a', 'c']);
  });

  it('is idempotent — no duplicates on repeat', () => {
    const input = {
      previousPlanTopTodoIds: ['a', 'b'],
      currentPlanTopTodoIds: ['a', 'b'],
      isTodoUnfinished: unfinished(['a', 'b']),
    };
    const first = computeCarryForwardIds(input);
    expect(first).toEqual([]);
    // Simulate applying the result and running again.
    const second = computeCarryForwardIds({
      ...input,
      currentPlanTopTodoIds: [...input.currentPlanTopTodoIds, ...first],
    });
    expect(second).toEqual([]);
  });

  it('skips completed todos', () => {
    expect(
      computeCarryForwardIds({
        previousPlanTopTodoIds: ['done1', 'open1'],
        currentPlanTopTodoIds: [],
        isTodoUnfinished: unfinished(['open1']),
      }),
    ).toEqual(['open1']);
  });

  it('respects the three-slot plan capacity', () => {
    expect(
      computeCarryForwardIds({
        previousPlanTopTodoIds: ['a', 'b', 'c', 'd', 'e'],
        currentPlanTopTodoIds: ['x'],
        isTodoUnfinished: unfinished(['a', 'b', 'c', 'd', 'e']),
      }),
    ).toEqual(['a', 'b']);
  });

  it('returns empty when capacity is exhausted', () => {
    expect(
      computeCarryForwardIds({
        previousPlanTopTodoIds: ['a'],
        currentPlanTopTodoIds: ['x', 'y', 'z'],
        isTodoUnfinished: unfinished(['a']),
      }),
    ).toEqual([]);
  });

  it('preserves previous-plan order', () => {
    expect(
      computeCarryForwardIds({
        previousPlanTopTodoIds: ['z', 'm', 'a'],
        currentPlanTopTodoIds: [],
        isTodoUnfinished: unfinished(['a', 'm', 'z']),
      }),
    ).toEqual(['z', 'm', 'a']);
  });
});

describe('computeAdherenceStreaks', () => {
  it('counts consecutive committed days ending yesterday', () => {
    const streaks = computeAdherenceStreaks(
      [
        { date_key: '2026-08-17', status: 'committed' },
        { date_key: '2026-08-18', status: 'committed' },
        { date_key: '2026-08-19', status: 'committed' },
      ],
      '2026-08-20',
    );
    expect(streaks.committedStreak).toBe(3);
    expect(streaks.completedStreak).toBe(0);
  });

  it('does not let an uncommitted today break the run', () => {
    const streaks = computeAdherenceStreaks(
      [
        { date_key: '2026-08-18', status: 'completed' },
        { date_key: '2026-08-19', status: 'completed' },
      ],
      '2026-08-20',
    );
    expect(streaks.committedStreak).toBe(2);
    expect(streaks.completedStreak).toBe(2);
  });

  it('includes today when today is committed/completed', () => {
    const streaks = computeAdherenceStreaks(
      [
        { date_key: '2026-08-19', status: 'committed' },
        { date_key: '2026-08-20', status: 'completed' },
      ],
      '2026-08-20',
    );
    expect(streaks.committedStreak).toBe(2);
    expect(streaks.completedStreak).toBe(1);
  });

  it('breaks on missing days', () => {
    const streaks = computeAdherenceStreaks(
      [
        { date_key: '2026-08-15', status: 'committed' },
        { date_key: '2026-08-19', status: 'committed' },
      ],
      '2026-08-20',
    );
    expect(streaks.committedStreak).toBe(1);
  });

  it('breaks on draft days', () => {
    const streaks = computeAdherenceStreaks(
      [
        { date_key: '2026-08-18', status: 'draft' },
        { date_key: '2026-08-19', status: 'committed' },
      ],
      '2026-08-20',
    );
    expect(streaks.committedStreak).toBe(1);
    expect(streaks.completedStreak).toBe(0);
  });

  it('handles empty history', () => {
    expect(computeAdherenceStreaks([], '2026-08-20')).toEqual({
      committedStreak: 0,
      completedStreak: 0,
    });
  });

  it('crosses month boundaries', () => {
    const streaks = computeAdherenceStreaks(
      [
        { date_key: '2026-07-30', status: 'completed' },
        { date_key: '2026-07-31', status: 'completed' },
        { date_key: '2026-08-01', status: 'completed' },
      ],
      '2026-08-02',
    );
    expect(streaks.completedStreak).toBe(3);
  });
});
