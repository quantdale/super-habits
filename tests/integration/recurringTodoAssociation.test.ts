import { describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';
import { addLocalDays, toDateKey } from '@/lib/time';

/**
 * A recurring Todo's Project/Goal association must survive into its next
 * instance.
 *
 * The audited defect: `insertRecurringInstanceWithinTransaction` inserts
 * `(title, notes, priority, due_date, series identity)` only — it never copies
 * `project_id`/`goal_id`, and neither side of the recurrence machinery records
 * the association anywhere (the `todo_recurrence_series` template carries no
 * association columns). So the moment a linked daily todo is completed, the
 * next day's copy exists with NO Project and NO Goal, and the association is
 * unrecoverable: it is gone from the ONLY pending row of the series.
 *
 * User-visible consequences, all through ordinary use:
 *   - the Project reports `1/1 tasks done` (100 % progress) while tomorrow's
 *     copy is still pending, and its "Next up" candidates stop offering the
 *     recurring task;
 *   - the Goal's linked-todo rollup reaches 100 % and stays there for a goal
 *     whose task recurs forever;
 *   - `listTodosForGoal`/`listTodosForProject` no longer list the task.
 *
 * Pinned contract:
 *  1. Completing a linked daily todo spawns the successor with the same
 *     Project and Goal, so Project/Goal rollups keep counting the pending
 *     work (total 2, done 1 — not "100 % done").
 *  2. Rollover expansion of a series whose current instance carries an
 *     association produces a linked instance too.
 *  3. An association whose parent was deleted is NOT inherited, so the
 *     recurrence machinery can never mint a dangling reference (and a
 *     rollover never fails because a parent disappeared).
 */
describe('recurring instances keep their Project/Goal association', () => {
  let db: TestDatabase;

  async function linkedRecurringTodo() {
    const projects = await import('@/features/projects/projects.data');
    const goals = await import('@/features/goals/goals.data');
    const todos = await import('@/features/todos/todos.data');

    const projectId = await projects.addProject({ name: 'Recurring project' });
    const goalId = await goals.addGoal({ title: 'Recurring goal', projectId });
    const todoId = await todos.addTodo({
      title: 'Daily standup',
      goalId,
      recurrence: 'daily',
    });
    return { projects, goals, todos, projectId, goalId, todoId };
  }

  it('a completed linked daily todo spawns a successor with the same Project and Goal', async () => {
    db = await freshDatabase();
    const { todos, projectId, goalId, todoId } = await linkedRecurringTodo();

    await todos.completeTodo(todoId);

    const rows = await db.getAllAsync<{
      id: string;
      project_id: string | null;
      goal_id: string | null;
    }>(`SELECT id, project_id, goal_id FROM todos WHERE recurrence_spawned_by_id = ?`, [todoId]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ project_id: projectId, goal_id: goalId });
  }, 60000);

  it('the project and goal rollups keep counting the pending successor', async () => {
    db = await freshDatabase();
    const { projects, goals, todos, projectId, goalId, todoId } = await linkedRecurringTodo();

    await todos.completeTodo(todoId);

    // One done instance + one pending successor: the project must not read as
    // finished, and the goal must not read 100 % of its linked work.
    const projectRollup = await projects.getProjectRollup(projectId);
    expect(projectRollup.todos).toEqual({ total: 2, done: 1 });

    const goalRollup = await goals.getGoalRollup(goalId);
    expect(goalRollup.todos).toEqual({ total: 2, done: 1 });

    // The successor is still offered as real work under both parents.
    const projectTodos = await projects.listTodosForProject(projectId);
    expect(projectTodos.map((row) => row.completed)).toEqual([0, 1]);
    expect((await goals.listTodosForGoal(goalId)).map((row) => row.completed)).toEqual([0, 1]);
  }, 60000);

  it('rollover expansion inherits the association of the series current instance', async () => {
    db = await freshDatabase();
    const { todos, projectId, goalId, todoId } = await linkedRecurringTodo();

    const recurrenceId = (await db.getFirstAsync<{ recurrence_id: string }>(
      'SELECT recurrence_id FROM todos WHERE id = ?',
      [todoId],
    ))!.recurrence_id;

    // Day rollover creates tomorrow's instance from the series template
    // (TodosScreen.loadTodosOnFocus -> createRecurringInstances).
    const tomorrow = addLocalDays(toDateKey(), 1);
    await todos.createRecurringInstances([
      {
        title: 'Daily standup',
        notes: null,
        priority: 'normal',
        recurrenceId,
        dueDate: tomorrow,
      },
    ]);

    const created = await db.getAllAsync<{
      project_id: string | null;
      goal_id: string | null;
      due_date: string;
    }>('SELECT project_id, goal_id, due_date FROM todos WHERE recurrence_id = ?', [recurrenceId]);
    const tomorrowRow = created.find((row) => row.due_date === tomorrow);
    expect(tomorrowRow).toMatchObject({ project_id: projectId, goal_id: goalId });
  }, 60000);

  it('does not inherit a parent that was deleted, so no dangling reference is minted', async () => {
    db = await freshDatabase();
    const { projects, goals, todos, projectId, goalId, todoId } = await linkedRecurringTodo();

    // Both parents disappear after the series row was created. A live row
    // cannot be produced either way, and the spawn must not fail.
    await goals.softDeleteGoal(goalId);
    await projects.softDeleteProject(projectId);
    await todos.completeTodo(todoId);

    const rows = await db.getAllAsync<{ project_id: string | null; goal_id: string | null }>(
      `SELECT project_id, goal_id FROM todos WHERE recurrence_spawned_by_id = ?`,
      [todoId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ project_id: null, goal_id: null });
    // No child of any live parent references a tombstoned id.
    const dangling = await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM todos t
        WHERE t.deleted_at IS NULL
          AND (t.project_id IS NOT NULL OR t.goal_id IS NOT NULL)
          AND (
            (t.project_id IS NOT NULL AND NOT EXISTS (
              SELECT 1 FROM projects p WHERE p.id = t.project_id AND p.deleted_at IS NULL
            ))
            OR (t.goal_id IS NOT NULL AND NOT EXISTS (
              SELECT 1 FROM goals g WHERE g.id = t.goal_id AND g.deleted_at IS NULL
            ))
          )`,
    );
    expect(dangling?.n).toBe(0);
  }, 60000);
});
