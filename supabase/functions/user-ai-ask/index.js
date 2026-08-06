// @ts-nocheck
import { normalizeAskRequestBody } from "./normalize.js";

// DeepSeek v4 Flash via OpenCodeGo gateway (OpenAI-compatible API).
// The original Bedrock/SigV4 design (tasks 4.2-4.8) was pivoted to this
// simpler path on 2026-08-04 — no AWS IAM, no hand-rolled SigV4 signer.
//
// Gateway config (set in Supabase secrets):
//   DEEPSEEK_API_KEY      — the API key
//   DEEPSEEK_BASE_URL     — default: https://opencode.ai/zen/go/v1
//   AI_ASK_MODEL          — default: deepseek-v4-flash
//
// Two stages, dispatched by the `stage` field in the request body:
//   classify — determine intent (pending_todos / calorie_summary / habit_streak / unsupported)
//   phrase   — generate a natural-language answer from retrieved facts
//
// IMPORTANT: deepseek-v4-flash is a reasoning model — its reasoning_content
// consumes most of the token budget. max_tokens must be set high enough
// (classified: 800, phrase: 1200) to leave room for the actual JSON output
// after reasoning completes. Lower budgets produce truncated content.

const DEFAULT_BASE_URL = "https://opencode.ai/zen/go/v1";
const DEFAULT_MODEL = "deepseek-v4-flash";
const FETCH_TIMEOUT_MS = 15_000;
const MAX_UPSTREAM_ATTEMPTS = 3;
const RETRY_DELAY_MS = [400, 1_200];

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: CORS_HEADERS,
  });
}

function logAskEvent(meta) {
  console.log(
    JSON.stringify({
      event: "user_ai_ask",
      ...meta,
    }),
  );
}

// ---- classify-stage prompt and parsing ----

const VALID_INTENTS = ["pending_todos", "calorie_summary", "habit_streak"];

function buildClassifyPrompt(input) {
  return [
    "You classify a natural-language question about a user's SuperHabits data into ",
    "exactly one intent. Return ONLY valid JSON — never prose outside JSON.",
    "",
    "Intent values:",
    '  "pending_todos"   — the user is asking about tasks they still need to do',
    '  "calorie_summary" — the user is asking about calories eaten today or over a range',
    '  "habit_streak"    — the user is asking about how many days in a row they completed a habit',
    "",
    "If the question matches one of the intents, return EXACTLY this JSON shape:",
    '  { "outcome": "classified", "intent": "<one of the intent values>", "params": { ... } }',
    "",
    "If the question does not match any of these intents, return EXACTLY this JSON shape:",
    '  { "outcome": "unsupported", "reason": "<brief reason>" }',
    "",
    "params rules:",
    "  - calorie_summary: include startDateKey and endDateKey (YYYY-MM-DD). Use the",
    "    provided todayDateKey as the default single-day range when the question is",
    "    about \"today\" or does not specify a range.",
    "  - habit_streak: include a habitName string if the user names a specific habit;",
    "    omit it if they are asking about overall streaks.",
    "  - pending_todos: params must be an empty object {}.",
    "",
    "The client-provided todayDateKey and tomorrowDateKey are authoritative for",
    "local-date interpretation. Do not invent timezone semantics beyond these anchors.",
    "",
    "Context:",
    JSON.stringify(input),
  ].join("\n");
}

function tryParseClassifyPayload(text) {
  // Strip markdown fences if the model wraps the JSON.
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const raw = JSON.parse(stripped);

  if (raw.outcome === "unsupported") {
    return {
      outcome: "unsupported",
      reason: typeof raw.reason === "string" ? raw.reason : "Unsupported question.",
    };
  }

  const intent = raw.intent ?? raw.category;
  if (typeof intent !== "string" || !VALID_INTENTS.includes(intent)) {
    throw new Error(`Invalid classify intent: ${JSON.stringify(intent)}`);
  }

  const params = raw.params && typeof raw.params === "object" ? raw.params : {};
  return { outcome: "classified", intent, params };
}

// ---- phrase-stage prompt and parsing ----

function buildPhrasePrompt(question, retrievedFacts) {
  return [
    "You are answering a question about a user's SuperHabits data.",
    "Use ONLY the retrieved facts below to compose a concise, natural answer.",
    "Do not invent data, numbers, or facts not present in the retrieved facts.",
    "Do not speculate about the future or give advice — only report what the data says.",
    "Return ONLY valid JSON with a single \"answer\" field — never prose outside JSON.",
    "",
    "Question:",
    question,
    "",
    "Retrieved facts:",
    JSON.stringify(retrievedFacts),
  ].join("\n");
}

function tryParsePhrasePayload(text) {
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const raw = JSON.parse(stripped);
  if (typeof raw.answer !== "string" || !raw.answer.trim()) {
    throw new Error("Phrase response must include a non-empty answer string.");
  }
  return raw.answer;
}

// ---- LLM invocation ----

/**
 * Calls the DeepSeek v4 Flash model through the OpenCodeGo gateway with a
 * single-turn prompt. The API is OpenAI-compatible.
 */
