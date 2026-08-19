import type { Goal, GoalHorizon, GoalStatus } from '@/core/db/types';

export type { Goal, GoalHorizon, GoalStatus };

export const GOAL_HORIZON_VALUES: readonly GoalHorizon[] = [
  'week',
  'month',
  'quarter',
  'year',
  'custom',
];

export const GOAL_HORIZON_LABELS: Record<GoalHorizon, string> = {
  week: 'This Week',
  month: 'This Month',
  quarter: 'This Quarter',
  year: 'This Year',
  custom: 'Custom',
};

export const GOAL_STATUS_VALUES: readonly GoalStatus[] = [
  'active',
  'paused',
  'completed',
  'archived',
];

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
};

export type GoalInput = {
  projectId?: string | null;
  title: string;
  description?: string | null;
  horizon?: GoalHorizon;
  targetDate?: string | null;
  status?: GoalStatus;
  progressPercent?: number;
};

export type GoalUpdate = {
  projectId?: string | null;
  title?: string;
  description?: string | null;
  horizon?: GoalHorizon;
  targetDate?: string | null;
  status?: GoalStatus;
  progressPercent?: number;
};
