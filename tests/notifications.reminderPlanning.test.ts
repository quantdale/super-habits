import { afterEach, describe, it, expect } from 'vitest';
import {
  computeTodoReminderFireAt,
  formatTimeOfDay,
  normalizeTimeOfDayInput,
  parseTimeOfDay,
  resolveTodoDueAt,
  todoReminderIdentifier,
  DAILY_PLAN_REMINDER_IDENTIFIER,
  TODO_REMINDER_DEFAULT_DUE_TIME,
} from '../core/notifications/reminderPlanning';

describe('parseTimeOfDay', () => {
  it('accepts valid HH:mm values', () => {
    expect(parseTimeOfDay('08:30')).toEqual({ hour: 8, minute: 30 });
    expect(parseTimeOfDay('23:59')).toEqual({ hour: 23, minute: 59 });
    expect(parseTimeOfDay('0:00')).toEqual({ hour: 0, minute: 0 });
    expect(parseTimeOfDay(' 9:05 ')).toEqual({ hour: 9, minute: 5 });
  });

  it('rejects malformed or out-of-range values', () => {
    expect(parseTimeOfDay(null)).toBeNull();
    expect(parseTimeOfDay('')).toBeNull();
    expect(parseTimeOfDay('8')).toBeNull();
    expect(parseTimeOfDay('8:5')).toBeNull();
    expect(parseTimeOfDay('24:00')).toBeNull();
    expect(parseTimeOfDay('12:60')).toBeNull();
    expect(parseTimeOfDay('ab:cd')).toBeNull();
    expect(parseTimeOfDay('-1:30')).toBeNull();
  });
});

describe('formatTimeOfDay / normalizeTimeOfDayInput', () => {
  it('zero-pads output', () => {
    expect(formatTimeOfDay({ hour: 8, minute: 5 })).toBe('08:05');
    expect(formatTimeOfDay({ hour: 0, minute: 0 })).toBe('00:00');
  });

  it('normalizes loose input to canonical HH:mm', () => {
    expect(normalizeTimeOfDayInput('9:5')).toBe('09:05');
    expect(normalizeTimeOfDayInput('21:00')).toBe('21:00');
    expect(normalizeTimeOfDayInput('nope')).toBeNull();
  });
});

describe('computeTodoReminderFireAt', () => {
  const now = new Date('2026-01-15T10:00:00');

  it('fires at the due moment by default', () => {
    const due = new Date('2026-01-15T12:00:00');
    expect(computeTodoReminderFireAt(due, undefined, now)).toEqual(due);
  });

  it('applies the lead time', () => {
    const due = new Date('2026-01-15T12:00:00');
    expect(computeTodoReminderFireAt(due, 30, now)).toEqual(new Date('2026-01-15T11:30:00'));
  });

  it('returns null for past-due or already-fired reminders', () => {
    expect(computeTodoReminderFireAt(new Date('2026-01-15T09:00:00'), 0, now)).toBeNull();
    // Lead pushes fire time into the past even though due is future.
    expect(computeTodoReminderFireAt(new Date('2026-01-15T10:15:00'), 30, now)).toBeNull();
  });
});

describe('identifiers', () => {
  it('are stable per entity', () => {
    expect(todoReminderIdentifier('todo_1_abc')).toBe('todo-reminder:todo_1_abc');
    expect(todoReminderIdentifier('todo_1_abc')).toBe(todoReminderIdentifier('todo_1_abc'));
    expect(DAILY_PLAN_REMINDER_IDENTIFIER).toBe('daily-plan-reminder:daily');
  });
});

/**
 * `resolveTodoDueAt` is the single place a date-only `due_date` becomes an
 * instant (audit C #1). It must anchor the LOCAL calendar day — never the UTC
 * interpretation ECMA-262 gives a bare `YYYY-MM-DD` string.
 */
describe('resolveTodoDueAt', () => {
  const previousTz = process.env.TZ;

  afterEach(() => {
    if (previousTz === undefined) delete process.env.TZ;
    else process.env.TZ = previousTz;
  });

  it('defaults to the documented local wall-clock reminder time', () => {
    expect(TODO_REMINDER_DEFAULT_DUE_TIME).toEqual({ hour: 9, minute: 0 });
    const dueAt = resolveTodoDueAt('2026-03-04');
    expect(dueAt).not.toBeNull();
    expect(dueAt!.getHours()).toBe(9);
    expect(dueAt!.getMinutes()).toBe(0);
    expect(dueAt!.getDate()).toBe(4);
  });

  it('honours an explicit wall clock on the same local day', () => {
    const dueAt = resolveTodoDueAt('2026-03-04', { hour: 18, minute: 45 });
    expect(dueAt!.getTime()).toBe(new Date(2026, 2, 4, 18, 45, 0, 0).getTime());
  });

  it('rejects malformed keys rather than silently substituting now', () => {
    for (const bad of ['', '2026-3-4', '2026-02-30', 'tomorrow', '2026-03-04T09:00:00Z']) {
      expect(resolveTodoDueAt(bad)).toBeNull();
    }
  });

  it('never equals the UTC instant a bare date string parses to (UTC+8)', () => {
    process.env.TZ = 'Asia/Manila';
    expect(new Date(2026, 2, 4, 12).getTimezoneOffset()).toBe(-480);
    const dueAt = resolveTodoDueAt('2026-03-04')!;
    expect(dueAt.getTime()).not.toBe(Date.parse('2026-03-04'));
    expect(dueAt.getTime()).toBe(new Date(2026, 2, 4, 9, 0, 0, 0).getTime());
  });

  it('stays on the named calendar day in UTC-5', () => {
    process.env.TZ = 'America/New_York';
    expect(new Date(2026, 2, 4, 12).getTimezoneOffset()).toBe(300); // EST
    const dueAt = resolveTodoDueAt('2026-03-04')!;
    expect(dueAt.getDate()).toBe(4);
    expect(dueAt.getMonth()).toBe(2);
    expect(dueAt.getTime()).toBe(new Date(2026, 2, 4, 9, 0, 0, 0).getTime());
  });

  it('resolves a skipped spring-forward wall clock onto the same local day', () => {
    process.env.TZ = 'America/New_York';
    // 02:30 does not exist on 2026-03-08 in New York (02:00 EST -> 03:00 EDT).
    const dueAt = resolveTodoDueAt('2026-03-08', { hour: 2, minute: 30 })!;
    expect(dueAt.getDate()).toBe(8);
    expect(dueAt.getHours()).toBe(0);
    expect(dueAt.getMinutes()).toBe(0);
  });

  it('keeps an ordinary wall clock intact across a DST boundary day', () => {
    process.env.TZ = 'America/New_York';
    const dueAt = resolveTodoDueAt('2026-11-01', { hour: 9, minute: 0 })!;
    expect(dueAt.getDate()).toBe(1);
    expect(dueAt.getHours()).toBe(9);
  });
});
