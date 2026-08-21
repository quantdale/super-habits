import type { Goal, GoalHorizon, GoalStatus } from '@/core/db/types';
import { isValidDateKey } from '@/lib/time';
import { clampProgressPercent } from '@/features/projects/projects.domain';
import {
  GOAL_HORIZON_LABELS,
  GOAL_HORIZON_VALUES,
  GOAL_STATUS_VALUES,
  type GoalInput,
  type GoalUpdate,
} from '@/features/goals/goals.types';

export const GOAL_TITLE_MAX = 160;
export const GOAL_DESCRIPTION_MAX = 1000;
export const GOAL_TARGET_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const ACTIVE_GOAL_STATUSES: readonly GoalStatus[] = ['active', 'paused'];

export function isGoalHorizon(value: string | undefined | null): value is GoalHorizon {
  return !!value && (GOAL_HORIZON_VALUES as readonly string[]).includes(value);
}

export function normalizeGoalHorizon(value: string | undefined | null): GoalHorizon {
  return isGoalHorizon(value) ? value : 'month';
}

export function isGoalStatus(value: string | undefined | null): value is GoalStatus {
  return !!value && (GOAL_STATUS_VALUES as readonly string[]).includes(value);
}

export function normalizeGoalStatus(value: string | undefined | null): GoalStatus {
  return isGoalStatus(value) ? value : 'active';
}

export function validateGoalTargetDate(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (!GOAL_TARGET_DATE_PATTERN.test(value)) return null;
  return isValidDateKey(value) ? value : null;
}

export type GoalValidationResult = {
  ok: boolean;
  title?: string;
  description?: string;
  targetDate?: string;
  status?: string;
  progressPercent?: string;
};

export function validateGoalInput(input: GoalInput | GoalUpdate): GoalValidationResult {
  const errors: GoalValidationResult = { ok: true };

  if (input.title !== undefined) {
    const trimmed = input.title.trim();
    if (trimmed.length === 0) {
      errors.ok = false;
      errors.title = 'Title is required.';
    } else if (trimmed.length > GOAL_TITLE_MAX) {
      errors.ok = false;
      errors.title = `Title must be ${GOAL_TITLE_MAX} characters or fewer.`;
    }
  }

  if (input.description !== undefined && input.description !== null) {
    if (input.description.length > GOAL_DESCRIPTION_MAX) {
      errors.ok = false;
      errors.description = `Description must be ${GOAL_DESCRIPTION_MAX} characters or fewer.`;
    }
  }

  if (input.horizon !== undefined && !isGoalHorizon(input.horizon)) {
    errors.ok = false;
    errors.status = 'Invalid horizon.';
  }

  if (input.status !== undefined && !isGoalStatus(input.status)) {
    errors.ok = false;
    errors.status = 'Invalid status.';
  }

  if (
    input.targetDate !== undefined &&
    input.targetDate &&
    validateGoalTargetDate(input.targetDate) === null
  ) {
    errors.ok = false;
    errors.targetDate = 'Use YYYY-MM-DD.';
  }

  if (input.progressPercent !== undefined && !Number.isFinite(input.progressPercent)) {
    errors.ok = false;
    errors.progressPercent = 'Progress must be a number.';
  }

  return errors;
}

export function normalizeGoalProgress(value: number | undefined | null): number {
  return clampProgressPercent(value ?? 0);
}

export { clampProgressPercent };

// ---------------------------------------------------------------------------
// Horizon-aware presentation
// ---------------------------------------------------------------------------

/** Review-window length in days per horizon; null = user-defined (custom). */
export const GOAL_HORIZON_WINDOW_DAYS: Record<GoalHorizon, number | null> = {
  week: 7,
  month: 30,
  quarter: 91,
  year: 365,
  custom: null,
};

export type GoalHorizonPresentation = {
  horizon: GoalHorizon;
  label: string;
  /** Fixed window length in days, or null for custom horizons. */
  windowDays: number | null;
  cadenceHint: string;
};

export function describeGoalHorizon(horizon: GoalHorizon): GoalHorizonPresentation {
  const windowDays = GOAL_HORIZON_WINDOW_DAYS[horizon];
  const hints: Record<GoalHorizon, string> = {
    week: 'Review daily; expect visible movement within a week.',
    month: 'Check in weekly against the linked tasks.',
    quarter: 'Check in every two weeks; keep linked projects on track.',
    year: 'Review monthly; long-horizon goals move slowly.',
    custom: 'Set your own target date and review rhythm.',
  };
  return {
    horizon,
    label: GOAL_HORIZON_LABELS[horizon],
    windowDays,
    cadenceHint: hints[horizon],
  };
}

