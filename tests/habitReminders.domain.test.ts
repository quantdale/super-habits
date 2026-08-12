import { describe, expect, it } from 'vitest';
import {
  buildHabitReminderPlan,
  buildLocalHabitReminderDate,
  formatHabitReminderTime,
  getHabitReminderIdentifier,
  getHabitReminderActionKey,
  getHabitReminderSnoozeIdentifier,
  isHabitReminderIdentifier,
  isHabitReminderSnoozeIdentifier,
  parseHabitReminderTime,
  type HabitReminderHabit,
} from '@/features/habits/habitReminders.domain';
import { createHabitRule } from '@/features/habits/habits.domain';

const NOW = new Date(2026, 7, 10, 12, 0, 0, 0); // Monday, local time

function habit(
  id: string,
  weekdays: readonly (1 | 2 | 3 | 4 | 5 | 6 | 7)[] = [1, 2, 3, 4, 5, 6, 7],
  target = 1,
  reminderTime: string | null = '18:00',
): HabitReminderHabit {
  return {
    id,
    name: id === 'gym' ? 'Gym' : id,
    target_per_day: target,
    reminder_time: reminderTime,
    created_at: '2026-08-01T00:00:00.000Z',
    deleted_at: null,
    rule_history: JSON.stringify([createHabitRule('2026-08-01', weekdays, target)]),
  };
}

describe('habit reminder time helpers', () => {
  it('uses stable normal and snooze occurrence identities plus action keys', () => {
    const normal = getHabitReminderIdentifier('habit_gym', '2026-08-10');
    const snooze = getHabitReminderSnoozeIdentifier('habit_gym', '2026-08-10');

    expect(normal).toBe('habit-reminder:habit_gym:2026-08-10');
    expect(snooze).toBe('habit-reminder-snooze:habit_gym:2026-08-10');
    expect(
      getHabitReminderActionKey('habit_gym', '2026-08-10', 'habit_reminder_mark_complete'),
    ).toBe(`${normal}:habit_reminder_mark_complete`);
    expect(isHabitReminderIdentifier(normal)).toBe(true);
    expect(isHabitReminderIdentifier(snooze)).toBe(true);
    expect(isHabitReminderSnoozeIdentifier(snooze)).toBe(true);
    expect(isHabitReminderSnoozeIdentifier(normal)).toBe(false);
  });
  it.each([
    ['00:00', { hour: 0, minute: 0 }],
    ['07:30', { hour: 7, minute: 30 }],
    ['23:59', { hour: 23, minute: 59 }],
  ])('parses canonical local time %s', (value, expected) => {
    expect(parseHabitReminderTime(value)).toEqual(expected);
  });

  it.each([null, undefined, '', '7:30', '24:00', '12:60', '12:00:00', 'noon'])(
    'rejects non-canonical time %s',
    (value) => {
      expect(parseHabitReminderTime(value)).toBeNull();
    },
  );

  it('formats without locale-dependent strings', () => {
    expect(formatHabitReminderTime({ hour: 7, minute: 5 })).toBe('07:05');
  });

  it('constructs a local wall-clock occurrence', () => {
    const occurrence = buildLocalHabitReminderDate('2026-08-12', { hour: 7, minute: 30 });
    expect({
      year: occurrence.getFullYear(),
      month: occurrence.getMonth() + 1,
      day: occurrence.getDate(),
      hour: occurrence.getHours(),
      minute: occurrence.getMinutes(),
    }).toEqual({ year: 2026, month: 8, day: 12, hour: 7, minute: 30 });
  });

  it.each(['2026-03-08', '2026-11-01'])(
    'preserves the requested wall clock around a DST boundary on %s',
    (dateKey) => {
      const occurrence = buildLocalHabitReminderDate(dateKey, { hour: 7, minute: 30 });
      expect({
        year: occurrence.getFullYear(),
        month: occurrence.getMonth() + 1,
        day: occurrence.getDate(),
        hour: occurrence.getHours(),
        minute: occurrence.getMinutes(),
      }).toEqual({
        year: Number(dateKey.slice(0, 4)),
        month: Number(dateKey.slice(5, 7)),
        day: Number(dateKey.slice(8, 10)),
        hour: 7,
        minute: 30,
      });
    },
  );
});

