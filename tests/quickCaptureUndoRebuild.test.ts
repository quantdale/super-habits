import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Undo-closure rebuild for the persisted recent-capture list.
 *
 * The contract under test: a rehydrated undo resolves the EXACT row the capture
 * created. Before `addCalorieEntry` returned the row id, undo re-read today's
 * newest-first list and deleted the first row matching food name, calories and
 * meal type — so undoing the older of two identical captures deleted the newer
 * one and left the row the user asked to remove. A record that carries no
 * identity (persisted by an older build) reports an explicit no-op instead of
 * guessing.
 *
 * The calorie data layer is mocked so these assertions stay about resolution,
 * not about SQL; the real-SQLite behaviour is pinned in
 * `tests/integration/quickCaptureCalorieUndo.test.ts`.
 */
const deleteCalorieEntry = vi.fn().mockResolvedValue(undefined);
const removeTodo = vi.fn().mockResolvedValue(undefined);
const deleteHabit = vi.fn().mockResolvedValue(undefined);
const softDeleteProject = vi.fn().mockResolvedValue(undefined);
const softDeleteGoal = vi.fn().mockResolvedValue(undefined);

vi.mock('@/features/calories/calories.data', () => ({
  addCalorieEntry: vi.fn(),
  deleteCalorieEntry: (...args: unknown[]) => deleteCalorieEntry(...args),
}));
vi.mock('@/features/todos/todos.data', () => ({
  addTodo: vi.fn(),
  removeTodo: (...args: unknown[]) => removeTodo(...args),
}));
vi.mock('@/features/habits/habits.data', () => ({
  addHabit: vi.fn(),
  deleteHabit: (...args: unknown[]) => deleteHabit(...args),
}));
vi.mock('@/features/projects/projects.data', () => ({
  addProject: vi.fn(),
  listProjects: vi.fn(),
  softDeleteProject: (...args: unknown[]) => softDeleteProject(...args),
}));
vi.mock('@/features/goals/goals.data', () => ({
  addGoal: vi.fn(),
  listGoals: vi.fn(),
  softDeleteGoal: (...args: unknown[]) => softDeleteGoal(...args),
}));

const { LEGACY_CAPTURE_UNDO_MESSAGE, rebuildRecentCapture } =
  await import('@/features/quick-capture/rebuildRecentCapture');

describe('rebuildRecentCapture — identity-based undo', () => {
  beforeEach(() => {
    // Call history only: the resolved-value implementations stay in place.
    vi.clearAllMocks();
  });

  it('resolves a calorie undo to exactly the captured row', async () => {
    const capture = rebuildRecentCapture({
      key: 'calorie:cal_first_1',
      label: 'Chicken rice · 250 kcal',
      calorieEntryId: 'cal_first',
    });
    expect(capture).not.toBeNull();

    await capture!.undo();
    expect(deleteCalorieEntry).toHaveBeenCalledWith('cal_first');
    expect(deleteCalorieEntry).toHaveBeenCalledTimes(1);
  });

  it('keeps a legacy record restorable but reports a no-op undo instead of guessing', async () => {
    const legacy = rebuildRecentCapture({
      key: 'calorie:1755000000000_1',
      label: 'Chicken rice · 250 kcal',
      calorieRef: { foodName: 'Chicken rice', calories: 250, mealType: 'lunch' },
    });
    expect(legacy).not.toBeNull();

    await expect(legacy!.undo()).rejects.toThrow(LEGACY_CAPTURE_UNDO_MESSAGE);
    // The critical part: no row was deleted on a guess.
    expect(deleteCalorieEntry).not.toHaveBeenCalled();
  });

  it('rebuilds the other destinations from their key', async () => {
    const todo = rebuildRecentCapture({ key: 'todo:todo_1', label: 'Task · Buy milk' });
    const habit = rebuildRecentCapture({ key: 'habit:habit_1', label: 'Habit · Read' });
    const project = rebuildRecentCapture({ key: 'project:proj_1', label: 'Project · Home' });
    const goal = rebuildRecentCapture({ key: 'goal:goal_1', label: 'Goal · Fitness' });

    await todo!.undo();
    await habit!.undo();
    await project!.undo();
    await goal!.undo();

    expect(removeTodo).toHaveBeenCalledWith('todo_1');
    expect(deleteHabit).toHaveBeenCalledWith('habit_1');
    expect(softDeleteProject).toHaveBeenCalledWith('proj_1');
    expect(softDeleteGoal).toHaveBeenCalledWith('goal_1');
  });

  it('returns null for an unknown kind or a malformed key', () => {
    expect(rebuildRecentCapture({ key: 'mystery:x', label: 'Unknown' })).toBeNull();
    expect(rebuildRecentCapture({ key: 'noseparator', label: 'Malformed' })).toBeNull();
  });
});
