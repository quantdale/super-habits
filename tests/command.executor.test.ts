import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_HABIT_COLOR, DEFAULT_HABIT_ICON } from '@/features/habits/habitPresets';
import type {
  DraftCompleteTodo,
  DraftCreateHabit,
  DraftCreateTodo,
  DraftLogCalorieEntry,
  DraftLogHabit,
  DraftLogWorkoutRoutine,
  DraftStartFocusSession,
} from '@/features/command/types';

import { executeDraftAction } from '@/features/command/command.executor';

const { addTodo, completeTodo, listTodos } = vi.hoisted(() => ({
  addTodo: vi.fn(),
  completeTodo: vi.fn(),
  listTodos: vi.fn(),
}));

const { addHabit, incrementHabit, listHabits } = vi.hoisted(() => ({
  addHabit: vi.fn(),
  incrementHabit: vi.fn(),
  listHabits: vi.fn(),
}));

const { addCalorieEntry } = vi.hoisted(() => ({
  addCalorieEntry: vi.fn(),
}));

const { completeRoutine, listRoutines } = vi.hoisted(() => ({
  completeRoutine: vi.fn(),
  listRoutines: vi.fn(),
}));

const { validateTodo, validateHabit } = vi.hoisted(() => ({
  validateTodo: vi.fn(),
  validateHabit: vi.fn(),
}));

vi.mock('@/features/todos/todos.data', () => ({
  addTodo,
  completeTodo,
  listTodos,
}));

vi.mock('@/features/habits/habits.data', () => ({
  addHabit,
  incrementHabit,
  listHabits,
}));

vi.mock('@/features/calories/calories.data', () => ({
  addCalorieEntry,
}));

vi.mock('@/features/workout/workout.data', () => ({
  completeRoutine,
  listRoutines,
}));

vi.mock('@/lib/validation', () => ({
  validateTodo,
  validateHabit,
}));

function buildTodoDraft(overrides: Partial<DraftCreateTodo['fields']> = {}): DraftCreateTodo {
  return {
    kind: 'create_todo',
    rawText: 'Add a todo to call mom tomorrow',
    parserKind: 'mock_rules',
    parserVersion: 'v1',
    confidence: 0.92,
    status: 'ready',
    warnings: [],
    missingFields: [],
    fields: {
      title: 'call mom',
      notes: null,
      dueDate: '2026-04-22',
      priority: 'normal',
      recurrence: null,
      ...overrides,
    },
  };
}

function buildHabitDraft(overrides: Partial<DraftCreateHabit['fields']> = {}): DraftCreateHabit {
  return {
    kind: 'create_habit',
    rawText: 'Create a habit to drink water every morning',
    parserKind: 'mock_rules',
    parserVersion: 'v1',
    confidence: 0.9,
    status: 'ready',
    warnings: [],
    missingFields: [],
    fields: {
      name: 'drink water',
      targetPerDay: 1,
      category: 'morning',
      icon: null,
      color: null,
      ...overrides,
    },
  };
}

