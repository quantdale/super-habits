import type { ProjectStatus } from '@/core/db/types';
import { isValidDateKey } from '@/lib/time';
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
