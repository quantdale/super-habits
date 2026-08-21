import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AskIntent, AskParseInput } from '@/features/command/ask.types';

import { classifyForAutoMode } from '@/features/command/autoModeRouter';
import { AskParser } from '@/features/command/askParser';

const { getSupabaseAccessToken, getSupabaseAnonKey, getSupabaseFunctionUrl } = vi.hoisted(() => ({
  getSupabaseAccessToken: vi.fn(),
  getSupabaseAnonKey: vi.fn(),
  getSupabaseFunctionUrl: vi.fn(),
}));

const {
  retrievePendingTodos,
  retrieveCalorieSummary,
  retrieveHabitProgress,
  retrieveHabitStreak,
  retrieveWorkoutSummary,
  retrieveFocusSummary,
  retrieveDailyOverview,
  retrieveProjectStatus,
  retrieveGoalProgressSummary,
  retrieveTodayFocus,
  AskRetrievalError,
} = vi.hoisted(() => {
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
    retrieveHabitProgress: vi.fn(),
    retrieveHabitStreak: vi.fn(),
    retrieveWorkoutSummary: vi.fn(),
    retrieveFocusSummary: vi.fn(),
    retrieveDailyOverview: vi.fn(),
    retrieveProjectStatus: vi.fn(),
    retrieveGoalProgressSummary: vi.fn(),
    retrieveTodayFocus: vi.fn(),
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
  retrieveHabitProgress,
  retrieveHabitStreak,
  retrieveWorkoutSummary,
  retrieveFocusSummary,
  retrieveDailyOverview,
  retrieveProjectStatus,
  retrieveGoalProgressSummary,
  retrieveTodayFocus,
  AskRetrievalError,
}));

const BASE_INPUT: AskParseInput = {
  question: 'how is my Apollo project doing?',
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

const ALL_INTENTS: AskIntent[] = [
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

describe('features/command/autoModeRouter', () => {
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

  it.each(ALL_INTENTS)('routes a classified %s question to the ask pipeline', async (intent) => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { outcome: 'classified', intent, params: {} }));

    const { route, classification } = await classifyForAutoMode(BASE_INPUT);

    expect(route).toEqual({ route: 'ask', intent });
    expect(classification).toMatchObject({ outcome: 'classified', intent });
  });

  it('routes an unsupported classification to the create pipeline', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        outcome: 'unsupported',
        reason: 'Not an Ask intent.',
      }),
    );

    const { route, classification } = await classifyForAutoMode(BASE_INPUT);

    expect(route).toEqual({
      route: 'create',
      reason: 'Not an Ask intent.',
    });
    expect(classification).toBeUndefined();
  });

  it('falls back to the create pipeline when classification is unavailable', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'));

    const { route } = await classifyForAutoMode(BASE_INPUT);

    expect(route).toEqual({
      route: 'create',
      reason: 'Classification unavailable — routing to Create as fallback.',
    });
  });

  it('falls back to the create pipeline when the classify payload is invalid', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { outcome: 'classified', intent: 'nope' }));

    const { route } = await classifyForAutoMode(BASE_INPUT);

    expect(route.route).toBe('create');
  });

  it('costs exactly one classify request per auto-ask (router + reused classification)', async () => {
    retrieveCalorieSummary.mockResolvedValue({
      totalCalories: 1800,
      totalProtein: 0,
      totalCarbs: 0,
      totalFats: 0,
      totalFiber: 0,
      entryCount: 2,
      startDateKey: '2026-04-21',
      endDateKey: '2026-04-21',
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { outcome: 'classified', intent: 'calorie_summary', params: {} }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { answer: '1800 kcal today.' }));
    global.fetch = fetchMock;

    const { route, classification } = await classifyForAutoMode(BASE_INPUT);
    expect(route.route).toBe('ask');

    const parser = new AskParser();
    const result = await parser.ask(BASE_INPUT, { precomputedClassification: classification });

    expect(result.outcome).toBe('answer');
    // One classify call (the router's) + one phrase call. Before the
    // precomputed-classification contract this cost three requests.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).stage).toBe('classify');
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body)).stage).toBe('phrase');
    expect(retrieveCalorieSummary).toHaveBeenCalledTimes(1);
  });

  it('answers planning intents on-device with zero network calls after routing', async () => {
    retrieveProjectStatus.mockResolvedValue({
      scope: 'single',
      projects: [{ name: 'Apollo', status: 'active', targetDate: null, openTodoCount: 2 }],
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, { outcome: 'classified', intent: 'project_status', params: {} }),
      );
    global.fetch = fetchMock;

    const { route, classification } = await classifyForAutoMode(BASE_INPUT);
    expect(route).toEqual({ route: 'ask', intent: 'project_status' });

    const result = await new AskParser().ask(BASE_INPUT, {
      precomputedClassification: classification,
    });

    // Only the router's classify request ran; retrieval + deterministic
    // formatting stayed local and no phrase round-trip happened.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      outcome: 'answer',
      question: BASE_INPUT.question,
      answer: 'Apollo is active with 2 open Todos.',
      intent: 'project_status',
    });
    expect(retrieveProjectStatus).toHaveBeenCalledWith(null);
  });
});