describe('features/command/command.executor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addTodo.mockResolvedValue('todo_1');
    completeTodo.mockResolvedValue({
      completed: 1,
      linkedActions: { matchedRuleCount: 0, notices: [] },
    });
    listTodos.mockResolvedValue([
      { id: 'todo_1', title: 'Buy groceries', completed: 0, deleted_at: null },
    ]);
    addHabit.mockResolvedValue('habit_1');
    incrementHabit.mockResolvedValue({
      count: 1,
      linkedActions: { matchedRuleCount: 0, notices: [] },
    });
    listHabits.mockResolvedValue([
      {
        id: 'habit_1',
        name: 'Gym',
        target_per_day: 1,
        created_at: new Date().toISOString(),
        rule_history: '[]',
        deleted_at: null,
      },
    ]);
    addCalorieEntry.mockResolvedValue(undefined);
    completeRoutine.mockResolvedValue({ status: 'applied', reason: null, routineName: 'Push Day' });
    listRoutines.mockResolvedValue([{ id: 'routine_1', name: 'Push Day', deleted_at: null }]);
    validateTodo.mockReturnValue(null);
    validateHabit.mockReturnValue(null);
  });

  it('does not write anything before confirm executes the draft', () => {
    buildTodoDraft();
    buildHabitDraft();

    expect(addTodo).not.toHaveBeenCalled();
    expect(addHabit).not.toHaveBeenCalled();
  });

  it('maps create_todo through validateTodo and addTodo', async () => {
    const result = await executeDraftAction(buildTodoDraft());

    expect(validateTodo).toHaveBeenCalledWith('call mom', '', '2026-04-22');
    expect(addTodo).toHaveBeenCalledWith({
      title: 'call mom',
      notes: undefined,
      dueDate: '2026-04-22',
      priority: 'normal',
      recurrence: null,
    });
    expect(result).toEqual({
      outcome: 'success',
      kind: 'create_todo',
      entityId: 'todo_1',
      message: 'Todo saved.',
    });
  });

  it('uses edited todo values and normalizes empty notes/dueDate', async () => {
    await executeDraftAction(
      buildTodoDraft({
        title: '  call mom now  ',
        notes: '   ',
        dueDate: '',
        priority: 'urgent',
      }),
    );

    expect(validateTodo).toHaveBeenCalledWith('call mom now', '', null);
    expect(addTodo).toHaveBeenCalledWith({
      title: 'call mom now',
      notes: undefined,
      dueDate: null,
      priority: 'urgent',
      recurrence: null,
    });
  });

  it('maps create_habit through validateHabit and addHabit', async () => {
    const result = await executeDraftAction(buildHabitDraft());

    expect(validateHabit).toHaveBeenCalledWith('drink water', 1);
    expect(addHabit).toHaveBeenCalledWith(
      'drink water',
      1,
      'morning',
      DEFAULT_HABIT_ICON,
      DEFAULT_HABIT_COLOR,
    );
    expect(result).toEqual({
      outcome: 'success',
      kind: 'create_habit',
      entityId: 'habit_1',
      message: 'Habit saved.',
    });
  });

  it('uses edited habit values in validateHabit and addHabit', async () => {
    await executeDraftAction(
      buildHabitDraft({
        name: '  stretch  ',
        targetPerDay: 3,
        category: 'evening',
      }),
    );

    expect(validateHabit).toHaveBeenCalledWith('stretch', 3);
    expect(addHabit).toHaveBeenCalledWith(
      'stretch',
      3,
      'evening',
      DEFAULT_HABIT_ICON,
      DEFAULT_HABIT_COLOR,
    );
  });

  it('does not coerce invalid edited habit targets before validation', async () => {
    validateHabit.mockImplementation((name: string, targetPerDay: number) => {
      if (!name.trim()) return 'Habit name is required.';
      if (!Number.isInteger(targetPerDay) || targetPerDay < 1) {
        return 'Daily target must be at least 1.';
      }
      return null;
    });

    const result = await executeDraftAction(
      buildHabitDraft({
        targetPerDay: 0,
      }),
    );

    expect(validateHabit).toHaveBeenCalledWith('drink water', 0);
    expect(addHabit).not.toHaveBeenCalled();
    expect(result).toEqual({
      outcome: 'validation_error',
      message: 'Daily target must be at least 1.',
    });
  });

  it('blocks execution when validation fails', async () => {
    validateTodo.mockReturnValue('Task title is required.');

    const result = await executeDraftAction(buildTodoDraft({ title: '' }));

    expect(addTodo).not.toHaveBeenCalled();
    expect(result).toEqual({
      outcome: 'validation_error',
      message: 'Task title is required.',
    });
  });

  it('completes one Todo through the canonical path and rejects a double confirm', async () => {
    const draft: DraftCompleteTodo = {
      kind: 'complete_todo',
      rawText: 'complete Buy groceries',
      parserKind: 'mock_rules',
      parserVersion: 'v2',
      confidence: 0.9,
      status: 'ready',
      warnings: [],
      missingFields: [],
      fields: { todoTitle: 'Buy groceries' },
    };
    const first = await executeDraftAction(draft, {
      executionToken: 'cmd_complete_once',
      resolvedEntityId: 'todo_1',
    });
    const duplicate = await executeDraftAction(draft, {
      executionToken: 'cmd_complete_once',
      resolvedEntityId: 'todo_1',
    });

    expect(first).toMatchObject({ outcome: 'success', kind: 'complete_todo' });
    expect(duplicate).toMatchObject({ outcome: 'duplicate' });
    expect(completeTodo).toHaveBeenCalledTimes(1);
  });

  it('executes habit, calorie, and workout V2 actions through canonical functions', async () => {
    const habitDraft: DraftLogHabit = {
      kind: 'log_habit',
      rawText: 'add one to Gym',
      parserKind: 'mock_rules',
      parserVersion: 'v2',
      confidence: 0.9,
      status: 'ready',
      warnings: [],
      missingFields: [],
      fields: { habitName: 'Gym', dateKey: null },
    };
    const calorieDraft: DraftLogCalorieEntry = {
      kind: 'log_calorie_entry',
      rawText: 'log eggs 140 calories',
      parserKind: 'mock_rules',
      parserVersion: 'v2',
      confidence: 0.9,
      status: 'ready',
      warnings: [],
      missingFields: [],
      fields: {
        foodName: 'eggs',
        calories: 140,
        protein: null,
        carbs: null,
        fats: null,
        fiber: null,
        mealType: 'breakfast',
        consumedOn: null,
      },
    };
    const workoutDraft: DraftLogWorkoutRoutine = {
      kind: 'log_workout_routine',
      rawText: 'log Push Day workout',
      parserKind: 'mock_rules',
      parserVersion: 'v2',
      confidence: 0.9,
      status: 'ready',
      warnings: [],
      missingFields: [],
      fields: { routineName: 'Push Day', completedOn: null },
    };

    expect(await executeDraftAction(habitDraft, { resolvedEntityId: 'habit_1' })).toMatchObject({
      outcome: 'success',
      kind: 'log_habit',
    });
    expect(await executeDraftAction(calorieDraft)).toMatchObject({
      outcome: 'success',
      kind: 'log_calorie_entry',
    });
    expect(await executeDraftAction(workoutDraft, { resolvedEntityId: 'routine_1' })).toMatchObject(
      {
        outcome: 'success',
        kind: 'log_workout_routine',
      },
    );
    expect(incrementHabit).toHaveBeenCalledWith('habit_1', expect.any(String));
    expect(addCalorieEntry).toHaveBeenCalledWith(
      expect.objectContaining({ foodName: 'eggs', calories: 140, protein: undefined }),
    );
    expect(completeRoutine).toHaveBeenCalledWith('routine_1');
  });

  it('does not create a workout log when the routine disappears after review', async () => {
    completeRoutine.mockResolvedValueOnce({
      status: 'skipped',
      reason: 'target_missing',
      routineName: null,
    });
    const draft: DraftLogWorkoutRoutine = {
      kind: 'log_workout_routine',
      rawText: 'log Push Day workout',
      parserKind: 'mock_rules',
      parserVersion: 'v2',
      confidence: 0.9,
      status: 'ready',
      warnings: [],
      missingFields: [],
      fields: { routineName: 'Push Day', completedOn: null },
    };

    await expect(
      executeDraftAction(draft, { resolvedEntityId: 'routine_1' }),
    ).resolves.toMatchObject({ outcome: 'validation_error' });
  });

  it('protects focus start with the canonical timer callback and conflict result', async () => {
    const draft: DraftStartFocusSession = {
      kind: 'start_focus_session',
      rawText: 'start a 25 minute focus session',
      parserKind: 'mock_rules',
      parserVersion: 'v2',
      confidence: 0.9,
      status: 'ready',
      warnings: [],
      missingFields: [],
      fields: { durationMinutes: 25 },
    };
    const callback = vi.fn().mockResolvedValue({
      outcome: 'conflict',
      message: 'A focus session is already running.',
    });

    const result = await executeDraftAction(draft, { startFocusSession: callback });
    expect(result).toMatchObject({ outcome: 'conflict' });
    expect(callback).toHaveBeenCalledWith(25);
  });
});
