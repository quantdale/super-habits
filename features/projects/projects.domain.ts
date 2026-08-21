import type { Project, ProjectStatus, TodoPriority } from '@/core/db/types';
import { dateKeyToLocalDate, isValidDateKey } from '@/lib/time';
import {
  PROJECT_COLORS,
  PROJECT_STATUS_VALUES,
  type ProjectInput,
  type ProjectUpdate,
} from '@/features/projects/projects.types';

export const PROJECT_NAME_MAX = 120;
export const PROJECT_DESCRIPTION_MAX = 1000;
export const PROJECT_TARGET_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Statuses that count as "live" for active-project progress summaries. */
export const ACTIVE_PROJECT_STATUSES: readonly ProjectStatus[] = ['active', 'paused'];

export function isProjectColor(value: string): boolean {
  return (PROJECT_COLORS as readonly string[]).includes(value);
}

export function normalizeProjectColor(value: string | undefined | null): string {
  if (value && isProjectColor(value)) return value;
  return PROJECT_COLORS[0];
}

export function isProjectStatus(value: string | undefined | null): value is ProjectStatus {
  return !!value && (PROJECT_STATUS_VALUES as readonly string[]).includes(value);
}

export function normalizeProjectStatus(value: string | undefined | null): ProjectStatus {
  return isProjectStatus(value) ? value : 'active';
}

export function validateTargetDate(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (!PROJECT_TARGET_DATE_PATTERN.test(value)) return null;
  return isValidDateKey(value) ? value : null;
}

export type ProjectValidationResult = {
  ok: boolean;
  name?: string;
  description?: string;
  targetDate?: string;
  status?: string;
};

export function validateProjectInput(input: ProjectInput | ProjectUpdate): ProjectValidationResult {
  const errors: ProjectValidationResult = { ok: true };

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (trimmed.length === 0) {
      errors.ok = false;
      errors.name = 'Name is required.';
    } else if (trimmed.length > PROJECT_NAME_MAX) {
      errors.ok = false;
      errors.name = `Name must be ${PROJECT_NAME_MAX} characters or fewer.`;
    }
  }

  if (input.description !== undefined && input.description !== null) {
    if (input.description.length > PROJECT_DESCRIPTION_MAX) {
      errors.ok = false;
      errors.description = `Description must be ${PROJECT_DESCRIPTION_MAX} characters or fewer.`;
    }
  }

  if (input.status !== undefined && !isProjectStatus(input.status)) {
    errors.ok = false;
    errors.status = 'Invalid status.';
  }

  if (input.targetDate !== undefined) {
    if (validateTargetDate(input.targetDate) === null && input.targetDate) {
      errors.ok = false;
      errors.targetDate = 'Use YYYY-MM-DD.';
    }
  }

  return errors;
}

export function clampProgressPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

// ---------------------------------------------------------------------------
// Progress rollup (pure math; data layer supplies the bounded inputs)
// ---------------------------------------------------------------------------

export type ProjectTodoRollupInput = { total: number; done: number };
export type ProjectGoalRollupInput = { count: number; averageProgressPercent: number };
export type ProjectHabitRollupInput = {
  habitCount: number;
  recentCompletions: number;
  windowDays: number;
};

export type ProjectProgressComponents = {
  todoRatio: number | null;
  goalRatio: number | null;
  habitRatio: number | null;
};

export type ProjectProgress = ProjectProgressComponents & {
  /** Blended 0-100 progress across the linked-entity kinds that have data. */
  percent: number;
  /** True when the project has no linked entities to measure. */
  isEmpty: boolean;
};

function ratio(done: number, total: number): number | null {
  if (!Number.isFinite(total) || total <= 0) return null;
  return Math.max(0, Math.min(1, done / total));
}

/**
 * Blend per-source ratios into a single project progress value. Sources with
 * no data are excluded from the average rather than counted as zero.
 */
