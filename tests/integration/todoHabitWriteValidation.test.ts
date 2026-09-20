import { describe, expect, it, beforeEach } from 'vitest';
import { freshDatabase } from './helpers/db';

/**
 * Todo/habit data-layer write contract against a REAL database: invalid
 * writes throw with the exact UI validator messages and persist NO rows (or
 * leave the existing row untouched for updates), while valid writes still
 * succeed. This pins the defense-in-depth backstop for non-UI writers (quick
 * capture, weekly-review executor, recurrence expansion) that bypass the
 * screen-level `validateTodo` / `validateHabit` checks.
 */

beforeEach(async () => {
  await freshDatabase();
});

async function todoLayers() {
  const todos = await import('@/features/todos/todos.data');
  return todos;
}

async function habitLayers() {
  const habits = await import('@/features/habits/habits.data');
  return habits;
}

describe('addTodo data-layer rejects', () => {
  it('rejects an empty title and writes no row', async () => {
    const { addTodo, listTodos } = await todoLayers();
    await expect(addTodo({ title: '   ' })).rejects.toThrow('Task title is required.');
    expect(await listTodos()).toHaveLength(0);
  });

  it('rejects an over-length title and writes no row', async () => {
    const { addTodo, listTodos } = await todoLayers();
    await expect(addTodo({ title: 'A'.repeat(201) })).rejects.toThrow(
      'Title must be 200 characters or less.',
    );
    expect(await listTodos()).toHaveLength(0);
  });

  it('rejects over-length notes and a malformed due date', async () => {
    const { addTodo, listTodos } = await todoLayers();
    await expect(addTodo({ title: 'Ok', notes: 'x'.repeat(501) })).rejects.toThrow(
      'Notes must be 500 characters or less.',
    );
    await expect(addTodo({ title: 'Ok', dueDate: '2026-13-40' })).rejects.toThrow(
      'Due date must be a valid YYYY-MM-DD date.',
    );
    expect(await listTodos()).toHaveLength(0);
  });

  it('still accepts a valid write', async () => {
    const { addTodo, listTodos } = await todoLayers();
    const id = await addTodo({ title: 'Buy groceries', dueDate: '2026-03-23' });
    expect(typeof id).toBe('string');
    expect(await listTodos()).toHaveLength(1);
  });
});

describe('updateTodo data-layer rejects', () => {
  it('rejects an empty title and leaves the row untouched', async () => {
    const { addTodo, updateTodo, listTodos } = await todoLayers();
    const id = await addTodo({ title: 'Original' });
    await expect(updateTodo(id, { title: '  ' })).rejects.toThrow('Task title is required.');
    await expect(updateTodo(id, { dueDate: 'not-a-date' })).rejects.toThrow(
      'Due date must be a valid YYYY-MM-DD date.',
    );
    const rows = await listTodos();
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Original');
  });

  it('still accepts a valid partial update', async () => {
    const { addTodo, updateTodo, listTodos } = await todoLayers();
    const id = await addTodo({ title: 'Original' });
    await updateTodo(id, { title: 'Renamed', dueDate: '2026-04-01' });
    const rows = await listTodos();
    expect(rows[0].title).toBe('Renamed');
    expect(rows[0].due_date).toBe('2026-04-01');
  });
});

describe('createRecurringInstances data-layer rejects', () => {
  it('rejects the whole batch when one input is invalid', async () => {
    const { createRecurringInstances, listTodos } = await todoLayers();
    await expect(
      createRecurringInstances([
        {
          title: 'Valid instance',
          notes: null,
          priority: 'normal',
          recurrenceId: 'rec_1',
          dueDate: '2026-03-23',
        },
        {
          title: '   ',
          notes: null,
          priority: 'normal',
          recurrenceId: 'rec_2',
          dueDate: '2026-03-23',
        },
      ]),
    ).rejects.toThrow('Task title is required.');
    expect(await listTodos()).toHaveLength(0);
  });
});

describe('addHabit data-layer rejects', () => {
  it('rejects invalid name/target/weekdays and writes no row', async () => {
    const { addHabit, listHabits } = await habitLayers();
    await expect(addHabit('', 1)).rejects.toThrow('Habit name is required.');
    await expect(addHabit('n'.repeat(101), 1)).rejects.toThrow(
      'Name must be 100 characters or less.',
    );
    await expect(addHabit('Read', 0)).rejects.toThrow('Daily target must be at least 1.');
    await expect(addHabit('Read', 100)).rejects.toThrow('Daily target cannot exceed 99.');
    await expect(addHabit('Read', 1, 'anytime', undefined, undefined, [])).rejects.toThrow(
      'Choose at least one day for this habit.',
    );
    expect(await listHabits()).toHaveLength(0);
  });

  it('still accepts a valid write', async () => {
    const { addHabit, listHabits } = await habitLayers();
    const id = await addHabit('Read', 2);
    expect(typeof id).toBe('string');
    expect(await listHabits()).toHaveLength(1);
  });
});

describe('updateHabit data-layer rejects', () => {
  it('rejects an invalid edited shape and leaves the row untouched', async () => {
    const { addHabit, updateHabit, listHabits } = await habitLayers();
    const id = await addHabit('Read', 2);
    await expect(
      updateHabit(id, { name: '', targetPerDay: 2, category: 'anytime' }),
    ).rejects.toThrow('Habit name is required.');
    await expect(
      updateHabit(id, { name: 'Read', targetPerDay: 0, category: 'anytime' }),
    ).rejects.toThrow('Daily target must be at least 1.');
    const rows = await listHabits();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Read');
    expect(rows[0].target_per_day).toBe(2);
  });
});
