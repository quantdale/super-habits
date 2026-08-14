export const COMMAND_EXPERIMENT_ENABLED = true;

/**
 * Ask mode (and Auto mode) — enabled 2026-08-05 after the user-ai-ask edge
 * function was deployed with the DeepSeek v4 Flash backend and the bounded
 * intent set + phrase stage were verified live against
 * project kruubbynsmxzxfdunaal.
 */
export const AI_ASK_EXPERIMENT_ENABLED = true;

export type DraftStatus = 'ready' | 'needs_input' | 'unsupported';
export type DraftParserKind = 'mock_rules' | 'model_proxy' | 'model_proxy_fallback';
export type DraftKind =
  | 'create_todo'
  | 'complete_todo'
  | 'create_habit'
  | 'log_habit'
  | 'log_calorie_entry'
  | 'log_workout_routine'
  | 'start_focus_session';
export type ParsePath = 'mock' | 'remote' | 'remote_with_fallback';
export type ParseLatencyBucket = 'fast' | 'noticeable' | 'frustrating';
export type ParseUnsupportedReasonCode = 'unsupported';
export type ParseUnavailableReasonCode =
  | 'remote_not_configured'
  | 'auth_session_unavailable'
  | 'request_timed_out'
  | 'request_failed'
  | 'http_error'
  | 'malformed_json'
  | 'response_validation_failed';
export type ParseReasonCode = ParseUnsupportedReasonCode | ParseUnavailableReasonCode;

export type DraftWarning = {
  code:
    | 'todo_time_not_supported'
    | 'unsupported_recurrence'
    | 'ambiguous_date'
    | 'defaulted_field'
    | 'partial_parse'
    | 'ambiguous_entity'
    | 'missing_nutrition'
    | 'active_timer_conflict'
    | 'already_satisfied'
    | 'off_day';
  message: string;
};

export type DraftMissingField = {
  field: string;
  message: string;
};

export type DraftBase<K extends DraftKind = DraftKind> = {
  kind: K;
  rawText: string;
  parserKind: DraftParserKind;
  parserVersion: string;
  confidence: number | null;
  status: DraftStatus;
  warnings: DraftWarning[];
  missingFields: DraftMissingField[];
  /** Local-only review token. Remote parsers never provide or control it. */
  executionToken?: string;
};

export type DraftCreateTodo = DraftBase & {
  kind: 'create_todo';
  fields: {
    title: string | null;
    notes: string | null;
    dueDate: string | null;
    priority: 'urgent' | 'normal' | 'low';
    recurrence: null;
  };
};

export type DraftCreateHabit = DraftBase & {
  kind: 'create_habit';
  fields: {
    name: string | null;
    targetPerDay: number;
    category: 'anytime' | 'morning' | 'afternoon' | 'evening';
    icon: string | null;
    color: string | null;
  };
};

export type DraftCompleteTodo = DraftBase<'complete_todo'> & {
  kind: 'complete_todo';
  fields: {
    todoTitle: string | null;
  };
};

export type DraftLogHabit = DraftBase<'log_habit'> & {
  kind: 'log_habit';
  fields: {
    habitName: string | null;
    dateKey: string | null;
  };
};

export type DraftLogCalorieEntry = DraftBase<'log_calorie_entry'> & {
  kind: 'log_calorie_entry';
  fields: {
    foodName: string | null;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fats: number | null;
    fiber: number | null;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null;
    consumedOn: string | null;
  };
};

export type DraftLogWorkoutRoutine = DraftBase<'log_workout_routine'> & {
  kind: 'log_workout_routine';
  fields: {
    routineName: string | null;
    completedOn: string | null;
  };
};

export type DraftStartFocusSession = DraftBase<'start_focus_session'> & {
  kind: 'start_focus_session';
  fields: {
    durationMinutes: number | null;
  };
};

export type DraftAiAction =
  | DraftCreateTodo
  | DraftCompleteTodo
  | DraftCreateHabit
  | DraftLogHabit
  | DraftLogCalorieEntry
  | DraftLogWorkoutRoutine
  | DraftStartFocusSession;

export type ParseCommandInput = {
  rawText: string;
  now: Date;
  locale: string;
  timeZone: string;
  todayDateKey: string;
  tomorrowDateKey: string;
};

export type ParseCommandResult =
  | { outcome: 'draft'; draft: DraftAiAction }
  | {
      outcome: 'unsupported';
      rawText: string;
      reason: string;
      reasonCode?: ParseUnsupportedReasonCode;
    }
  | {
      outcome: 'unavailable';
      rawText: string;
      message: string;
      reasonCode: ParseUnavailableReasonCode;
    };

export interface AiCommandParser {
  parse(input: ParseCommandInput): Promise<ParseCommandResult>;
}

export type CommandParseObservation = {
  effectivePath: ParsePath;
  outcome: ParseCommandResult['outcome'];
  draftStatus: DraftStatus | null;
  warningCodes: DraftWarning['code'][];
  missingFieldNames: string[];
  latencyMs: number;
  latencyBucket: ParseLatencyBucket;
  reasonCode: ParseReasonCode | null;
};

export type CommandParseExecution = {
  result: ParseCommandResult;
  observation: CommandParseObservation;
};

export type CommandExecutionResult =
  | {
      outcome: 'success';
      kind: DraftAiAction['kind'];
      entityId: string | null;
      message: string;
    }
  | {
      outcome: 'duplicate' | 'conflict';
      message: string;
    }
  | {
      outcome: 'validation_error';
      message: string;
    }
  | {
      outcome: 'error';
      message: string;
    };
