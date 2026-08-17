import type { BaseEntity } from '@/core/db/types';

// Canonical week - Monday-start (ISO convention, matching existing HabitWeekday 1=Mon)
export type ReviewWeek = {
  weekKey: string; // YYYY-MM-DD of the Monday start
  startDateKey: string; // YYYY-MM-DD Monday
  endDateKey: string; // YYYY-MM-DD Sunday (inclusive)
  nextWeekStartDateKey: string;
  nextWeekEndDateKey: string;
};

export type WeeklyTodoDecision =
  | { todoId: string; action: 'leave' }
  | { todoId: string; action: 'reschedule'; dueDate: string }
  | { todoId: string; action: 'carry_forward'; dueDate?: string };

export type WeeklyPriorityDraft = {
  id: string;
  text: string;
};

export type NewTodoCommitmentDraft = {
  id: string;
  title: string;
  notes?: string;
  dueDate?: string;
  priority: 'urgent' | 'normal' | 'low';
  createdTodoId?: string;
};

export type WeeklyReviewDraft = {
  weekKey: string;
  todoDecisions: WeeklyTodoDecision[];
  priorities: WeeklyPriorityDraft[];
  newCommitments: NewTodoCommitmentDraft[];
  reflection: string;
};

export type TodoSummaryItem = {
  id: string;
  title: string;
  dueDate: string | null;
  priority: string;
};

export type TodoSummary = {
  completedCount: number;
  incompleteCount: number;
  overdueCount: number;
  dueNextWeekCount: number;
  carryForwardCandidates: TodoSummaryItem[];
};

export type HabitAttentionItem = {
  habitId: string;
  name: string;
  kind: string;
  message: string;
};

export type HabitSummary = {
  scheduledOccurrences: number;
  completedOccurrences: number;
  consistencyPercent: number | null;
  attention: HabitAttentionItem[];
};

export type FocusSummary = {
  sessions: number;
  minutes: number;
  priorWeekMinutes: number | null;
};

export type RoutineFrequencyItem = {
  routineId: string;
  name: string;
  count: number;
};

export type WorkoutSummary = {
  sessions: number;
  priorWeekSessions: number | null;
  routines: RoutineFrequencyItem[];
};

export type CalorieSummary = {
  loggedDays: number;
  averageCaloriesOnLoggedDays: number | null;
  configuredGoal: number | null;
};

export type ReviewInsight = {
  kind: string;
  message: string;
};

export type WeeklyReviewSummaryV1 = {
  version: 1;
  week: ReviewWeek;
  todos: TodoSummary;
  habits: HabitSummary;
  focus: FocusSummary;
  workouts: WorkoutSummary;
  calories: CalorieSummary;
  wins: ReviewInsight[];
  attention: ReviewInsight[];
};

export type WeeklyPlanPayload = {
  priorities: { id: string; text: string }[];
  todoDecisions: WeeklyTodoDecision[];
  newCommitments: {
    id: string;
    title: string;
    notes?: string;
    dueDate?: string;
    priority: string;
    createdTodoId?: string;
  }[];
};

// Persisted weekly review row (matches SQLite schema)
export type WeeklyReview = BaseEntity & {
  week_key: string;
  week_start_date: string;
  week_end_date: string;
  next_week_start_date: string;
  completed_at: string | null;
  status: 'draft' | 'completed';
  summary_payload: string;
  plan_payload: string;
  reflection: string;
};
