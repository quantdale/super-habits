import { describe, expect, it } from 'vitest';
import type { TestDatabase } from './helpers/db';
import { freshDatabase } from './helpers/db';

/**
 * Planning-area integration coverage against a REAL better-sqlite3 database:
 *
 *   - Project/goal rollup assembly functions (audit F8 / task 11.1): bounded
 *     aggregate SQL asserted end-to-end through the unmodified data layers.
 *   - F1: every projects/goals/daily_plans mutation now lands an owner-scoped
 *     outbox row in the same transaction (plus reconciled-child records).
 *   - F6/F7: daily-plan upsert reads existence in-transaction and
 *     carry-forward merges inside the write transaction.
 *
 * Each test opens a fresh database via `freshDatabase()` and dynamically
 * imports data layers afterwards (module registry is reset per test).
 */

const TODAY = (() => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
})();

function shiftKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

async function outboxRows(db: TestDatabase) {
  return db.getAllAsync<{ entity: string; id: string; operation: string }>(
    'SELECT entity, id, operation FROM sync_outbox ORDER BY rowid',
  );
}

describe('project rollups (F8 / task 11.1)', () => {
  it('getProjectRollup aggregates linked todos, goals, and habit completions', async () => {
    await freshDatabase();
    const projects = await import('@/features/projects/projects.data');
    const goals = await import('@/features/goals/goals.data');
    const todos = await import('@/features/todos/todos.data');
    const habits = await import('@/features/habits/habits.data');

    const projectId = await projects.addProject({ name: 'Home renovation' });
    const otherId = await projects.addProject({ name: 'Unrelated' });

    await goals.addGoal({ title: 'Kitchen', projectId, progressPercent: 40 });
    await goals.addGoal({ title: 'Bathroom', projectId, progressPercent: 80 });
    await goals.addGoal({ title: 'Elsewhere' });

    const t1 = await todos.addTodo({ title: 'Order tiles', projectId });
    await todos.addTodo({ title: 'Paint walls', projectId });
    await todos.addTodo({ title: 'Other project todo', projectId: otherId });
    await todos.completeTodo(t1);

    const habitId = await habits.addHabit('Site check-in', 1);
    await habits.setHabitProjectGoal(habitId, { projectId });
    await habits.incrementHabit(habitId, TODAY);
    // Outside the 30-day window — must not count.
    await habits.incrementHabit(habitId, shiftKey(TODAY, -40));

    const rollup = await projects.getProjectRollup(projectId);
    expect(rollup.todos).toEqual({ total: 2, done: 1 });
    expect(rollup.goals.count).toBe(2);
    expect(rollup.goals.averageProgressPercent).toBeCloseTo(60, 0);
    expect(rollup.habits.habitCount).toBe(1);
    expect(rollup.habits.recentCompletions).toBe(1);
    expect(rollup.habits.windowDays).toBe(30);
  });

  it('listProjectRollups covers every project without N+1 and skips unlinked rows', async () => {
    await freshDatabase();
    const projects = await import('@/features/projects/projects.data');
    const todos = await import('@/features/todos/todos.data');

    const p1 = await projects.addProject({ name: 'A' });
    const p2 = await projects.addProject({ name: 'B' });
    await todos.addTodo({ title: 'a1', projectId: p1 });
    await todos.addTodo({ title: 'b1', projectId: p2 });
    await todos.addTodo({ title: 'unlinked' });

    const rollups = await projects.listProjectRollups();
    expect(Object.keys(rollups).sort()).toEqual([p1, p2].sort());
    expect(rollups[p1].todos.total).toBe(1);
    expect(rollups[p2].todos.total).toBe(1);
  });
});

