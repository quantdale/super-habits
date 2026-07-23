import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AskParseInput } from '@/features/command/ask.types';

import { AskParser } from '@/features/command/askParser';

const { getSupabaseAccessToken, getSupabaseAnonKey, getSupabaseFunctionUrl } = vi.hoisted(() => ({
  getSupabaseAccessToken: vi.fn(),
  getSupabaseAnonKey: vi.fn(),
  getSupabaseFunctionUrl: vi.fn(),
}));

const { retrievePendingTodos, retrieveCalorieSummary, retrieveHabitStreak, AskRetrievalError } =
  vi.hoisted(() => {
    class AskRetrievalErrorImpl extends Error {
      reasonCode: string;
      constructor(reasonCode: string, message: string) {
        super(message);
        this.reasonCode = reasonCode;
      }
    }
    return {
      retrievePendingTodos: vi.fn(),
      retrieveCalorieSummary: vi.fn(),
      retrieveHabitStreak: vi.fn(),
      AskRetrievalError: AskRetrievalErrorImpl,
    };
  });

vi.mock('@/lib/supabase', () => ({
  getSupabaseAccessToken,
  getSupabaseAnonKey,
  getSupabaseFunctionUrl,
}));

vi.mock('@/features/command/ask.retrieval', () => ({
  retrievePendingTodos,
  retrieveCalorieSummary,
  retrieveHabitStreak,
  AskRetrievalError,
}));

const BASE_INPUT: AskParseInput = {
  question: 'how many calories have I eaten today?',
  conversationContext: [],
  now: new Date(2026, 3, 21, 9, 0, 0),
  locale: 'en-US',
  timeZone: 'Asia/Manila',
  todayDateKey: '2026-04-21',
  tomorrowDateKey: '2026-04-22',
};

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe('features/command/askParser', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseFunctionUrl.mockReturnValue('https://example.supabase.co/functions/v1/user-ai-ask');
    getSupabaseAnonKey.mockReturnValue('anon-key');
    getSupabaseAccessToken.mockResolvedValue('access-token');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('classifies, retrieves local facts, and returns the phrased answer', async () => {
    retrieveCalorieSummary.mockResolvedValue({
      totalCalories: 1800,
      entryCount: 3,
      startDateKey: '2026-04-21',
      endDateKey: '2026-04-21',
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          outcome: 'classified',
          intent: 'calorie_summary',
          params: { startDateKey: '2026-04-21', endDateKey: '2026-04-21' },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { answer: "You've eaten 1800 kcal today." }));
    global.fetch = fetchMock;

    const parser = new AskParser();
    const result = await parser.ask(BASE_INPUT);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(retrieveCalorieSummary).toHaveBeenCalledWith('2026-04-21', '2026-04-21');
    expect(result).toEqual({
      outcome: 'answer',
      question: BASE_INPUT.question,
      answer: "You've eaten 1800 kcal today.",
      intent: 'calorie_summary',
    });
  });

  it('returns unsupported when classify says the question is out of scope', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        outcome: 'unsupported',
        reason: 'Workout questions are out of scope.',
      }),
    );
    global.fetch = fetchMock;

    const parser = new AskParser();
    const result = await parser.ask(BASE_INPUT);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      outcome: 'unsupported',
      question: BASE_INPUT.question,
      reason: 'Workout questions are out of scope.',
      reasonCode: 'unsupported',
    });
  });

  it('returns unsupported with habit_not_found when retrieval cannot resolve the named habit', async () => {
    retrieveHabitStreak.mockRejectedValue(
      new AskRetrievalError('habit_not_found', 'No habit named "running" was found.'),
    );
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        outcome: 'classified',
        intent: 'habit_streak',
        params: { habitName: 'running' },
      }),
    );
    global.fetch = fetchMock;

    const parser = new AskParser();
    const result = await parser.ask({ ...BASE_INPUT, question: "what's my running streak?" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      outcome: 'unsupported',
      question: "what's my running streak?",
      reason: 'No habit named "running" was found.',
      reasonCode: 'habit_not_found',
    });
  });

  it('returns unavailable when the function URL is not configured', async () => {
    getSupabaseFunctionUrl.mockReturnValue(null);

    const parser = new AskParser();
    const result = await parser.ask(BASE_INPUT);

    expect(result).toEqual({
      outcome: 'unavailable',
      question: BASE_INPUT.question,
      message: 'Ask is not configured on this device.',
      reasonCode: 'remote_not_configured',
    });
  });

  it('returns unavailable with http_error when the classify call responds with a non-2xx status', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(501, { error: 'not implemented' }));
    global.fetch = fetchMock;

    const parser = new AskParser();
    const result = await parser.ask(BASE_INPUT);

    expect(result).toEqual({
      outcome: 'unavailable',
      question: BASE_INPUT.question,
      message: 'Ask failed with status 501.',
      reasonCode: 'http_error',
    });
  });

  it('returns unavailable with request_timed_out when the fetch call aborts', async () => {
    const abortError = new Error('Aborted');
    abortError.name = 'AbortError';
    const fetchMock = vi.fn().mockRejectedValue(abortError);
    global.fetch = fetchMock;

    const parser = new AskParser();
    const result = await parser.ask(BASE_INPUT);

    expect(result).toEqual({
      outcome: 'unavailable',
      question: BASE_INPUT.question,
      message: 'Ask timed out.',
      reasonCode: 'request_timed_out',
    });
  });

  it('returns unavailable with malformed_json when the response body cannot be parsed', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.reject(new Error('bad json')),
    });
    global.fetch = fetchMock;

    const parser = new AskParser();
    const result = await parser.ask(BASE_INPUT);

    expect(result).toEqual({
      outcome: 'unavailable',
      question: BASE_INPUT.question,
      message: 'Ask returned malformed JSON.',
      reasonCode: 'malformed_json',
    });
  });
});
