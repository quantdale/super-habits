import { describe, expect, it } from 'vitest';
import type { Habit } from '@/features/habits/types';
import {
  buildHabitCheckInRow,
  groupHabitCheckInRows,
  habitProgressTone,
  summarizeHabitsForDate,
} from '@/features/habits/habitCheckIn.domain';

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

function habit(overrides: Partial<Habit> & { id: string; name?: string }): Habit {
  return {
    name: overrides.name ?? overrides.id,
    target_per_day: 1,
    category: 'anytime',
    reminder_time: null,
    icon: 'check',
    color: '#ef4444',
    rule_history: JSON.stringify([
      { effective_from_date: '2026-01-01', weekdays: ALL_DAYS, target_per_day: 1 },
    ]),
    created_at: '2026-01-01T00:00:00.000Z',
    status: 'active',
    ...overrides,
  } as Habit;
}

describe('habitProgressTone', () => {
  it('does not treat an untouched large target as danger', () => {
    expect(habitProgressTone('not_started')).toBe('neutral');
    expect(habitProgressTone('in_progress')).toBe('accent');
    expect(habitProgressTone('complete')).toBe('complete');
    expect(habitProgressTone('inactive')).toBe('inactive');
  });
});

describe('buildHabitCheckInRow', () => {
  it('checks in a binary habit without using a quantitative add label', () => {
    const row = buildHabitCheckInRow({
      habit: habit({ id: 'h1', name: 'Read' }),
      dateKey: '2026-03-09',
      todayKey: '2026-03-09',
      count: 0,
      currentStreak: 12,
    });

    expect(row.quantitative).toBe(false);
    expect(row.actionable).toBe(true);
    expect(row.tone).toBe('neutral');
    expect(row.actionLabel).toBe('Read: 0 of 1 today. Check in.');
    expect(row.secondaryLabel).toBe('Current streak 12');
    // Streaks count scheduled occurrences, not calendar days (e.g. M/W/F).
    expect(row.secondaryLabel).not.toContain('days');
    expect(row.tone).not.toBe('danger');
  });

  it('keeps quantitative increment and decrement distinct', () => {
    const row = buildHabitCheckInRow({
      habit: habit({
        id: 'water',
        name: 'Drink water',
        target_per_day: 8,
        rule_history: JSON.stringify([
          { effective_from_date: '2026-01-01', weekdays: ALL_DAYS, target_per_day: 8 },
        ]),
      }),
      dateKey: '2026-03-09',
      todayKey: '2026-03-09',
      count: 5,
    });

    expect(row.quantitative).toBe(true);
    expect(row.state).toBe('in_progress');
    expect(row.tone).toBe('accent');
    expect(row.secondaryLabel).toBe('5 of 8');
    expect(row.actionLabel).toBe('Drink water: 5 of 8 today. Add one.');
    expect(row.decrementLabel).toContain('remove one');
  });

  it('uses the historical target, not the current column', () => {
    const row = buildHabitCheckInRow({
      habit: habit({
        id: 'h1',
        name: 'Read',
        target_per_day: 4,
        rule_history: JSON.stringify([
          { effective_from_date: '2026-01-01', weekdays: ALL_DAYS, target_per_day: 1 },
          { effective_from_date: '2026-03-10', weekdays: ALL_DAYS, target_per_day: 4 },
        ]),
      }),
      dateKey: '2026-03-09',
      todayKey: '2026-03-10',
      count: 1,
    });

    expect(row.target).toBe(1);
    expect(row.state).toBe('complete');
    expect(row.quantitative).toBe(false);
  });

  it('closes unscheduled, masked, paused, and pre-creation dates', () => {
    const unscheduled = buildHabitCheckInRow({
      habit: habit({
        id: 'gym',
        name: 'Gym',
        rule_history: JSON.stringify([
          { effective_from_date: '2026-01-01', weekdays: [1, 3, 5], target_per_day: 1 },
        ]),
      }),
      dateKey: '2026-03-10',
      todayKey: '2026-03-10',
      count: 0,
    });
    expect(unscheduled.actionable).toBe(false);
    expect(unscheduled.blockReason).toBe('unscheduled');
    expect(unscheduled.tone).toBe('inactive');
    expect(unscheduled.actionLabel).toBe('Gym: Not scheduled today. Rest day.');

    const masked = buildHabitCheckInRow({
      habit: habit({
        id: 'h1',
        name: 'Read',
        lifecycle_history: JSON.stringify([
          { status: 'paused', from_date_key: '2026-03-01', to_date_key: '2026-03-20' },
        ]),
      }),
      dateKey: '2026-03-09',
      todayKey: '2026-03-09',
      count: 0,
    });
    expect(masked.blockReason).toBe('masked');
    expect(masked.actionable).toBe(false);

    const paused = buildHabitCheckInRow({
      habit: habit({ id: 'h1', name: 'Read', status: 'paused' }),
      dateKey: '2026-03-09',
      todayKey: '2026-03-09',
      count: 0,
    });
    expect(paused.blockReason).toBe('paused');

    const early = buildHabitCheckInRow({
      habit: habit({
        id: 'h1',
        name: 'Read',
        created_at: '2026-03-15T12:00:00.000Z',
        rule_history: JSON.stringify([
          { effective_from_date: '2026-03-15', weekdays: ALL_DAYS, target_per_day: 1 },
        ]),
      }),
      dateKey: '2026-03-01',
      todayKey: '2026-03-20',
      count: 0,
    });
    expect(early.blockReason).toBe('before_creation');
  });

  it('labels a current streak as current even on a past day', () => {
    const row = buildHabitCheckInRow({
      habit: habit({ id: 'h1', name: 'Read' }),
      dateKey: '2026-03-08',
      todayKey: '2026-03-09',
      count: 0,
      currentStreak: 4,
    });
    expect(row.secondaryLabel).toBe('Current streak 4');
    expect(row.actionLabel).toContain('on Sun 8');
    expect(row.actionLabel).not.toContain('today');
  });
});

