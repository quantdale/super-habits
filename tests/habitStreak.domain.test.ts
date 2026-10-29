import { describe, expect, it } from 'vitest';
import {
  computeStreakRun,
  fillStreakDayGaps,
  type StreakRunDay,
} from '@/features/habits/habitStreak.domain';
import {
  calculateCurrentStreak,
  calculateLongestStreak,
  buildDayCompletions,
  createHabitRule,
  serializeHabitLifecycleHistory,
  type HabitWeekday,
} from '@/features/habits/habits.domain';
import { computeStreakSummary } from '@/features/gamification/gamification.domain';
import type { StreakDay } from '@/features/gamification/gamification.types';
import { addLocalDays, buildDateRangeOldestFirst } from '@/lib/time';

/**
 * ONE streak definition (audit C #10).
 *
 * The Habits tab, the per-habit insights, Ask, and the reward ledger used to run
 * three walkers with different grace/bridge rules, so two numbers labelled
 * "streak" could disagree on the same data. These tests pin the shared engine,
 * and pin that the habit and reward adapters both go through it.
 */

const TODAY = '2026-06-10'; // Wednesday
const YESTERDAY = '2026-06-09';

function run(endKey: string, length: number): StreakRunDay[] {
  const days: StreakRunDay[] = [];
  for (let offset = length - 1; offset >= 0; offset -= 1) {
    days.push({
      dateKey: addLocalDays(endKey, -offset),
      required: true,
      completed: true,
    });
  }
  return days;
}

function completion(dateKey: string): { date_key: string; count: number } {
  return { date_key: dateKey, count: 1 };
}

describe('computeStreakRun — one definition of a streak day', () => {
  it('counts completed required days and stops at an unfrozen miss', () => {
    const days: StreakRunDay[] = [
      ...run(YESTERDAY, 3),
      { dateKey: TODAY, required: true, completed: false },
    ];
    expect(computeStreakRun(days, TODAY)).toMatchObject({
      current: 3,
      longest: 3,
      activeToday: false,
      atRisk: true,
    });
  });

  it('counts today once it is complete', () => {
    const days = run(TODAY, 4);
    expect(computeStreakRun(days, TODAY)).toMatchObject({
      current: 4,
      activeToday: true,
      atRisk: false,
      lastActiveDateKey: TODAY,
    });
  });

  it('bridges a not-required day instead of breaking the run (habit off-day)', () => {
    const days: StreakRunDay[] = [
      { dateKey: '2026-06-08', required: true, completed: true },
      // A weekly rest day: no obligation, so it neither counts nor breaks.
      { dateKey: '2026-06-09', required: false, completed: false },
      { dateKey: '2026-06-10', required: true, completed: true },
    ];
    expect(computeStreakRun(days, TODAY)).toMatchObject({ current: 2, longest: 2 });
  });

  it('bridges a frozen day without adding to the count', () => {
    const days: StreakRunDay[] = [
      { dateKey: '2026-06-07', required: true, completed: true },
      { dateKey: '2026-06-08', required: true, completed: true },
      { dateKey: '2026-06-09', required: true, completed: false, frozen: true },
      { dateKey: '2026-06-10', required: true, completed: true },
    ];
    expect(computeStreakRun(days, TODAY)).toMatchObject({ current: 3, longest: 3 });
  });

  it('breaks at a required miss older than one day', () => {
    const days: StreakRunDay[] = [
      ...run('2026-06-06', 3),
      { dateKey: '2026-06-07', required: true, completed: false },
      { dateKey: '2026-06-09', required: true, completed: true },
      { dateKey: '2026-06-10', required: true, completed: true },
    ];
    const summary = computeStreakRun(days, TODAY);
    expect(summary.current).toBe(2);
    expect(summary.longest).toBe(3);
    expect(summary.lastActiveDateKey).toBe(TODAY);
  });

  it('keeps the longest run found anywhere in the history', () => {
    const days: StreakRunDay[] = [...run('2026-05-20', 9), ...run(TODAY, 2)];
    expect(computeStreakRun(days, TODAY)).toMatchObject({ current: 2, longest: 9 });
  });

  it('ignores malformed keys and empty histories', () => {
    expect(computeStreakRun([], TODAY)).toMatchObject({ current: 0, longest: 0 });
    expect(
      computeStreakRun([{ dateKey: 'not-a-day', required: true, completed: true }], TODAY),
    ).toMatchObject({ current: 0, longest: 0 });
  });

  it('uses lib/time day walking, so a DST boundary is still one calendar day', () => {
    // US spring-forward 2026 is 2026-03-08: that local day is 23 hours long.
    const days: StreakRunDay[] = [
      { dateKey: '2026-03-07', required: true, completed: true },
      { dateKey: '2026-03-08', required: true, completed: true },
      { dateKey: '2026-03-09', required: true, completed: true },
    ];
    expect(computeStreakRun(days, '2026-03-09')).toMatchObject({ current: 3, longest: 3 });
  });
});

