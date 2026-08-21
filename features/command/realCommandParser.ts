import {
  getSupabaseAccessToken,
  getSupabaseAnonKey,
  getSupabaseFunctionUrl,
  isSupabaseConfigured,
} from '@/lib/supabase';
import { validateHabit, validateTodo } from '@/lib/validation';
import {
  COMMAND_MAX_CALORIES,
  COMMAND_MAX_FOCUS_MINUTES,
  COMMAND_MAX_MACRO_GRAMS,
  isBoundedNonNegativeNumber,
  isBoundedPositiveInteger,
  isValidCommandDateKey,
  validateCommandDraftFields,
} from './command.validation';
import type {
  AiCommandParser,
  DraftAddTodoToDailyPlan,
  DraftCreateProject,
  DraftLogCalorieEntry,
  DraftLogHabit,
  DraftLogWorkoutRoutine,
  DraftCompleteTodo,
  DraftStartFocusSession,
  DraftCreateHabit,
  DraftCreateTodo,
  DraftMissingField,
  DraftUpdateGoalProgress,
  DraftWarning,
  ParseCommandInput,
  ParseCommandResult,
  ParseUnavailableReasonCode,
} from './types';
import { getAiCommandParseConfig, type AiCommandParseConfig } from './commandConfig';

const REMOTE_PARSE_TIMEOUT_MS = 4_500;
const FALLBACK_PARSER_VERSION = 'v1';
const SUPPORTED_WARNING_CODES: DraftWarning['code'][] = [
  'todo_time_not_supported',
  'unsupported_recurrence',
  'ambiguous_date',
  'defaulted_field',
  'partial_parse',
  'ambiguous_entity',
  'missing_nutrition',
  'active_timer_conflict',
  'already_satisfied',
  'off_day',
  'percent_clamped',
];
const SUPPORTED_WARNING_CODE_SET = new Set<string>(SUPPORTED_WARNING_CODES);
// Planning-kind bound mirrored by supabase/functions/parse-ai-command/normalize.js;
// keep both sides in lockstep (see tests/commandRemoteParity.contract.test.ts).
const COMMAND_MAX_ENTITY_NAME_LENGTH = 80;
const SUPPORTED_TODO_DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/g;
const TODAY_PATTERN = /\btoday\b/gi;
const TOMORROW_PATTERN = /\btomorrow\b/gi;

