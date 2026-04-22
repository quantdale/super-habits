import { toDateKey } from "@/lib/time";
import type {
  DraftAiAction,
  DraftCreateHabit,
  DraftCreateTodo,
  DraftMissingField,
  DraftStatus,
  DraftWarning,
  ParseCommandInput,
  ParseCommandResult,
} from "./types";

const SAFE_DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/;
const TODO_TIME_PATTERN = /\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)|\d{1,2}:\d{2})\b/i;
const MULTI_ACTION_PATTERN =
  /\b(?:and|then|also)\b\s+(?:to\s+)?(?:add|create|make|remind|call|pay|send|email|text|buy|book|schedule|do|write|read|finish|complete|submit|review|clean|fix|update)\b|;\s*(?:add|create|make|remind|call|pay|send|email|text|buy|book|schedule|do|write|read|finish|complete|submit|review|clean|fix|update)\b/i;
const UNSUPPORTED_ROOT_VERB_PATTERN =
  /^(?:delete|remove|clear|destroy|erase|edit|update|change|rename|complete|finish)\b/i;
const POLITE_PREFIX_PATTERN = /^(?:please|kindly)\s+/i;
const QUESTION_PREFIX_PATTERN = /^(?:can|could|would)\s+you\s+/i;
const TODO_KEYWORD_PATTERN = /\b(?:todo|task)\b/i;
const HABIT_KEYWORD_PATTERN = /\bhabit\b/i;
const TODO_HINT_PREFIX_PATTERN = /^(?:remind\s+me\s+to|add\s+(?:(?:a|an)\s+)?task\s+to)\s+/i;
const I_NEED_TO_PREFIX_PATTERN = /^i\s+need\s+to\s+/i;
const VAGUE_I_NEED_TO_PATTERN = /^(?:be|get|become)\b/i;
const I_NEED_TO_TASK_VERB_PATTERN =
  /^(?:call|pay|send|email|text|message|buy|book|schedule|finish|complete|submit|review|read|write|clean|fix|pick|drop|cancel|renew|plan|prepare|update|reply|visit|do|go|check)\b/i;
const WEEKDAY_SCHEDULE_PATTERN =
  /\b(?:every|each|on|this|next)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?\b|\bweekdays?\b/i;
