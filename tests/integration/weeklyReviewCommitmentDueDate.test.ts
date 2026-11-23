import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';
import type { WeeklyReviewDraft } from '@/features/weekly-review/weeklyReview.types';

/**
 * A commitment's Due field starts empty and the row reads "Due <next Monday>".
 * Typing a date and then clearing it leaves `dueDate: ''`, which the executor's
 * `??` fallback did not catch: the Todo was written with `due_date = ''` — a
 * value no other writer produces (`NULL` means "no due date") — instead of the
 * next-week start the row promised.
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

describe('weekly review commitment due date', () => {
  let db: TestDatabase;
  beforeEach(async () => {
    db = await freshDatabase();
  });
  afterEach(async () => {
    await db.closeAsync();
  });

  it('a cleared Due field falls back to the next-week start the row displays', async () => {
    const executor = await import('@/features/weekly-review/weeklyReview.executor');
    const draft: WeeklyReviewDraft = {
      weekKey: WEEK.weekKey,
      todoDecisions: [],
      priorities: [{ id: 'p1', text: 'Protect focus' }],
      newCommitments: [{ id: 'c1', title: 'Plan the sprint', dueDate: '', priority: 'normal' }],
      reflection: '',
    };

    const result = await executor.executeWeeklyReview({ summary: makeSummary(), draft });

    expect(result.commitmentOutcomes).toMatchObject([{ status: 'created' }]);
    expect(
      await db.getFirstAsync('SELECT due_date FROM todos WHERE id = ?', [result.createdTodoIds[0]]),
    ).toEqual({ due_date: WEEK.nextWeekStartDateKey });
  });
});
