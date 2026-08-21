import { getSupabaseAccessToken, getSupabaseAnonKey, getSupabaseFunctionUrl } from '@/lib/supabase';
import {
  AskRetrievalError,
  retrieveCalorieSummary,
  retrieveDailyOverview,
  retrieveFocusSummary,
  retrieveGoalProgressSummary,
  retrieveHabitProgress,
  retrieveHabitStreak,
  retrievePendingTodos,
  retrieveProjectStatus,
  retrieveTodayFocus,
  retrieveWorkoutSummary,
} from './ask.retrieval';
import {
  formatGoalProgressAnswer,
  formatProjectStatusAnswer,
  formatTodayFocusAnswer,
} from './planningAsk.domain';
import { dateKeyToLocalDate, toDateKey } from '@/lib/time';
import { isValidCommandDateKey, normalizeReference } from './command.validation';
import type {
  AiAskParser,
  AskIntent,
  AskParseInput,
  AskResult,
  ClassifyParams,
  ClassifyResult,
  RetrievedFacts,
} from './ask.types';

const ASK_FUNCTION_NAME = 'user-ai-ask';
const ASK_REQUEST_TIMEOUT_MS = 4_500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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

function buildUnavailableResult(
  question: string,
  message: string,
  reasonCode: Extract<AskResult, { outcome: 'unavailable' }>['reasonCode'],
): Extract<AskResult, { outcome: 'unavailable' }> {
  return { outcome: 'unavailable', question, message, reasonCode };
}

function resolveRequestUrl(): string | null {
  return getSupabaseFunctionUrl(ASK_FUNCTION_NAME);
}

function buildRequestHeaders(accessToken: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const anonKey = getSupabaseAnonKey();
  if (anonKey) headers.apikey = anonKey;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
}

export async function callAskFunction(
  body: Record<string, unknown>,
): Promise<
  | { ok: true; payload: unknown }
  | { ok: false; result: Extract<AskResult, { outcome: 'unavailable' }> }
> {
  const question = typeof body.question === 'string' ? body.question : '';
  const url = resolveRequestUrl();
  if (!url) {
    return {
      ok: false,
      result: buildUnavailableResult(
        question,
        'Ask is not configured on this device.',
        'remote_not_configured',
      ),
    };
  }

  let accessToken: string | null = null;
  try {
    accessToken = await getSupabaseAccessToken();
  } catch {
    return {
      ok: false,
      result: buildUnavailableResult(
        question,
        'Ask could not load the current auth session.',
        'auth_session_unavailable',
      ),
    };
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: buildRequestHeaders(accessToken),
        body: JSON.stringify(body),
      },
      ASK_REQUEST_TIMEOUT_MS,
    );
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    return {
      ok: false,
      result: buildUnavailableResult(
        question,
        timedOut ? 'Ask timed out.' : 'Ask request failed.',
        timedOut ? 'request_timed_out' : 'request_failed',
      ),
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      result: buildUnavailableResult(
        question,
        `Ask failed with status ${response.status}.`,
        'http_error',
      ),
    };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return {
      ok: false,
      result: buildUnavailableResult(question, 'Ask returned malformed JSON.', 'malformed_json'),
    };
  }

  return { ok: true, payload };
}

function normalizeDateRange(
  params: Record<string, unknown>,
  input: Pick<AskParseInput, 'todayDateKey'> | undefined,
  defaultDays: number,
) {
  const startDateKey = params.startDateKey;
  const endDateKey = params.endDateKey;
  let normalizedStart = startDateKey;
  let normalizedEnd = endDateKey;
  if (normalizedStart == null && normalizedEnd == null && input) {
    const start = dateKeyToLocalDate(input.todayDateKey);
    start.setDate(start.getDate() - (defaultDays - 1));
    normalizedStart = toDateKey(start);
    normalizedEnd = input.todayDateKey;
  } else if (normalizedStart == null || normalizedEnd == null) {
    const onlyDate = normalizedStart ?? normalizedEnd;
    normalizedStart = onlyDate;
    normalizedEnd = onlyDate;
  }
  if (typeof normalizedStart !== 'string' || typeof normalizedEnd !== 'string') {
    throw new Error('Classify response must include a bounded date range.');
  }
  if (!isValidCommandDateKey(normalizedStart) || !isValidCommandDateKey(normalizedEnd)) {
    throw new Error('Classify response must include valid date keys.');
  }
  const start = dateKeyToLocalDate(normalizedStart);
  const end = dateKeyToLocalDate(normalizedEnd);
  const dayCount = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (normalizedStart > normalizedEnd || dayCount < 1 || dayCount > 366) {
    throw new Error('Classify response date range is outside the supported bounds.');
  }
  return { startDateKey: normalizedStart, endDateKey: normalizedEnd };
}

