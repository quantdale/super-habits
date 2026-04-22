import {
  getSupabaseAccessToken,
  getSupabaseAnonKey,
  getSupabaseFunctionUrl,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { validateHabit, validateTodo } from "@/lib/validation";
import type {
  AiCommandParser,
  DraftAiAction,
  DraftCreateHabit,
  DraftCreateTodo,
  DraftMissingField,
  DraftWarning,
  ParseCommandInput,
  ParseCommandResult,
} from "./types";
import { getAiCommandParseConfig, type AiCommandParseConfig } from "./commandConfig";

const REMOTE_PARSE_TIMEOUT_MS = 4_500;
const FALLBACK_PARSER_VERSION = "v1";
const SUPPORTED_WARNING_CODES: DraftWarning["code"][] = [
  "todo_time_not_supported",
  "unsupported_recurrence",
  "ambiguous_date",
  "defaulted_field",
  "partial_parse",
];
const SUPPORTED_WARNING_CODE_SET = new Set<string>(SUPPORTED_WARNING_CODES);

type RemoteParseResponse =
  | Record<string, unknown>
  | {
      outcome: "unsupported";
      reason: string;
      parserVersion?: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidDateKey(dateKey: string): boolean {
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` === dateKey;
}

function normalizeWarnings(value: unknown): DraftWarning[] {
  if (!Array.isArray(value)) return [];

  const warnings: DraftWarning[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const code = toNonEmptyString(entry.code);
    const message = toNonEmptyString(entry.message);
    if (!code || !message || !SUPPORTED_WARNING_CODE_SET.has(code)) continue;
    warnings.push({
      code: code as DraftWarning["code"],
      message,
    });
  }

  return warnings;
}

function normalizeMissingFields(value: unknown): DraftMissingField[] {
  if (!Array.isArray(value)) return [];

  const missingFields: DraftMissingField[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const field = toNonEmptyString(entry.field);
    const message = toNonEmptyString(entry.message);
    if (!field || !message) continue;
    missingFields.push({ field, message });
  }

  return missingFields;
}

function normalizeConfidence(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error("Model confidence must be a number or null.");
  }
  if (value < 0 || value > 1) {
    throw new Error("Model confidence must be between 0 and 1.");
  }
  return value;
}

function normalizeParserVersion(value: unknown): string {
  return toNonEmptyString(value) ?? FALLBACK_PARSER_VERSION;
}

function normalizeOptionalString(value: unknown, fieldName: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new Error(`Model ${fieldName} must be a string or null.`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRemoteTodoDraft(
  payload: Record<string, unknown>,
  rawText: string,
): DraftCreateTodo {
  const fields = isRecord(payload.fields) ? payload.fields : null;
  if (!fields) {
    throw new Error("Model todo fields must be an object.");
  }

  const title = fields.title == null ? null : toNonEmptyString(fields.title);
  const notes = normalizeOptionalString(fields.notes, "todo notes");
  const dueDate = fields.dueDate == null ? null : toNonEmptyString(fields.dueDate);
  const priority = fields.priority;
  const status = payload.status;

  if (status !== "ready" && status !== "needs_input") {
    throw new Error("Model todo status must be ready or needs_input.");
  }
  if (dueDate && !isValidDateKey(dueDate)) {
    throw new Error("Model todo dueDate must be a valid YYYY-MM-DD date.");
  }
  if (priority !== "urgent" && priority !== "normal" && priority !== "low") {
    throw new Error("Model todo priority is invalid.");
  }

  return {
    kind: "create_todo",
    rawText,
    parserKind: "model_proxy",
    parserVersion: normalizeParserVersion(payload.parserVersion),
    confidence: normalizeConfidence(payload.confidence),
    status,
    warnings: normalizeWarnings(payload.warnings),
    missingFields: normalizeMissingFields(payload.missingFields),
    fields: {
      title,
      notes,
      dueDate,
      priority,
      recurrence: null,
    },
  };
}

function normalizeRemoteHabitDraft(
  payload: Record<string, unknown>,
  rawText: string,
): DraftCreateHabit {
  const fields = isRecord(payload.fields) ? payload.fields : null;
  if (!fields) {
    throw new Error("Model habit fields must be an object.");
  }

  const name = fields.name == null ? null : toNonEmptyString(fields.name);
  const targetPerDay = fields.targetPerDay;
  const category = fields.category;
  const icon = normalizeOptionalString(fields.icon, "habit icon");
  const color = normalizeOptionalString(fields.color, "habit color");
  const status = payload.status;

  if (status !== "ready" && status !== "needs_input") {
    throw new Error("Model habit status must be ready or needs_input.");
  }
  if (
    typeof targetPerDay !== "number" ||
    !Number.isInteger(targetPerDay) ||
    targetPerDay < 1 ||
    targetPerDay > 99
  ) {
    throw new Error("Model habit targetPerDay must be an integer between 1 and 99.");
  }
  if (
    category !== "anytime" &&
    category !== "morning" &&
    category !== "afternoon" &&
    category !== "evening"
  ) {
    throw new Error("Model habit category is invalid.");
  }

  return {
    kind: "create_habit",
    rawText,
    parserKind: "model_proxy",
    parserVersion: normalizeParserVersion(payload.parserVersion),
    confidence: normalizeConfidence(payload.confidence),
    status,
    warnings: normalizeWarnings(payload.warnings),
    missingFields: normalizeMissingFields(payload.missingFields),
    fields: {
      name,
      targetPerDay,
      category,
      icon,
      color,
    },
  };
}

export function normalizeRemoteParseResponse(
  payload: unknown,
  input: ParseCommandInput,
): ParseCommandResult {
  if (!isRecord(payload)) {
    throw new Error("Model parser response must be an object.");
  }

  if (payload.outcome === "unsupported") {
    const reason = toNonEmptyString(payload.reason);
    if (!reason) {
      throw new Error("Model parser response must include an unsupported reason.");
    }

    return {
      outcome: "unsupported",
      rawText: input.rawText,
      reason,
    };
  }

  if (payload.outcome !== "draft") {
    throw new Error("Model parser response outcome is invalid.");
  }

  if (payload.kind === "create_todo") {
    const draft = normalizeRemoteTodoDraft(payload, input.rawText);
    const validationMessage = validateTodo(
      draft.fields.title ?? "",
      draft.fields.notes ?? "",
      draft.fields.dueDate,
    );
    if (draft.status === "ready" && validationMessage) {
      throw new Error(`Model todo draft failed local validation: ${validationMessage}`);
    }

    return { outcome: "draft", draft };
  }

  if (payload.kind === "create_habit") {
    const draft = normalizeRemoteHabitDraft(payload, input.rawText);
    const validationMessage = validateHabit(
      draft.fields.name ?? "",
      draft.fields.targetPerDay,
    );
    if (draft.status === "ready" && validationMessage) {
      throw new Error(`Model habit draft failed local validation: ${validationMessage}`);
    }

    return { outcome: "draft", draft };
  }

  throw new Error("Model parser response kind is invalid.");
}

async function resolveRequestUrl(config: AiCommandParseConfig): Promise<string | null> {
  if (config.backendHost === "custom_url") {
    return config.customProxyUrl;
  }

  if (!isSupabaseConfigured()) {
    return null;
  }

  return getSupabaseFunctionUrl(config.supabaseFunctionName);
}

function buildRequestHeaders(config: AiCommandParseConfig, accessToken: string | null) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.backendHost === "supabase_edge") {
    const anonKey = getSupabaseAnonKey();
    if (anonKey) {
      headers.apikey = anonKey;
    }
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
  }

  return headers;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export class RemoteModelAiCommandParser implements AiCommandParser {
  async parse(input: ParseCommandInput): Promise<ParseCommandResult> {
    const config = getAiCommandParseConfig();
    const url = await resolveRequestUrl(config);
    if (!url) {
      return {
        outcome: "unavailable",
        rawText: input.rawText,
        message: "Remote command parsing is not configured.",
      };
    }

    let accessToken: string | null = null;
    if (config.backendHost === "supabase_edge") {
      try {
        accessToken = await getSupabaseAccessToken();
      } catch {
        return {
          outcome: "unavailable",
          rawText: input.rawText,
          message: "Remote command parsing could not load the current auth session.",
        };
      }
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: buildRequestHeaders(config, accessToken),
          body: JSON.stringify({
            rawText: input.rawText,
            nowIso: input.now.toISOString(),
            locale: input.locale,
            timeZone: input.timeZone,
            todayDateKey: input.todayDateKey,
            tomorrowDateKey: input.tomorrowDateKey,
          }),
        },
        REMOTE_PARSE_TIMEOUT_MS,
      );
    } catch (error) {
      return {
        outcome: "unavailable",
        rawText: input.rawText,
        message:
          error instanceof Error && error.name === "AbortError"
            ? "Remote command parsing timed out."
            : "Remote command parsing request failed.",
      };
    }

    if (!response.ok) {
      return {
        outcome: "unavailable",
        rawText: input.rawText,
        message: `Remote command parsing failed with status ${response.status}.`,
      };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return {
        outcome: "unavailable",
        rawText: input.rawText,
        message: "Remote command parsing returned malformed JSON.",
      };
    }

    try {
      return normalizeRemoteParseResponse(payload, input);
    } catch (error) {
      return {
        outcome: "unavailable",
        rawText: input.rawText,
        message: error instanceof Error ? error.message : "Remote command parsing failed.",
      };
    }
  }
}

export const realCommandParser = new RemoteModelAiCommandParser();
