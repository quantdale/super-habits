import type { Project, ProjectStatus } from '@/core/db/types';

export type { Project, ProjectStatus };

/**
 * Theme-safe palette for Project colors. Stored as a hex string so it persists
 * in SQLite without coupling to the theme system.
 */
export const PROJECT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#8B5CF6', // violet
  '#F97316', // orange
  '#F59E0B', // amber
  '#EC4899', // pink
  '#14B8A6', // teal
  '#EF4444', // red
  '#6366F1', // indigo
  '#84CC16', // lime
] as const;

export const PROJECT_STATUS_VALUES: readonly ProjectStatus[] = [
  'active',
  'paused',
  'completed',
  'archived',
];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  archived: 'Archived',
};

export type ProjectInput = {
  name: string;
  description?: string | null;
  color?: string;
  status?: ProjectStatus;
  targetDate?: string | null;
};

export type ProjectUpdate = {
  name?: string;
  description?: string | null;
  color?: string;
  status?: ProjectStatus;
  targetDate?: string | null;
};
