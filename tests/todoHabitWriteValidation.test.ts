import { describe, it, expect } from 'vitest';
import {
  assertHabitWrite,
  assertTodoPartialUpdate,
  assertTodoWrite,
  validateHabit,
  validateHabitName,
  validateHabitTarget,
  validateTodo,
  validateTodoDueDate,
  validateTodoNotes,
  validateTodoTitle,
} from '@/lib/validation';

/**
 * Todo/habit data-layer write contract: the field validators extracted for the
 * data layer must preserve the exact UI messages, `validateTodo` /
 * `validateHabit` must compose them unchanged, and the throwing asserts must
 * reject invalid writes with those same messages while passing valid input
 * (partial updates only check the fields being changed).
 */

describe('todo field validators preserve UI messages', () => {
  it('validateTodoTitle matches the historic todo title messages', () => {
    expect(validateTodoTitle('')).toBe('Task title is required.');
    expect(validateTodoTitle('   ')).toBe('Task title is required.');
    expect(validateTodoTitle('A'.repeat(201))).toBe('Title must be 200 characters or less.');
    expect(validateTodoTitle('A'.repeat(200))).toBeNull();
  });

  it('validateTodoNotes matches the historic notes message', () => {
    expect(validateTodoNotes('x'.repeat(501))).toBe('Notes must be 500 characters or less.');
    expect(validateTodoNotes('x'.repeat(500))).toBeNull();
  });

  it('validateTodoDueDate matches the historic due-date messages', () => {
    expect(validateTodoDueDate('03/23/2025')).toBe('Due date must be a valid YYYY-MM-DD date.');
    expect(validateTodoDueDate('2026-13-40')).toBe('Due date must be a valid YYYY-MM-DD date.');
    expect(validateTodoDueDate('2026-02-30')).toBe('Due date must be a valid YYYY-MM-DD date.');
    expect(validateTodoDueDate(null)).toBeNull();
    expect(validateTodoDueDate(undefined)).toBeNull();
    expect(validateTodoDueDate('2026-03-23')).toBeNull();
  });

  it('validateTodo composes the field validators unchanged', () => {
    expect(validateTodo('', '')).toBe('Task title is required.');
    expect(validateTodo('A'.repeat(201), '')).toBe('Title must be 200 characters or less.');
    expect(validateTodo('Ok', 'x'.repeat(501))).toBe('Notes must be 500 characters or less.');
    expect(validateTodo('Ok', '', 'nope')).toBe('Due date must be a valid YYYY-MM-DD date.');
    expect(validateTodo('Buy groceries', '')).toBeNull();
  });
});

describe('assertTodoWrite', () => {
  it('throws the exact UI message for each invalid field', () => {
    expect(() => assertTodoWrite({ title: '  ' })).toThrow('Task title is required.');
    expect(() => assertTodoWrite({ title: 'A'.repeat(201) })).toThrow(
      'Title must be 200 characters or less.',
    );
    expect(() => assertTodoWrite({ title: 'Ok', notes: 'x'.repeat(501) })).toThrow(
      'Notes must be 500 characters or less.',
    );
    expect(() => assertTodoWrite({ title: 'Ok', dueDate: '2026-13-01' })).toThrow(
      'Due date must be a valid YYYY-MM-DD date.',
    );
  });

  it('accepts valid full and minimal shapes', () => {
    expect(() =>
      assertTodoWrite({ title: 'Buy groceries', notes: 'oat milk', dueDate: '2026-03-23' }),
    ).not.toThrow();
    expect(() => assertTodoWrite({ title: 'Buy groceries' })).not.toThrow();
    expect(() =>
      assertTodoWrite({ title: 'Buy groceries', notes: null, dueDate: null }),
    ).not.toThrow();
  });
});

describe('assertTodoPartialUpdate', () => {
  it('checks only the fields being changed', () => {
    expect(() => assertTodoPartialUpdate({})).not.toThrow();
    expect(() => assertTodoPartialUpdate({ priority: undefined } as never)).not.toThrow();
    expect(() => assertTodoPartialUpdate({ title: '' })).toThrow('Task title is required.');
    expect(() => assertTodoPartialUpdate({ notes: 'x'.repeat(501) })).toThrow(
      'Notes must be 500 characters or less.',
    );
    expect(() => assertTodoPartialUpdate({ dueDate: 'bad' })).toThrow(
      'Due date must be a valid YYYY-MM-DD date.',
    );
    expect(() => assertTodoPartialUpdate({ dueDate: null })).not.toThrow();
    expect(() =>
      assertTodoPartialUpdate({ title: 'Rescheduled', dueDate: '2026-04-01' }),
    ).not.toThrow();
  });
});

describe('habit field validators preserve UI messages', () => {
  it('validateHabitName matches the historic habit name messages', () => {
    expect(validateHabitName('')).toBe('Habit name is required.');
    expect(validateHabitName('n'.repeat(101))).toBe('Name must be 100 characters or less.');
    expect(validateHabitName('Read')).toBeNull();
  });

  it('validateHabitTarget matches the historic target messages', () => {
    expect(validateHabitTarget(0)).toBe('Daily target must be at least 1.');
    expect(validateHabitTarget(100)).toBe('Daily target cannot exceed 99.');
    expect(validateHabitTarget(1.5)).toBe('Daily target must be at least 1.');
    expect(validateHabitTarget(3)).toBeNull();
  });

  it('validateHabit composes the field validators unchanged', () => {
    expect(validateHabit('', 1)).toBe('Habit name is required.');
    expect(validateHabit('Read', 0)).toBe('Daily target must be at least 1.');
    expect(validateHabit('Read', 2)).toBeNull();
  });
});

describe('assertHabitWrite', () => {
  it('throws the exact UI message for each invalid field', () => {
    expect(() => assertHabitWrite({ name: '', targetPerDay: 1 })).toThrow(
      'Habit name is required.',
    );
    expect(() => assertHabitWrite({ name: 'n'.repeat(101), targetPerDay: 1 })).toThrow(
      'Name must be 100 characters or less.',
    );
    expect(() => assertHabitWrite({ name: 'Read', targetPerDay: 0 })).toThrow(
      'Daily target must be at least 1.',
    );
    expect(() => assertHabitWrite({ name: 'Read', targetPerDay: 100 })).toThrow(
      'Daily target cannot exceed 99.',
    );
    expect(() => assertHabitWrite({ name: 'Read', targetPerDay: 1, weekdays: [] })).toThrow(
      'Choose at least one day for this habit.',
    );
  });

  it('accepts valid shapes with and without weekdays', () => {
    expect(() => assertHabitWrite({ name: 'Read', targetPerDay: 2 })).not.toThrow();
    expect(() =>
      assertHabitWrite({ name: 'Read', targetPerDay: 2, weekdays: [1, 3, 5] }),
    ).not.toThrow();
  });
});
