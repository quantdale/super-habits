export type AskIntent =
  | 'pending_todos'
  | 'calorie_summary'
  | 'habit_progress'
  | 'workout_summary'
  | 'focus_summary'
  | 'daily_overview'
  /** Accepted only as a backwards-compatible alias for pre-V2 responses. */
  | 'habit_streak';

export type AskConversationTurn = {
  question: string;
  answer: string;
};

export type AskDateRange = {
  startDateKey: string;
  endDateKey: string;
};

export type PendingTodoParams = {
  due: 'all' | 'today' | 'overdue';
  priority: 'all' | 'urgent' | 'normal' | 'low';
};

export type ClassifyParams = {
  pending_todos: PendingTodoParams;
  calorie_summary: AskDateRange;
  habit_progress: AskDateRange & { habitName: string | null };
  workout_summary: AskDateRange & { routineName: string | null };
  focus_summary: AskDateRange;
  daily_overview: { dateKey: string };
  habit_streak: { habitName: string | null };
};

export type ClassifyResult =
  | { outcome: 'classified'; intent: 'pending_todos'; params: ClassifyParams['pending_todos'] }
  | { outcome: 'classified'; intent: 'calorie_summary'; params: ClassifyParams['calorie_summary'] }
  | { outcome: 'classified'; intent: 'habit_progress'; params: ClassifyParams['habit_progress'] }
  | { outcome: 'classified'; intent: 'workout_summary'; params: ClassifyParams['workout_summary'] }
  | { outcome: 'classified'; intent: 'focus_summary'; params: ClassifyParams['focus_summary'] }
  | { outcome: 'classified'; intent: 'daily_overview'; params: ClassifyParams['daily_overview'] }
  | { outcome: 'classified'; intent: 'habit_streak'; params: ClassifyParams['habit_streak'] }
  | {
      outcome: 'unsupported';
      reason: string;
    };

export type PendingTodosFacts = {
  count: number;
  titles: string[];
};

export type CalorieSummaryFacts = {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
  totalFiber: number;
  entryCount: number;
  startDateKey: string;
  endDateKey: string;
};

export type HabitProgressMetric = {
  habitName: string;
  currentStreak: number;
  longestStreak: number;
  scheduledOccurrences: number;
  completedOccurrences: number;
  currentTarget: number;
  currentActual: number;
  last7Percentage: number | null;
  last30Percentage: number | null;
  last90Percentage: number | null;
};

export type HabitProgressFacts = {
  scope: 'single' | 'overall';
  startDateKey: string;
  endDateKey: string;
  habits: HabitProgressMetric[];
};

export type WorkoutSummaryFacts = {
  startDateKey: string;
  endDateKey: string;
  sessionCount: number;
  lastSession: { routineName: string | null; completedAt: string } | null;
  routineFrequency: { routineName: string; sessionCount: number }[];
};

export type FocusSummaryFacts = {
  startDateKey: string;
  endDateKey: string;
  completedSessionCount: number;
  totalFocusedMinutes: number;
};

export type DailyOverviewFacts = {
  dateKey: string;
  todos: { pendingCount: number; completedCount: number; overdueCount: number };
  habits: { scheduledCount: number; completedCount: number; remainingCount: number };
  calories: Pick<
    CalorieSummaryFacts,
    'totalCalories' | 'totalProtein' | 'totalCarbs' | 'totalFats' | 'totalFiber' | 'entryCount'
  >;
  focus: Pick<FocusSummaryFacts, 'completedSessionCount' | 'totalFocusedMinutes'>;
  workout: Pick<WorkoutSummaryFacts, 'sessionCount'>;
};

/** Backward-compatible V1 fact shape for legacy tests/clients. */
export type HabitStreakFacts =
  | {
      scope: 'single';
      habitName: string;
      currentStreak: number;
      longestStreak: number;
    }
  | {
      scope: 'overall';
      habits: { habitName: string; currentStreak: number; longestStreak: number }[];
    };

export type RetrievedFacts =
  | { intent: 'pending_todos'; facts: PendingTodosFacts }
  | { intent: 'calorie_summary'; facts: CalorieSummaryFacts }
  | { intent: 'habit_progress'; facts: HabitProgressFacts }
  | { intent: 'habit_streak'; facts: HabitStreakFacts }
  | { intent: 'workout_summary'; facts: WorkoutSummaryFacts }
  | { intent: 'focus_summary'; facts: FocusSummaryFacts }
  | { intent: 'daily_overview'; facts: DailyOverviewFacts };

export type AskUnsupportedReasonCode =
  | 'unsupported'
  | 'habit_not_found'
  | 'habit_ambiguous'
  | 'routine_not_found'
  | 'routine_ambiguous'
  | 'invalid_range';

export type AskUnavailableReasonCode =
  | 'remote_not_configured'
  | 'auth_session_unavailable'
  | 'request_timed_out'
  | 'request_failed'
  | 'http_error'
  | 'malformed_json'
  | 'response_validation_failed';

export type AskResult =
  | { outcome: 'answer'; question: string; answer: string; intent: AskIntent }
  | {
      outcome: 'unsupported';
      question: string;
      reason: string;
      reasonCode: AskUnsupportedReasonCode;
    }
  | {
      outcome: 'unavailable';
      question: string;
      message: string;
      reasonCode: AskUnavailableReasonCode;
    };

export interface AiAskParser {
  ask(input: AskParseInput): Promise<AskResult>;
}

export type AskParseInput = {
  question: string;
  conversationContext: AskConversationTurn[];
  now: Date;
  locale: string;
  timeZone: string;
  todayDateKey: string;
  tomorrowDateKey: string;
};
