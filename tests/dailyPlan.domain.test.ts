import { describe, it, expect } from 'vitest';
import {
  computeCarryForwardIds,
  computeAdherenceStreaks,
  selectScheduledHabitNamesForPlan,
  type ScheduledPlanHabit,
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

describe('selectScheduledHabitNamesForPlan', () => {
  // 2026-09-20 is a Sunday (weekday 7); fixed keys keep the suite clock-free.
  const DATE_KEY = '2026-09-20';
  const everydayRule = JSON.stringify([
    { effective_from_date: '2020-01-01', weekdays: [1, 2, 3, 4, 5, 6, 7], target_per_day: 1 },
  ]);
  const mondayOnlyRule = JSON.stringify([
    { effective_from_date: '2020-01-01', weekdays: [1], target_per_day: 1 },
  ]);

  const habit = (overrides: Partial<ScheduledPlanHabit> = {}): ScheduledPlanHabit => ({
    name: 'Morning run',
    target_per_day: 1,
    rule_history: everydayRule,
    ...overrides,
  });

  it('lists active habits scheduled on the date', () => {
    expect(selectScheduledHabitNamesForPlan([habit({ name: 'Run' })], DATE_KEY)).toEqual(['Run']);
  });

  it('treats legacy rows without status as active', () => {
    const legacy = habit({ name: 'Legacy' });
    delete (legacy as Partial<ScheduledPlanHabit>).status;
    expect(selectScheduledHabitNamesForPlan([legacy], DATE_KEY)).toEqual(['Legacy']);
  });

  it('still excludes habits not scheduled on the date', () => {
    expect(
      selectScheduledHabitNamesForPlan(
        [habit({ name: 'Monday only', rule_history: mondayOnlyRule })],
        DATE_KEY,
      ),
    ).toEqual([]);
  });

  it('excludes a paused habit with an open pause interval', () => {
    expect(
      selectScheduledHabitNamesForPlan(
        [
          habit({
            name: 'Paused run',
            status: 'paused',
            lifecycle_history: JSON.stringify([
              { status: 'paused', from_date_key: '2026-09-18', to_date_key: null },
            ]),
          }),
        ],
        DATE_KEY,
      ),
    ).toEqual([]);
  });

  it('excludes an archived habit', () => {
    expect(
      selectScheduledHabitNamesForPlan(
        [
          habit({
            name: 'Retired run',
            status: 'archived',
            lifecycle_history: JSON.stringify([
              { status: 'archived', from_date_key: '2026-09-18', to_date_key: null },
            ]),
          }),
        ],
        DATE_KEY,
      ),
    ).toEqual([]);
  });

  it('excludes a paused-status row even without interval history (legacy backfill shape)', () => {
    expect(
      selectScheduledHabitNamesForPlan(
        [habit({ name: 'Paused legacy', status: 'paused' })],
        DATE_KEY,
      ),
    ).toEqual([]);
  });

  it('excludes a date masked by a closed interval even when the row is active again', () => {
    expect(
      selectScheduledHabitNamesForPlan(
        [
          habit({
            name: 'Resumed run',
            status: 'active',
            lifecycle_history: JSON.stringify([
              { status: 'paused', from_date_key: '2026-09-18', to_date_key: '2026-09-22' },
            ]),
          }),
        ],
        DATE_KEY,
      ),
    ).toEqual([]);
  });

  it('lists only the active scheduled habits from a mixed list', () => {
    expect(
      selectScheduledHabitNamesForPlan(
        [
          habit({ name: 'Active run' }),
          habit({ name: 'Paused run', status: 'paused' }),
          habit({ name: 'Archived run', status: 'archived' }),
          habit({ name: 'Monday only', rule_history: mondayOnlyRule }),
        ],
        DATE_KEY,
      ),
    ).toEqual(['Active run']);
  });
});
