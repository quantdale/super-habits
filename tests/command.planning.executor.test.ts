import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DraftAddTodoToDailyPlan,
  DraftCreateProject,
  DraftUpdateGoalProgress,
} from '@/features/command/types';

import { executeDraftAction } from '@/features/command/command.executor';

const { listTodos } = vi.hoisted(() => ({
  listTodos: vi.fn(),
}));

const { addProject } = vi.hoisted(() => ({
  addProject: vi.fn(),
}));

const { listGoals, setGoalProgress } = vi.hoisted(() => ({
  listGoals: vi.fn(),
  setGoalProgress: vi.fn(),
}));

const { getDailyPlan, setDailyPlanTopTodos } = vi.hoisted(() => ({
  getDailyPlan: vi.fn(),
  setDailyPlanTopTodos: vi.fn(),
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

vi.mock('@/features/todos/todos.data', () => ({
  addTodo: vi.fn(),
  completeTodo: vi.fn(),
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
  validateTodo: vi.fn(() => null),
  validateHabit: vi.fn(() => null),
}));

vi.mock('@/features/projects/projects.data', () => ({
  addProject,
}));

vi.mock('@/features/goals/goals.data', () => ({
  listGoals,
  setGoalProgress,
}));

vi.mock('@/features/daily-plan/dailyPlan.data', () => ({
  getDailyPlan,
  setDailyPlanTopTodos,
}));

function buildProjectDraft(
  overrides: Partial<DraftCreateProject['fields']> = {},
): DraftCreateProject {
  return {
    kind: 'create_project',
    rawText: 'Create project Apollo',
    parserKind: 'mock_rules',
    parserVersion: 'v2',
    confidence: 0.9,
    status: 'ready',
    warnings: [],
    missingFields: [],
    fields: { name: 'Apollo', color: null, targetDate: null, ...overrides },
  };
}

function buildGoalDraft(
  overrides: Partial<DraftUpdateGoalProgress['fields']> = {},
): DraftUpdateGoalProgress {
  return {
    kind: 'update_goal_progress',
    rawText: 'set goal Read more to 50%',
    parserKind: 'mock_rules',
    parserVersion: 'v2',
    confidence: 0.9,
    status: 'ready',
    warnings: [],
    missingFields: [],
    fields: { goalTitle: 'Read more', percent: 50, ...overrides },
  };
}

function buildPlanDraft(
  overrides: Partial<DraftAddTodoToDailyPlan['fields']> = {},
): DraftAddTodoToDailyPlan {
  return {
    kind: 'add_todo_to_daily_plan',
    rawText: 'add Buy groceries to my plan today',
    parserKind: 'mock_rules',
    parserVersion: 'v2',
    confidence: 0.9,
    status: 'ready',
    warnings: [],
    missingFields: [],
    fields: { todoTitle: 'Buy groceries', dateKey: null, ...overrides },
  };
}

describe('features/command/command.executor (planning kinds)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    addProject.mockResolvedValue('proj_1');
    setGoalProgress.mockResolvedValue(undefined);
    setDailyPlanTopTodos.mockResolvedValue({});
    listGoals.mockResolvedValue([
      {
        id: 'goal_1',
        title: 'Read more',
        progress_percent: 10,
        status: 'active',
        deleted_at: null,
      },
    ]);
    listTodos.mockResolvedValue([
      { id: 'todo_1', title: 'Buy groceries', completed: 0, deleted_at: null },
    ]);
    getDailyPlan.mockResolvedValue(null);
  });

  it('creates a project with mapped color hex and target date', async () => {
    const result = await executeDraftAction(
      buildProjectDraft({ color: 'blue', targetDate: '2026-05-01' }),
    );

    expect(result.outcome).toBe('success');
    if (result.outcome === 'success') expect(result.entityId).toBe('proj_1');
    expect(addProject).toHaveBeenCalledWith({
      name: 'Apollo',
      color: '#3B82F6',
      targetDate: '2026-05-01',
    });
  });

  it('returns validation_error when the project name is blank', async () => {
    const result = await executeDraftAction(buildProjectDraft({ name: '   ' }));
    expect(result.outcome).toBe('validation_error');
    expect(addProject).not.toHaveBeenCalled();
  });

  it('updates goal progress by resolved title', async () => {
    const result = await executeDraftAction(buildGoalDraft({ percent: 75 }));

    expect(result.outcome).toBe('success');
    expect(setGoalProgress).toHaveBeenCalledWith('goal_1', 75);
  });

  it('rejects out-of-range percents before any write', async () => {
    const result = await executeDraftAction(buildGoalDraft({ percent: 250 }));

    expect(result.outcome).toBe('validation_error');
    expect(setGoalProgress).not.toHaveBeenCalled();
  });

  it('fails goal resolution when the title does not match', async () => {
    listGoals.mockResolvedValue([
      { id: 'goal_1', title: 'Something else', progress_percent: 0, deleted_at: null },
    ]);
    const result = await executeDraftAction(buildGoalDraft());
    expect(result.outcome).toBe('validation_error');
    expect(setGoalProgress).not.toHaveBeenCalled();
  });

  it('appends the todo to an empty daily plan', async () => {
    const result = await executeDraftAction(buildPlanDraft());

    expect(result.outcome).toBe('success');
    expect(setDailyPlanTopTodos).toHaveBeenCalledWith(expect.any(String), ['todo_1']);
  });

  it('reports duplicate when the todo is already on the plan', async () => {
    getDailyPlan.mockResolvedValue({ id: 'dplan_1', top_todo_ids: JSON.stringify(['todo_1']) });
    const result = await executeDraftAction(buildPlanDraft());
    expect(result.outcome).toBe('duplicate');
    expect(setDailyPlanTopTodos).not.toHaveBeenCalled();
  });

  it('rejects additions when the plan already has three top priorities', async () => {
    getDailyPlan.mockResolvedValue({
      id: 'dplan_1',
      top_todo_ids: JSON.stringify(['a', 'b', 'c']),
    });
    const result = await executeDraftAction(buildPlanDraft());
    expect(result.outcome).toBe('validation_error');
    expect(setDailyPlanTopTodos).not.toHaveBeenCalled();
  });

  it('rejects unresolved todo titles', async () => {
    listTodos.mockResolvedValue([]);
    const result = await executeDraftAction(buildPlanDraft());
    expect(result.outcome).toBe('validation_error');
  });
});