function normalizeHabitName(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') throw new Error('Habit references must be strings or null.');
  return normalizeReference(value);
}

function normalizePlanningReference(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== 'string') throw new Error('References must be strings or null.');
  return normalizeReference(value);
}

export function normalizeClassifyPayload(
  payload: unknown,
  input?: Pick<AskParseInput, 'todayDateKey'>,
): ClassifyResult {
  if (!isRecord(payload)) {
    throw new Error('Classify response must be an object.');
  }

  if (payload.outcome === 'unsupported') {
    const reason = typeof payload.reason === 'string' ? payload.reason : 'Unsupported question.';
    return { outcome: 'unsupported', reason };
  }

  if (payload.outcome !== 'classified') {
    throw new Error('Classify response outcome is invalid.');
  }

  const intent = payload.intent as AskIntent;
  const supported = [
    'pending_todos',
    'calorie_summary',
    'habit_progress',
    'workout_summary',
    'focus_summary',
    'daily_overview',
    'habit_streak',
    'project_status',
    'goal_progress',
    'today_focus',
  ];
  if (typeof payload.intent !== 'string' || !supported.includes(intent)) {
    throw new Error('Classify response intent is invalid.');
  }

  const params = isRecord(payload.params) ? payload.params : {};
  if (intent === 'pending_todos') {
    const due = params.due ?? 'all';
    const priority = params.priority ?? 'all';
    if (typeof due !== 'string' || !['all', 'today', 'overdue'].includes(due)) {
      throw new Error('Classify pending_todos due filter is invalid.');
    }
    if (typeof priority !== 'string' || !['all', 'urgent', 'normal', 'low'].includes(priority)) {
      throw new Error('Classify pending_todos priority filter is invalid.');
    }
    return {
      outcome: 'classified',
      intent: 'pending_todos',
      params: { due, priority } as ClassifyParams['pending_todos'],
    };
  }

  if (intent === 'calorie_summary') {
    return {
      outcome: 'classified',
      intent,
      params: normalizeDateRange(params, input, 1),
    };
  }

  if (intent === 'focus_summary') {
    return {
      outcome: 'classified',
      intent,
      params: normalizeDateRange(params, input, 7),
    };
  }

  if (intent === 'habit_streak') {
    return {
      outcome: 'classified',
      intent,
      params: { habitName: normalizeHabitName(params.habitName) },
    };
  }

  if (intent === 'project_status') {
    return {
      outcome: 'classified',
      intent: 'project_status',
      params: { projectName: normalizePlanningReference(params.projectName) },
    };
  }

  if (intent === 'goal_progress') {
    return {
      outcome: 'classified',
      intent: 'goal_progress',
      params: { goalTitle: normalizePlanningReference(params.goalTitle) },
    };
  }

  if (intent === 'today_focus') {
    const dateKey = params.dateKey ?? input?.todayDateKey;
    if (typeof dateKey !== 'string' || !isValidCommandDateKey(dateKey)) {
      throw new Error('Classify today_focus dateKey is invalid.');
    }
    return { outcome: 'classified', intent: 'today_focus', params: { dateKey } };
  }

  if (intent === 'habit_progress') {
    return {
      outcome: 'classified',
      intent,
      params: {
        ...normalizeDateRange(params, input, 30),
        habitName: normalizeHabitName(params.habitName),
      },
    };
  }

  if (intent === 'workout_summary') {
    return {
      outcome: 'classified',
      intent,
      params: {
        ...normalizeDateRange(params, input, 7),
        routineName: normalizeHabitName(params.routineName),
      },
    };
  }

  const dateKey = params.dateKey ?? input?.todayDateKey;
  if (typeof dateKey !== 'string') throw new Error('Classify daily_overview dateKey is invalid.');
  if (!isValidCommandDateKey(dateKey))
    throw new Error('Classify daily_overview dateKey is invalid.');
  return { outcome: 'classified', intent, params: { dateKey } };
}

