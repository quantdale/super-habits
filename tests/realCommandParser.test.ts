import { describe, expect, it } from 'vitest';
import { normalizeRemoteParseResponse } from '@/features/command/realCommandParser';

const PARSE_INPUT_BASE = {
  rawText: 'Add a todo to call mom tomorrow',
  now: new Date(2026, 3, 21, 9, 0, 0),
  locale: 'en-US',
  timeZone: 'Asia/Manila',
  todayDateKey: '2026-04-21',
  tomorrowDateKey: '2026-04-22',
};

describe('features/command/realCommandParser normalization', () => {
  it('maps model-backed today due dates to the provided todayDateKey', () => {
    const result = normalizeRemoteParseResponse(
      {
        outcome: 'draft',
        kind: 'create_todo',
        status: 'ready',
        confidence: 0.91,
        parserVersion: 'gpt-test',
        warnings: [],
        missingFields: [],
        fields: {
          title: 'call mom',
          notes: null,
          dueDate: '1999-01-01',
          priority: 'normal',
        },
      },
      {
        ...PARSE_INPUT_BASE,
        rawText: 'Add a todo to call mom today',
      },
    );

    expect(result).toEqual({
      outcome: 'draft',
      draft: {
        kind: 'create_todo',
        rawText: 'Add a todo to call mom today',
        parserKind: 'model_proxy',
        parserVersion: 'gpt-test',
        confidence: 0.91,
        status: 'ready',
        warnings: [],
        missingFields: [],
        fields: {
          title: 'call mom',
          notes: null,
          dueDate: '2026-04-21',
          priority: 'normal',
          recurrence: null,
        },
      },
    });
  });

  it('maps model-backed tomorrow due dates to the provided tomorrowDateKey', () => {
    const result = normalizeRemoteParseResponse(
      {
        outcome: 'draft',
        kind: 'create_todo',
        status: 'ready',
        confidence: 0.91,
        parserVersion: 'gpt-test',
        warnings: [],
        missingFields: [],
        fields: {
          title: 'call mom',
          notes: null,
          dueDate: '2026-04-22',
          priority: 'normal',
        },
      },
      PARSE_INPUT_BASE,
    );

    expect(result).toEqual({
      outcome: 'draft',
      draft: {
        kind: 'create_todo',
        rawText: 'Add a todo to call mom tomorrow',
        parserKind: 'model_proxy',
        parserVersion: 'gpt-test',
        confidence: 0.91,
        status: 'ready',
        warnings: [],
        missingFields: [],
        fields: {
          title: 'call mom',
          notes: null,
          dueDate: '2026-04-22',
          priority: 'normal',
          recurrence: null,
        },
      },
    });
  });

  it('keeps explicit YYYY-MM-DD due dates authoritative from the raw command text', () => {
    const result = normalizeRemoteParseResponse(
      {
        outcome: 'draft',
        kind: 'create_todo',
        status: 'ready',
        confidence: 0.87,
        parserVersion: 'gpt-test',
        warnings: [],
        missingFields: [],
        fields: {
          title: 'call mom',
          notes: null,
          dueDate: '2026-04-30',
          priority: 'normal',
        },
      },
      {
        ...PARSE_INPUT_BASE,
        rawText: 'Add a todo to call mom 2026-04-25',
      },
    );

    expect(result).toEqual({
      outcome: 'draft',
      draft: {
        kind: 'create_todo',
        rawText: 'Add a todo to call mom 2026-04-25',
        parserKind: 'model_proxy',
        parserVersion: 'gpt-test',
        confidence: 0.87,
        status: 'ready',
        warnings: [],
        missingFields: [],
        fields: {
          title: 'call mom',
          notes: null,
          dueDate: '2026-04-25',
          priority: 'normal',
          recurrence: null,
        },
      },
    });
  });

  it('preserves time warnings while resolving authoritative due dates', () => {
    const result = normalizeRemoteParseResponse(
      {
        outcome: 'draft',
        kind: 'create_todo',
        status: 'ready',
        confidence: 0.84,
        parserVersion: 'gpt-test',
        warnings: [
          {
            code: 'todo_time_not_supported',
            message: 'Time will not be saved in this version.',
          },
        ],
        missingFields: [],
        fields: {
          title: 'call mom',
          notes: null,
          dueDate: null,
          priority: 'normal',
        },
      },
      {
        ...PARSE_INPUT_BASE,
        rawText: 'Add a todo to call mom tomorrow at 7pm',
      },
    );

    expect(result).toEqual({
      outcome: 'draft',
      draft: {
        kind: 'create_todo',
        rawText: 'Add a todo to call mom tomorrow at 7pm',
        parserKind: 'model_proxy',
        parserVersion: 'gpt-test',
        confidence: 0.84,
        status: 'ready',
        warnings: [
          {
            code: 'todo_time_not_supported',
            message: 'Time will not be saved in this version.',
          },
        ],
        missingFields: [],
        fields: {
          title: 'call mom',
          notes: null,
          dueDate: '2026-04-22',
          priority: 'normal',
          recurrence: null,
        },
      },
    });
  });

  it('keeps unsupported separate from technical failure', () => {
    const result = normalizeRemoteParseResponse(
      {
        outcome: 'unsupported',
        reason: 'Use one create command at a time in this version.',
      },
      PARSE_INPUT_BASE,
    );

    expect(result).toEqual({
      outcome: 'unsupported',
      rawText: 'Add a todo to call mom tomorrow',
      reason: 'Use one create command at a time in this version.',
      reasonCode: 'unsupported',
    });
  });

  it('rejects invented todo due dates when the command text did not authorize one', () => {
    expect(() =>
      normalizeRemoteParseResponse(
        {
          outcome: 'draft',
          kind: 'create_todo',
          status: 'ready',
          confidence: 0.8,
          warnings: [],
          missingFields: [],
          fields: {
            title: 'call mom',
            notes: null,
            dueDate: '2026-04-22',
            priority: 'normal',
          },
        },
        {
          ...PARSE_INPUT_BASE,
          rawText: 'Add a todo to call mom',
        },
      ),
    ).toThrow('only allowed when the command uses today, tomorrow, or YYYY-MM-DD');
  });

  it('rejects ambiguous supported date directives before accepting a model-backed todo draft', () => {
    expect(() =>
      normalizeRemoteParseResponse(
        {
          outcome: 'draft',
          kind: 'create_todo',
          status: 'ready',
          confidence: 0.8,
          warnings: [],
          missingFields: [],
          fields: {
            title: 'call mom',
            notes: null,
            dueDate: '2026-04-22',
            priority: 'normal',
          },
        },
        {
          ...PARSE_INPUT_BASE,
          rawText: 'Add a todo to call mom today 2026-04-22',
        },
      ),
    ).toThrow('Use at most one due date');
  });

  it.each([
    {
      kind: 'complete_todo',
      fields: { todoTitle: 'Buy groceries' },
      expected: { todoTitle: 'Buy groceries' },
    },
    {
      kind: 'log_habit',
      fields: { habitName: 'Drink water', dateKey: null },
      expected: { habitName: 'Drink water', dateKey: null },
    },
    {
      kind: 'log_calorie_entry',
      fields: {
        foodName: 'Eggs',
        calories: 140,
        protein: 12,
        carbs: null,
        fats: null,
        fiber: null,
        mealType: 'breakfast',
        consumedOn: null,
      },
      expected: { foodName: 'Eggs', calories: 140, protein: 12 },
    },
    {
      kind: 'log_workout_routine',
      fields: { routineName: 'Push Day', completedOn: null },
      expected: { routineName: 'Push Day', completedOn: null },
    },
    {
      kind: 'start_focus_session',
      fields: { durationMinutes: 25 },
      expected: { durationMinutes: 25 },
    },
  ])('normalizes V2 $kind references and fields', ({ kind, fields, expected }) => {
    const result = normalizeRemoteParseResponse(
      {
        outcome: 'draft',
        kind,
        status: 'ready',
        confidence: 0.9,
        parserVersion: 'v2-test',
        warnings: [],
        missingFields: [],
        fields,
      },
      PARSE_INPUT_BASE,
    );

    expect(result).toMatchObject({
      outcome: 'draft',
      draft: {
        kind,
        parserKind: 'model_proxy',
        parserVersion: 'v2-test',
        fields: expected,
      },
    });
  });

  it.each([
    ['negative calories', 'log_calorie_entry', { foodName: 'Rice', calories: -1 }],
    ['invalid macro', 'log_calorie_entry', { foodName: 'Rice', calories: 200, protein: -1 }],
    [
      'invalid meal type',
      'log_calorie_entry',
      { foodName: 'Rice', calories: 200, mealType: 'brunch' },
    ],
    ['invalid date', 'log_habit', { habitName: 'Read', dateKey: '2026-13-40' }],
    ['oversized focus duration', 'start_focus_session', { durationMinutes: 121 }],
  ])('rejects %s from a remote V2 response', (_label, kind, fields) => {
    expect(() =>
      normalizeRemoteParseResponse(
        {
          outcome: 'draft',
          kind,
          status: 'ready',
          confidence: 0.9,
          warnings: [],
          missingFields: [],
          fields,
        },
        PARSE_INPUT_BASE,
      ),
    ).toThrow();
  });

  describe('planning kinds', () => {
    it.each([
      {
        kind: 'create_project',
        fields: { name: 'Apollo', color: 'blue', targetDate: '2026-05-01' },
        expected: { name: 'Apollo', color: 'blue', targetDate: '2026-05-01' },
      },
      {
        kind: 'update_goal_progress',
        fields: { goalTitle: 'Read more', percent: 50 },
        expected: { goalTitle: 'Read more', percent: 50 },
      },
      {
        kind: 'add_todo_to_daily_plan',
        fields: { todoTitle: 'Buy groceries', dateKey: null },
        expected: { todoTitle: 'Buy groceries', dateKey: null },
      },
    ])(
      'normalizes remote $kind drafts with model_proxy parser kind',
      ({ kind, fields, expected }) => {
        const result = normalizeRemoteParseResponse(
          {
            outcome: 'draft',
            kind,
            status: 'ready',
            confidence: 0.9,
            parserVersion: 'v2-test',
            warnings: [],
            missingFields: [],
            fields,
          },
          PARSE_INPUT_BASE,
        );

        expect(result).toMatchObject({
          outcome: 'draft',
          draft: {
            kind,
            parserKind: 'model_proxy',
            parserVersion: 'v2-test',
            fields: expected,
          },
        });
      },
    );

    it('clamps a remote out-of-range percent and keeps the percent_clamped warning', () => {
      const result = normalizeRemoteParseResponse(
        {
          outcome: 'draft',
          kind: 'update_goal_progress',
          status: 'ready',
          confidence: 0.9,
          parserVersion: 'v2-test',
          warnings: [],
          missingFields: [],
          fields: { goalTitle: 'Read more', percent: 150 },
        },
        PARSE_INPUT_BASE,
      );

      expect(result).toMatchObject({
        outcome: 'draft',
        draft: {
          fields: { goalTitle: 'Read more', percent: 100 },
          warnings: [
            { code: 'percent_clamped', message: 'Progress was clamped to the 0–100 range.' },
          ],
        },
      });
    });

    it('rejects an invalid project targetDate from a remote response', () => {
      expect(() =>
        normalizeRemoteParseResponse(
          {
            outcome: 'draft',
            kind: 'create_project',
            status: 'ready',
            confidence: 0.9,
            warnings: [],
            missingFields: [],
            fields: { name: 'Apollo', color: null, targetDate: '2026-13-40' },
          },
          PARSE_INPUT_BASE,
        ),
      ).toThrow(/targetDate must be a valid YYYY-MM-DD date or null/);
    });

    it('rejects an over-long planning name from a remote response', () => {
      expect(() =>
        normalizeRemoteParseResponse(
          {
            outcome: 'draft',
            kind: 'add_todo_to_daily_plan',
            status: 'ready',
            confidence: 0.9,
            warnings: [],
            missingFields: [],
            fields: { todoTitle: 'T'.repeat(81), dateKey: null },
          },
          PARSE_INPUT_BASE,
        ),
      ).toThrow(/todoTitle must be 80 characters or fewer/);
    });

    it('fails closed on an unknown future kind instead of mis-normalizing', () => {
      expect(() =>
        normalizeRemoteParseResponse(
          {
            outcome: 'draft',
            kind: 'archive_project',
            status: 'ready',
            confidence: 0.9,
            warnings: [],
            missingFields: [],
            fields: {},
          },
          PARSE_INPUT_BASE,
        ),
      ).toThrow('Model parser response kind is invalid.');
    });
  });
});
