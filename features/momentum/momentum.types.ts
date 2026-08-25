import type {
  Goal,
  Habit,
  HabitCompletion,
  PomodoroSession,
  Project,
  WorkoutLog,
} from '@/core/db/types';

export const MOMENTUM_MAX_DAYS = 28;
export const MOMENTUM_DEFAULT_DAYS = 7;

export const MOMENTUM_SOURCES = [
  'tasks',
  'habits',
  'focus',
  'workout',
  'nutrition',
  'planning',
  'review',
] as const;

export type MomentumSource = (typeof MOMENTUM_SOURCES)[number];

export const MOMENTUM_SOURCE_LABELS: Record<MomentumSource, string> = {
  tasks: 'Tasks',
  habits: 'Habits',
  focus: 'Focus',
  workout: 'Workout',
  nutrition: 'Nutrition',
  planning: 'Planning',
  review: 'Weekly Review',
};

export const MOMENTUM_LIMITS = {
  tasksPerDay: 3,
  habitsPerDay: 3,
  focusSessionsPerDay: 2,
  workoutSessionsPerDay: 1,
  nutritionDaysPerDay: 1,
  planningCompletionsPerDay: 1,
  reviewCompletionsPerDay: 1,
  queryRowsPerTimestampSource: 500,
  queryRowsPerHabitSource: 500,
  queryRowsPerHabitCompletionSource: 1_000,
} as const;

export type MomentumTaskFact = {
  completed: 0 | 1;
  completed_at?: string | null;
  deleted_at?: string | null;
};

export type MomentumFocusFact = Pick<
  PomodoroSession,
  'started_at' | 'ended_at' | 'duration_seconds' | 'session_type'
>;

export type MomentumWorkoutFact = Pick<WorkoutLog, 'completed_at'>;

export type MomentumNutritionFact = {
  consumed_on: string;
  deleted_at?: string | null;
};

export type MomentumDailyPlanFact = {
  date_key: string;
  status: 'draft' | 'committed' | 'completed';
  completed_at?: string | null;
  deleted_at?: string | null;
};

export type MomentumReviewFact = {
  completed_at: string | null;
  status: 'draft' | 'completed';
  deleted_at?: string | null;
};

export type MomentumMilestoneFact = {
  id: string;
  label: string;
  completed_at?: string | null;
  status: string;
  deleted_at?: string | null;
};

export type MomentumDomainInput = {
  todayKey: string;
  days?: number;
  tasks: readonly MomentumTaskFact[];
  habits: readonly Habit[];
  habitCompletions: readonly Pick<HabitCompletion, 'habit_id' | 'date_key' | 'count'>[];
  focus: readonly MomentumFocusFact[];
  workouts: readonly MomentumWorkoutFact[];
  nutrition: readonly MomentumNutritionFact[];
  dailyPlans: readonly MomentumDailyPlanFact[];
  reviews: readonly MomentumReviewFact[];
  milestones: readonly MomentumMilestoneFact[];
};

export type MomentumContribution = {
  source: MomentumSource;
  label: string;
  count: number;
  level: 0 | 1 | 2 | 3;
  detail: string;
};

export type MomentumDay = {
  dateKey: string;
  isToday: boolean;
  contributions: Record<MomentumSource, MomentumContribution>;
  activeSources: MomentumSource[];
  hasGrowth: boolean;
  accessibilityLabel: string;
};

export type MomentumMilestone = {
  id: string;
  label: string;
  dateKey: string;
};

export type MomentumGardenModel = {
  todayKey: string;
  days: MomentumDay[];
  today: MomentumDay;
  milestones: MomentumMilestone[];
  activeDays: number;
  hasPriorGrowth: boolean;
  accessibilityLabel: string;
};

export type MomentumSourceExplanation = {
  source: MomentumSource;
  label: string;
  explanation: string;
};

export type MomentumWindow = {
  todayKey: string;
  startKey: string;
  endKey: string;
  days: string[];
};

// Keep these imports type-visible to make it easy for callers to construct
// source facts from the authoritative entity shapes without widening the
// runtime module boundary.
export type MomentumProject = Pick<
  Project,
  'id' | 'name' | 'status' | 'completed_at' | 'deleted_at'
>;
export type MomentumGoal = Pick<Goal, 'id' | 'title' | 'status' | 'completed_at' | 'deleted_at'>;
