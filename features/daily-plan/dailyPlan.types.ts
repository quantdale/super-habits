import type { DailyPlan, DailyPlanStatus } from '@/core/db/types';

export type { DailyPlan, DailyPlanStatus };

export const DAILY_PLAN_STATUS_VALUES: readonly DailyPlanStatus[] = [
  'draft',
  'committed',
  'completed',
];

export const DAILY_PLAN_STATUS_LABELS: Record<DailyPlanStatus, string> = {
  draft: 'Draft',
  committed: 'Committed',
  completed: 'Completed',
};

export const MAX_TOP_PRIORITIES = 3;
export const FOCUS_TARGET_MAX_MINUTES = 24 * 60;
export const ENERGY_SCORE_MIN = 1;
export const ENERGY_SCORE_MAX = 5;
export const INTENTION_MAX = 1000;
export const NOTES_MAX = 2000;
export const REFLECTION_MAX = 2000;