const AMBIGUOUS_DATE_PATTERN =
  /\b(?:next|this)\s+(?:week|month|weekend|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\bweekend\b|\b(?:later|someday|sometime|soon|eventually)\b/i;
const UNSUPPORTED_TODO_RECURRENCE_PATTERN =
  /\b(?:every day|everyday|daily|each day|every week|weekly|every month|monthly|every weekday|weekdays|on weekdays)\b/i;
const HABIT_CATEGORY_PATTERN = /\bevery\s+(morning|afternoon|evening)\b/i;
const HABIT_LIKE_CADENCE_PATTERN =
  /\b(?:every|daily|weekdays?|weekends?|monday|tuesday|wednesday|thursday|friday|saturday|sunday|morning|afternoon|evening)\b/i;

type CommandIntent = DraftAiAction["kind"];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripLeadingScaffolding(text: string, patterns: RegExp[]): string {
  let next = normalizeWhitespace(text);
  let changed = true;

  while (changed) {
    changed = false;
    for (const pattern of patterns) {
      const replaced = next.replace(pattern, "");
      if (replaced !== next) {
        next = normalizeWhitespace(replaced);
        changed = true;
      }
    }
  }

  return next;
}

function cleanEntityLabel(text: string): string | null {
  const cleaned = stripLeadingScaffolding(
    text.replace(/[.,!?;:]+$/g, ""),
    [/^to\s+/i, /^that\s+/i],
  );

  return cleaned.length > 0 ? cleaned : null;
}

function isValidDateKey(dateKey: string): boolean {
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  return toDateKey(date) === dateKey;
}

function getTomorrowDateKey(now: Date): string {
  const nextDay = new Date(now);
  nextDay.setDate(nextDay.getDate() + 1);
  return toDateKey(nextDay);
}

function isClearlyTaskLikeINeedTo(remainder: string): boolean {
  const next = normalizeWhitespace(remainder);
  if (!next) return false;
  if (VAGUE_I_NEED_TO_PATTERN.test(next)) return false;
  if (HABIT_LIKE_CADENCE_PATTERN.test(next)) return false;
  if (MULTI_ACTION_PATTERN.test(next)) return false;

  const tokenCount = next.split(" ").filter(Boolean).length;
  if (tokenCount < 2) return false;
  if (SAFE_DATE_PATTERN.test(next) || /\b(?:today|tomorrow)\b/i.test(next)) return true;

  return I_NEED_TO_TASK_VERB_PATTERN.test(next);
}

function detectIntent(rawText: string): {
  intent: CommandIntent | null;
  reason: string | null;
} {
  const leadingNormalizedText = stripLeadingScaffolding(rawText, [
    POLITE_PREFIX_PATTERN,
    QUESTION_PREFIX_PATTERN,
  ]);
  const hasHabitCue =
    HABIT_KEYWORD_PATTERN.test(leadingNormalizedText) ||
    HABIT_CATEGORY_PATTERN.test(leadingNormalizedText);
  const hasTodoCue =
    TODO_KEYWORD_PATTERN.test(leadingNormalizedText) ||
    TODO_HINT_PREFIX_PATTERN.test(leadingNormalizedText);
  const hasINeedTo = I_NEED_TO_PREFIX_PATTERN.test(leadingNormalizedText);

  if (hasHabitCue && (hasTodoCue || hasINeedTo)) {
    return {
      intent: null,
      reason: "This phrasing mixes todo and habit intent. Use one command type at a time.",
    };
  }

  if (hasINeedTo) {
    const remainder = stripLeadingScaffolding(leadingNormalizedText, [
      I_NEED_TO_PREFIX_PATTERN,
    ]);
    if (!isClearlyTaskLikeINeedTo(remainder)) {
      return {
        intent: null,
        reason:
          "Use explicit todo or habit wording for \"i need to\" commands that are vague or cadence-like.",
      };
    }

    return {
      intent: "create_todo",
      reason: null,
    };
  }

  if (hasHabitCue) {
    return {
      intent: "create_habit",
      reason: null,
    };
  }

  if (hasTodoCue) {
    return {
      intent: "create_todo",
      reason: null,
    };
  }

  return {
    intent: null,
    reason: "Use todo or habit wording so the command shell knows what to create.",
  };
}

function makeTodoDraft(input: {
  rawText: string;
  status: DraftStatus;
  confidence: number | null;
  warnings?: DraftWarning[];
  missingFields?: DraftMissingField[];
  fields: DraftCreateTodo["fields"];
}): DraftCreateTodo {
  return {
    kind: "create_todo",
    rawText: input.rawText,
    parserKind: "mock_rules",
    parserVersion: "v1",
    confidence: input.confidence,
    status: input.status,
    warnings: input.warnings ?? [],
    missingFields: input.missingFields ?? [],
    fields: input.fields,
  };
}

function makeHabitDraft(input: {
  rawText: string;
  status: DraftStatus;
  confidence: number | null;
  warnings?: DraftWarning[];
  missingFields?: DraftMissingField[];
  fields: DraftCreateHabit["fields"];
}): DraftCreateHabit {
  return {
    kind: "create_habit",
    rawText: input.rawText,
    parserKind: "mock_rules",
    parserVersion: "v1",
    confidence: input.confidence,
    status: input.status,
    warnings: input.warnings ?? [],
    missingFields: input.missingFields ?? [],
    fields: input.fields,
  };
}

function parseTodoDraft(input: ParseCommandInput): ParseCommandResult {
  const warnings: DraftWarning[] = [];
  let workingText = stripLeadingScaffolding(input.rawText, [
    POLITE_PREFIX_PATTERN,
    QUESTION_PREFIX_PATTERN,
    I_NEED_TO_PREFIX_PATTERN,
    /^(?:remind\s+me\s+to)\s+/i,
    /^(?:add|create|make)\s+(?:(?:a|an)\s+)?task\s+to\s+/i,
    /^(?:please\s+)?(?:add|create|make)\s+(?:(?:a|an)\s+)?(?:todo|task)(?:\s+to)?\s+/i,
    /^(?:todo|task)\s*:?\s*/i,
  ]);

  const explicitDateMatch = workingText.match(SAFE_DATE_PATTERN);
  let dueDate: string | null = null;

  if (/\btoday\b/i.test(workingText)) {
    dueDate = toDateKey(input.now);
    workingText = normalizeWhitespace(workingText.replace(/\btoday\b/i, " "));
  } else if (/\btomorrow\b/i.test(workingText)) {
    dueDate = getTomorrowDateKey(input.now);
    workingText = normalizeWhitespace(workingText.replace(/\btomorrow\b/i, " "));
  } else if (explicitDateMatch) {
    dueDate = explicitDateMatch[0];
    workingText = normalizeWhitespace(workingText.replace(explicitDateMatch[0], " "));
  }

  const timeMatch = workingText.match(TODO_TIME_PATTERN);
  if (timeMatch) {
    if (!dueDate) {
      return {
        outcome: "unsupported",
        rawText: input.rawText,
        reason:
          "This version can only warn about todo times when the command also uses today, tomorrow, or YYYY-MM-DD.",
      };
    }

    warnings.push({
      code: "todo_time_not_supported",
      message: "Time will not be saved in this version.",
    });
    workingText = normalizeWhitespace(workingText.replace(timeMatch[0], " "));
  }

  const title = cleanEntityLabel(workingText);
  if (!title) {
    return {
      outcome: "draft",
      draft: makeTodoDraft({
        rawText: input.rawText,
        status: "needs_input",
        confidence: 0.45,
        warnings,
        missingFields: [
          {
            field: "title",
            message: "Add the task title, then try parsing again.",
          },
        ],
        fields: {
          title: null,
          notes: null,
          dueDate,
          priority: "normal",
          recurrence: null,
        },
      }),
    };
  }

  if (dueDate && !isValidDateKey(dueDate)) {
    return {
      outcome: "unsupported",
      rawText: input.rawText,
      reason: "Use a real YYYY-MM-DD date when you include an explicit due date.",
    };
  }

  return {
    outcome: "draft",
    draft: makeTodoDraft({
      rawText: input.rawText,
      status: "ready",
      confidence: dueDate ? 0.92 : 0.82,
      warnings,
      fields: {
        title,
        notes: null,
        dueDate,
        priority: "normal",
        recurrence: null,
      },
    }),
  };
}

function extractHabitTargetPerDay(text: string): {
  targetPerDay: number;
  nextText: string;
  warnings: DraftWarning[];
} {
  const patterns: Array<{ pattern: RegExp; value: number }> = [
    { pattern: /\bonce(?:\s+(?:a|per)\s+day)?\b/i, value: 1 },
    { pattern: /\btwice(?:\s+(?:a|per)\s+day)?\b/i, value: 2 },
    { pattern: /\b2\s+times(?:\s+(?:a|per)\s+day)?\b/i, value: 2 },
    { pattern: /\b2x(?:\s+(?:a|per)\s+day)?\b/i, value: 2 },
    { pattern: /\bthree\s+times(?:\s+(?:a|per)\s+day)?\b/i, value: 3 },
    { pattern: /\b3\s+times(?:\s+(?:a|per)\s+day)?\b/i, value: 3 },
    { pattern: /\b3x(?:\s+(?:a|per)\s+day)?\b/i, value: 3 },
  ];

  for (const entry of patterns) {
    if (entry.pattern.test(text)) {
      return {
        targetPerDay: entry.value,
        nextText: normalizeWhitespace(text.replace(entry.pattern, " ")),
        warnings: [],
      };
    }
  }

  return {
    targetPerDay: 1,
    nextText: text,
    warnings: [
      {
        code: "defaulted_field",
        message: "Target per day defaulted to 1 in this version.",
      },
    ],
  };
}

function parseHabitDraft(input: ParseCommandInput): ParseCommandResult {
  if (TODO_TIME_PATTERN.test(input.rawText)) {
    return {
      outcome: "unsupported",
      rawText: input.rawText,
      reason: "Habit reminder times are not supported in this version.",
    };
  }

  let workingText = stripLeadingScaffolding(input.rawText, [
    POLITE_PREFIX_PATTERN,
    QUESTION_PREFIX_PATTERN,
    /^(?:please\s+)?(?:add|create|make)\s+(?:(?:a|an)\s+)?habit(?:\s+to)?\s+/i,
    /^(?:create|add|make)\s+(?:(?:a|an)\s+)?habit\s+to\s+/i,
    /^habit\s*:?\s*/i,
  ]);

  let category: DraftCreateHabit["fields"]["category"] = "anytime";
  const categoryMatch = workingText.match(HABIT_CATEGORY_PATTERN);
  if (categoryMatch) {
    category = categoryMatch[1].toLowerCase() as DraftCreateHabit["fields"]["category"];
    workingText = normalizeWhitespace(workingText.replace(categoryMatch[0], " "));
  }

  const targetResult = extractHabitTargetPerDay(workingText);
  workingText = targetResult.nextText;

  const name = cleanEntityLabel(workingText);
  if (!name) {
    return {
      outcome: "draft",
      draft: makeHabitDraft({
        rawText: input.rawText,
        status: "needs_input",
        confidence: 0.42,
        warnings: targetResult.warnings,
        missingFields: [
          {
            field: "name",
            message: "Add the habit name, then try parsing again.",
          },
        ],
        fields: {
          name: null,
          targetPerDay: targetResult.targetPerDay,
          category,
          icon: null,
          color: null,
        },
      }),
    };
  }

  return {
    outcome: "draft",
    draft: makeHabitDraft({
      rawText: input.rawText,
      status: "ready",
      confidence: category === "anytime" ? 0.81 : 0.9,
      warnings: targetResult.warnings,
      fields: {
        name,
        targetPerDay: targetResult.targetPerDay,
        category,
        icon: null,
        color: null,
      },
    }),
  };
}

export function isDraftReady(draft: DraftAiAction): boolean {
  return draft.status === "ready";
}

/**
 * Keep preflight intentionally narrow so remote parsing remains the primary
 * parse path whenever a command is not obviously out of scope.
 */
export function preflightCommandDraft(
  input: ParseCommandInput,
): Extract<ParseCommandResult, { outcome: "unsupported" }> | null {
  const rawText = normalizeWhitespace(input.rawText);
  if (!rawText) {
    return {
      outcome: "unsupported",
      rawText: input.rawText,
      reason: "Enter a command first.",
    };
  }

  const rootCheckText = stripLeadingScaffolding(rawText, [
    POLITE_PREFIX_PATTERN,
    QUESTION_PREFIX_PATTERN,
  ]);
  if (UNSUPPORTED_ROOT_VERB_PATTERN.test(rootCheckText)) {
    return {
      outcome: "unsupported",
      rawText,
      reason: "This version only supports creating new todos or habits.",
    };
  }

  if (MULTI_ACTION_PATTERN.test(rawText)) {
    return {
      outcome: "unsupported",
      rawText,
      reason: "Use one create command at a time in this version.",
    };
  }

  const lowerText = rawText.toLowerCase();
  if (UNSUPPORTED_TODO_RECURRENCE_PATTERN.test(lowerText)) {
    return {
      outcome: "unsupported",
      rawText,
      reason: "Recurring commands are not supported in this version.",
    };
  }

  if (WEEKDAY_SCHEDULE_PATTERN.test(lowerText)) {
    return {
      outcome: "unsupported",
      rawText,
      reason: "Weekday schedules are out of scope for this version.",
    };
  }

  return null;
}

export function parseCommandDraft(input: ParseCommandInput): ParseCommandResult {
  const rawText = normalizeWhitespace(input.rawText);
  if (!rawText) {
    return {
      outcome: "unsupported",
      rawText: input.rawText,
      reason: "Enter a command first.",
    };
  }

  const lowerText = rawText.toLowerCase();
  const rootCheckText = stripLeadingScaffolding(rawText, [
    POLITE_PREFIX_PATTERN,
    QUESTION_PREFIX_PATTERN,
  ]);
  if (UNSUPPORTED_ROOT_VERB_PATTERN.test(rootCheckText)) {
    return {
      outcome: "unsupported",
      rawText,
      reason: "This version only supports creating new todos or habits.",
    };
  }

  if (MULTI_ACTION_PATTERN.test(rawText)) {
    return {
      outcome: "unsupported",
      rawText,
      reason: "Use one create command at a time in this version.",
    };
  }

  if (AMBIGUOUS_DATE_PATTERN.test(lowerText)) {
    return {
      outcome: "unsupported",
      rawText,
      reason: "Use today, tomorrow, or an exact YYYY-MM-DD date.",
    };
  }

  if (WEEKDAY_SCHEDULE_PATTERN.test(lowerText) && !HABIT_CATEGORY_PATTERN.test(lowerText)) {
    return {
      outcome: "unsupported",
      rawText,
      reason: "Weekday schedules are out of scope for this version.",
    };
  }

  const { intent, reason } = detectIntent(rawText);
  if (!intent) {
    return {
      outcome: "unsupported",
      rawText,
      reason:
        reason ?? "Use todo or habit wording so the command shell knows what to create.",
    };
  }

  if (intent === "create_todo" && UNSUPPORTED_TODO_RECURRENCE_PATTERN.test(lowerText)) {
    return {
      outcome: "unsupported",
      rawText,
      reason: "Recurring todo commands are not supported in this version.",
    };
  }

  return intent === "create_todo"
    ? parseTodoDraft({ ...input, rawText })
    : parseHabitDraft({ ...input, rawText });
}
