import { getSupabaseAccessToken, getSupabaseAnonKey, getSupabaseFunctionUrl } from '@/lib/supabase';
import {
  AskRetrievalError,
  retrieveCalorieSummary,
  retrieveHabitStreak,
  retrievePendingTodos,
} from './ask.retrieval';
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

async function callAskFunction(
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

function normalizeClassifyPayload(payload: unknown, question: string): ClassifyResult {
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

  const intent = payload.intent;
  if (intent !== 'pending_todos' && intent !== 'calorie_summary' && intent !== 'habit_streak') {
    throw new Error('Classify response intent is invalid.');
  }

  void question;
  return {
    outcome: 'classified',
    intent,
    params: (payload.params ?? {}) as ClassifyParams[AskIntent],
  };
}

async function retrieveFactsForIntent(
  intent: AskIntent,
  params: ClassifyParams[AskIntent],
): Promise<RetrievedFacts> {
  if (intent === 'pending_todos') {
    return { intent, facts: await retrievePendingTodos() };
  }

  if (intent === 'calorie_summary') {
    const calorieParams = params as ClassifyParams['calorie_summary'];
    return {
      intent,
      facts: await retrieveCalorieSummary(calorieParams.startDateKey, calorieParams.endDateKey),
    };
  }

  const habitParams = params as ClassifyParams['habit_streak'];
  return { intent, facts: await retrieveHabitStreak(habitParams.habitName) };
}

function normalizePhrasePayload(payload: unknown): string {
  if (!isRecord(payload) || typeof payload.answer !== 'string' || !payload.answer.trim()) {
    throw new Error('Phrase response must include a non-empty answer string.');
  }
  return payload.answer;
}

export class AskParser implements AiAskParser {
  async ask(input: AskParseInput): Promise<AskResult> {
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

    if (!classifyCall.ok) {
      return classifyCall.result;
    }

    let classifyResult: ClassifyResult;
    try {
      classifyResult = normalizeClassifyPayload(classifyCall.payload, input.question);
    } catch (error) {
      return {
        outcome: 'unavailable',
        question: input.question,
        message: error instanceof Error ? error.message : 'Ask returned an invalid response.',
        reasonCode: 'response_validation_failed',
      };
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
      retrievedFacts = await retrieveFactsForIntent(classifyResult.intent, classifyResult.params);
    } catch (error) {
      if (error instanceof AskRetrievalError) {
        return {
          outcome: 'unsupported',
          question: input.question,
          reason: error.message,
          reasonCode: error.reasonCode,
        };
      }
      throw error;
    }

    const phraseCall = await callAskFunction({
      stage: 'phrase',
      question: input.question,
      retrievedFacts,
    });

    if (!phraseCall.ok) {
      return phraseCall.result;
    }

    try {
      const answer = normalizePhrasePayload(phraseCall.payload);
      return { outcome: 'answer', question: input.question, answer, intent: classifyResult.intent };
    } catch (error) {
      return {
        outcome: 'unavailable',
        question: input.question,
        message: error instanceof Error ? error.message : 'Ask returned an invalid response.',
        reasonCode: 'response_validation_failed',
      };
    }
  }
}

export const askParser = new AskParser();
