import { describe, it, expect } from 'vitest';
import {
  computeTodoReminderFireAt,
  formatTimeOfDay,
  normalizeTimeOfDayInput,
  parseTimeOfDay,
  todoReminderIdentifier,
  DAILY_PLAN_REMINDER_IDENTIFIER,
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
