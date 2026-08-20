import type { GoalHorizon, GoalStatus } from '@/core/db/types';
import { isValidDateKey } from '@/lib/time';
import { clampProgressPercent } from '@/features/projects/projects.domain';
import {
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
