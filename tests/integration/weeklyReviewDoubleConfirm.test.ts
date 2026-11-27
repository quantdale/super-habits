import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';
import type {
  WeeklyReviewDraft,
  WeeklyReviewSummaryV1,
} from '@/features/weekly-review/weeklyReview.types';

/**
 * A weekly review can be confirmed twice from one screen: a double tap on
 * `Confirm & Save` lands two activations before React re-renders the disabled
 * button, and the done step's `Retry failed commitments` press can overlap the
 * run it is retrying.
 *
 * (A second browser tab is not part of this window: web holds one origin-wide
 * OPFS write lock and the app refuses to open a second connection — see
 * `core/storage/dbOwnership.ts`.)
 *
 * The executor's receipt model resolves previously created commitments from
 * (a) the in-memory draft or (b) the PRIOR review row's `plan_payload` — both
 * of which only exist once the first run has committed. Two runs that overlap
 * therefore both read "no receipt yet" and both create every commitment, so
 * the user's week ends up with duplicate Todos whose `due_date` is the next
 * week's start. The review row itself is idempotent by `week_key`, which makes
 * the duplication easy to miss: one review, two identical tasks.
 *
 * Real SQLite, no mocks: two executions are started in the same tick and
 * allowed to interleave through the canonical data-layer transactions.
 */

const WEEK = {
  weekKey: '2026-08-17',
  startDateKey: '2026-08-17',
  endDateKey: '2026-08-23',
  nextWeekStartDateKey: '2026-08-24',
  nextWeekEndDateKey: '2026-08-30',
};

function makeSummary(): WeeklyReviewSummaryV1 {
  return {
    version: 1,
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

/** A fresh draft per activation — the screen rebuilds it on every confirm. */
function makeDraft(): WeeklyReviewDraft {
  return {
    weekKey: WEEK.weekKey,
    todoDecisions: [],
    priorities: [{ id: 'p1', text: 'Protect deep work' }],
    newCommitments: [
      { id: 'c1', title: 'Plan the sprint', priority: 'normal' },
      { id: 'c2', title: 'Book the dentist', priority: 'normal' },
    ],
    reflection: 'Two activations of the same confirm.',
  };
}

describe('weekly review double confirmation (real SQLite)', () => {
  let db: TestDatabase;
  beforeEach(async () => {
    db = await freshDatabase();
  });
  afterEach(async () => {
    await db.closeAsync();
  });

  it('two overlapping confirms of the same week create each commitment exactly once', async () => {
    const executor = await import('@/features/weekly-review/weeklyReview.executor');

    const results = await Promise.all([
      executor.executeWeeklyReview({ summary: makeSummary(), draft: makeDraft() }),
      executor.executeWeeklyReview({ summary: makeSummary(), draft: makeDraft() }),
    ]);

    // One review row per week (already true), and one Todo per commitment.
    const todos = await db.getAllAsync<{ title: string; due_date: string | null }>(
      `SELECT title, due_date FROM todos WHERE deleted_at IS NULL ORDER BY title`,
    );
    expect(todos).toEqual([
      { title: 'Book the dentist', due_date: WEEK.nextWeekStartDateKey },
      { title: 'Plan the sprint', due_date: WEEK.nextWeekStartDateKey },
    ]);

    // Both activations must report the same review, and the second must
    // recognise the first's receipts instead of claiming fresh creations.
    expect(results[0].reviewId).toBe(results[1].reviewId);
    const created = results.flatMap((result) => result.createdTodoIds);
    expect(new Set(created).size).toBe(2);
    expect(results[1].commitmentOutcomes.map((outcome) => outcome.status)).toEqual([
      'already_exists',
      'already_exists',
    ]);
    expect(results[1].createdTodoIds).toEqual([]);

    // One coalesced durable intent per Todo (no duplicate outbox rows).
    const intents = await db.getAllAsync<{ id: string }>(
      `SELECT id FROM sync_outbox WHERE entity = 'todos'`,
    );
    expect(intents).toHaveLength(2);
  });
});
