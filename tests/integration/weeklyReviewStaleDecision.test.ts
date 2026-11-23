import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';
import type { WeeklyReviewDraft } from '@/features/weekly-review/weeklyReview.types';

/**
 * The review captures its carry-forward candidates when the summary loads.
 * The user can finish (or delete) one of those tasks elsewhere before pressing
 * Confirm — from a notification action, another tab, or a re-confirm of an
 * already-saved week. A reschedule / carry-forward decision must then leave the
 * finished task alone: rewriting the due date of a COMPLETED task moves its
 * history to next week, and reporting a deleted task as rescheduled is a false
 * receipt. `applyNextWeekPlanSuggestions` already rechecks eligibility
 * (weeklyReviewStaleCompletion.test.ts); the decision loop must too.
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

function draftWith(decisions: WeeklyReviewDraft['todoDecisions']): WeeklyReviewDraft {
  return {
    weekKey: WEEK.weekKey,
    todoDecisions: decisions,
    priorities: [{ id: 'p1', text: 'Protect focus' }],
    newCommitments: [],
    reflection: '',
  };
}

describe('weekly review decisions recheck the task is still unfinished', () => {
  let db: TestDatabase;
  beforeEach(async () => {
    db = await freshDatabase();
  });
  afterEach(async () => {
    await db.closeAsync();
  });

  it.each(['carry_forward', 'reschedule'] as const)(
    'a %s decision leaves a task completed during the review untouched',
    async (action) => {
      const todos = await import('@/features/todos/todos.data');
      const executor = await import('@/features/weekly-review/weeklyReview.executor');
      const finished = await todos.addTodo({ title: 'Finished meanwhile', dueDate: '2026-08-19' });
      const live = await todos.addTodo({ title: 'Still open', dueDate: '2026-08-19' });
      await todos.completeTodo(finished);
      const before = await db.getFirstAsync<{ updated_at: string }>(
        'SELECT updated_at FROM todos WHERE id = ?',
        [finished],
      );
      const outboxBefore = await db.getAllAsync(
        "SELECT revision, operation FROM sync_outbox WHERE entity = 'todos' AND id = ?",
        [finished],
      );

      const result = await executor.executeWeeklyReview({
        summary: makeSummary(),
        draft: draftWith([
          { todoId: finished, action, dueDate: '2026-08-25' },
          { todoId: live, action, dueDate: '2026-08-25' },
        ]),
      });

      expect(result.rescheduledTodoIds).toEqual([live]);
      expect(
        await db.getFirstAsync('SELECT due_date, completed, updated_at FROM todos WHERE id = ?', [
          finished,
        ]),
      ).toEqual({ due_date: '2026-08-19', completed: 1, updated_at: before!.updated_at });
      expect(await db.getFirstAsync('SELECT due_date FROM todos WHERE id = ?', [live])).toEqual({
        due_date: '2026-08-25',
      });
      expect(
        await db.getAllAsync(
          "SELECT revision, operation FROM sync_outbox WHERE entity = 'todos' AND id = ?",
          [finished],
        ),
      ).toEqual(outboxBefore);
    },
  );

  it('a decision for a task deleted during the review is not reported as rescheduled', async () => {
    const todos = await import('@/features/todos/todos.data');
    const executor = await import('@/features/weekly-review/weeklyReview.executor');
    const gone = await todos.addTodo({ title: 'Deleted meanwhile', dueDate: '2026-08-19' });
    await todos.removeTodo(gone);

    const result = await executor.executeWeeklyReview({
      summary: makeSummary(),
      draft: draftWith([{ todoId: gone, action: 'carry_forward' }]),
    });

    expect(result.rescheduledTodoIds).toEqual([]);
  });
});