async function retrieveFactsForIntent(
  classified: Extract<ClassifyResult, { outcome: 'classified' }>,
  input: AskParseInput,
): Promise<RetrievedFacts> {
  switch (classified.intent) {
    case 'pending_todos':
      return {
        intent: classified.intent,
        facts: await retrievePendingTodos({
          ...classified.params,
          todayDateKey: input.todayDateKey,
        }),
      };
    case 'calorie_summary':
      return {
        intent: classified.intent,
        facts: await retrieveCalorieSummary(
          classified.params.startDateKey,
          classified.params.endDateKey,
        ),
      };
    case 'habit_progress':
      return {
        intent: classified.intent,
        facts: await retrieveHabitProgress(
          classified.params.habitName,
          classified.params.startDateKey,
          classified.params.endDateKey,
        ),
      };
    case 'habit_streak':
      return {
        intent: classified.intent,
        facts: await retrieveHabitStreak(classified.params.habitName),
      };
    case 'workout_summary':
      return {
        intent: classified.intent,
        facts: await retrieveWorkoutSummary(
          classified.params.routineName,
          classified.params.startDateKey,
          classified.params.endDateKey,
        ),
      };
    case 'focus_summary':
      return {
        intent: classified.intent,
        facts: await retrieveFocusSummary(
          classified.params.startDateKey,
          classified.params.endDateKey,
        ),
      };
    case 'daily_overview':
      return {
        intent: classified.intent,
        facts: await retrieveDailyOverview(classified.params.dateKey),
      };
    case 'project_status':
      return {
        intent: classified.intent,
        facts: await retrieveProjectStatus(classified.params.projectName),
      };
    case 'goal_progress':
      return {
        intent: classified.intent,
        facts: await retrieveGoalProgressSummary(classified.params.goalTitle),
      };
    case 'today_focus':
      return {
        intent: classified.intent,
        facts: await retrieveTodayFocus(classified.params.dateKey),
      };
  }
}

function normalizePhrasePayload(payload: unknown): string {
  if (!isRecord(payload) || typeof payload.answer !== 'string' || !payload.answer.trim()) {
    throw new Error('Phrase response must include a non-empty answer string.');
  }
  return payload.answer;
}

function deterministicAnswer(retrievedFacts: RetrievedFacts): string {
  switch (retrievedFacts.intent) {
    case 'pending_todos':
      return `You have ${retrievedFacts.facts.count} pending Todo${retrievedFacts.facts.count === 1 ? '' : 's'}.${retrievedFacts.facts.titles.length > 0 ? ` ${retrievedFacts.facts.titles.join(', ')}.` : ''}`;
    case 'calorie_summary': {
      const facts = retrievedFacts.facts;
      return `${facts.startDateKey === facts.endDateKey ? facts.startDateKey : `${facts.startDateKey} to ${facts.endDateKey}`}: ${facts.totalCalories} calories, ${facts.totalProtein} g protein, ${facts.totalCarbs} g carbs, ${facts.totalFats} g fats, and ${facts.totalFiber} g fiber across ${facts.entryCount} entries.`;
    }
    case 'habit_progress': {
      const habits = retrievedFacts.facts.habits;
      if (habits.length === 0) return 'No active Habits matched that progress request.';
      // Overall scope with multiple habits: summarize the set instead of
      // answering with one arbitrary habit (Area 8 F10).
      if (retrievedFacts.facts.scope === 'overall' && habits.length > 1) {
        const bestStreak = Math.max(...habits.map((habit) => habit.currentStreak));
        const names = habits
          .slice(0, 3)
          .map((habit) => habit.habitName)
          .join(', ');
        const remaining = habits.length - Math.min(3, habits.length);
        return `${habits.length} Habits tracked (best current streak ${bestStreak} day${bestStreak === 1 ? '' : 's'}): ${names}${remaining > 0 ? ` and ${remaining} more` : ''}.`;
      }
      const first = habits[0];
      return `${first.habitName}: ${first.currentStreak}-day current streak, ${first.last30Percentage ?? 0}% completion over the recent window, and ${first.currentActual}/${first.currentTarget} today.`;
    }
    case 'habit_streak': {
      if (retrievedFacts.facts.scope === 'single') {
        return `${retrievedFacts.facts.habitName}: current streak ${retrievedFacts.facts.currentStreak}, longest streak ${retrievedFacts.facts.longestStreak}.`;
      }
      return retrievedFacts.facts.habits.length === 0
        ? 'No active Habits have progress yet.'
        : retrievedFacts.facts.habits
            .map((habit) => `${habit.habitName}: ${habit.currentStreak}-day current streak`)
            .join('; ');
    }
    case 'workout_summary':
      return `${retrievedFacts.facts.sessionCount} workout session${retrievedFacts.facts.sessionCount === 1 ? '' : 's'} from ${retrievedFacts.facts.startDateKey} to ${retrievedFacts.facts.endDateKey}.`;
    case 'focus_summary':
      return `${retrievedFacts.facts.totalFocusedMinutes} focused minutes across ${retrievedFacts.facts.completedSessionCount} completed session${retrievedFacts.facts.completedSessionCount === 1 ? '' : 's'}.`;
    case 'daily_overview': {
      const facts = retrievedFacts.facts;
      return `${facts.dateKey}: ${facts.todos.pendingCount} pending Todos, ${facts.habits.completedCount} of ${facts.habits.scheduledCount} scheduled Habits complete, ${facts.calories.totalCalories} calories, ${facts.focus.totalFocusedMinutes} focus minutes, and ${facts.workout.sessionCount} workout sessions.`;
    }
    case 'project_status':
      return formatProjectStatusAnswer(retrievedFacts.facts);
    case 'goal_progress':
      return formatGoalProgressAnswer(retrievedFacts.facts);
    case 'today_focus':
      return formatTodayFocusAnswer(retrievedFacts.facts);
  }
}