describe('buildHabitReminderPlan', () => {
  it('plans a daily habit within a bounded fourteen-date window', () => {
    const plan = buildHabitReminderPlan({ habits: [habit('daily')], now: NOW });

    expect(plan).toHaveLength(14);
    expect(plan[0]).toMatchObject({ dateKey: '2026-08-10', time: '18:00' });
    expect(plan.at(-1)).toMatchObject({ dateKey: '2026-08-23', time: '18:00' });
    expect(plan.every((item) => item.fireAt.getTime() > NOW.getTime())).toBe(true);
  });

  it.each([
    [
      'weekdays',
      [1, 2, 3, 4, 5] as const,
      [
        '2026-08-10',
        '2026-08-11',
        '2026-08-12',
        '2026-08-13',
        '2026-08-14',
        '2026-08-17',
        '2026-08-18',
        '2026-08-19',
        '2026-08-20',
        '2026-08-21',
      ],
    ],
    ['weekends', [6, 7] as const, ['2026-08-15', '2026-08-16', '2026-08-22', '2026-08-23']],
    [
      'M/W/F',
      [1, 3, 5] as const,
      ['2026-08-10', '2026-08-12', '2026-08-14', '2026-08-17', '2026-08-19', '2026-08-21'],
    ],
    ['custom Tue/Thu', [2, 4] as const, ['2026-08-11', '2026-08-13', '2026-08-18', '2026-08-20']],
  ])('uses the V2 schedule authority for %s', (_label, weekdays, expectedDates) => {
    const plan = buildHabitReminderPlan({
      habits: [habit('scheduled', weekdays)],
      now: NOW,
    });
    expect(plan.map((item) => item.dateKey)).toEqual(expectedDates);
  });

  it('does not schedule an off-day even when an off-day completion exists', () => {
    const plan = buildHabitReminderPlan({
      habits: [habit('gym', [1, 3, 5])],
      completions: [{ habit_id: 'gym', date_key: '2026-08-11', count: 1 }],
      now: NOW,
    });
    expect(plan.some((item) => item.dateKey === '2026-08-11')).toBe(false);
  });

  it('suppresses a satisfied target-one reminder for today', () => {
    const plan = buildHabitReminderPlan({
      habits: [habit('gym', [1], 1)],
      completions: [{ habit_id: 'gym', date_key: '2026-08-10', count: 1 }],
      now: NOW,
    });
    expect(plan.some((item) => item.dateKey === '2026-08-10')).toBe(false);
  });

  it('keeps a target-greater-than-one reminder while progress is partial', () => {
    const plan = buildHabitReminderPlan({
      habits: [habit('gym', [1], 3)],
      completions: [{ habit_id: 'gym', date_key: '2026-08-10', count: 1 }],
      now: NOW,
    });
    expect(plan.find((item) => item.dateKey === '2026-08-10')).toBeDefined();

    const complete = buildHabitReminderPlan({
      habits: [habit('gym', [1], 3)],
      completions: [{ habit_id: 'gym', date_key: '2026-08-10', count: 3 }],
      now: NOW,
    });
    expect(complete.some((item) => item.dateKey === '2026-08-10')).toBe(false);
  });

  it('skips today after the configured local time has passed', () => {
    const plan = buildHabitReminderPlan({
      habits: [habit('today', [1], 1, '07:00')],
      now: new Date(2026, 7, 10, 19, 0, 0, 0),
    });
    expect(plan.some((item) => item.dateKey === '2026-08-10')).toBe(false);
    expect(plan[0]?.dateKey).toBe('2026-08-17');
  });

  it('reflects current schedule and time edits without rewriting history', () => {
    const before = buildHabitReminderPlan({
      habits: [habit('gym', [1, 3, 5], 1, '18:00')],
      now: NOW,
    });
    const after = buildHabitReminderPlan({
      habits: [habit('gym', [1, 2, 3, 4, 5], 1, '07:00')],
      now: NOW,
    });

    expect(before.map((item) => item.dateKey)).not.toEqual(after.map((item) => item.dateKey));
    expect(after[0]).toMatchObject({ dateKey: '2026-08-11', time: '07:00' });
    expect(after[0]?.identifier).toBe(getHabitReminderIdentifier('gym', '2026-08-11'));
  });

  it('ignores disabled, malformed, and soft-deleted habits', () => {
    const deleted = { ...habit('deleted'), deleted_at: '2026-08-10T00:00:00.000Z' };
    const plan = buildHabitReminderPlan({
      habits: [
        habit('enabled'),
        habit('disabled', [1], 1, null),
        habit('malformed', [1], 1, '9am'),
        deleted,
      ],
      now: NOW,
    });
    expect(new Set(plan.map((item) => item.habitId))).toEqual(new Set(['enabled']));
  });

  it('uses historical targets and schedules for each future date', () => {
    const habitWithHistory = {
      ...habit('history', [1, 2, 3, 4, 5, 6, 7], 1),
      rule_history: JSON.stringify([
        createHabitRule('2026-08-01', [1, 2, 3, 4, 5, 6, 7], 1),
        createHabitRule('2026-08-12', [1, 3, 5], 2),
      ]),
    };
    const plan = buildHabitReminderPlan({
      habits: [habitWithHistory],
      completions: [{ habit_id: 'history', date_key: '2026-08-12', count: 2 }],
      now: NOW,
    });
    expect(plan.map((item) => item.dateKey)).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-14',
      '2026-08-17',
      '2026-08-19',
      '2026-08-21',
    ]);
  });

  it('embeds the occurrence identity in every planned notification', () => {
    const item = buildHabitReminderPlan({ habits: [habit('gym')], now: NOW })[0];
    expect(item?.data).toMatchObject({
      kind: 'habit-reminder',
      habitId: 'gym',
      dateKey: '2026-08-10',
      occurrenceId: 'habit-reminder:gym:2026-08-10',
      snoozed: false,
    });
  });
});