function buildUnavailableResult(
  rawText: string,
  message: string,
  reasonCode: ParseUnavailableReasonCode,
): Extract<ParseCommandResult, { outcome: 'unavailable' }> {
  return {
    outcome: 'unavailable',
    rawText,
    message,
    reasonCode,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidDateKey(dateKey: string): boolean {
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return false;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
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
      code: code as DraftWarning['code'],
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
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Model confidence must be a number or null.');
  }
  if (value < 0 || value > 1) {
    throw new Error('Model confidence must be between 0 and 1.');
  }
  return value;
}

function normalizeParserVersion(value: unknown): string {
  return toNonEmptyString(value) ?? FALLBACK_PARSER_VERSION;
}

function normalizeOptionalString(value: unknown, fieldName: string): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') {
    throw new Error(`Model ${fieldName} must be a string or null.`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalPositiveInteger(
  value: unknown,
  fieldName: string,
  max: number,
): number | null {
  if (value == null) return null;
  if (!isBoundedPositiveInteger(value, max)) {
    throw new Error(`Model ${fieldName} must be a whole number from 1 to ${max}.`);
  }
  return value;
}

function normalizeOptionalNonNegativeNumber(
  value: unknown,
  fieldName: string,
  max: number,
): number | null {
  if (value == null) return null;
  if (!isBoundedNonNegativeNumber(value, max)) {
    throw new Error(`Model ${fieldName} must be between 0 and ${max} grams.`);
  }
  return value;
}

function deriveTodoDueDateDirective(
  rawText: string,
):
  | { kind: 'none' }
  | { kind: 'today' }
  | { kind: 'tomorrow' }
  | { kind: 'explicit'; dateKey: string }
  | { kind: 'invalid'; reason: string } {
  const todayMatches = rawText.match(TODAY_PATTERN) ?? [];
  const tomorrowMatches = rawText.match(TOMORROW_PATTERN) ?? [];
  const explicitMatches = rawText.match(SUPPORTED_TODO_DATE_PATTERN) ?? [];
  const signalCount =
    (todayMatches.length > 0 ? 1 : 0) +
    (tomorrowMatches.length > 0 ? 1 : 0) +
    explicitMatches.length;

  if (signalCount > 1) {
    return {
      kind: 'invalid',
      reason: 'Use at most one due date: today, tomorrow, or a single YYYY-MM-DD date.',
    };
  }

  if (todayMatches.length > 0) {
    return { kind: 'today' };
  }

  if (tomorrowMatches.length > 0) {
    return { kind: 'tomorrow' };
  }

  if (explicitMatches.length === 1) {
    const dateKey = explicitMatches[0];
    if (!isValidDateKey(dateKey)) {
      return {
        kind: 'invalid',
        reason: 'Use a real YYYY-MM-DD date when you include an explicit due date.',
      };
    }

    return {
      kind: 'explicit',
      dateKey,
    };
  }

  return { kind: 'none' };
}

function resolveAuthoritativeTodoDueDate(
  input: ParseCommandInput,
  modelDueDate: string | null,
): string | null {
  const directive = deriveTodoDueDateDirective(input.rawText);

  if (directive.kind === 'invalid') {
    throw new Error(directive.reason);
  }

  if (directive.kind === 'today') {
    return input.todayDateKey;
  }

  if (directive.kind === 'tomorrow') {
    return input.tomorrowDateKey;
  }

  if (directive.kind === 'explicit') {
    return directive.dateKey;
  }

  if (modelDueDate !== null) {
    throw new Error(
      'Model todo dueDate is only allowed when the command uses today, tomorrow, or YYYY-MM-DD.',
    );
  }

  return null;
}

function normalizeRemoteTodoDraft(
  payload: Record<string, unknown>,
  input: ParseCommandInput,
): DraftCreateTodo {
  const fields = isRecord(payload.fields) ? payload.fields : null;
  if (!fields) {
    throw new Error('Model todo fields must be an object.');
  }

  const title = fields.title == null ? null : toNonEmptyString(fields.title);
  const notes = normalizeOptionalString(fields.notes, 'todo notes');
  const requestedDueDate = fields.dueDate == null ? null : toNonEmptyString(fields.dueDate);
  const priority = fields.priority;
  const status = payload.status;

  if (status !== 'ready' && status !== 'needs_input') {
    throw new Error('Model todo status must be ready or needs_input.');
  }
  if (priority !== 'urgent' && priority !== 'normal' && priority !== 'low') {
    throw new Error('Model todo priority is invalid.');
  }

  return {
    kind: 'create_todo',
    rawText: input.rawText,
    parserKind: 'model_proxy',
    parserVersion: normalizeParserVersion(payload.parserVersion),
    confidence: normalizeConfidence(payload.confidence),
    status,
    warnings: normalizeWarnings(payload.warnings),
    missingFields: normalizeMissingFields(payload.missingFields),
    fields: {
      title,
      notes,
      dueDate: resolveAuthoritativeTodoDueDate(input, requestedDueDate),
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
    throw new Error('Model habit fields must be an object.');
  }

  const name = fields.name == null ? null : toNonEmptyString(fields.name);
  const targetPerDay = fields.targetPerDay;
  const category = fields.category;
  const icon = normalizeOptionalString(fields.icon, 'habit icon');
  const color = normalizeOptionalString(fields.color, 'habit color');
  const status = payload.status;

  if (status !== 'ready' && status !== 'needs_input') {
    throw new Error('Model habit status must be ready or needs_input.');
  }
  if (
    typeof targetPerDay !== 'number' ||
    !Number.isInteger(targetPerDay) ||
    targetPerDay < 1 ||
    targetPerDay > 99
  ) {
    throw new Error('Model habit targetPerDay must be an integer between 1 and 99.');
  }
  if (
    category !== 'anytime' &&
    category !== 'morning' &&
    category !== 'afternoon' &&
    category !== 'evening'
  ) {
    throw new Error('Model habit category is invalid.');
  }

  return {
    kind: 'create_habit',
    rawText,
    parserKind: 'model_proxy',
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

function normalizeEntityReferenceField(value: unknown, fieldName: string): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') {
    throw new Error(`Model ${fieldName} must be a string or null.`);
  }
  const trimmed = value.replace(/\s+/g, ' ').trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalCommandDate(value: unknown, fieldName: string): string | null {
  if (value == null) return null;
  if (typeof value !== 'string' || !isValidCommandDateKey(value)) {
    throw new Error(`Model ${fieldName} must be a valid YYYY-MM-DD date or null.`);
  }
  return value;
}

function normalizeCommandStatus(value: unknown): 'ready' | 'needs_input' {
  if (value !== 'ready' && value !== 'needs_input') {
    throw new Error('Model draft status must be ready or needs_input.');
  }
  return value;
}

function normalizeRemoteCompleteTodoDraft(
  payload: Record<string, unknown>,
  rawText: string,
): DraftCompleteTodo {
  const fields = isRecord(payload.fields) ? payload.fields : null;
  if (!fields) throw new Error('Model complete_todo fields must be an object.');
  const todoTitle = normalizeEntityReferenceField(fields.todoTitle, 'todoTitle');
  return {
    kind: 'complete_todo',
    rawText,
    parserKind: 'model_proxy',
    parserVersion: normalizeParserVersion(payload.parserVersion),
    confidence: normalizeConfidence(payload.confidence),
    status: normalizeCommandStatus(payload.status),
    warnings: normalizeWarnings(payload.warnings),
    missingFields: normalizeMissingFields(payload.missingFields),
    fields: { todoTitle },
  };
}

function normalizeRemoteLogHabitDraft(
  payload: Record<string, unknown>,
  rawText: string,
): DraftLogHabit {
  const fields = isRecord(payload.fields) ? payload.fields : null;
  if (!fields) throw new Error('Model log_habit fields must be an object.');
  const habitName = normalizeEntityReferenceField(fields.habitName, 'habitName');
  const dateKey = normalizeOptionalCommandDate(fields.dateKey, 'dateKey');
  return {
    kind: 'log_habit',
    rawText,
    parserKind: 'model_proxy',
    parserVersion: normalizeParserVersion(payload.parserVersion),
    confidence: normalizeConfidence(payload.confidence),
    status: normalizeCommandStatus(payload.status),
    warnings: normalizeWarnings(payload.warnings),
    missingFields: normalizeMissingFields(payload.missingFields),
    fields: { habitName, dateKey },
  };
}

function normalizeRemoteCalorieDraft(
  payload: Record<string, unknown>,
  rawText: string,
): DraftLogCalorieEntry {
  const fields = isRecord(payload.fields) ? payload.fields : null;
  if (!fields) throw new Error('Model log_calorie_entry fields must be an object.');
  const foodName = normalizeEntityReferenceField(fields.foodName, 'foodName');
  const macroValues = {
    protein: normalizeOptionalNonNegativeNumber(fields.protein, 'protein', COMMAND_MAX_MACRO_GRAMS),
    carbs: normalizeOptionalNonNegativeNumber(fields.carbs, 'carbs', COMMAND_MAX_MACRO_GRAMS),
    fats: normalizeOptionalNonNegativeNumber(fields.fats, 'fats', COMMAND_MAX_MACRO_GRAMS),
    fiber: normalizeOptionalNonNegativeNumber(fields.fiber, 'fiber', COMMAND_MAX_MACRO_GRAMS),
  };
  const calories = normalizeOptionalPositiveInteger(
    fields.calories,
    'calories',
    COMMAND_MAX_CALORIES,
  );
  const mealType = fields.mealType ?? null;
  if (
    mealType !== null &&
    mealType !== 'breakfast' &&
    mealType !== 'lunch' &&
    mealType !== 'dinner' &&
    mealType !== 'snack'
  ) {
    throw new Error('Model mealType is invalid.');
  }
  const consumedOn = normalizeOptionalCommandDate(fields.consumedOn, 'consumedOn');
  return {
    kind: 'log_calorie_entry',
    rawText,
    parserKind: 'model_proxy',
    parserVersion: normalizeParserVersion(payload.parserVersion),
    confidence: normalizeConfidence(payload.confidence),
    status: normalizeCommandStatus(payload.status),
    warnings: normalizeWarnings(payload.warnings),
    missingFields: normalizeMissingFields(payload.missingFields),
    fields: {
      foodName,
      calories,
      protein: macroValues.protein,
      carbs: macroValues.carbs,
      fats: macroValues.fats,
      fiber: macroValues.fiber,
      mealType,
      consumedOn,
    },
  };
}

function normalizeRemoteWorkoutDraft(
  payload: Record<string, unknown>,
  rawText: string,
): DraftLogWorkoutRoutine {
  const fields = isRecord(payload.fields) ? payload.fields : null;
  if (!fields) throw new Error('Model log_workout_routine fields must be an object.');
  return {
    kind: 'log_workout_routine',
    rawText,
    parserKind: 'model_proxy',
    parserVersion: normalizeParserVersion(payload.parserVersion),
    confidence: normalizeConfidence(payload.confidence),
    status: normalizeCommandStatus(payload.status),
    warnings: normalizeWarnings(payload.warnings),
    missingFields: normalizeMissingFields(payload.missingFields),
    fields: {
      routineName: normalizeEntityReferenceField(fields.routineName, 'routineName'),
      completedOn: normalizeOptionalCommandDate(fields.completedOn, 'completedOn'),
    },
  };
}

function normalizeRemoteFocusDraft(
  payload: Record<string, unknown>,
  rawText: string,
): DraftStartFocusSession {
  const fields = isRecord(payload.fields) ? payload.fields : null;
  if (!fields) throw new Error('Model start_focus_session fields must be an object.');
  const durationMinutes = normalizeOptionalPositiveInteger(
    fields.durationMinutes,
    'durationMinutes',
    COMMAND_MAX_FOCUS_MINUTES,
  );
  return {
    kind: 'start_focus_session',
    rawText,
    parserKind: 'model_proxy',
    parserVersion: normalizeParserVersion(payload.parserVersion),
    confidence: normalizeConfidence(payload.confidence),
    status: normalizeCommandStatus(payload.status),
    warnings: normalizeWarnings(payload.warnings),
    missingFields: normalizeMissingFields(payload.missingFields),
    fields: { durationMinutes },
  };
}

function normalizePlanningNameField(value: unknown, fieldName: string): string | null {
  const normalized = normalizeEntityReferenceField(value, fieldName);
  if (normalized && normalized.length > COMMAND_MAX_ENTITY_NAME_LENGTH) {
    throw new Error(
      `Model ${fieldName} must be ${COMMAND_MAX_ENTITY_NAME_LENGTH} characters or fewer.`,
    );
  }
  return normalized;
}

function normalizeClampedPercent(value: unknown): { percent: number | null; clamped: boolean } {
  if (value == null) return { percent: null, clamped: false };
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Model percent must be a number or null.');
  }
  const clamped = Math.min(100, Math.max(0, value));
  return { percent: clamped, clamped: clamped !== value };
}

function normalizeRemoteProjectDraft(
  payload: Record<string, unknown>,
  rawText: string,
): DraftCreateProject {
  const fields = isRecord(payload.fields) ? payload.fields : null;
  if (!fields) throw new Error('Model create_project fields must be an object.');
  return {
    kind: 'create_project',
    rawText,
    parserKind: 'model_proxy',
    parserVersion: normalizeParserVersion(payload.parserVersion),
    confidence: normalizeConfidence(payload.confidence),
    status: normalizeCommandStatus(payload.status),
    warnings: normalizeWarnings(payload.warnings),
    missingFields: normalizeMissingFields(payload.missingFields),
    fields: {
      name: normalizePlanningNameField(fields.name, 'name'),
      color: fields.color == null ? null : toNonEmptyString(fields.color),
      targetDate: normalizeOptionalCommandDate(fields.targetDate, 'targetDate'),
    },
  };
}

function normalizeRemoteGoalProgressDraft(
  payload: Record<string, unknown>,
  rawText: string,
): DraftUpdateGoalProgress {
  const fields = isRecord(payload.fields) ? payload.fields : null;
  if (!fields) throw new Error('Model update_goal_progress fields must be an object.');
  const percentResult = normalizeClampedPercent(fields.percent);
  const warnings = [...normalizeWarnings(payload.warnings)];
  if (percentResult.clamped) {
    warnings.push({
      code: 'percent_clamped',
      message: 'Progress was clamped to the 0–100 range.',
    });
  }
  return {
    kind: 'update_goal_progress',
    rawText,
    parserKind: 'model_proxy',
    parserVersion: normalizeParserVersion(payload.parserVersion),
    confidence: normalizeConfidence(payload.confidence),
    status: normalizeCommandStatus(payload.status),
    warnings,
    missingFields: normalizeMissingFields(payload.missingFields),
    fields: {
      goalTitle: normalizePlanningNameField(fields.goalTitle, 'goalTitle'),
      percent: percentResult.percent,
    },
  };
}

function normalizeRemoteDailyPlanDraft(
  payload: Record<string, unknown>,
  rawText: string,
): DraftAddTodoToDailyPlan {
  const fields = isRecord(payload.fields) ? payload.fields : null;
  if (!fields) throw new Error('Model add_todo_to_daily_plan fields must be an object.');
  return {
    kind: 'add_todo_to_daily_plan',
    rawText,
    parserKind: 'model_proxy',
    parserVersion: normalizeParserVersion(payload.parserVersion),
    confidence: normalizeConfidence(payload.confidence),
    status: normalizeCommandStatus(payload.status),
    warnings: normalizeWarnings(payload.warnings),
    missingFields: normalizeMissingFields(payload.missingFields),
    fields: {
      todoTitle: normalizePlanningNameField(fields.todoTitle, 'todoTitle'),
      dateKey: normalizeOptionalCommandDate(fields.dateKey, 'dateKey'),
    },
  };
}

export function normalizeRemoteParseResponse(
  payload: unknown,
  input: ParseCommandInput,
): ParseCommandResult {
  if (!isRecord(payload)) {
    throw new Error('Model parser response must be an object.');
  }

  if (payload.outcome === 'unsupported') {
    const reason = toNonEmptyString(payload.reason);
    if (!reason) {
      throw new Error('Model parser response must include an unsupported reason.');
    }

    return {
      outcome: 'unsupported',
      rawText: input.rawText,
      reason,
      reasonCode: 'unsupported',
    };
  }

  if (payload.outcome !== 'draft') {
    throw new Error('Model parser response outcome is invalid.');
  }

  if (payload.kind === 'create_todo') {
    const draft = normalizeRemoteTodoDraft(payload, input);
    const validationMessage = validateTodo(
      draft.fields.title ?? '',
      draft.fields.notes ?? '',
      draft.fields.dueDate,
    );
    if (draft.status === 'ready' && validationMessage) {
      throw new Error(`Model todo draft failed local validation: ${validationMessage}`);
    }

    return { outcome: 'draft', draft };
  }

  if (payload.kind === 'create_habit') {
    const draft = normalizeRemoteHabitDraft(payload, input.rawText);
    const validationMessage = validateHabit(draft.fields.name ?? '', draft.fields.targetPerDay);
    if (draft.status === 'ready' && validationMessage) {
      throw new Error(`Model habit draft failed local validation: ${validationMessage}`);
    }

    return { outcome: 'draft', draft };
  }

  const v2Draft =
    payload.kind === 'complete_todo'
      ? normalizeRemoteCompleteTodoDraft(payload, input.rawText)
      : payload.kind === 'log_habit'
        ? normalizeRemoteLogHabitDraft(payload, input.rawText)
        : payload.kind === 'log_calorie_entry'
          ? normalizeRemoteCalorieDraft(payload, input.rawText)
          : payload.kind === 'log_workout_routine'
            ? normalizeRemoteWorkoutDraft(payload, input.rawText)
            : payload.kind === 'start_focus_session'
              ? normalizeRemoteFocusDraft(payload, input.rawText)
              : payload.kind === 'create_project'
                ? normalizeRemoteProjectDraft(payload, input.rawText)
                : payload.kind === 'update_goal_progress'
                  ? normalizeRemoteGoalProgressDraft(payload, input.rawText)
                  : payload.kind === 'add_todo_to_daily_plan'
                    ? normalizeRemoteDailyPlanDraft(payload, input.rawText)
                    : null;

  if (v2Draft) {
    const validationMessage = validateCommandDraftFields(v2Draft);
    if (v2Draft.status === 'ready' && validationMessage) {
      throw new Error(`Model ${v2Draft.kind} draft failed local validation: ${validationMessage}`);
    }
    return { outcome: 'draft', draft: v2Draft };
  }

  throw new Error('Model parser response kind is invalid.');
}

function resolveRequestUrl(config: AiCommandParseConfig): Promise<string | null> {
  if (config.backendHost === 'custom_url') {
    return Promise.resolve(config.customProxyUrl);
  }

  if (!isSupabaseConfigured()) {
    return Promise.resolve(null);
  }

  return Promise.resolve(getSupabaseFunctionUrl(config.supabaseFunctionName));
}

function buildRequestHeaders(config: AiCommandParseConfig, accessToken: string | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.backendHost === 'supabase_edge') {
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
      return buildUnavailableResult(
        input.rawText,
        'Remote command parsing is not configured.',
        'remote_not_configured',
      );
    }

    let accessToken: string | null = null;
    if (config.backendHost === 'supabase_edge') {
      try {
        accessToken = await getSupabaseAccessToken();
      } catch {
        return buildUnavailableResult(
          input.rawText,
          'Remote command parsing could not load the current auth session.',
          'auth_session_unavailable',
        );
      }
    }

    let response: Response;
    try {
      response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
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
      return buildUnavailableResult(
        input.rawText,
        error instanceof Error && error.name === 'AbortError'
          ? 'Remote command parsing timed out.'
          : 'Remote command parsing request failed.',
        error instanceof Error && error.name === 'AbortError'
          ? 'request_timed_out'
          : 'request_failed',
      );
    }

    if (!response.ok) {
      return buildUnavailableResult(
        input.rawText,
        `Remote command parsing failed with status ${response.status}.`,
        'http_error',
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return buildUnavailableResult(
        input.rawText,
        'Remote command parsing returned malformed JSON.',
        'malformed_json',
      );
    }

    try {
      return normalizeRemoteParseResponse(payload, input);
    } catch (error) {
      return buildUnavailableResult(
        input.rawText,
        error instanceof Error ? error.message : 'Remote command parsing failed.',
        'response_validation_failed',
      );
    }
  }
}

export const realCommandParser = new RemoteModelAiCommandParser();
