/**
 * AUD-SH12-A/B/C and AUD-SH13-A — Project/Goal associations are authoritative.
 *
 * Audited defects:
 *
 * SH-12 (Medium): creation and update enforced DIFFERENT subsets of the
 * documented association contract. Real reproductions were: `addGoal` accepted a
 * `projectId` that did not exist; `addTodo` with a Goal in Project P persisted
 * `project_id = null`; moving that Todo's Project kept a Goal from the old
 * Project; and clearing a linked Habit's Project kept the Goal.
 *
 * SH-13 (Medium): the Todo creation dialog's Project/Goal choices updated the
 * form state but `addTodo` omitted both fields, so a new task persisted
 * null/null despite the selections. Edit mode passed them.
 *
 * These cases use real SQLite and the production data APIs.
 */

import { describe, expect, it, vi } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '1.0.0' } },
}));

type World = {
  projectP: string;
  projectP2: string;
  goalInP: string;
  goalNoProject: string;
};

/** Seed two projects and two goals (one Project-backed, one standalone). */
async function seedWorld(db: TestDatabase): Promise<World> {
  const projects = await import('@/features/projects/projects.data');
  const goals = await import('@/features/goals/goals.data');
  const projectP = await projects.addProject({ name: 'Project P' });
  const projectP2 = await projects.addProject({ name: 'Project P2' });
  const goalInP = await goals.addGoal({ title: 'Goal in P', projectId: projectP });
  const goalNoProject = await goals.addGoal({ title: 'Standalone goal' });
  return { projectP, projectP2, goalInP, goalNoProject };
}

async function outboxCount(db: TestDatabase, entity: string): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = ?',
    [entity],
  );
  return Number(row?.n ?? 0);
}

describe('AUD-SH12-A: every creation entrypoint refuses a dangling parent', () => {
  it('addTodo rejects a Goal that does not exist and writes nothing', async () => {
    const db = await freshDatabase();
    await seedWorld(db);
    const todos = await import('@/features/todos/todos.data');
    const before = await outboxCount(db, 'todos');

    await expect(todos.addTodo({ title: 'Dangling', goalId: 'goal_missing' })).rejects.toThrow(
      /Goal not found/i,
    );
    const rows = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM todos WHERE title = 'Dangling'",
    );
    expect(Number(rows?.n ?? -1)).toBe(0);
    expect(await outboxCount(db, 'todos')).toBe(before);
    await db.closeAsync();
  }, 60000);

  it('addTodo rejects a Project that does not exist', async () => {
    const db = await freshDatabase();
    await seedWorld(db);
    const todos = await import('@/features/todos/todos.data');
    await expect(todos.addTodo({ title: 'Dangling', projectId: 'proj_missing' })).rejects.toThrow(
      /Project not found/i,
    );
    await db.closeAsync();
  }, 60000);

  it('addGoal rejects a Project that does not exist', async () => {
    const db = await freshDatabase();
    await seedWorld(db);
    const goals = await import('@/features/goals/goals.data');
    const before = await outboxCount(db, 'goals');
    await expect(
      goals.addGoal({ title: 'Dangling goal', projectId: 'proj_missing' }),
    ).rejects.toThrow(/Project not found/i);
    const rows = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM goals WHERE title = 'Dangling goal'",
    );
    expect(Number(rows?.n ?? -1)).toBe(0);
    expect(await outboxCount(db, 'goals')).toBe(before);
    await db.closeAsync();
  }, 60000);

  it('a soft-deleted parent is refused exactly like a missing one', async () => {
    const db = await freshDatabase();
    const world = await seedWorld(db);
    const projects = await import('@/features/projects/projects.data');
    const goals = await import('@/features/goals/goals.data');
    await projects.softDeleteProject(world.projectP);
    await expect(
      goals.addGoal({ title: 'Into deleted project', projectId: world.projectP }),
    ).rejects.toThrow(/Project not found/i);
    await db.closeAsync();
  }, 60000);
});