describe('computeStreakRun — sparse reward-ledger mode', () => {
  it('survives on grace while yesterday is active', () => {
    const days: StreakRunDay[] = run(YESTERDAY, 3);
    expect(computeStreakRun(days, TODAY, { sparse: true })).toMatchObject({
      current: 3,
      atRisk: true,
    });
  });

  it('requires yesterday to be active or frozen, exactly like the reward ledger always did', () => {
    const days: StreakRunDay[] = run('2026-06-06', 5);
    expect(computeStreakRun(days, TODAY, { sparse: true })).toMatchObject({
      current: 0,
      longest: 5,
      atRisk: false,
    });
  });

  it('bridges a frozen day in sparse mode', () => {
    const days: StreakRunDay[] = [
      ...run('2026-06-08', 2),
      { dateKey: '2026-06-09', required: true, completed: false, frozen: true },
      { dateKey: '2026-06-10', required: true, completed: true },
    ];
    expect(computeStreakRun(days, TODAY, { sparse: true })).toMatchObject({
      current: 3,
      longest: 3,
    });
  });
});

describe('fillStreakDayGaps', () => {
  it('fills every missing day between the first record and the end key', () => {
    const filled = fillStreakDayGaps(
      [
        { dateKey: '2026-06-08', required: true, completed: true },
        { dateKey: '2026-06-10', required: true, completed: true },
      ],
      TODAY,
    );
    expect(filled.map((day) => day.dateKey)).toEqual(['2026-06-08', '2026-06-09', '2026-06-10']);
    expect(filled[1]).toMatchObject({ required: true, completed: false });
  });
});

// ---------------------------------------------------------------------------
// adapters: the habit surfaces and the reward ledger both delegate here
// ---------------------------------------------------------------------------

function habitDays(
  history: ReturnType<typeof createHabitRule>[],
  completedKeys: readonly string[],
  todayKey: string,
  lifecycleHistory?: string,
) {
  const completions = completedKeys.map(completion);
  return buildDayCompletions(
    completions,
    1,
    undefined,
    history,
    undefined,
    todayKey,
    lifecycleHistory,
  );
}

describe('habit streak surfaces share the engine', () => {
  const everyDay = [createHabitRule('2026-06-01', [1, 2, 3, 4, 5, 6, 7], 1)];

  it('counts a scheduled day only when the habit is scheduled on it', () => {
    // Mon/Wed/Fri only: Tue/Thu/Sat/Sun are not obligations and never break.
    const weekdaysOnly = [
      createHabitRule('2026-06-01', [1, 3, 5] as HabitWeekday[], 1),
    ] as ReturnType<typeof createHabitRule>[];
    const days = habitDays(
      weekdaysOnly,
      ['2026-06-01', '2026-06-03', '2026-06-05', '2026-06-08', '2026-06-10'],
      TODAY,
    );
    expect(calculateCurrentStreak(days, TODAY)).toBe(5);
    expect(calculateLongestStreak(days, TODAY)).toBe(5);
  });

  it('grants grace while today is not yet done', () => {
    const days = habitDays(everyDay, ['2026-06-08', '2026-06-09'], TODAY);
    expect(calculateCurrentStreak(days, TODAY)).toBe(2);
  });

  it('breaks at an earlier scheduled miss inside the same window', () => {
    const days = habitDays(everyDay, ['2026-06-06', '2026-06-10'], TODAY);
    // 06-10 is completed; 06-09/06-08/06-07 are misses, so the run is 1.
    expect(calculateCurrentStreak(days, TODAY)).toBe(1);
  });

  it('bridges a paused interval so a pause never fake-breaks a streak', () => {
    const paused = serializeHabitLifecycleHistory([
      { status: 'paused', from_date_key: '2026-06-05', to_date_key: '2026-06-06' },
    ]);
    const days = habitDays(everyDay, ['2026-06-04', '2026-06-07'], TODAY, paused);
    // 06-08..06-10 are misses, so today's run is 0; what matters is that the
    // pause days are excluded from the denominator rather than counted as misses.
    expect(days.filter((day) => day.eligible).map((day) => day.dateKey)).not.toContain(
      '2026-06-05',
    );
    expect(days.filter((day) => day.eligible).map((day) => day.dateKey)).not.toContain(
      '2026-06-06',
    );
  });

  it('feeds the reward streak from the same definition', () => {
    const ledger: StreakDay[] = [
      { dateKey: '2026-06-08', active: true, frozen: false },
      { dateKey: '2026-06-09', active: true, frozen: false },
      { dateKey: TODAY, active: true, frozen: false },
    ];
    const summary = computeStreakSummary(ledger, TODAY);
    const shared = computeStreakRun(
      ledger.map((day) => ({
        dateKey: day.dateKey,
        required: true,
        completed: day.active,
        frozen: day.frozen,
      })),
      TODAY,
      { sparse: true },
    );
    expect(summary.current).toBe(shared.current);
    expect(summary.longest).toBe(shared.longest);
    expect(summary.current).toBe(3);
    expect(summary.atRisk).toBe(false);
  });

  it('keeps the reward streak and the habit streak independent but individually consistent', () => {
    // A reward-active day that is a habit off-day: the reward run continues,
    // the habit run is unaffected — one engine, two schedules, no contradiction.
    const habitOffDay = buildDateRangeOldestFirst(3, new Date(2026, 5, 10)).map((dateKey) => ({
      dateKey,
      required: dateKey !== '2026-06-09',
      completed: dateKey !== '2026-06-09',
    }));
    expect(computeStreakRun(habitOffDay, TODAY).current).toBe(2);
  });
});