describe('goal rollups (F8 / task 11.1)', () => {
  it('getGoalRollup bounds habit completions by the horizon window', async () => {
    const db = await freshDatabase();
    const goals = await import('@/features/goals/goals.data');
    const todos = await import('@/features/todos/todos.data');
    const habits = await import('@/features/habits/habits.data');

    const weekGoal = await goals.addGoal({ title: 'Weekly goal', horizon: 'week' });
    const yearGoal = await goals.addGoal({ title: 'Yearly goal', horizon: 'year' });

    const t1 = await todos.addTodo({ title: 'g1 task', goalId: weekGoal });
    await todos.completeTodo(t1);
    await todos.addTodo({ title: 'g2 task', goalId: weekGoal });

    const habitId = await habits.addHabit('Journal', 1);
    // Backdate the seed habit so the lifecycle write gate accepts the
    // historical completions this test writes through incrementHabit.
    const { createHabitRule } = await import('@/features/habits/habits.domain');
    await db.runAsync('UPDATE habits SET created_at = ?, rule_history = ? WHERE id = ?', [
      new Date(`${shiftKey(TODAY, -30)}T12:00:00`).toISOString(),
      JSON.stringify([createHabitRule(shiftKey(TODAY, -30), [1, 2, 3, 4, 5, 6, 7], 1)]),
      habitId,
    ]);
    await habits.setHabitProjectGoal(habitId, { goalId: yearGoal });
    await habits.incrementHabit(habitId, shiftKey(TODAY, -3)); // inside both windows
    await habits.incrementHabit(habitId, shiftKey(TODAY, -10)); // outside week, inside year

    const weekRollup = await goals.getGoalRollup(weekGoal);
    expect(weekRollup.todos).toEqual({ total: 2, done: 1 });
    expect(weekRollup.habits.windowDays).toBe(7);
    expect(weekRollup.habits.completionsInWindow).toBe(0); // habit belongs to the other goal

    const yearRollup = await goals.getGoalRollup(yearGoal);
    expect(yearRollup.todos.total).toBe(0);
    expect(yearRollup.habits.windowDays).toBe(365);
    expect(yearRollup.habits.completionsInWindow).toBe(2);
    expect(yearRollup.habits.habitCount).toBe(1);
  });

  it('listHabitsForGoal returns only non-deleted linked habits', async () => {
    await freshDatabase();
    const goals = await import('@/features/goals/goals.data');
    const habits = await import('@/features/habits/habits.data');

    const goalId = await goals.addGoal({ title: 'G' });
    const h1 = await habits.addHabit('Keep', 1);
    const h2 = await habits.addHabit('Drop', 1);
    await habits.setHabitProjectGoal(h1, { goalId });
    await habits.setHabitProjectGoal(h2, { goalId });
    await habits.deleteHabit(h2);

    const linked = await goals.listHabitsForGoal(goalId);
    expect(linked.map((h) => h.name)).toEqual(['Keep']);
  });
});