describe('AUD-SH12-A: creation aligns a Project-backed Goal', () => {
  it('addTodo with a Project-backed Goal inherits its Project', async () => {
    const db = await freshDatabase();
    const world = await seedWorld(db);
    const todos = await import('@/features/todos/todos.data');

    const id = await todos.addTodo({ title: 'Aligned', goalId: world.goalInP });
    const row = await db.getFirstAsync<{ project_id: string | null; goal_id: string | null }>(
      'SELECT project_id, goal_id FROM todos WHERE id = ?',
      [id],
    );
    // The audited defect left project_id null here.
    expect(row?.project_id).toBe(world.projectP);
    expect(row?.goal_id).toBe(world.goalInP);
    await db.closeAsync();
  }, 60000);

  it('a Goal without a Project does not impose one', async () => {
    const db = await freshDatabase();
    const world = await seedWorld(db);
    const todos = await import('@/features/todos/todos.data');
    const id = await todos.addTodo({
      title: 'Independent',
      goalId: world.goalNoProject,
      projectId: world.projectP2,
    });
    const row = await db.getFirstAsync<{ project_id: string | null; goal_id: string | null }>(
      'SELECT project_id, goal_id FROM todos WHERE id = ?',
      [id],
    );
    expect(row?.project_id).toBe(world.projectP2);
    expect(row?.goal_id).toBe(world.goalNoProject);
    await db.closeAsync();
  }, 60000);

  it('the composed create applies the same alignment', async () => {
    const db = await freshDatabase();
    const world = await seedWorld(db);
    const todos = await import('@/features/todos/todos.data');
    const id = await todos.addTodoWithLinkedActionRules({
      title: 'Composed aligned',
      goalId: world.goalInP,
      rules: [],
    });
    const row = await db.getFirstAsync<{ project_id: string | null }>(
      'SELECT project_id FROM todos WHERE id = ?',
      [id],
    );
    expect(row?.project_id).toBe(world.projectP);
    await db.closeAsync();
  }, 60000);
});

describe('AUD-SH12-B: update paths keep the documented move/clear semantics', () => {
  it('moving a Todo to another Project clears the conflicting Goal', async () => {
    const db = await freshDatabase();
    const world = await seedWorld(db);
    const todos = await import('@/features/todos/todos.data');
    const id = await todos.addTodo({ title: 'Move me', goalId: world.goalInP });
    // The Goal pins Project P; moving to P2 must not leave the pair inconsistent.
    await todos.updateTodo(id, { projectId: world.projectP2 });
    const row = await db.getFirstAsync<{ project_id: string | null; goal_id: string | null }>(
      'SELECT project_id, goal_id FROM todos WHERE id = ?',
      [id],
    );
    expect(row?.project_id).toBe(world.projectP2);
    expect(row?.goal_id).toBeNull();
    await db.closeAsync();
  }, 60000);

  it('an explicit Goal selection in the same call is authoritative', async () => {
    const db = await freshDatabase();
    const world = await seedWorld(db);
    const todos = await import('@/features/todos/todos.data');
    const id = await todos.addTodo({ title: 'Explicit', projectId: world.projectP2 });
    await todos.updateTodo(id, { projectId: world.projectP2, goalId: world.goalInP });
    const row = await db.getFirstAsync<{ project_id: string | null; goal_id: string | null }>(
      'SELECT project_id, goal_id FROM todos WHERE id = ?',
      [id],
    );
    // The Goal belongs to P, so it aligns the Project.
    expect(row?.project_id).toBe(world.projectP);
    expect(row?.goal_id).toBe(world.goalInP);
    await db.closeAsync();
  }, 60000);

  it('clearing the Project clears a Project-backed Goal on a Habit too', async () => {
    const db = await freshDatabase();
    const world = await seedWorld(db);
    const habits = await import('@/features/habits/habits.data');
    const id = await habits.addHabit(
      'Linked habit',
      1,
      'anytime',
      undefined,
      undefined,
      undefined,
      null,
      world.projectP,
      world.goalInP,
    );
    await habits.setHabitProjectGoal(id, { projectId: null });
    const row = await db.getFirstAsync<{ project_id: string | null; goal_id: string | null }>(
      'SELECT project_id, goal_id FROM habits WHERE id = ?',
      [id],
    );
    expect(row?.project_id).toBeNull();
    expect(row?.goal_id).toBeNull();
    await db.closeAsync();
  }, 60000);
});

