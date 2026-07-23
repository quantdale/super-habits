export type AskIntent = 'pending_todos' | 'calorie_summary' | 'habit_streak';

export type AskConversationTurn = {
  question: string;
  answer: string;
};

export type AskParseInput = {
  question: string;
  conversationContext: AskConversationTurn[];
  now: Date;
  locale: string;
  timeZone: string;
  todayDateKey: string;
  tomorrowDateKey: string;
};

export type ClassifyParams = {
  pending_todos: Record<string, never>;
  calorie_summary: { startDateKey: string; endDateKey: string };
  habit_streak: { habitName: string | null };
};

export type ClassifyResult =
  | {
      outcome: 'classified';
      intent: AskIntent;
      params: ClassifyParams[AskIntent];
    }
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
  entryCount: number;
  startDateKey: string;
  endDateKey: string;
};

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
  | { intent: 'habit_streak'; facts: HabitStreakFacts };

export type AskUnsupportedReasonCode = 'unsupported' | 'habit_not_found';

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