export function computeProjectProgress(input: {
  todos: ProjectTodoRollupInput;
  goals: ProjectGoalRollupInput;
  habits: ProjectHabitRollupInput;
}): ProjectProgress {
  const todoRatio = ratio(input.todos.done, input.todos.total);
  const goalRatio =
    input.goals.count > 0
      ? ratio(clampProgressPercent(input.goals.averageProgressPercent), 100)
      : null;
  const expectedSlots = input.habits.habitCount * Math.max(0, input.habits.windowDays);
  const habitRatio =
    input.habits.habitCount > 0 && expectedSlots > 0
      ? ratio(input.habits.recentCompletions, expectedSlots)
      : null;

  const parts = [todoRatio, goalRatio, habitRatio].filter((r): r is number => r !== null);
  const percent =
    parts.length > 0
      ? clampProgressPercent((parts.reduce((a, b) => a + b, 0) / parts.length) * 100)
      : 0;

  return { todoRatio, goalRatio, habitRatio, percent, isEmpty: parts.length === 0 };
}

/** Days from `todayKey` until `targetKey` (negative when overdue). */
export function daysUntilDate(targetKey: string, todayKey: string): number {
  const msPerDay = 86_400_000;
  const target = dateKeyToLocalDate(targetKey).getTime();
  const today = dateKeyToLocalDate(todayKey).getTime();
  return Math.round((target - today) / msPerDay);
}

export type TargetDateCountdown = {
  targetDate: string;
  daysRemaining: number;
  isOverdue: boolean;
  isToday: boolean;
  label: string;
};

/** Human countdown for a project target date; null when no target set. */
export function computeTargetDateCountdown(
  targetDate: string | null | undefined,
  todayKey: string,
): TargetDateCountdown | null {
  if (!targetDate || !isValidDateKey(targetDate)) return null;
  const daysRemaining = daysUntilDate(targetDate, todayKey);
  const isOverdue = daysRemaining < 0;
  const isToday = daysRemaining === 0;
  const abs = Math.abs(daysRemaining);
  const unit = abs === 1 ? 'day' : 'days';
  const label = isToday
    ? 'Due today'
    : isOverdue
      ? `${abs} ${unit} overdue`
      : `${abs} ${unit} remaining`;
  return { targetDate, daysRemaining, isOverdue, isToday, label };
}

// ---------------------------------------------------------------------------
// List filtering / sorting (pure)
// ---------------------------------------------------------------------------

export type ProjectStatusFilter = 'all' | ProjectStatus;
export type ProjectSortKey = 'manual' | 'target_date' | 'progress' | 'name';

export type ProjectListRow = {
  project: Project;
  progressPercent: number;
  linkedCounts: { todos: number; goals: number; habits: number };
};

export function filterProjectRows(
  rows: ProjectListRow[],
  statusFilter: ProjectStatusFilter,
): ProjectListRow[] {
  if (statusFilter === 'all') return rows;
  return rows.filter((row) => row.project.status === statusFilter);
}

export function sortProjectRows(rows: ProjectListRow[], sortKey: ProjectSortKey): ProjectListRow[] {
  const copy = [...rows];
  switch (sortKey) {
    case 'target_date':
      copy.sort((a, b) => {
        // Ascending by target date; undated projects sink to the end.
        if (!a.project.target_date && !b.project.target_date) return 0;
        if (!a.project.target_date) return 1;
        if (!b.project.target_date) return -1;
        return a.project.target_date.localeCompare(b.project.target_date);
      });
      return copy;
    case 'progress':
      copy.sort((a, b) => b.progressPercent - a.progressPercent);
      return copy;
    case 'name':
      copy.sort((a, b) => a.project.name.localeCompare(b.project.name));
      return copy;
    case 'manual':
    default:
      // Data layer already returns manual order (sort_order ASC).
      return copy;
  }
}

const PRIORITY_RANK: Record<TodoPriority, number> = { urgent: 0, normal: 1, low: 2 };

/**
 * "Next up" order for candidate tasks: dated todos first by soonest due date,
 * undated last; ties broken by priority (urgent → normal → low). Stable, so
 * equal due/priority candidates keep the data layer's manual order.
 */
export function compareTodosByNextUp(
  a: { due_date: string | null; priority: TodoPriority },
  b: { due_date: string | null; priority: TodoPriority },
): number {
  if (a.due_date && b.due_date && a.due_date !== b.due_date) {
    return a.due_date.localeCompare(b.due_date);
  }
  if (a.due_date && !b.due_date) return -1;
  if (!a.due_date && b.due_date) return 1;
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}
