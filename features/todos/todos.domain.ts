import type { TodoPriority } from '@/core/db/types';

/**
 * Get tomorrow's date key as YYYY-MM-DD (local date).
 */
export function getTomorrowDateKey(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Get today's date key as YYYY-MM-DD (local date).
 * Inline implementation — no toDateKey() import (domain purity).
 */
export function getTodayDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

/**
 * Determine which recurrence_ids need a new instance today.
 * Returns the set of recurrence_ids that have no active
 * (non-deleted, non-completed) instance with due_date = today.
 *
 * activeTodos: all non-deleted todos (completed and pending)
 * todayKey: today's date key
 */
export function findMissingRecurrenceIds(
  activeTodos: {
    recurrence_id: string | null;
    recurrence: string | null;
    due_date: string | null;
    deleted_at: string | null;
  }[],
  todayKey: string,
): string[] {
  const allRecurrenceIds = new Set<string>();
  for (const t of activeTodos) {
    if (t.recurrence === 'daily' && t.recurrence_id) {
      allRecurrenceIds.add(t.recurrence_id);
    }
  }

  const coveredToday = new Set<string>();
  for (const t of activeTodos) {
    if (t.recurrence_id && t.due_date === todayKey && t.deleted_at === null) {
      coveredToday.add(t.recurrence_id);
    }
  }

  return Array.from(allRecurrenceIds).filter((id) => !coveredToday.has(id));
}

export type TodoDueWindow = 'all' | 'overdue' | 'today' | 'week' | 'later' | 'no_due';

export type TodoSortMode = 'manual' | 'due_date' | 'priority' | 'created';

export type TodoListFilters = {
  priority?: TodoPriority | 'all';
  dueWindow?: TodoDueWindow;
  projectId?: string | null;
  goalId?: string | null;
  todayKey?: string;
};

export type TodoListQuery = TodoListFilters & {
  search?: string;
  sort?: TodoSortMode;
  todayKey?: string;
};

export type TodoLikeForQuery = {
  title: string;
  notes: string | null;
  due_date: string | null;
  priority: TodoPriority;
  project_id: string | null;
  goal_id: string | null;
  sort_order: number;
  created_at: string;
};

export const PRIORITY_RANK: Record<TodoPriority, number> = {
  urgent: 0,
  normal: 1,
  low: 2,
};

/** Case-insensitive substring match over title and notes. */
export function searchTodos<T extends { title: string; notes: string | null }>(
  todos: T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return todos;
  return todos.filter(
    (todo) =>
      todo.title.toLowerCase().includes(needle) ||
      (todo.notes ?? '').toLowerCase().includes(needle),
  );
}

function getDueWindowEndDate(window: Exclude<TodoDueWindow, 'all' | 'no_due'>, todayKey: string) {
  if (window === 'today') return todayKey;
  if (window === 'overdue') return todayKey;
  // 'week': the next 7 days including today.
  const end = new Date(todayKey + 'T12:00:00');
  end.setDate(end.getDate() + 6);
  const y = end.getFullYear();
  const m = String(end.getMonth() + 1).padStart(2, '0');
  const d = String(end.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function filterTodos<T extends TodoLikeForQuery>(todos: T[], filters: TodoListFilters): T[] {
  const todayKey = filters.todayKey ?? getTodayDateKey();
  return todos.filter((todo) => {
    if (filters.priority && filters.priority !== 'all' && todo.priority !== filters.priority) {
      return false;
    }
    if (filters.projectId !== undefined && todo.project_id !== filters.projectId) {
      return false;
    }
    if (filters.goalId !== undefined && todo.goal_id !== filters.goalId) {
      return false;
    }
    const window = filters.dueWindow;
    if (window && window !== 'all') {
      if (window === 'no_due') {
        if (todo.due_date !== null) return false;
      } else {
        if (todo.due_date === null) return false;
        if (window === 'overdue' && todo.due_date >= todayKey) return false;
        if (window === 'today' && todo.due_date !== todayKey) return false;
        if (window === 'week') {
          const end = getDueWindowEndDate('week', todayKey);
          if (todo.due_date < todayKey || todo.due_date > end) return false;
        }
        if (window === 'later') {
          const end = getDueWindowEndDate('week', todayKey);
          if (todo.due_date <= end) return false;
        }
      }
    }
    return true;
  });
}

/**
 * Stable sort. 'manual' preserves the given order (sort_order is applied by
 * the data layer); due date puts undated last; priority ranks urgent first
 * with due date as tiebreaker; created is newest first.
 */
export function sortTodos<T extends TodoLikeForQuery>(todos: T[], mode: TodoSortMode): T[] {
  const copy = [...todos];
  if (mode === 'manual') return copy;
  if (mode === 'created') {
    copy.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return copy;
  }
  copy.sort((a, b) => {
    if (mode === 'due_date') {
      if (a.due_date === b.due_date) return a.sort_order - b.sort_order;
      if (a.due_date === null) return 1;
      if (b.due_date === null) return -1;
      return a.due_date.localeCompare(b.due_date);
    }
    // 'priority'
    const rankDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (rankDiff !== 0) return rankDiff;
    if (a.due_date !== b.due_date) {
      if (a.due_date === null) return 1;
      if (b.due_date === null) return -1;
      return a.due_date.localeCompare(b.due_date);
    }
    return a.sort_order - b.sort_order;
  });
  return copy;
}

/** Compose search → filter → sort over an in-memory todo list. */
export function applyTodoListQuery<T extends TodoLikeForQuery>(
  todos: T[],
  query: TodoListQuery = {},
): T[] {
  let result = todos;
  if (query.search) result = searchTodos(result, query.search);
  result = filterTodos(result, query);
  return sortTodos(result, query.sort ?? 'manual');
}

export type TodoDueWindowGroups<T> = {
  overdue: T[];
  today: T[];
  upcoming: T[];
  noDue: T[];
};

/** Partition pending todos into overdue / today / upcoming / no-due groups. */
export function groupTodosByDueWindow<T extends { due_date: string | null }>(
  todos: T[],
  todayKey: string,
): TodoDueWindowGroups<T> {
  const groups: TodoDueWindowGroups<T> = {
    overdue: [],
    today: [],
    upcoming: [],
    noDue: [],
  };
  for (const todo of todos) {
    if (todo.due_date === null) groups.noDue.push(todo);
    else if (todo.due_date < todayKey) groups.overdue.push(todo);
    else if (todo.due_date === todayKey) groups.today.push(todo);
    else groups.upcoming.push(todo);
  }
  return groups;
}
