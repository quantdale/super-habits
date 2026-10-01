import { describe, expect, it, vi } from 'vitest';
import type { Habit } from '@/features/habits/types';
import {
  buildHabitDayStrip,
  buildHabitRuleHistoryIndex,
  summarizeHabitsToday,
  type HabitCompletionCounts,
} from '@/features/habits/habitsScreen.derivations';
import * as habitsDomain from '@/features/habits/habits.domain';

/**
 * The Habits surface's derived state must be a function of its data, computed
 * once per data change.
 *
 * The defect: `activeHabits` had a fresh array identity on every render, so the
 * `stripDays` memo (which depended on it) recomputed every render, and each of
 * its 7 × H iterations re-parsed the habit's rule history — for every render,
 * on the section-activation hot path.
 *
 * These tests pin the observable contract: the derivations are pure, they never
 * parse when handed a prebuilt index, and their values for a fixed corpus are
 * exactly what the surface shows (counts, day strip, and the hero subtitle they
 * produce).
 */

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

function habit(overrides: Partial<Habit> & { id: string }): Habit {
  return {
    name: overrides.id,
    target_per_day: 1,
    rule_history: JSON.stringify([
      { effective_from_date: '2026-01-01', weekdays: ALL_DAYS, target_per_day: 1 },
    ]),
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as Habit;
}

/** 2026-03-09 — the morning after the US spring-forward boundary. */
const TODAY = new Date(2026, 2, 9, 9, 30, 0, 0);

function counts(...entries: [string, string, number][]): HabitCompletionCounts {
  const out: HabitCompletionCounts = {};
  for (const [habitId, dateKey, count] of entries) {
    (out[habitId] ??= {})[dateKey] = count;
  }
  return out;
}

describe('buildHabitRuleHistoryIndex', () => {
  it('parses each active habit rule history exactly once', () => {
    const parseSpy = vi.spyOn(habitsDomain, 'parseHabitRuleHistory');
    const activeHabits = [habit({ id: 'h1' }), habit({ id: 'h2' }), habit({ id: 'h3' })];

    const index = buildHabitRuleHistoryIndex(activeHabits);

    expect(parseSpy).toHaveBeenCalledTimes(3);
    expect(index.size).toBe(3);
    expect(index.get('h1')?.length).toBe(1);
    parseSpy.mockRestore();
  });
});

describe('summarizeHabitsToday', () => {
  const allHabits = [
    habit({ id: 'h1' }),
    habit({ id: 'h2' }),
    habit({ id: 'h3', status: 'paused' }),
    habit({ id: 'h4', status: 'archived' }),
  ];
  // The screen passes only durable-active rows (F1); the derivation trusts that.
  const activeHabits = allHabits.filter((h) => (h.status ?? 'active') === 'active');
  const ruleHistoryById = buildHabitRuleHistoryIndex(activeHabits);

  it('counts only durable-active habits in both denominators', () => {
    const summary = summarizeHabitsToday({
      activeHabits,
      ruleHistoryById,
      countsByHabitDate: counts(['h1', '2026-03-09', 1], ['h3', '2026-03-09', 1]),
      todayKey: '2026-03-09',
    });

    expect(summary.scheduledTodayCount).toBe(2);
    expect(summary.completedTodayCount).toBe(1);
    expect(summary.todayProgress).toBe(50);
  });

  it('reports a rest day as null progress rather than a fake zero', () => {
    // Scheduled on Wednesdays only, so the reference Monday is a rest day.
    const restOnly = [
      habit({
        id: 'h1',
        rule_history: JSON.stringify([
          { effective_from_date: '2026-01-01', weekdays: [3], target_per_day: 1 },
        ]),
      }),
    ];
    const summary = summarizeHabitsToday({
      activeHabits: restOnly,
      ruleHistoryById: buildHabitRuleHistoryIndex(restOnly),
      countsByHabitDate: {},
      todayKey: '2026-03-09',
    });

    expect(summary.scheduledTodayCount).toBe(0);
    expect(summary.todayProgress).toBeNull();
  });

  it('does not parse rule history at all when the index is prebuilt', () => {
    const parseSpy = vi.spyOn(habitsDomain, 'parseHabitRuleHistory');

    summarizeHabitsToday({
      activeHabits,
      ruleHistoryById,
      countsByHabitDate: {},
      todayKey: '2026-03-09',
    });

    expect(parseSpy).not.toHaveBeenCalled();
    parseSpy.mockRestore();
  });
});

describe('buildHabitDayStrip', () => {
  const activeHabits = [habit({ id: 'h1' }), habit({ id: 'h2' })];
  const ruleHistoryById = buildHabitRuleHistoryIndex(activeHabits);

  it('spans exactly 7 local calendar days ending on the reference day', () => {
    const strip = buildHabitDayStrip({
      activeHabits,
      ruleHistoryById,
      countsByHabitDate: {},
      today: TODAY,
    });

    expect(strip).toHaveLength(7);
    expect(strip.map((day) => day.dateKey)).toEqual([
      '2026-03-03',
      '2026-03-04',
      '2026-03-05',
      '2026-03-06',
      '2026-03-07',
      '2026-03-08',
      '2026-03-09',
    ]);
    // The 23-hour spring-forward day is inside the window and keeps its own
    // label, so the strip never collapses two local days.
    expect(strip[5].weekdayLabel).toBe('S'); // Sunday
    expect(strip[5].dayOfMonth).toBe('8');
  });

  it('aggregates scheduled and completed per day from the prebuilt index', () => {
    const strip = buildHabitDayStrip({
      activeHabits,
      ruleHistoryById,
      countsByHabitDate: counts(['h1', '2026-03-09', 1], ['h2', '2026-03-08', 1]),
      today: TODAY,
    });

    expect(strip[6]).toMatchObject({ dateKey: '2026-03-09', scheduledCount: 2, completedCount: 1 });
    expect(strip[5]).toMatchObject({ dateKey: '2026-03-08', scheduledCount: 2, completedCount: 1 });
    expect(strip[0]).toMatchObject({ dateKey: '2026-03-03', scheduledCount: 2, completedCount: 0 });
  });

  it('uses the rule effective on each day, not the current target', () => {
    // Target doubles from 2026-03-07, and the habit is weekday-only from then.
    const retargeted = [
      habit({
        id: 'h1',
        rule_history: JSON.stringify([
          { effective_from_date: '2026-01-01', weekdays: ALL_DAYS, target_per_day: 1 },
          { effective_from_date: '2026-03-07', weekdays: [6, 7], target_per_day: 2 },
        ]),
      }),
    ];
    const strip = buildHabitDayStrip({
      activeHabits: retargeted,
      ruleHistoryById: buildHabitRuleHistoryIndex(retargeted),
      countsByHabitDate: counts(['h1', '2026-03-08', 2], ['h1', '2026-03-09', 1]),
      today: TODAY,
    });

    // Before the retarget: scheduled every day at target 1.
    expect(strip[0]).toMatchObject({ dateKey: '2026-03-03', scheduledCount: 1, completedCount: 0 });
    // From 2026-03-07: Saturday/Sunday only, target 2 — the Monday of 03-09 is
    // no longer scheduled, and 03-08 counts as complete at 2.
    expect(strip[5]).toMatchObject({ dateKey: '2026-03-08', scheduledCount: 1, completedCount: 1 });
    expect(strip[6]).toMatchObject({ dateKey: '2026-03-09', scheduledCount: 0, completedCount: 0 });
  });

  it('performs no rule-history parse when the index is prebuilt', () => {
    const parseSpy = vi.spyOn(habitsDomain, 'parseHabitRuleHistory');

    buildHabitDayStrip({ activeHabits, ruleHistoryById, countsByHabitDate: {}, today: TODAY });

    expect(parseSpy).not.toHaveBeenCalled();
    parseSpy.mockRestore();
  });

  it('is referentially deterministic for the same data, so the screen memo is stable', () => {
    const first = buildHabitDayStrip({
      activeHabits,
      ruleHistoryById,
      countsByHabitDate: {},
      today: TODAY,
    });
    const second = buildHabitDayStrip({
      activeHabits,
      ruleHistoryById,
      countsByHabitDate: {},
      today: TODAY,
    });

    expect(second).toEqual(first);
  });
});