describe('AUD-SH13-A: the creation dialog sends its associations', () => {
  it('addTodo persists the selected Project and Goal', async () => {
    const db = await freshDatabase();
    const world = await seedWorld(db);
    const todos = await import('@/features/todos/todos.data');
    // Exactly what the dialog's payload now carries.
    const id = await todos.addTodo({
      title: 'Created with associations',
      projectId: world.projectP,
      goalId: world.goalNoProject,
    });
    const row = await db.getFirstAsync<{ project_id: string | null; goal_id: string | null }>(
      'SELECT project_id, goal_id FROM todos WHERE id = ?',
      [id],
    );
    expect(row?.project_id).toBe(world.projectP);
    expect(row?.goal_id).toBe(world.goalNoProject);
    await db.closeAsync();
  }, 60000);

  it('the screen payload includes both association fields', async () => {
    // Guard the exact audited omission: the create branch built a payload with
    // no projectId/goalId while the edit branch passed them.
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const source = readFileSync(
      path.resolve(__dirname, '..', '..', 'features/todos/TodosScreen.tsx'),
      'utf8',
    );
    // Bound the slice to the CREATE branch: from the payload declaration to the
    // recurring-source dispatch that consumes it.
    const branchStart = source.indexOf('const payload: {');
    const branchEnd = source.indexOf('if (isRecurringLinkedActionSource) {', branchStart);
    expect(branchStart).toBeGreaterThan(-1);
    expect(branchEnd).toBeGreaterThan(branchStart);
    const createBranch = source.slice(branchStart, branchEnd);
    expect(createBranch).toContain('projectId:');
    expect(createBranch).toContain('goalId:');
    expect(createBranch).toContain('editProjectId');
    expect(createBranch).toContain('editGoalId');
  });

  it('membership is visible from the list query after reload', async () => {
    const db = await freshDatabase();
    const world = await seedWorld(db);
    const todos = await import('@/features/todos/todos.data');
    const id = await todos.addTodo({
      title: 'Membership check',
      goalId: world.goalInP,
    });
    // Re-read through the production list API (a fresh query, i.e. a reload).
    const listed = (await todos.listTodos()).find((todo) => todo.id === id);
    expect(listed?.project_id).toBe(world.projectP);
    expect(listed?.goal_id).toBe(world.goalInP);
    await db.closeAsync();
  }, 60000);
});

