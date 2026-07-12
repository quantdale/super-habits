// @ts-nocheck
import {
  isRecord,
  isValidDateKey,
  normalizeModelResponse,
  toNonEmptyString,
} from "./normalize.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const MAX_RAW_TEXT_LENGTH = 280;
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";

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
    const normalized = normalizeModelResponse(parsed, model, requestBody);
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