describe('summarizeHabitsForDate', () => {
  it('does not mix today with a historical day', () => {
    const habits = [
      habit({ id: 'daily', name: 'Daily' }),
      habit({
        id: 'mwf',
        name: 'Gym',
        rule_history: JSON.stringify([
          { effective_from_date: '2026-01-01', weekdays: [1, 3, 5], target_per_day: 1 },
        ]),
      }),
    ];
    const today = summarizeHabitsForDate({
      habits,
      countsByHabitDate: { daily: { '2026-03-09': 1 } },
      dateKey: '2026-03-09',
      todayKey: '2026-03-09',
    });
    const yesterday = summarizeHabitsForDate({
      habits,
      countsByHabitDate: {},
      dateKey: '2026-03-08',
      todayKey: '2026-03-09',
    });

    expect(today.label).toBe('1 of 2 done today');
    expect(yesterday.label).toBe('0 of 1 done on Sun 8');
    expect(yesterday.label).not.toContain('1 of 2');
    expect(yesterday.label).not.toContain('0 of 2');
  });

  it('uses the historical target and excludes a masked date', () => {
    const habits = [
      habit({
        id: 'water',
        name: 'Water',
        target_per_day: 8,
        rule_history: JSON.stringify([
          { effective_from_date: '2026-01-01', weekdays: ALL_DAYS, target_per_day: 2 },
          { effective_from_date: '2026-03-10', weekdays: ALL_DAYS, target_per_day: 8 },
        ]),
      }),
      habit({
        id: 'paused',
        name: 'Paused then',
        lifecycle_history: JSON.stringify([
          { status: 'paused', from_date_key: '2026-03-09', to_date_key: '2026-03-09' },
        ]),
      }),
    ];
    const summary = summarizeHabitsForDate({
      habits,
      countsByHabitDate: { water: { '2026-03-09': 2 } },
      dateKey: '2026-03-09',
      todayKey: '2026-03-10',
    });
    expect(summary.scheduledCount).toBe(1);
    expect(summary.completedCount).toBe(1);
    expect(summary.label).toBe('1 of 1 done on Mon 9');
  });

  it('names a rest day instead of a zero-percent failure', () => {
    const summary = summarizeHabitsForDate({
      habits: [
        habit({
          id: 'gym',
          name: 'Gym',
          rule_history: JSON.stringify([
            { effective_from_date: '2026-01-01', weekdays: [3], target_per_day: 1 },
          ]),
        }),
      ],
      countsByHabitDate: {},
      dateKey: '2026-03-09',
      todayKey: '2026-03-09',
    });
    expect(summary.scheduledCount).toBe(0);
    expect(summary.label).toBe('Nothing scheduled today');
  });
});

describe('groupHabitCheckInRows', () => {
  it('omits empty time-of-day groups', () => {
    const groups = groupHabitCheckInRows([
      buildHabitCheckInRow({
        habit: habit({ id: 'h1', name: 'Read', category: 'morning' }),
        dateKey: '2026-03-09',
        todayKey: '2026-03-09',
        count: 0,
      }),
    ]);
    expect(groups.map((group) => group.label)).toEqual(['Morning']);
  });
});
