import { describe, expect, it } from 'vitest';
import { normalizeAskRequestBody as normalizeAskRequestBodyJs } from '../supabase/functions/user-ai-ask/normalize.js';

// The module is untyped runtime JS shared with the Deno entrypoint; widen the
// inferred signature so assertions below stay readable.
const normalizeAskRequestBody = normalizeAskRequestBodyJs as (
  payload: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => any;

function buildRequestPayload(overrides: Record<string, unknown> = {}) {
  return {
    question: 'how many calories have I eaten today?',
    nowIso: '2026-07-12T08:00:00.000Z',
    locale: 'en-US',
    timeZone: 'Asia/Manila',
    todayDateKey: '2026-07-12',
    tomorrowDateKey: '2026-07-13',
    ...overrides,
  };
}

describe('supabase/functions/user-ai-ask/normalize', () => {
  it('normalizes a valid request with no conversation context', () => {
    const result = normalizeAskRequestBody(buildRequestPayload());

    expect(result).toEqual({
      question: 'how many calories have I eaten today?',
      conversationContext: [],
      nowIso: '2026-07-12T08:00:00.000Z',
      locale: 'en-US',
      timeZone: 'Asia/Manila',
      todayDateKey: '2026-07-12',
      tomorrowDateKey: '2026-07-13',
    });
  });

  it('normalizes conversation context turns', () => {
    const result = normalizeAskRequestBody(
      buildRequestPayload({
        conversationContext: [{ question: 'how many calories today?', answer: '1800 kcal.' }],
      }),
    );

    expect(result.conversationContext).toEqual([
      { question: 'how many calories today?', answer: '1800 kcal.' },
    ]);
  });

  it('throws when question is missing', () => {
    const payload = buildRequestPayload();
    delete (payload as Record<string, unknown>).question;

    expect(() => normalizeAskRequestBody(payload)).toThrow(/Missing required ask request fields/);
  });

  it('throws when question exceeds the max length', () => {
    expect(() =>
      normalizeAskRequestBody(buildRequestPayload({ question: 'a'.repeat(281) })),
    ).toThrow(/280 characters or less/);
  });

  it('throws when todayDateKey is not a valid date key', () => {
    expect(() =>
      normalizeAskRequestBody(buildRequestPayload({ todayDateKey: '2026-13-40' })),
    ).toThrow(/valid YYYY-MM-DD dates/);
  });

  it('throws when a conversation turn is missing a field', () => {
    expect(() =>
      normalizeAskRequestBody(
        buildRequestPayload({ conversationContext: [{ question: 'only a question' }] }),
      ),
    ).toThrow(/must include question and answer/);
  });

  it('throws when conversationContext exceeds the max turn count', () => {
    const tooManyTurns = Array.from({ length: 21 }, () => ({
      question: 'q',
      answer: 'a',
    }));

    expect(() =>
      normalizeAskRequestBody(buildRequestPayload({ conversationContext: tooManyTurns })),
    ).toThrow(/at most 20 turns/);
  });
});
