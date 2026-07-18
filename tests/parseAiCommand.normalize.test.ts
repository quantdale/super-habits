import { describe, expect, it } from 'vitest';
import { normalizeModelResponse as normalizeModelResponseJs } from '../supabase/functions/parse-ai-command/normalize.js';

// The module is untyped runtime JS shared with the Deno entrypoint; widen the
// inferred union so property assertions below stay readable.
const normalizeModelResponse = normalizeModelResponseJs as (
  payload: unknown,
  parserVersion: string,
  input: Record<string, string>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => any;

// Regression tests for SEC-001: the edge function used to pass the raw text
// string as `input`, so `input.rawText` was undefined and every create_todo
// normalization threw (`undefined.match`), returning HTTP 502. These tests
// exercise the normalizers with the request-object contract the fixed
// entrypoint now passes.

const BASE_INPUT = {
  rawText: 'buy milk today',
  nowIso: '2026-07-12T08:00:00.000Z',
  locale: 'en-US',
  timeZone: 'Asia/Manila',
  todayDateKey: '2026-07-12',
  tomorrowDateKey: '2026-07-13',
};

function buildTodoPayload(overrides: Record<string, unknown> = {}) {
  return {
    outcome: 'draft',
    kind: 'create_todo',
    status: 'ready',
    confidence: 0.9,
    reason: null,
    warnings: [],
    missingFields: [],
    fields: {
      title: 'buy milk',
      notes: null,
      dueDate: '2026-07-12',
      priority: 'normal',
      recurrence: null,
      name: null,
      targetPerDay: null,
      category: null,
      icon: null,
      color: null,
    },
    ...overrides,
  };
}

describe('normalizeModelResponse (parse-ai-command edge function)', () => {
  it("resolves a todo draft with 'today' in the raw text to todayDateKey without throwing", () => {
    const result = normalizeModelResponse(buildTodoPayload(), 'test-model', BASE_INPUT);

    expect(result.outcome).toBe('draft');
    expect(result.kind).toBe('create_todo');
    expect(result.fields.dueDate).toBe('2026-07-12');
    expect(result.rawText).toBe('buy milk today');
  });

  it("resolves 'tomorrow' in the raw text to tomorrowDateKey", () => {
    const input = { ...BASE_INPUT, rawText: 'call mom tomorrow' };
    const payload = buildTodoPayload({
      fields: { ...buildTodoPayload().fields, dueDate: '2026-07-13' },
    });

    const result = normalizeModelResponse(payload, 'test-model', input);

    expect(result.outcome).toBe('draft');
    expect(result.fields.dueDate).toBe('2026-07-13');
  });

  it('resolves an explicit YYYY-MM-DD date in the raw text', () => {
    const input = { ...BASE_INPUT, rawText: 'pay rent 2026-08-01' };
    const payload = buildTodoPayload({
      fields: { ...buildTodoPayload().fields, dueDate: '2026-08-01' },
    });

    const result = normalizeModelResponse(payload, 'test-model', input);

    expect(result.outcome).toBe('draft');
    expect(result.fields.dueDate).toBe('2026-08-01');
  });

  it('keeps dueDate null when the raw text has no date signal and the model returned none', () => {
    const input = { ...BASE_INPUT, rawText: 'buy milk' };
    const payload = buildTodoPayload({
      fields: { ...buildTodoPayload().fields, dueDate: null },
    });

    const result = normalizeModelResponse(payload, 'test-model', input);

    expect(result.outcome).toBe('draft');
    expect(result.fields.dueDate).toBeNull();
  });

  it('returns unsupported when the model invents a due date the raw text never mentioned', () => {
    const input = { ...BASE_INPUT, rawText: 'buy milk' };
    const payload = buildTodoPayload(); // model claims dueDate 2026-07-12

    const result = normalizeModelResponse(payload, 'test-model', input);

    expect(result.outcome).toBe('unsupported');
    expect(result.reason).toMatch(/limited to today, tomorrow/);
  });

  it('normalizes a habit draft', () => {
    const payload = {
      outcome: 'draft',
      kind: 'create_habit',
      status: 'ready',
      confidence: 0.8,
      reason: null,
      warnings: [],
      missingFields: [],
      fields: {
        title: null,
        notes: null,
        dueDate: null,
        priority: null,
        recurrence: null,
        name: 'Drink water',
        targetPerDay: 8,
        category: 'anytime',
        icon: null,
        color: null,
      },
    };

    const result = normalizeModelResponse(payload, 'test-model', BASE_INPUT);

    expect(result.outcome).toBe('draft');
    expect(result.kind).toBe('create_habit');
    expect(result.fields.name).toBe('Drink water');
    expect(result.fields.targetPerDay).toBe(8);
    expect(result.rawText).toBe('buy milk today');
  });

  it('passes through an unsupported outcome with the raw text attached', () => {
    const result = normalizeModelResponse(
      { outcome: 'unsupported', reason: 'Out of scope.' },
      'test-model',
      BASE_INPUT,
    );

    expect(result).toEqual({
      outcome: 'unsupported',
      rawText: 'buy milk today',
      reason: 'Out of scope.',
      reasonCode: 'unsupported',
    });
  });

  it('rejects conflicting date signals in the raw text as unsupported', () => {
    const input = { ...BASE_INPUT, rawText: 'buy milk today or tomorrow' };

    const result = normalizeModelResponse(buildTodoPayload(), 'test-model', input);

    expect(result.outcome).toBe('unsupported');
    expect(result.reason).toMatch(/at most one due date/);
  });
});
