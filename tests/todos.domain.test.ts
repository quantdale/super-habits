import { describe, it, expect } from 'vitest';
import {
  getTodayDateKey,
  getTomorrowDateKey,
  findMissingRecurrenceIds,
  createSubmitGuard,
  applyTodoListQuery,
  filterTodos,
  groupTodosByDueWindow,
  searchTodos,
  sortTodos,
} from '@/features/todos/todos.domain';

describe('getTodayDateKey', () => {
  it('returns YYYY-MM-DD format', () => {
    expect(getTodayDateKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('matches local date not UTC', () => {
    const local = new Date();
    const expected = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
    expect(getTodayDateKey()).toBe(expected);
  });
});

describe('getTomorrowDateKey', () => {
  it('returns a date one day after today', () => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const expected = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    expect(getTomorrowDateKey()).toBe(expected);
  });
});

describe('findMissingRecurrenceIds', () => {
  it('returns empty when no recurring todos', () => {
    const todos = [{ recurrence_id: null, recurrence: null, due_date: null, deleted_at: null }];
    expect(findMissingRecurrenceIds(todos, '2025-01-01')).toHaveLength(0);
  });

  it('returns recurrence_id when no instance exists for today', () => {
    const todos = [
      { recurrence_id: 'rec_001', recurrence: 'daily', due_date: '2025-01-01', deleted_at: null }, // yesterday
    ];
    const missing = findMissingRecurrenceIds(todos, '2025-01-02');
    expect(missing).toContain('rec_001');
  });

  it('does not return recurrence_id when today already covered', () => {
    const todos = [
      { recurrence_id: 'rec_001', recurrence: 'daily', due_date: '2025-01-02', deleted_at: null }, // today
    ];
    const missing = findMissingRecurrenceIds(todos, '2025-01-02');
    expect(missing).toHaveLength(0);
  });

  it('handles multiple series independently', () => {
    const todos = [
      { recurrence_id: 'rec_001', recurrence: 'daily', due_date: '2025-01-02', deleted_at: null }, // covered
      { recurrence_id: 'rec_002', recurrence: 'daily', due_date: '2025-01-01', deleted_at: null }, // not covered
    ];
    const missing = findMissingRecurrenceIds(todos, '2025-01-02');
    expect(missing).toHaveLength(1);
    expect(missing).toContain('rec_002');
  });
});

describe('createSubmitGuard', () => {
  it('allows one submission and rejects re-entry until it finishes', () => {
    const guard = createSubmitGuard();

    expect(guard.tryStart()).toBe(true);
    expect(guard.tryStart()).toBe(false);

    guard.finish();

    expect(guard.tryStart()).toBe(true);
  });

  it('can be finished after validation fails and used again', () => {
    const guard = createSubmitGuard();

    expect(guard.tryStart()).toBe(true);
    guard.finish();

    expect(guard.tryStart()).toBe(true);
    expect(guard.tryStart()).toBe(false);
  });
});

describe('todos list query (search/filter/sort/group)', () => {
  const today = '2026-04-16';
  const base = {
    notes: null as string | null,
    priority: 'normal' as 'urgent' | 'normal' | 'low',
    project_id: null as string | null,
    goal_id: null as string | null,
    sort_order: 1,
    created_at: '2026-04-10T00:00:00Z',
  };
  const mk = (over: Partial<typeof base> & { title: string; due_date?: string | null }) => ({
    ...base,
    due_date: null,
    ...over,
  });
  const todos = [
    mk({ title: 'Buy milk', due_date: '2026-04-15', priority: 'urgent', sort_order: 1 }),
    mk({ title: 'Write report', notes: 'quarterly numbers', due_date: '2026-04-16', sort_order: 2 }),
    mk({ title: 'Read book', due_date: '2026-05-01', priority: 'low', sort_order: 3 }),
    mk({ title: 'No date task', sort_order: 4, created_at: '2026-04-12T00:00:00Z' }),
  ];

  it('searchTodos matches title and notes case-insensitively', () => {
    expect(searchTodos(todos, 'MILK')).toHaveLength(1);
    expect(searchTodos(todos, 'quarterly')).toHaveLength(1);
    expect(searchTodos(todos, '')).toHaveLength(4);
    expect(searchTodos(todos, '   ')).toHaveLength(4);
  });

  it('filterTodos filters by priority', () => {
    expect(filterTodos(todos, { priority: 'urgent' })).toHaveLength(1);
    expect(filterTodos(todos, { priority: 'all' })).toHaveLength(4);
  });

  it('filterTodos filters by due window', () => {
    expect(filterTodos(todos, { dueWindow: 'overdue', todayKey: today }).map((t) => t.title)).toEqual(['Buy milk']);
    expect(filterTodos(todos, { dueWindow: 'today', todayKey: today }).map((t) => t.title)).toEqual(['Write report']);
    expect(filterTodos(todos, { dueWindow: 'week', todayKey: today }).map((t) => t.title)).toEqual([
      'Write report',
    ]);
    expect(filterTodos(todos, { dueWindow: 'later', todayKey: today }).map((t) => t.title)).toEqual(['Read book']);
    expect(filterTodos(todos, { dueWindow: 'no_due', todayKey: today }).map((t) => t.title)).toEqual(['No date task']);
    expect(filterTodos(todos, { dueWindow: 'all', todayKey: today })).toHaveLength(4);
  });

  it('filterTodos filters by project and goal', () => {
    const withProject = [
      mk({ title: 'a', project_id: 'p1', goal_id: 'g1' }),
      mk({ title: 'b', project_id: 'p1', goal_id: null }),
      mk({ title: 'c', project_id: null, goal_id: null }),
    ];
    expect(filterTodos(withProject, { projectId: 'p1' })).toHaveLength(2);
    expect(filterTodos(withProject, { goalId: 'g1' })).toHaveLength(1);
    expect(filterTodos(withProject, { projectId: null })).toHaveLength(1);
  });

  it('sortTodos sorts by due date with undated last', () => {
    const sorted = sortTodos(todos, 'due_date');
    expect(sorted.map((t) => t.title)).toEqual([
      'Buy milk',
      'Write report',
      'Read book',
      'No date task',
    ]);
  });

  it('sortTodos sorts by priority then due date', () => {
    const sorted = sortTodos(todos, 'priority');
    expect(sorted.map((t) => t.title)).toEqual([
      'Buy milk',
      'Write report',
      'No date task',
      'Read book',
    ]);
  });

  it('sortTodos sorts by created newest first and does not mutate input', () => {
    const sorted = sortTodos(todos, 'created');
    expect(sorted.map((t) => t.title)).toEqual([
      'No date task',
      'Buy milk',
      'Write report',
      'Read book',
    ]);
    expect(todos[0].title).toBe('Buy milk');
  });

  it('applyTodoListQuery composes search, filter, and sort', () => {
    const result = applyTodoListQuery(todos, { search: 'report', sort: 'manual' });
    expect(result.map((t) => t.title)).toEqual(['Write report']);
    const result2 = applyTodoListQuery(todos, { dueWindow: 'week', sort: 'due_date', todayKey: today });
    expect(result2.map((t) => t.title)).toEqual(['Write report']);
  });

  it('groupTodosByDueWindow partitions into four groups', () => {
    const groups = groupTodosByDueWindow(todos, today);
    expect(groups.overdue.map((t) => t.title)).toEqual(['Buy milk']);
    expect(groups.today.map((t) => t.title)).toEqual(['Write report']);
    expect(groups.upcoming.map((t) => t.title)).toEqual(['Read book']);
    expect(groups.noDue.map((t) => t.title)).toEqual(['No date task']);
  });
});
