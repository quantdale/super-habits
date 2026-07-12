// Pure model-response normalization for the parse-ai-command function.
// Runtime-agnostic (no Deno APIs) so the same code is exercised by the
// Deno entrypoint (index.js) and by Node-side unit tests.

const SUPPORTED_WARNING_CODES = new Set([
  "todo_time_not_supported",
  "unsupported_recurrence",
  "ambiguous_date",
  "defaulted_field",
  "partial_parse",
]);
const SUPPORTED_TODO_DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/g;
const TODAY_PATTERN = /\btoday\b/gi;
const TOMORROW_PATTERN = /\btomorrow\b/gi;

export function isRecord(value) {
  return typeof value === "object" && value !== null;
}

export function toNonEmptyString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isValidDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` === value;
}

function normalizeWarnings(value) {
  if (!Array.isArray(value)) return [];

  const warnings = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const code = toNonEmptyString(entry.code);
    const message = toNonEmptyString(entry.message);
    if (!code || !message || !SUPPORTED_WARNING_CODES.has(code)) continue;
    warnings.push({ code, message });
  }
  return warnings;
}

function normalizeMissingFields(value) {
  if (!Array.isArray(value)) return [];

  const missingFields = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const field = toNonEmptyString(entry.field);
    const message = toNonEmptyString(entry.message);
    if (!field || !message) continue;
    missingFields.push({ field, message });
  }
  return missingFields;
}

function normalizeConfidence(value) {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error("Model confidence must be between 0 and 1.");
  }
  return value;
}

function deriveTodoDueDateDirective(rawText) {
  const todayMatches = rawText.match(TODAY_PATTERN) ?? [];
  const tomorrowMatches = rawText.match(TOMORROW_PATTERN) ?? [];
  const explicitMatches = rawText.match(SUPPORTED_TODO_DATE_PATTERN) ?? [];
  const signalCount =
    (todayMatches.length > 0 ? 1 : 0) +
    (tomorrowMatches.length > 0 ? 1 : 0) +
    explicitMatches.length;

  if (signalCount > 1) {
    return {
      kind: "invalid",
      reason: "Use at most one due date: today, tomorrow, or a single YYYY-MM-DD date.",
    };
  }

  if (todayMatches.length > 0) {
    return { kind: "today" };
  }

  if (tomorrowMatches.length > 0) {
    return { kind: "tomorrow" };
  }

  if (explicitMatches.length === 1) {
    const dateKey = explicitMatches[0];
    if (!isValidDateKey(dateKey)) {
      return {
        kind: "invalid",
        reason: "Use a real YYYY-MM-DD date when you include an explicit due date.",
      };
    }

    return {
      kind: "explicit",
      dateKey,
    };
  }

  return { kind: "none" };
}

function resolveAuthoritativeTodoDueDate(input, modelDueDate) {
  const directive = deriveTodoDueDateDirective(input.rawText);

  if (directive.kind === "invalid") {
    return {
      outcome: "unsupported",
      rawText: input.rawText,
      reason: directive.reason,
    };
  }

  if (directive.kind === "today") {
    return { dueDate: input.todayDateKey };
  }

  if (directive.kind === "tomorrow") {
    return { dueDate: input.tomorrowDateKey };
  }

  if (directive.kind === "explicit") {
    return { dueDate: directive.dateKey };
  }

  if (modelDueDate !== null) {
    return {
      outcome: "unsupported",
      rawText: input.rawText,
      reason: "Todo due dates are limited to today, tomorrow, or an explicit YYYY-MM-DD date.",
    };
  }

  return { dueDate: null };
}

function normalizeTodoDraft(payload, parserVersion, input) {
  const fields = isRecord(payload.fields) ? payload.fields : null;
  if (!fields) {
    throw new Error("Todo draft fields must be an object.");
  }

  const title = fields.title == null ? null : toNonEmptyString(fields.title);
  const notes = fields.notes == null ? null : toNonEmptyString(fields.notes);
  const requestedDueDate = fields.dueDate == null ? null : toNonEmptyString(fields.dueDate);
  const priority = fields.priority;
  const dueDateResult = resolveAuthoritativeTodoDueDate(input, requestedDueDate);

  if (payload.status !== "ready" && payload.status !== "needs_input") {
    throw new Error("Todo draft status must be ready or needs_input.");
  }
  if (priority !== "urgent" && priority !== "normal" && priority !== "low") {
    throw new Error("Todo priority must be urgent, normal, or low.");
  }
  if ("outcome" in dueDateResult) {
    return dueDateResult;
  }

  return {
    outcome: "draft",
    kind: "create_todo",
    parserVersion,
    confidence: normalizeConfidence(payload.confidence),
    status: payload.status,
    warnings: normalizeWarnings(payload.warnings),
    missingFields: normalizeMissingFields(payload.missingFields),
    fields: {
      title,
      notes,
      dueDate: dueDateResult.dueDate,
      priority,
      recurrence: null,
      name: null,
      targetPerDay: null,
      category: null,
      icon: null,
      color: null,
    },
    rawText: input.rawText,
  };
}

function normalizeHabitDraft(payload, parserVersion, rawText) {
  const fields = isRecord(payload.fields) ? payload.fields : null;
  if (!fields) {
    throw new Error("Habit draft fields must be an object.");
  }

  const name = fields.name == null ? null : toNonEmptyString(fields.name);
  const targetPerDay = fields.targetPerDay;
  const category = fields.category;
  const icon = fields.icon == null ? null : toNonEmptyString(fields.icon);
  const color = fields.color == null ? null : toNonEmptyString(fields.color);

  if (payload.status !== "ready" && payload.status !== "needs_input") {
    throw new Error("Habit draft status must be ready or needs_input.");
  }
  if (
    typeof targetPerDay !== "number" ||
    !Number.isInteger(targetPerDay) ||
    targetPerDay < 1 ||
    targetPerDay > 99
  ) {
    throw new Error("Habit targetPerDay must be an integer between 1 and 99.");
  }
  if (
    category !== "anytime" &&
    category !== "morning" &&
    category !== "afternoon" &&
    category !== "evening"
  ) {
    throw new Error("Habit category is invalid.");
  }

  return {
    outcome: "draft",
    kind: "create_habit",
    parserVersion,
    confidence: normalizeConfidence(payload.confidence),
    status: payload.status,
    warnings: normalizeWarnings(payload.warnings),
    missingFields: normalizeMissingFields(payload.missingFields),
    fields: {
      title: null,
      notes: null,
      dueDate: null,
      priority: null,
      recurrence: null,
      name,
      targetPerDay,
      category,
      icon,
      color,
    },
    rawText,
  };
}

export function normalizeModelResponse(payload, parserVersion, input) {
  if (!isRecord(payload)) {
    throw new Error("Model output must be an object.");
  }

  if (payload.outcome === "unsupported") {
    const reason = toNonEmptyString(payload.reason);
    if (!reason) {
      throw new Error("Unsupported model output must include a reason.");
    }
    return {
      outcome: "unsupported",
      rawText: input.rawText,
      reason,
      reasonCode: "unsupported",
    };
  }

  if (payload.outcome !== "draft") {
    throw new Error("Model output outcome is invalid.");
  }

  if (payload.kind === "create_todo") {
    return normalizeTodoDraft(payload, parserVersion, input);
  }

  if (payload.kind === "create_habit") {
    return normalizeHabitDraft(payload, parserVersion, input.rawText);
  }

  throw new Error("Model output kind is invalid.");
}