describe('AUD-SH12-C: refusals leave no side effects', () => {
  it('a refused association change leaves child rows and outbox unchanged', async () => {
    const db = await freshDatabase();
    const world = await seedWorld(db);
    const todos = await import('@/features/todos/todos.data');
    const id = await todos.addTodo({ title: 'Stable', goalId: world.goalInP });
    const before = await db.getAllAsync<{ entity: string; id: string; operation: string }>(
      'SELECT entity, id, operation FROM sync_outbox ORDER BY entity, id',
    );

    await expect(todos.updateTodo(id, { goalId: 'goal_missing' })).rejects.toThrow(
      /Goal not found/i,
    );
    // Nothing changed: the row keeps its original pair and the outbox is intact.
    const row = await db.getFirstAsync<{ project_id: string | null; goal_id: string | null }>(
      'SELECT project_id, goal_id FROM todos WHERE id = ?',
      [id],
    );
    expect(row).toMatchObject({ project_id: world.projectP, goal_id: world.goalInP });
    const after = await db.getAllAsync<{ entity: string; id: string; operation: string }>(
      'SELECT entity, id, operation FROM sync_outbox ORDER BY entity, id',
    );
    expect(after).toEqual(before);
    await db.closeAsync();
  }, 60000);

  it('repeated identical mutations are idempotent', async () => {
    const db = await freshDatabase();
    const world = await seedWorld(db);
    const todos = await import('@/features/todos/todos.data');
    const id = await todos.addTodo({ title: 'Repeat', goalId: world.goalInP });
    const first = await db.getAllAsync<{ entity: string; id: string }>(
      'SELECT entity, id FROM sync_outbox ORDER BY entity, id',
    );
    await todos.updateTodo(id, { goalId: world.goalInP });
    await todos.updateTodo(id, { goalId: world.goalInP });
    const after = await db.getAllAsync<{ entity: string; id: string }>(
      'SELECT entity, id FROM sync_outbox ORDER BY entity, id',
    );
    // The outbox dedupes by (entity, id): no duplicate intents accumulate.
    expect(after).toEqual(first);
    await db.closeAsync();
  }, 60000);

  it('goal deletion keeps documented child behaviour without dangling references', async () => {
    const db = await freshDatabase();
    const world = await seedWorld(db);
    const todos = await import('@/features/todos/todos.data');
    const goals = await import('@/features/goals/goals.data');
    const id = await todos.addTodo({ title: 'Orphan candidate', goalId: world.goalInP });
    await goals.softDeleteGoal(world.goalInP);
    const row = await db.getFirstAsync<{ goal_id: string | null; deleted_at: string | null }>(
      'SELECT goal_id, deleted_at FROM todos WHERE id = ?',
      [id],
    );
    // The Todo survives; the goal id may remain as history but the goal row is
    // tombstoned, so no active reference dangles.
    expect(row?.deleted_at).toBeNull();
    const goal = await db.getFirstAsync<{ deleted_at: string | null }>(
      'SELECT deleted_at FROM goals WHERE id = ?',
      [world.goalInP],
    );
    expect(goal?.deleted_at).not.toBeNull();
    await db.closeAsync();
  }, 60000);
});

describe('AUD-SH12-A: Habit CREATION validates associations', () => {
  it('addHabit rejects a Goal that does not exist', async () => {
    const db = await freshDatabase();
    await seedWorld(db);
    const habits = await import('@/features/habits/habits.data');
    // The audited probe: `addHabit` wrote project_id/goal_id verbatim.
    await expect(
      habits.addHabit(
        'Dangling habit',
        1,
        'anytime',
        undefined,
        undefined,
        undefined,
        null,
        null,
        'goal_missing',
      ),
    ).rejects.toThrow(/Goal not found/i);
    const rows = await db.getFirstAsync<{ n: number }>(
      "SELECT COUNT(*) AS n FROM habits WHERE name = 'Dangling habit'",
    );
    expect(Number(rows?.n ?? -1)).toBe(0);
    await db.closeAsync();
  }, 60000);

  it('addHabit rejects a Project that does not exist', async () => {
    const db = await freshDatabase();
    await seedWorld(db);
    const habits = await import('@/features/habits/habits.data');
    await expect(
      habits.addHabit(
        'Dangling habit',
        1,
        'anytime',
        undefined,
        undefined,
        undefined,
        null,
        'proj_missing',
        null,
      ),
    ).rejects.toThrow(/Project not found/i);
    await db.closeAsync();
  }, 60000);

  it('addHabit aligns a Project-backed Goal instead of persisting project_id null', async () => {
    const db = await freshDatabase();
    const world = await seedWorld(db);
    const habits = await import('@/features/habits/habits.data');
    const id = await habits.addHabit(
      'Aligned habit',
      1,
      'anytime',
      undefined,
      undefined,
      undefined,
      null,
      null,
      world.goalInP,
    );
    const row = await db.getFirstAsync<{ project_id: string | null; goal_id: string | null }>(
      'SELECT project_id, goal_id FROM habits WHERE id = ?',
      [id],
    );
    expect(row?.project_id).toBe(world.projectP);
    expect(row?.goal_id).toBe(world.goalInP);
    await db.closeAsync();
  }, 60000);

  it('the composed habit create applies the same contract', async () => {
    const db = await freshDatabase();
    const world = await seedWorld(db);
    const habits = await import('@/features/habits/habits.data');
    await expect(
      habits.addHabitWithLinkedActionRules({
        name: 'Composed dangling',
        targetPerDay: 1,
        goalId: 'goal_missing',
        rules: [],
      }),
    ).rejects.toThrow(/Goal not found/i);
    const id = await habits.addHabitWithLinkedActionRules({
      name: 'Composed aligned',
      targetPerDay: 1,
      goalId: world.goalInP,
      rules: [],
    });
    const row = await db.getFirstAsync<{ project_id: string | null }>(
      'SELECT project_id FROM habits WHERE id = ?',
      [id],
    );
    expect(row?.project_id).toBe(world.projectP);
    await db.closeAsync();
  }, 60000);
});