describe('F1 — planning mutations enqueue owner-scoped outbox records', () => {
  it('project create/update/reorder/delete each land outbox rows; delete also enqueues cleared children', async () => {
    const db = await freshDatabase();
    const projects = await import('@/features/projects/projects.data');
    const goals = await import('@/features/goals/goals.data');
    const todos = await import('@/features/todos/todos.data');
    const habits = await import('@/features/habits/habits.data');

    // The durable outbox coalesces to ONE row per (entity, id): later records
    // overwrite earlier ones once their revision wins. Each stage below asserts
    // the row exists and carries the latest operation.
    const projectId = await projects.addProject({ name: 'P' });
    const projectRows = async () =>
      (await outboxRows(db)).filter((r) => r.entity === 'projects' && r.id === projectId);
    expect(await projectRows()).toEqual([
      { entity: 'projects', id: projectId, operation: 'create' },
    ]);

    const goalId = await goals.addGoal({ title: 'G', projectId });
    const todoId = await todos.addTodo({ title: 'T', projectId });
    const habitId = await habits.addHabit('H', 1);
    await habits.setHabitProjectGoal(habitId, { projectId });

    await projects.updateProject(projectId, { name: 'P2' });
    expect((await projectRows()).map((r) => r.operation)).toEqual(['update']);

    await projects.reorderProjects([projectId]);
    expect((await projectRows()).map((r) => r.operation)).toEqual(['update']);

    await projects.softDeleteProject(projectId);
    expect((await projectRows()).map((r) => r.operation)).toEqual(['delete']);

    // Child reconciliation: the surviving Goal keeps only a cleared project_id
    // (H9 — no tombstone), and cleared-child updates ride the same
    // transaction's outbox.
    const rows = await outboxRows(db);
    expect(rows.find((r) => r.entity === 'goals' && r.id === goalId)?.operation).toBe('update');
    expect(rows.find((r) => r.entity === 'todos' && r.id === todoId)?.operation).toBe('update');
    expect(rows.find((r) => r.entity === 'habits' && r.id === habitId)?.operation).toBe('update');
  });

  it('goal create/update/delete enqueue; delete reconciles children into the outbox', async () => {
    const db = await freshDatabase();
    const goals = await import('@/features/goals/goals.data');
    const todos = await import('@/features/todos/todos.data');

    const goalId = await goals.addGoal({ title: 'G' });
    const goalRows = async () =>
      (await outboxRows(db)).filter((r) => r.entity === 'goals' && r.id === goalId);
    expect(await goalRows()).toEqual([{ entity: 'goals', id: goalId, operation: 'create' }]);

    const todoId = await todos.addTodo({ title: 'T', goalId });

    await goals.updateGoal(goalId, { status: 'completed' });
    expect((await goalRows()).map((r) => r.operation)).toEqual(['update']);

    await goals.softDeleteGoal(goalId);
    expect((await goalRows()).map((r) => r.operation)).toEqual(['delete']);
    // Clearing goal_id on delete must enqueue the linked child's row.
    const rows = await outboxRows(db);
    expect(rows.find((r) => r.entity === 'todos' && r.id === todoId)?.operation).toBe('update');
  });

  it('daily plan upsert/complete/delete enqueue create/update/delete', async () => {
    const db = await freshDatabase();
    const plans = await import('@/features/daily-plan/dailyPlan.data');

    const planRows = async () => (await outboxRows(db)).filter((r) => r.entity === 'daily_plans');

    await plans.upsertDailyPlan(TODAY, { intention: 'focus' });
    expect((await planRows()).map((r) => r.operation)).toEqual(['create']);

    await plans.upsertDailyPlan(TODAY, { intention: 'refocused' });
    expect((await planRows()).map((r) => r.operation)).toEqual(['update']);

    await plans.completeDailyPlan(TODAY);
    expect((await planRows()).map((r) => r.operation)).toEqual(['update']);

    const plan = await plans.getDailyPlan(TODAY);
    await plans.softDeleteDailyPlan(plan!.id);
    expect((await planRows()).map((r) => r.operation)).toEqual(['delete']);
  });
});

describe('F6/F7 — daily-plan transactional writes', () => {
  it('completed_at is set on entering completed and cleared on leaving (stable fact)', async () => {
    await freshDatabase();
    const plans = await import('@/features/daily-plan/dailyPlan.data');

    await plans.upsertDailyPlan(TODAY, {});
    expect((await plans.getDailyPlan(TODAY))?.completed_at).toBeNull();

    await plans.completeDailyPlan(TODAY, { reflection: 'done' });
    const completed = await plans.getDailyPlan(TODAY);
    expect(completed?.status).toBe('completed');
    expect(completed?.completed_at).not.toBeNull();

    await plans.upsertDailyPlan(TODAY, { status: 'draft' });
    const reopened = await plans.getDailyPlan(TODAY);
    expect(reopened?.status).toBe('draft');
    expect(reopened?.completed_at).toBeNull();
  });

  it('carryForwardFromPreviousDay merges inside the write transaction and is idempotent', async () => {
    const db = await freshDatabase();
    const plans = await import('@/features/daily-plan/dailyPlan.data');
    const todos = await import('@/features/todos/todos.data');

    const yesterday = shiftKey(TODAY, -1);
    const keep = await todos.addTodo({ title: 'still open' });
    const done = await todos.addTodo({ title: 'finished yesterday' });
    await todos.completeTodo(done);

    await plans.upsertDailyPlan(yesterday, { topTodoIds: [keep, done] });
    await plans.upsertDailyPlan(TODAY, {});

    const first = await plans.carryForwardFromPreviousDay(TODAY);
    expect(first?.top_todo_ids ? JSON.parse(first.top_todo_ids) : []).toEqual([keep]);

    // Second run adds nothing new (idempotent).
    const second = await plans.carryForwardFromPreviousDay(TODAY);
    expect(second?.top_todo_ids ? JSON.parse(second.top_todo_ids) : []).toEqual([keep]);

    // Outbox got exactly one update for today's plan across both runs — the
    // second run found zero candidates and wrote nothing.
    const rows = (await outboxRows(db)).filter((r) => r.entity === 'daily_plans');
    expect(rows.filter((r) => r.operation === 'update')).toHaveLength(1);
  });
});