// ---------------------------------------------------------------------------
// Linked-entity rollup (pure math)
// ---------------------------------------------------------------------------

export type GoalTodoRollupInput = { total: number; done: number };
export type GoalHabitRollupInput = {
  habitCount: number;
  completionsInWindow: number;
  windowDays: number;
};

export type GoalRollup = {
  todoRatio: number | null;
  habitConsistency: number | null;
  /** Blended 0-100 suggested progress from linked entities. */
  suggestedPercent: number;
  isEmpty: boolean;
};

/**
 * Blend linked-todo completion ratio and linked-habit consistency into a
 * suggested goal progress. Sources with no data are excluded from the average.
 */
export function computeGoalRollup(input: {
  todos: GoalTodoRollupInput;
  habits: GoalHabitRollupInput;
}): GoalRollup {
  const todoRatio =
    input.todos.total > 0 ? Math.max(0, Math.min(1, input.todos.done / input.todos.total)) : null;
  const expectedSlots = input.habits.habitCount * Math.max(0, input.habits.windowDays);
  const habitConsistency =
    input.habits.habitCount > 0 && expectedSlots > 0
      ? Math.max(0, Math.min(1, input.habits.completionsInWindow / expectedSlots))
      : null;

  const parts = [todoRatio, habitConsistency].filter((r): r is number => r !== null);
  const suggestedPercent =
    parts.length > 0
      ? clampProgressPercent((parts.reduce((a, b) => a + b, 0) / parts.length) * 100)
      : 0;

  return {
    todoRatio,
    habitConsistency,
    suggestedPercent,
    isEmpty: parts.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Progress editing validation
// ---------------------------------------------------------------------------

export type ProgressParseResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

/** Parse free-text progress input ("42", "42%", " 7 ") into a clamped 0-100 int. */
export function parseGoalProgressText(text: string): ProgressParseResult {
  const trimmed = text.trim().replace(/%$/, '').trim();
  if (trimmed.length === 0) return { ok: false, error: 'Enter a progress value.' };
  if (!/^\d{1,3}$/.test(trimmed)) {
    return { ok: false, error: 'Progress must be a whole number between 0 and 100.' };
  }
  const value = Number(trimmed);
  if (value < 0 || value > 100) {
    return { ok: false, error: 'Progress must be between 0 and 100.' };
  }
  return { ok: true, value };
}

// ---------------------------------------------------------------------------
// List filtering / sorting (pure)
// ---------------------------------------------------------------------------

export type GoalStatusFilter = 'all' | GoalStatus;
export type GoalHorizonFilter = 'all' | GoalHorizon;
export type GoalSortKey = 'created' | 'progress' | 'target_date' | 'title';

export type GoalListRow = {
  goal: Goal;
  projectName: string | null;
};

export function filterGoalRows(
  rows: GoalListRow[],
  filters: { status: GoalStatusFilter; horizon: GoalHorizonFilter },
): GoalListRow[] {
  return rows.filter((row) => {
    if (filters.status !== 'all' && row.goal.status !== filters.status) return false;
    if (filters.horizon !== 'all' && row.goal.horizon !== filters.horizon) return false;
    return true;
  });
}

export function sortGoalRows(rows: GoalListRow[], sortKey: GoalSortKey): GoalListRow[] {
  const copy = [...rows];
  switch (sortKey) {
    case 'progress':
      copy.sort((a, b) => b.goal.progress_percent - a.goal.progress_percent);
      return copy;
    case 'target_date':
      copy.sort((a, b) => {
        if (!a.goal.target_date && !b.goal.target_date) return 0;
        if (!a.goal.target_date) return 1;
        if (!b.goal.target_date) return -1;
        return a.goal.target_date.localeCompare(b.goal.target_date);
      });
      return copy;
    case 'title':
      copy.sort((a, b) => a.goal.title.localeCompare(b.goal.title));
      return copy;
    case 'created':
    default:
      // Data layer already returns created_at DESC.
      return copy;
  }
}
