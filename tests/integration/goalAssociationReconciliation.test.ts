import { beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * A Goal save must reconcile linked Todo/Habit Projects only when the Goal's
 * Project actually moves.
 *
 * The user-visible failure: `GoalDetailView` always submits `projectId` (the
 * stored value), so `updateGoal` ran its child reconciliation on EVERY save and
 * wrote `project_id = nextProjectId` onto every linked Todo and Habit
 * unconditionally. A Goal without a Project imposes no Project — the shared
 * association contract's rule 5, which is what lets a task be filed under
 * Project P while being linked to a standalone Goal (`associations.ts`,
 * `buildDayCompletions`-independent paths, `associationAuthority.test.ts`
 * "a Goal without a Project does not impose one"). Saving that Goal's title,
 * progress, or status therefore silently pulled every linked task and habit out
 * of Project P: the Project lost them from its "Next up" candidates, its
 * counts, and its progress rollup, without the user touching any task.
 *
 * Pinned contract:
 *  1. A save that does not move the Goal's Project leaves the linked children's
 *     Projects untouched (no row writes, no extra outbox intents).
 *  2. A Goal that moves to a concrete Project still aligns its children
 *     (`productivity-expansion-hardening` "Goal moves Projects").
 */
describe('goal save reconciles only a real Project move', () => {
  let db: TestDatabase;

  beforeEach(async () => {
    db = await freshDatabase();
  });

  async function childProjects(todoId: string, habitId: string) {
    return db.getFirstAsync<{ todo_project: string | null; habit_project: string | null }>(
      `SELECT (SELECT project_id FROM todos WHERE id = ?) AS todo_project,
              (SELECT project_id FROM habits WHERE id = ?) AS habit_project`,
      [todoId, habitId],
    );
  }

  it('keeps independently assigned child Projects when an unrelated Goal save repeats the stored projectId', async () => {
    const projects = await import('@/features/projects/projects.data');
    const goals = await import('@/features/goals/goals.data');
    const todos = await import('@/features/todos/todos.data');
    const habits = await import('@/features/habits/habits.data');

    const projectP = await projects.addProject({ name: 'Project P' });
    const standaloneGoal = await goals.addGoal({ title: 'Standalone goal' });

    // Rule 5: a Goal without a Project imposes none, so the explicitly chosen
    // Project survives the link.
    const todoId = await todos.addTodo({
      title: 'Filed under P',
      projectId: projectP,
      goalId: standaloneGoal,
    });
    const habitId = await habits.addHabit(
      'Filed under P',
      1,
      'anytime',
      undefined,
      undefined,
      undefined,
      null,
      projectP,
      standaloneGoal,
    );
    expect(await childProjects(todoId, habitId)).toEqual({
      todo_project: projectP,
      habit_project: projectP,
    });

    // Exactly what the editor submits on Save: its own fields, plus the Goal's
    // stored (null) projectId. The user never touched the children.
    await goals.updateGoal(standaloneGoal, {
      title: 'Renamed standalone goal',
      projectId: null,
    });

    expect(await childProjects(todoId, habitId)).toEqual({
      todo_project: projectP,
      habit_project: projectP,
    });
    // No child row churn and no child outbox intents (the ids below are only
    // the create intents the two linked children already carried).
    const intents = await db.getAllAsync<{ entity: string; id: string; operation: string }>(
      `SELECT entity, id, operation FROM sync_outbox WHERE entity IN ('todos','habits') ORDER BY entity, id`,
    );
    expect(intents).toEqual([
      { entity: 'habits', id: habitId, operation: 'create' },
      { entity: 'todos', id: todoId, operation: 'create' },
    ]);
  });

  it('still aligns linked children when the Goal moves to a concrete Project', async () => {
    const projects = await import('@/features/projects/projects.data');
    const goals = await import('@/features/goals/goals.data');
    const todos = await import('@/features/todos/todos.data');
    const habits = await import('@/features/habits/habits.data');

    const projectP = await projects.addProject({ name: 'Project P' });
    const standaloneGoal = await goals.addGoal({ title: 'Standalone goal' });
    const todoId = await todos.addTodo({
      title: 'Filed under P',
      projectId: projectP,
      goalId: standaloneGoal,
    });
    const habitId = await habits.addHabit(
      'Filed under P',
      1,
      'anytime',
      undefined,
      undefined,
      undefined,
      null,
      projectP,
      standaloneGoal,
    );

    await goals.updateGoal(standaloneGoal, { projectId: projectP });

    expect(await childProjects(todoId, habitId)).toEqual({
      todo_project: projectP,
      habit_project: projectP,
    });
  });
});