/**
 * Planning intents are answered deterministically from local facts; their
 * phrase stage is skipped so project/goal names never leave the device.
 */
function isPlanningIntent(intent: AskIntent): boolean {
  return intent === 'project_status' || intent === 'goal_progress' || intent === 'today_focus';
}

export type AskOptions = {
  /**
   * A ClassifyResult already obtained for this question (e.g. by the Auto-mode
   * router). When provided, the classify network call is skipped entirely so
   * one auto-ask costs a single classify request.
   */
  precomputedClassification?: ClassifyResult;
};

export class AskParser implements AiAskParser {
  async ask(input: AskParseInput, options?: AskOptions): Promise<AskResult> {
    let classifyResult: ClassifyResult;
    if (options?.precomputedClassification) {
      classifyResult = options.precomputedClassification;
    } else {
      const classifyCall = await callAskFunction({
        stage: 'classify',
        question: input.question,
        conversationContext: input.conversationContext,
        nowIso: input.now.toISOString(),
        locale: input.locale,
        timeZone: input.timeZone,
        todayDateKey: input.todayDateKey,
        tomorrowDateKey: input.tomorrowDateKey,
      });

      if (!classifyCall.ok) return classifyCall.result;

      try {
        classifyResult = normalizeClassifyPayload(classifyCall.payload, input);
      } catch (error) {
        return buildUnavailableResult(
          input.question,
          error instanceof Error ? error.message : 'Ask returned an invalid response.',
          'response_validation_failed',
        );
      }
    }

    if (classifyResult.outcome === 'unsupported') {
      return {
        outcome: 'unsupported',
        question: input.question,
        reason: classifyResult.reason,
        reasonCode: 'unsupported',
      };
    }

    let retrievedFacts: RetrievedFacts;
    try {
      retrievedFacts = await retrieveFactsForIntent(classifyResult, input);
    } catch (error) {
      if (error instanceof AskRetrievalError) {
        return {
          outcome: 'unsupported',
          question: input.question,
          reason: error.message,
          reasonCode: error.reasonCode,
        };
      }
      return buildUnavailableResult(
        input.question,
        'Ask could not read local facts.',
        'request_failed',
      );
    }

    // Planning answers stay on-device: format deterministically and skip the
    // phrase round-trip so project/goal names are never sent upstream.
    if (isPlanningIntent(classifyResult.intent)) {
      return {
        outcome: 'answer',
        question: input.question,
        answer: deterministicAnswer(retrievedFacts),
        intent: classifyResult.intent,
      };
    }

    const phraseCall = await callAskFunction({
      stage: 'phrase',
      question: input.question,
      retrievedFacts,
    });

    if (!phraseCall.ok) {
      return {
        outcome: 'answer',
        question: input.question,
        answer: deterministicAnswer(retrievedFacts),
        intent: classifyResult.intent,
      };
    }

    try {
      const answer = normalizePhrasePayload(phraseCall.payload);
      return { outcome: 'answer', question: input.question, answer, intent: classifyResult.intent };
    } catch {
      return {
        outcome: 'answer',
        question: input.question,
        answer: deterministicAnswer(retrievedFacts),
        intent: classifyResult.intent,
      };
    }
  }
}

export const askParser = new AskParser();