async function invokeDeepSeek({ messages, responseFormat, maxTokens }) {
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  const baseUrl = Deno.env.get("DEEPSEEK_BASE_URL") ?? DEFAULT_BASE_URL;
  const model = Deno.env.get("AI_ASK_MODEL") ?? DEFAULT_MODEL;

  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured.");
  }

  const body = {
    model,
    store: false,
    temperature: 0,
    max_tokens: maxTokens ?? 800,
    messages,
  };

  // DeepSeek v4 Flash supports OpenAI response_format.json_object
  // (enforced JSON output). Some gateways may also support json_schema
  // but json_object is the safest common denominator.
  if (responseFormat) {
    body.response_format = responseFormat;
  }

  const url = `${baseUrl.replace(/\/$/, "")}/chat/completions`;

  // The gateway is a shared multi-tenant endpoint: transient 429/5xx and
  // connection drops happen under load. Retry with backoff (observed
  // empirically on 2026-08-04 — the gateway drops connections under load).
  let lastError;
  for (let attempt = 0; attempt < MAX_UPSTREAM_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAY_MS[attempt - 1] ?? 2_000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log(
          JSON.stringify({
            event: "user_ai_ask_upstream_error",
            attempt: attempt + 1,
            status: response.status,
            errorBody: String(errorText).slice(0, 500),
          }),
        );
        // Retryable statuses: 429 (rate limit), 5xx (transient upstream).
        // 4xx other than 429 (bad request, auth) are fatal.
        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(`Upstream request failed with status ${response.status}.`);
          continue;
        }
        throw new Error(`Upstream request failed with status ${response.status}.`);
      }

      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        lastError = new Error("Upstream response contained no usable content.");
        continue;
      }
      return content;
    } catch (error) {
      // fetch network errors (e.g. connection dropped) are retryable.
      if (error instanceof Error && error.name === "AbortError") {
        lastError = new Error("Upstream request timed out.");
      } else if (error instanceof Error && error.message.startsWith("Upstream request failed")) {
        // Fatal non-retryable status was thrown above.
        throw error;
      } else {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }
  }

  throw lastError ?? new Error("Upstream request failed after retries.");
}

// ---- entrypoint ----

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  // 1. Validate the request body.
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let requestBody;
  try {
    requestBody = normalizeAskRequestBody(await request.json());
  } catch (error) {
    const responseBody = {
      error: error instanceof Error ? error.message : "Invalid request body.",
    };
    logAskEvent({
      requestId,
      questionLength: null,
      latencyMs: Date.now() - startedAt,
      outcome: "invalid_request",
      httpStatus: 400,
    });
    return jsonResponse(400, responseBody);
  }

  // 2. Dispatch to classify or phrase stage.
  try {
    if (requestBody.stage === "classify") {
      return await handleClassify(requestBody, requestId, startedAt);
    }
    return await handlePhrase(requestBody, requestId, startedAt);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error during invocation.";
    logAskEvent({
      requestId,
      questionLength: requestBody.question.length,
      stage: requestBody.stage,
      latencyMs: Date.now() - startedAt,
      outcome: "error",
      error: message,
      httpStatus: 500,
    });
    return jsonResponse(500, { error: "Failed to process the ask request." });
  }
});

async function handleClassify(requestBody, requestId, startedAt) {
  const classifyStartedAt = Date.now();
  const input = {
    question: requestBody.question,
    conversationContext: requestBody.conversationContext ?? [],
    todayDateKey: requestBody.todayDateKey,
    tomorrowDateKey: requestBody.tomorrowDateKey,
    nowIso: requestBody.nowIso,
    locale: requestBody.locale,
    timeZone: requestBody.timeZone,
  };

  let classifyResult;
  try {
    const raw = await invokeDeepSeek({
      messages: [
        {
          role: "system",
          content:
            "You classify a single SuperHabits question into its intent. Return valid JSON only.",
        },
        { role: "user", content: buildClassifyPrompt(input) },
      ],
      responseFormat: { type: "json_object" },
      maxTokens: 1200,
    });
    classifyResult = tryParseClassifyPayload(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Classification failed.";
    logAskEvent({
      requestId,
      questionLength: requestBody.question.length,
      stage: "classify",
      latencyMs: Date.now() - classifyStartedAt,
      outcome: "classify_error",
      error: message,
      httpStatus: 500,
    });
    return jsonResponse(500, { error: "The ask service could not classify your question." });
  }

  const classifyLatency = Date.now() - classifyStartedAt;
  logAskEvent({
    requestId,
    questionLength: requestBody.question.length,
    stage: "classify",
    latencyMs: classifyLatency,
    outcome: classifyResult.outcome,
    intent: classifyResult.intent ?? null,
    httpStatus: 200,
  });

  return jsonResponse(200, classifyResult);
}

async function handlePhrase(requestBody, requestId, startedAt) {
  const phraseStartedAt = Date.now();

  let answer;
  try {
    const raw = await invokeDeepSeek({
      messages: [
        {
          role: "system",
          content:
            "You answer a single SuperHabits question using only the provided retrieved facts. Return valid JSON with a single answer field.",
        },
        {
          role: "user",
          content: buildPhrasePrompt(requestBody.question, requestBody.retrievedFacts),
        },
      ],
      responseFormat: { type: "json_object" },
      maxTokens: 1500,
    });
    answer = tryParsePhrasePayload(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Phrasing failed.";
    logAskEvent({
      requestId,
      questionLength: requestBody.question.length,
      stage: "phrase",
      latencyMs: Date.now() - phraseStartedAt,
      outcome: "phrase_error",
      error: message,
      httpStatus: 500,
    });
    return jsonResponse(500, { error: "The ask service could not phrase the answer." });
  }

  const phraseLatency = Date.now() - phraseStartedAt;
  logAskEvent({
    requestId,
    questionLength: requestBody.question.length,
    stage: "phrase",
    latencyMs: phraseLatency,
    outcome: "success",
    answerLength: answer.length,
    httpStatus: 200,
  });

  logAskEvent({
    requestId,
    questionLength: requestBody.question.length,
    stage: requestBody.stage,
    latencyMs: Date.now() - startedAt,
    outcome: "complete",
    httpStatus: 200,
  });

  return jsonResponse(200, { answer });
}