describe('AUD-SH14-B: the Todo EDIT path is one composed operation', () => {
  it('a failing rule write rolls the row edit back (screen orchestration shape)', async () => {
    // The reviewer's finding: TodosScreen committed `updateTodo` FIRST and then
    // called the composed save, so a failing rule write left the title committed
    // with the old rules. This asserts the screen no longer contains that
    // two-step shape, and that the composed operation itself is atomic.
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const screen = readFileSync(
      path.resolve(__dirname, '..', '..', 'features/todos/TodosScreen.tsx'),
      'utf8',
    );
    const editBranchStart = screen.indexOf('if (editingId) {');
    // Bound to the create branch, which begins with the composed-create comment.
    const editBranchEnd = screen.indexOf(
      'AUD-SH14-A: the parent and its rules commit together',
      editBranchStart,
    );
    expect(editBranchEnd).toBeGreaterThan(editBranchStart);
    const editBranch = screen.slice(editBranchStart, editBranchEnd);
    // Exactly ONE row write in the branch, and it is the composed call for
    // non-recurring sources.
    const updateCalls = editBranch.match(/await updateTodo\(/g) ?? [];
    expect(updateCalls).toHaveLength(1);
    expect(editBranch).toContain('await updateTodoWithLinkedActionRules(');
    // The two writes are MUTUALLY EXCLUSIVE branches of the same `if`, not a
    // sequence: the audited defect was an unconditional `updateTodo` that ran
    // before the composed call, so the composed call could never describe the
    // already-committed edit.
    const recurringBranch = editBranch.indexOf('if (isRecurringLinkedActionSource) {');
    const composedCall = editBranch.indexOf('await updateTodoWithLinkedActionRules(');
    const plainCall = editBranch.indexOf('await updateTodo(');
    expect(recurringBranch).toBeGreaterThan(-1);
    expect(composedCall).toBeGreaterThan(recurringBranch);
    expect(plainCall).toBeGreaterThan(recurringBranch);
    // The plain call is INSIDE the recurring branch's else, i.e. after it.
    expect(plainCall).toBeGreaterThanOrEqual(recurringBranch);
  });

  it('a failing rule replacement leaves the title unchanged', async () => {
    const db = await freshDatabase();
    const world = await seedWorld(db);
    const habits = await import('@/features/habits/habits.data');
    const todos = await import('@/features/todos/todos.data');
    // A rule target that cannot be written (a trigger) exercises the real fault.
    await db.runAsync(
      `CREATE TRIGGER sh12_fail_rule_insert BEFORE INSERT ON linked_action_rules
       BEGIN SELECT RAISE(ABORT, 'simulated rule persistence failure'); END;`,
    );
    const id = await todos.addTodo({ title: 'Original', goalId: world.goalInP });
    await expect(
      todos.updateTodoWithLinkedActionRules(id, { title: 'Edited', projectId: world.projectP2 }, [
        {
          triggerType: 'todo.completed',
          target: {
            feature: 'habits',
            entityType: 'habit',
            entityId: habits === habits ? 'habit_target_seeded' : 'habit_target_seeded',
            effect: {
              kind: 'progress',
              type: 'habit.increment',
              amount: 1,
              dateStrategy: 'source_date',
            },
          },
        },
      ]),
    ).rejects.toBeInstanceOf(Error);
    const row = await db.getFirstAsync<{ title: string; project_id: string | null }>(
      'SELECT title, project_id FROM todos WHERE id = ?',
      [id],
    );
    // NEITHER the title NOR the association moved.
    expect(row?.title).toBe('Original');
    expect(row?.project_id).toBe(world.projectP);
    await db.closeAsync();
  }, 60000);
});
