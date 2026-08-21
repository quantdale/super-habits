import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AskParseInput } from '@/features/command/ask.types';

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

  it('routes every V2 Ask intent to bounded local retrieval', async () => {
    const cases = [
      {
        intent: 'pending_todos',
        params: { due: 'all', priority: 'all' },
        retriever: retrievePendingTodos,
        facts: { count: 1, titles: ['Submit report'] },
      },
      {
        intent: 'calorie_summary',
        params: { startDateKey: '2026-04-21', endDateKey: '2026-04-21' },
        retriever: retrieveCalorieSummary,
        facts: {
          totalCalories: 1800,
          totalProtein: 80,
          totalCarbs: 200,
          totalFats: 60,
          totalFiber: 20,
          entryCount: 3,
          startDateKey: '2026-04-21',
          endDateKey: '2026-04-21',
        },
      },
      {
        intent: 'habit_progress',
        params: { habitName: null, startDateKey: '2026-04-15', endDateKey: '2026-04-21' },
        retriever: retrieveHabitProgress,
        facts: {
          scope: 'overall',
          startDateKey: '2026-04-15',
          endDateKey: '2026-04-21',
          habits: [],
        },
      },
      {
        intent: 'workout_summary',
        params: { routineName: null, startDateKey: '2026-04-15', endDateKey: '2026-04-21' },
        retriever: retrieveWorkoutSummary,
        facts: {
          startDateKey: '2026-04-15',
          endDateKey: '2026-04-21',
          sessionCount: 2,
          lastSession: null,
          routineFrequency: [],
        },
      },
      {
        intent: 'focus_summary',
        params: { startDateKey: '2026-04-15', endDateKey: '2026-04-21' },
        retriever: retrieveFocusSummary,
        facts: {
          startDateKey: '2026-04-15',
          endDateKey: '2026-04-21',
          completedSessionCount: 2,
          totalFocusedMinutes: 50,
        },
      },
      {
        intent: 'daily_overview',
        params: { dateKey: '2026-04-21' },
        retriever: retrieveDailyOverview,
        facts: {
          dateKey: '2026-04-21',
          todos: { pendingCount: 1, completedCount: 1, overdueCount: 0 },
          habits: { scheduledCount: 1, completedCount: 1, remainingCount: 0 },
          calories: {
            totalCalories: 1800,
            totalProtein: 80,
            totalCarbs: 200,
            totalFats: 60,
            totalFiber: 20,
            entryCount: 3,
          },
          focus: { completedSessionCount: 2, totalFocusedMinutes: 50 },
          workout: { sessionCount: 1 },
        },
      },
    ] as const;

    for (const testCase of cases) {
      vi.clearAllMocks();
      testCase.retriever.mockResolvedValue(testCase.facts);
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(200, {
            outcome: 'classified',
            intent: testCase.intent,
            params: testCase.params,
          }),
        )
        .mockResolvedValueOnce(jsonResponse(200, { answer: 'bounded answer' }));

      const result = await new AskParser().ask({
        ...BASE_INPUT,
        question: `summary for ${testCase.intent}`,
      });

      expect(result).toMatchObject({ outcome: 'answer', intent: testCase.intent });
      expect(testCase.retriever).toHaveBeenCalled();
    }
  });

  it('falls back to a deterministic answer when the phrase provider is unavailable', async () => {
    retrieveHabitProgress.mockResolvedValue({
      scope: 'single',
      startDateKey: '2026-04-15',
      endDateKey: '2026-04-21',
      habits: [
        {
          habitName: 'Gym',
          currentStreak: 3,
          longestStreak: 5,
          scheduledOccurrences: 5,
          completedOccurrences: 4,
          currentTarget: 1,
          currentActual: 1,
          last7Percentage: 80,
          last30Percentage: 70,
          last90Percentage: 70,
        },
      ],
    });
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          outcome: 'classified',
          intent: 'habit_progress',
          params: { habitName: 'Gym', startDateKey: '2026-04-15', endDateKey: '2026-04-21' },
        }),
      )
      .mockResolvedValueOnce(jsonResponse(503, { error: 'provider unavailable' }));

    const result = await new AskParser().ask({ ...BASE_INPUT, question: 'how is Gym going?' });

    expect(result).toMatchObject({ outcome: 'answer', intent: 'habit_progress' });
    if (result.outcome !== 'answer') return;
    expect(result.answer).toContain('Gym');
    expect(result.answer).toContain('3-day current streak');
  });

  it('answers planning intents deterministically without a phrase round-trip', async () => {
    retrieveProjectStatus.mockResolvedValue({
      scope: 'single',
      projects: [{ name: 'Apollo', status: 'active', targetDate: null, openTodoCount: 2 }],
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        outcome: 'classified',
        intent: 'project_status',
        params: { projectName: 'Apollo' },
      }),
    );
    global.fetch = fetchMock;

    const result = await new AskParser().ask({
      ...BASE_INPUT,
      question: 'how is my Apollo project doing?',
    });

    // Only the classify call ran; project names never reach the phrase stage.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(retrieveProjectStatus).toHaveBeenCalledWith('Apollo');
    expect(result).toEqual({
      outcome: 'answer',
      question: 'how is my Apollo project doing?',
      answer: 'Apollo is active with 2 open Todos.',
      intent: 'project_status',
    });
  });

  it('skips the classify request when a precomputed classification is supplied', async () => {
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
      .mockResolvedValueOnce(jsonResponse(200, { answer: '1800 kcal today.' }));
    global.fetch = fetchMock;

    const result = await new AskParser().ask(BASE_INPUT, {
      precomputedClassification: {
        outcome: 'classified',
        intent: 'calorie_summary',
        params: { startDateKey: '2026-04-21', endDateKey: '2026-04-21' },
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).stage).toBe('phrase');
    expect(retrieveCalorieSummary).toHaveBeenCalledWith('2026-04-21', '2026-04-21');
    expect(result).toMatchObject({ outcome: 'answer', intent: 'calorie_summary' });
  });

  it('routes goal_progress and today_focus to their planning retrievers', async () => {
    retrieveGoalProgressSummary.mockResolvedValue({
      scope: 'single',
      goals: [{ title: 'Read more', progressPercent: 50, status: 'active' }],
    });
    global.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        outcome: 'classified',
        intent: 'goal_progress',
        params: { goalTitle: 'Read more' },
      }),
    );

    const goalResult = await new AskParser().ask({
      ...BASE_INPUT,
      question: 'how far along is Read more?',
    });

    expect(retrieveGoalProgressSummary).toHaveBeenCalledWith('Read more');
    expect(goalResult).toEqual({
      outcome: 'answer',
      question: 'how far along is Read more?',
      answer: 'Read more: 50% complete (active).',
      intent: 'goal_progress',
    });

    vi.clearAllMocks();
    retrieveTodayFocus.mockResolvedValue({
      dateKey: '2026-04-21',
      planIntention: null,
      topTodos: [],
      pendingTodoCount: 1,
      habitsRemainingCount: 2,
    });
    global.fetch = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        outcome: 'classified',
        intent: 'today_focus',
        params: { dateKey: '2026-04-21' },
      }),
    );

    const focusResult = await new AskParser().ask({
      ...BASE_INPUT,
      question: "what's my focus today?",
    });

    expect(retrieveTodayFocus).toHaveBeenCalledWith('2026-04-21');
    expect(focusResult).toMatchObject({ outcome: 'answer', intent: 'today_focus' });
    if (focusResult.outcome !== 'answer') return;
    expect(focusResult.answer).toContain('No top priorities are set for today yet.');
    expect(focusResult.answer).toContain('1 pending Todo today.');
  });
});
