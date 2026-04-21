export const COMMAND_EXPERIMENT_ENABLED = true;

export type DraftStatus = "ready" | "needs_input" | "unsupported";

export type DraftWarning = {
  code:
    | "todo_time_not_supported"
    | "unsupported_recurrence"
    | "ambiguous_date"
    | "defaulted_field"
    | "partial_parse";
  message: string;
};

export type DraftMissingField = {
  field: string;
  message: string;
};

export type DraftBase = {
  kind: "create_todo" | "create_habit";
  rawText: string;
  parserKind: "mock_rules";
  parserVersion: "v1";
  confidence: number | null;
  status: DraftStatus;
  warnings: DraftWarning[];
  missingFields: DraftMissingField[];
};

export type DraftCreateTodo = DraftBase & {
  kind: "create_todo";
  fields: {
    title: string | null;
    notes: string | null;
    dueDate: string | null;
    priority: "urgent" | "normal" | "low";
    recurrence: null;
  };
};

export type DraftCreateHabit = DraftBase & {
  kind: "create_habit";
  fields: {
    name: string | null;
    targetPerDay: number;
    category: "anytime" | "morning" | "afternoon" | "evening";
    icon: string | null;
    color: string | null;
  };
};

export type DraftAiAction = DraftCreateTodo | DraftCreateHabit;

export type ParseCommandInput = {
  rawText: string;
  now: Date;
  locale: string;
  timeZone: string;
};

export type ParseCommandResult =
  | { outcome: "draft"; draft: DraftAiAction }
  | { outcome: "unsupported"; rawText: string; reason: string };

export interface AiCommandParser {
  parse(input: ParseCommandInput): Promise<ParseCommandResult>;
}

export type CommandExecutionResult =
  | {
      outcome: "success";
      kind: DraftAiAction["kind"];
      entityId: string;
      message: string;
    }
  | {
      outcome: "validation_error";
      message: string;
    }
  | {
      outcome: "error";
      message: string;
    };
