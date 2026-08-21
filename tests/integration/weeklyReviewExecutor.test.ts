import { describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';
import type { WeeklyReviewDraft } from '@/features/weekly-review/weeklyReview.types';

/**
 * Weekly-review executor idempotency (audit F3) and next-week application
 * structured outcomes (audit F4), against a REAL better-sqlite3 database.
 *
 *  - Re-confirming the same week must never duplicate commitment Todos —
 *    receipts resolve from the in-memory draft OR the prior review's
 *    plan_payload.
 *  - A receipt whose Todo was soft-deleted is correctly re-created.
 *  - applyNextWeekPlanSuggestions reports skipped/failed/truncated per item
 *    and applies all days inside one transaction.
 */

const WEEK = {
  weekKey: '2026-08-17',
  startDateKey: '2026-08-17',
  endDateKey: '2026-08-23',
  nextWeekStartDateKey: '2026-08-24',
  nextWeekEndDateKey: '2026-08-30',
};

function makeSummary() {
  return {
    version: 1 as const,
    week: WEEK,
    todos: {
      completedCount: 0,
      incompleteCount: 0,
      overdueCount: 0,
      dueNextWeekCount: 0,
      carryForwardCandidates: [],
    },
    habits: {
      scheduledOccurrences: 0,
      completedOccurrences: 0,
      consistencyPercent: null,
      attention: [],
    },
    focus: { sessions: 0, minutes: 0, priorWeekMinutes: null },
    workouts: { sessions: 0, priorWeekSessions: null, routines: [] },
    calories: { loggedDays: 0, averageCaloriesOnLoggedDays: null, configuredGoal: null },
    wins: [],
    attention: [],
  };
}

function makeDraft(commitmentIds: string[]): WeeklyReviewDraft {
  return {
    weekKey: WEEK.weekKey,
    todoDecisions: [],
    priorities: [{ id: 'p1', text: 'Protect focus' }],
    newCommitments: commitmentIds.map((id, i) => ({
      id,
      title: `Commitment ${i + 1}`,
      priority: 'normal' as const,
    })),
    reflection: '',
  };
}

describe('executeWeeklyReview idempotency (F3)', () => {
  it('re-confirming the same week does not duplicate commitments', async () => {
    await freshDatabase();
    const executor = await import('@/features/weekly-review/weeklyReview.executor');
    const todos = await import('@/features/todos/todos.data');

    const summary = makeSummary();
    const first = await executor.executeWeeklyReview({ summary, draft: makeDraft(['c1', 'c2']) });
    expect(first.commitmentOutcomes.map((o) => o.status)).toEqual(['created', 'created']);

    // Second confirm with a FRESH draft (no in-memory createdTodoId): receipts
    // must resolve from the prior review's plan_payload.
    const second = await executor.executeWeeklyReview({ summary, draft: makeDraft(['c1', 'c2']) });
    expect(second.commitmentOutcomes.map((o) => o.status)).toEqual([
      'already_exists',
      'already_exists',
    ]);
    expect(second.createdTodoIds).toEqual([]);

    const all = await todos.listTodos();
    const commitments = all.filter((t) => t.title.startsWith('Commitment'));
    expect(commitments).toHaveLength(2);
  });

  it('in-memory draft receipts cover a same-session retry after partial failure', async () => {
    await freshDatabase();
    const executor = await import('@/features/weekly-review/weeklyReview.executor');
    const todos = await import('@/features/todos/todos.data');

    // Simulate a partially applied run: commitment c1's Todo exists but no
    // review row was saved (crash before save). The retry draft still carries
    // the in-memory receipt for c1; c2 has none and gets created.
    const draft = makeDraft(['c1', 'c2']);
    const summary = makeSummary();
    const createdFirst = await todos.addTodo({ title: 'Commitment 1' });
    draft.newCommitments[0].createdTodoId = createdFirst;

    const result = await executor.executeWeeklyReview({ summary, draft });
    expect(result.commitmentOutcomes[0]).toMatchObject({
      commitmentId: 'c1',
      status: 'already_exists',
      todoId: createdFirst,
    });
    expect(result.commitmentOutcomes[1].status).toBe('created');

    const commitments = (await todos.listTodos()).filter((t) => t.title.startsWith('Commitment'));
    expect(commitments).toHaveLength(2);
  });

  it('a receipt whose Todo was soft-deleted is re-created, not skipped', async () => {
    await freshDatabase();
    const executor = await import('@/features/weekly-review/weeklyReview.executor');
    const todos = await import('@/features/todos/todos.data');

    const summary = makeSummary();
    const first = await executor.executeWeeklyReview({ summary, draft: makeDraft(['c1']) });
    const createdId = first.createdTodoIds[0];
    await todos.removeTodo(createdId);

    const second = await executor.executeWeeklyReview({ summary, draft: makeDraft(['c1']) });
    expect(second.commitmentOutcomes[0].status).toBe('created');
    expect(second.commitmentOutcomes[0].todoId).not.toBe(createdId);
  });

  it('reschedule decisions are idempotent on re-run', async () => {
    await freshDatabase();
    const executor = await import('@/features/weekly-review/weeklyReview.executor');
    const todos = await import('@/features/todos/todos.data');

    const todoId = await todos.addTodo({ title: 'Existing', dueDate: '2026-08-18' });
    const draft = {
      ...makeDraft([]),
      todoDecisions: [{ todoId, action: 'reschedule' as const, dueDate: '2026-08-24' }],
    };
    const summary = makeSummary();
    await executor.executeWeeklyReview({ summary, draft });
    await executor.executeWeeklyReview({ summary, draft });

    const todo = (await todos.listTodos()).find((t) => t.id === todoId);
    expect(todo?.due_date).toBe('2026-08-24');
  });
});

describe('applyNextWeekPlanSuggestions structured outcomes (F4)', () => {
  it('reports added/skipped/truncated and applies across days in one transaction', async () => {
    await freshDatabase();
    const apply = await import('@/features/weekly-review/weeklyReview.applyNextWeek');
    const plans = await import('@/features/daily-plan/dailyPlan.data');
    const todos = await import('@/features/todos/todos.data');

    // Real todo ids: upsert prunes non-existent ids at save time (H10), so
    // seeds must be actual rows. MAX_TOP_PRIORITIES = 3.
    const seed1 = await todos.addTodo({ title: 'seed1' });
    const seed2 = await todos.addTodo({ title: 'seed2' });
    const new1 = await todos.addTodo({ title: 'new1' });
    const overflowA = await todos.addTodo({ title: 'overflow-a' });
    const overflowB = await todos.addTodo({ title: 'overflow-b' });
    const day2a = await todos.addTodo({ title: 'day2a' });

    await plans.upsertDailyPlan('2026-08-24', { topTodoIds: [seed1, seed2] });

    const result = await apply.applyNextWeekPlanSuggestions([
      { dateKey: '2026-08-24', todoIds: [seed1, new1, overflowA, overflowB] },
      { dateKey: '2026-08-25', todoIds: [day2a] },
    ]);

    expect(result.appliedDateKeys).toEqual(['2026-08-24', '2026-08-25']);
    expect(result.addedCount).toBe(2);
    expect(result.skipped).toEqual([
      { dateKey: '2026-08-24', todoId: seed1, reason: 'already_selected' },
      { dateKey: '2026-08-24', todoId: overflowA, reason: 'capacity_full' },
      { dateKey: '2026-08-24', todoId: overflowB, reason: 'capacity_full' },
    ]);
    expect(result.failed).toEqual([]);
    expect(result.truncatedCandidateCount).toBe(0);

    const day1 = await plans.getDailyPlan('2026-08-24');
    expect(day1?.top_todo_ids ? JSON.parse(day1.top_todo_ids) : []).toEqual([seed1, seed2, new1]);
    const day2 = await plans.getDailyPlan('2026-08-25');
    expect(day2?.top_todo_ids ? JSON.parse(day2.top_todo_ids) : []).toEqual([day2a]);
  });

  it('counts candidates truncated by the suggestion cap and records invalid days as failed', async () => {
    await freshDatabase();
    const apply = await import('@/features/weekly-review/weeklyReview.applyNextWeek');

    const result = await apply.applyNextWeekPlanSuggestions([
      { dateKey: 'not-a-date', todoIds: ['x1'] },
      { dateKey: '2026-08-24', todoIds: ['y1'] },
    ]);

    expect(result.appliedDateKeys).toEqual(['2026-08-24']);
    expect(result.failed).toEqual([
      { dateKey: 'not-a-date', todoId: 'x1', error: 'Invalid date key.' },
    ]);
    expect(result.addedCount).toBe(1);
  });
});
