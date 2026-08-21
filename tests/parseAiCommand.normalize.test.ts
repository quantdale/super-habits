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

function buildV2Payload(
  kind: string,
  fields: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) {
  return {
    outcome: 'draft',
    kind,
    status: 'ready',
    confidence: 0.9,
    warnings: [],
    missingFields: [],
    fields,
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

  it('normalizes every V2 mutation shape without inventing values', () => {
    expect(
      normalizeModelResponse(
        buildV2Payload('complete_todo', { todoTitle: 'Buy groceries' }),
        'test-model',
        BASE_INPUT,
      ),
    ).toMatchObject({ kind: 'complete_todo', fields: { todoTitle: 'Buy groceries' } });

    expect(
      normalizeModelResponse(
        buildV2Payload('log_habit', { habitName: 'Drink water', dateKey: null }),
        'test-model',
        BASE_INPUT,
      ),
    ).toMatchObject({ kind: 'log_habit', fields: { habitName: 'Drink water', dateKey: null } });

    expect(
      normalizeModelResponse(
        buildV2Payload('log_calorie_entry', {
          foodName: 'Eggs',
          calories: 140,
          protein: 12,
          carbs: null,
          fats: null,
          fiber: null,
          mealType: 'breakfast',
          consumedOn: null,
        }),
        'test-model',
        BASE_INPUT,
      ),
    ).toMatchObject({ kind: 'log_calorie_entry', fields: { foodName: 'Eggs', calories: 140 } });

    expect(
      normalizeModelResponse(
        buildV2Payload('log_workout_routine', { routineName: 'Push Day', completedOn: null }),
        'test-model',
        BASE_INPUT,
      ),
    ).toMatchObject({ kind: 'log_workout_routine', fields: { routineName: 'Push Day' } });

    expect(
      normalizeModelResponse(
        buildV2Payload('start_focus_session', { durationMinutes: 25 }),
        'test-model',
        BASE_INPUT,
      ),
    ).toMatchObject({ kind: 'start_focus_session', fields: { durationMinutes: 25 } });
  });

  it('keeps omitted calorie macros null instead of estimating them', () => {
    const result = normalizeModelResponse(
      buildV2Payload('log_calorie_entry', {
        foodName: 'Chicken breast',
        calories: null,
        protein: null,
        carbs: null,
        fats: null,
        fiber: null,
        mealType: null,
        consumedOn: null,
      }),
      'test-model',
      BASE_INPUT,
    );

    expect(result.fields).toEqual({
      foodName: 'Chicken breast',
      calories: null,
      protein: null,
      carbs: null,
      fats: null,
      fiber: null,
      mealType: null,
      consumedOn: null,
    });
  });

  it.each([
    ['negative calories', 'log_calorie_entry', { foodName: 'Rice', calories: -1 }],
    ['oversized calories', 'log_calorie_entry', { foodName: 'Rice', calories: 10_000 }],
    [
      'invalid meal type',
      'log_calorie_entry',
      { foodName: 'Rice', calories: 200, mealType: 'brunch' },
    ],
    ['invalid date', 'log_habit', { habitName: 'Read', dateKey: '2026-13-40' }],
    ['oversized focus duration', 'start_focus_session', { durationMinutes: 121 }],
  ])('rejects %s in V2 model output', (_label, kind, fields) => {
    expect(() =>
      normalizeModelResponse(buildV2Payload(kind, fields), 'test-model', BASE_INPUT),
    ).toThrow();
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

describe('normalizeModelResponse planning kinds (create_project / update_goal_progress / add_todo_to_daily_plan)', () => {
  it('normalizes a ready create_project draft with color and targetDate', () => {
    const result = normalizeModelResponse(
      buildV2Payload('create_project', {
        name: 'Apollo',
        color: 'blue',
        targetDate: '2026-07-20',
      }),
      'test-model',
      BASE_INPUT,
    );

    expect(result.outcome).toBe('draft');
    expect(result.kind).toBe('create_project');
    expect(result.fields).toEqual({ name: 'Apollo', color: 'blue', targetDate: '2026-07-20' });
  });

  it('keeps an empty project name null for needs_input instead of inventing one', () => {
    const result = normalizeModelResponse(
      buildV2Payload(
        'create_project',
        { name: '   ', color: null, targetDate: null },
        {
          status: 'needs_input',
          missingFields: [{ field: 'name', message: 'What should the project be called?' }],
        },
      ),
      'test-model',
      BASE_INPUT,
    );

    expect(result.status).toBe('needs_input');
    expect(result.fields.name).toBeNull();
  });

  it('rejects an invalid project targetDate', () => {
    expect(() =>
      normalizeModelResponse(
        buildV2Payload('create_project', { name: 'Apollo', color: null, targetDate: '2026-13-40' }),
        'test-model',
        BASE_INPUT,
      ),
    ).toThrow(/targetDate must be a valid YYYY-MM-DD date or null/);
  });

  it('rejects an over-long project name', () => {
    expect(() =>
      normalizeModelResponse(
        buildV2Payload('create_project', { name: 'A'.repeat(81), color: null, targetDate: null }),
        'test-model',
        BASE_INPUT,
      ),
    ).toThrow(/name must be 80 characters or fewer/);
  });

  it('normalizes goal progress and preserves an in-range percent without warnings', () => {
    const result = normalizeModelResponse(
      buildV2Payload('update_goal_progress', { goalTitle: 'Read more', percent: 50 }),
      'test-model',
      BASE_INPUT,
    );

    expect(result.kind).toBe('update_goal_progress');
    expect(result.fields).toEqual({ goalTitle: 'Read more', percent: 50 });
    expect(result.warnings).toEqual([]);
  });

  it('clamps out-of-range percents into 0–100 and adds a percent_clamped warning', () => {
    const result = normalizeModelResponse(
      buildV2Payload('update_goal_progress', { goalTitle: 'Read more', percent: 150 }),
      'test-model',
      BASE_INPUT,
    );

    expect(result.fields.percent).toBe(100);
    expect(result.warnings).toEqual([
      { code: 'percent_clamped', message: 'Progress was clamped to the 0–100 range.' },
    ]);
  });

  it('clamps negative percents to zero with the same warning code', () => {
    const result = normalizeModelResponse(
      buildV2Payload('update_goal_progress', { goalTitle: 'Read more', percent: -5 }),
      'test-model',
      BASE_INPUT,
    );

    expect(result.fields.percent).toBe(0);
    expect(result.warnings.map((warning: { code: string }) => warning.code)).toContain(
      'percent_clamped',
    );
  });

  it('rejects a non-numeric percent', () => {
    expect(() =>
      normalizeModelResponse(
        buildV2Payload('update_goal_progress', { goalTitle: 'Read more', percent: 'half' }),
        'test-model',
        BASE_INPUT,
      ),
    ).toThrow(/percent must be a number or null/);
  });

  it('normalizes an add_todo_to_daily_plan draft with an optional dateKey', () => {
    const result = normalizeModelResponse(
      buildV2Payload('add_todo_to_daily_plan', { todoTitle: 'Buy groceries', dateKey: null }),
      'test-model',
      BASE_INPUT,
    );

    expect(result.kind).toBe('add_todo_to_daily_plan');
    expect(result.fields).toEqual({ todoTitle: 'Buy groceries', dateKey: null });
  });

  it('rejects an invalid daily-plan dateKey', () => {
    expect(() =>
      normalizeModelResponse(
        buildV2Payload('add_todo_to_daily_plan', { todoTitle: 'Buy groceries', dateKey: 'nope' }),
        'test-model',
        BASE_INPUT,
      ),
    ).toThrow();
  });

  it('fails closed on an unknown future kind instead of mis-normalizing', () => {
    expect(() =>
      normalizeModelResponse(buildV2Payload('delete_everything', {}), 'test-model', BASE_INPUT),
    ).toThrow(/kind is invalid/);
  });
});
