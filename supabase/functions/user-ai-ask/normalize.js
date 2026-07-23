// Pure request-validation helpers for the user-ai-ask function.
// Runtime-agnostic (no Deno APIs) so the same code is exercised by the
// Deno entrypoint (index.js) and by Node-side unit tests.
//
// Deliberately not shared with parse-ai-command/normalize.js: that module's
// helpers are shaped around Create's todo/habit draft normalization, which
// has nothing in common with Ask's classify/phrase contracts.

const MAX_QUESTION_LENGTH = 280;
const MAX_CONVERSATION_TURNS = 20;

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

function normalizeConversationContext(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) {
    throw new Error("conversationContext must be an array when provided.");
  }
  if (value.length > MAX_CONVERSATION_TURNS) {
    throw new Error(`conversationContext must have at most ${MAX_CONVERSATION_TURNS} turns.`);
  }

  return value.map((entry) => {
    if (!isRecord(entry)) {
      throw new Error("Each conversationContext turn must be an object.");
    }
    const question = toNonEmptyString(entry.question);
    const answer = toNonEmptyString(entry.answer);
    if (!question || !answer) {
      throw new Error("Each conversationContext turn must include question and answer.");
    }
    return { question, answer };
  });
}

/** Shared request fields for both the classify and phrase stages. */
export function normalizeAskRequestBody(payload) {
  if (!isRecord(payload)) {
    throw new Error("Request body must be an object.");
  }

  const question = toNonEmptyString(payload.question);
  const nowIso = toNonEmptyString(payload.nowIso);
  const locale = toNonEmptyString(payload.locale);
  const timeZone = toNonEmptyString(payload.timeZone);
  const todayDateKey = toNonEmptyString(payload.todayDateKey);
  const tomorrowDateKey = toNonEmptyString(payload.tomorrowDateKey);

  if (!question || !nowIso || !locale || !timeZone || !todayDateKey || !tomorrowDateKey) {
    throw new Error("Missing required ask request fields.");
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    throw new Error(`question must be ${MAX_QUESTION_LENGTH} characters or less.`);
  }
  if (Number.isNaN(new Date(nowIso).getTime())) {
    throw new Error("nowIso must be a valid ISO timestamp.");
  }
  if (!isValidDateKey(todayDateKey) || !isValidDateKey(tomorrowDateKey)) {
    throw new Error("todayDateKey and tomorrowDateKey must be valid YYYY-MM-DD dates.");
  }

  return {
    question,
    conversationContext: normalizeConversationContext(payload.conversationContext),
    nowIso,
    locale,
    timeZone,
    todayDateKey,
    tomorrowDateKey,
  };
}
