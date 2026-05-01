// @ts-nocheck
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const MAX_RAW_TEXT_LENGTH = 280;
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
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

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_HEADERS,
  });
}

function logParseEvent(meta) {
  console.log(
    JSON.stringify({
      event: "parse_ai_command",
      ...meta,
    }),
  );
}

function isRecord(value) {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidDateKey(value) {
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

function normalizeModelResponse(payload, parserVersion, input) {
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

function buildPromptBody(input) {
  return [
    "You are a strict parser for the SuperHabits quick command shell.",
    "You must return JSON only.",
    "Supported outcomes are limited to create_todo, create_habit, or unsupported.",
    "Never return prose outside JSON.",
    "Never invent unsupported commands or multi-step behavior.",
    "No destructive, edit, delete, complete, update, or linked-action commands.",
    "The client-provided todayDateKey and tomorrowDateKey are authoritative for local-date interpretation.",
    "Do not invent timezone semantics beyond the provided anchors.",
    "If the command is ambiguous, outside scope, or uncertain, return unsupported.",
    "Treat recurring or weekday schedule authoring as unsupported.",
    "Use status ready only when the draft is safe for user review; otherwise use needs_input.",
    "",
    "Input context:",
    JSON.stringify(input),
  ].join("\n");
}

function buildStructuredResponseSchema() {
  return {
    name: "superhabits_command_parse",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        outcome: {
          type: "string",
          enum: ["draft", "unsupported"],
        },
        kind: {
          type: ["string", "null"],
        },
        status: {
          type: ["string", "null"],
        },
        confidence: {
          type: ["number", "null"],
        },
        reason: {
          type: ["string", "null"],
        },
        warnings: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              code: { type: "string" },
              message: { type: "string" },
            },
            required: ["code", "message"],
          },
        },
        missingFields: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              field: { type: "string" },
              message: { type: "string" },
            },
            required: ["field", "message"],
          },
        },
        fields: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: ["string", "null"] },
            notes: { type: ["string", "null"] },
            dueDate: { type: ["string", "null"] },
            priority: { type: ["string", "null"] },
            recurrence: { type: ["string", "null"] },
            name: { type: ["string", "null"] },
            targetPerDay: { type: ["number", "null"] },
            category: { type: ["string", "null"] },
            icon: { type: ["string", "null"] },
            color: { type: ["string", "null"] },
          },
          required: [
            "title",
            "notes",
            "dueDate",
            "priority",
            "recurrence",
            "name",
            "targetPerDay",
            "category",
            "icon",
            "color",
          ],
        },
      },
      required: [
        "outcome",
        "kind",
        "status",
        "confidence",
        "reason",
        "warnings",
        "missingFields",
        "fields",
      ],
    },
  };
}

async function invokeOpenAiParse(input) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("AI_COMMAND_MODEL");
  const baseUrl = Deno.env.get("OPENAI_BASE_URL") ?? DEFAULT_OPENAI_BASE_URL;

  if (!apiKey || !model) {
    throw new Error("Missing OPENAI_API_KEY or AI_COMMAND_MODEL.");
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      store: false,
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: buildStructuredResponseSchema(),
      },
      messages: [
        {
          role: "system",
          content:
            "You convert a single natural-language command into a structured SuperHabits draft or unsupported result.",
        },
        {
          role: "user",
          content: buildPromptBody(input),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI request failed with status ${response.status}: ${errorText}`);
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("OpenAI response did not include JSON content.");
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("OpenAI response content was not valid JSON.");
  }

  return {
    model,
    parsed,
  };
}

function normalizeRequestBody(payload) {
  if (!isRecord(payload)) {
    throw new Error("Request body must be an object.");
  }

  const rawText = toNonEmptyString(payload.rawText);
  const nowIso = toNonEmptyString(payload.nowIso);
  const locale = toNonEmptyString(payload.locale);
  const timeZone = toNonEmptyString(payload.timeZone);
  const todayDateKey = toNonEmptyString(payload.todayDateKey);
  const tomorrowDateKey = toNonEmptyString(payload.tomorrowDateKey);

  if (!rawText || !nowIso || !locale || !timeZone || !todayDateKey || !tomorrowDateKey) {
    throw new Error("Missing required parse fields.");
  }
  if (rawText.length > MAX_RAW_TEXT_LENGTH) {
    throw new Error(`Command text must be ${MAX_RAW_TEXT_LENGTH} characters or less.`);
  }
  if (Number.isNaN(new Date(nowIso).getTime())) {
    throw new Error("nowIso must be a valid ISO timestamp.");
  }
  if (!isValidDateKey(todayDateKey) || !isValidDateKey(tomorrowDateKey)) {
    throw new Error("todayDateKey and tomorrowDateKey must be valid YYYY-MM-DD dates.");
  }

  return {
    rawText,
    nowIso,
    locale,
    timeZone,
    todayDateKey,
    tomorrowDateKey,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  let requestBody;
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    requestBody = normalizeRequestBody(await request.json());
  } catch (error) {
    const responseBody = {
      error: error instanceof Error ? error.message : "Invalid request body.",
    };
    logParseEvent({
      requestId,
      rawTextLength: null,
      latencyMs: Date.now() - startedAt,
      outcome: "invalid_request",
      reasonCode: "invalid_request",
      httpStatus: 400,
    });
    return jsonResponse(400, responseBody);
  }

  try {
    const { model, parsed } = await invokeOpenAiParse(requestBody);
    const normalized = normalizeModelResponse(parsed, model, requestBody.rawText);
    logParseEvent({
      requestId,
      rawTextLength: requestBody.rawText.length,
      latencyMs: Date.now() - startedAt,
      outcome: normalized.outcome,
      reasonCode:
        normalized.outcome === "unsupported" ? normalized.reasonCode ?? "unsupported" : null,
      httpStatus: 200,
    });
    return jsonResponse(200, normalized);
  } catch (error) {
    const responseBody = {
      error: error instanceof Error ? error.message : "Unable to parse command.",
    };
    logParseEvent({
      requestId,
      rawTextLength: requestBody.rawText.length,
      latencyMs: Date.now() - startedAt,
      outcome: "unavailable",
      reasonCode: "model_request_failed",
      httpStatus: 502,
    });
    return jsonResponse(502, responseBody);
  }
});
