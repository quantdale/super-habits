import type { TodoPriority } from '@/core/db/types';
import { addLocalDays, toDateKey } from '@/lib/time';

/**
 * Get tomorrow's date key as YYYY-MM-DD (local date).
 *
 * `reference` defaults to now; pass an explicit clock to keep a caller
 * deterministic (recurrence spawning and notification actions both do).
 */
export function getTomorrowDateKey(reference: Date = new Date()): string {
  return addLocalDays(toDateKey(reference), 1);
}

/**
 * Get today's date key as YYYY-MM-DD (local date).
 *
 * Thin alias of `lib/time`'s local-day contract: `lib/time` is dependency-free
 * and already imported by other `*.domain.ts` files, so domain purity is not
 * a reason to duplicate the builder here.
 */
export function getTodayDateKey(reference: Date = new Date()): string {
  return toDateKey(reference);
}

/**
 * Determine which recurrence_ids need a new instance today.
 * Returns the set of recurrence_ids that have no active
 * (non-deleted, non-completed) instance with due_date = today.
 *
 * A live PENDING instance with NO due date also covers its series. Such a row
 * cannot be matched by the date comparison, so without this it looked
 * permanently missing and the rollover scan appended another pending copy on
 * the first load of each day — an ever-growing pile of identical tasks.
 * Starting a daily series without typing a date (`Repeat daily` alone) and
 * clearing the date of an existing series both produce exactly that row.
 *
 * Completion state matters here, unlike the due-date branch: a COMPLETED
 * undated row must not cover its series, or finishing today's copy would
 * suppress every future copy of the chain forever.
 *
 * activeTodos: all non-deleted todos (completed and pending)
 * todayKey: today's date key
 */
export function findMissingRecurrenceIds(
  activeTodos: {
    recurrence_id: string | null;
    recurrence: string | null;
    due_date: string | null;
    completed: 0 | 1;
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
    if (!t.recurrence_id || t.deleted_at !== null) continue;
    // Dated coverage is unchanged (a completed row due today still covers).
    if (t.due_date === todayKey || (t.due_date === null && t.completed === 0)) {
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
  return addLocalDays(todayKey, 6);
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

export type TodoRowMetaTone = 'danger' | 'warning' | 'muted';

export type TodoRowMetaItem = {
  key: 'due' | 'priority' | 'project' | 'recurrence';
  text: string;
  tone: TodoRowMetaTone;
};

export type TodoLikeForRowMeta = {
  due_date: string | null;
  priority: TodoPriority;
  recurrence: string | null;
};

/** `Mar 4`-style compact label for a YYYY-MM-DD date key (locale-fixed for determinism). */
function formatDueMeta(dueDate: string): string {
  const date = new Date(dueDate + 'T12:00:00');
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

/**
 * The metadata line for a task row, in the campaign's priority hierarchy
 * (docs/ui-ux/13 §6 + campaign brief §12):
 *
 *   1. overdue / due date when it matters (state-toned text, never a red row)
 *   2. priority when meaningful (urgent/low only — plain tasks say nothing)
 *   3. project/context when linked
 *   4. recurrence (secondary flag)
 *
 * A plain task yields `[]` and renders as checkbox + title only. Ordering is
 * stable so rows scan consistently; the caller may omit `projectName` when it
 * has not resolved project names (the project item is then skipped).
 */
export function buildTodoRowMeta<T extends TodoLikeForRowMeta>(
  todo: T,
  todayKey: string,
  options: { projectName?: string | null } = {},
): TodoRowMetaItem[] {
  const items: TodoRowMetaItem[] = [];

  if (todo.due_date !== null) {
    if (todo.due_date < todayKey) {
      items.push({ key: 'due', text: `Overdue · ${formatDueMeta(todo.due_date)}`, tone: 'danger' });
    } else if (todo.due_date === todayKey) {
      items.push({ key: 'due', text: 'Today', tone: 'warning' });
    } else {
      items.push({ key: 'due', text: formatDueMeta(todo.due_date), tone: 'muted' });
    }
  }

  if (todo.priority === 'urgent') {
    items.push({ key: 'priority', text: 'Urgent', tone: 'danger' });
  } else if (todo.priority === 'low') {
    items.push({ key: 'priority', text: 'Low', tone: 'muted' });
  }

  if (options.projectName) {
    items.push({ key: 'project', text: options.projectName, tone: 'muted' });
  }

  if (todo.recurrence === 'daily') {
    items.push({ key: 'recurrence', text: '↻ daily', tone: 'muted' });
  }

  return items;
}

/**
 * True when a todo toggle may take the gamification fast path.
 *
 * Mirror of shouldAwardHabitFastPath: only a confirmed completion
 * (result.completed equals 1 from toggleTodo, completeTodo, or
 * setTodoCompletionState) may award, and only when the completion belongs to
 * the award's own local day (`actionDateKey === todayKey`). A failed toggle
 * (missing or deleted row or lost race yields completed 0) must not mint XP
 * for an action that never happened. The un-complete direction (completed 0)
 * never awards.
 *
 * The day match is correctness, not latency (same refusal as the habit
 * guard's backdated-write check): the midnight-straddle race — the write
 * stamps `completed_at` just before local midnight and the award re-reads the
 * day just after — must not award under the NEXT day's key. Todo source keys
 * are per-todo-per-day (`${dateKey}:${todoId}`), so a next-day-keyed award
 * never matches reconcile's action-day key: housekeeping would pay the same
 * completion a second time (double XP) and the stray row would mark a
 * zero-activity day active. A completion that misses the fast path degrades
 * to reconcile backfill (exact + silent), the same miss+reconcile policy as
 * the habit guard.
 */
export function shouldAwardTodoFastPath(
  completed: 0 | 1,
  actionDateKey: string,
  todayKey: string,
): boolean {
  return completed === 1 && actionDateKey === todayKey;
}
