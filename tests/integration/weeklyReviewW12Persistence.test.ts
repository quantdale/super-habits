import { describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from './helpers/db';

/**
 * W12 (tasks 7.3) — real-SQLite oracles for the review-persistence path the
 * rebuilt Weekly Review screen depends on.
 *
 * The W12 screen reduces steps and moves statistics into a disclosure, but the
 * durable contract it drives is unchanged: `executeWeeklyReview` writes exactly
 * one `weekly_reviews` row per week and one coalesced outbox intent, and a
 * rejected write must leave neither a row nor an intent (so the surface can
 * honestly report failure instead of a false success).
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

describe('W12 review persistence oracles (real SQLite)', () => {
  it('writes exactly one review row and one coalesced create intent', async () => {
    const db: TestDatabase = await freshDatabase();
    const { executeWeeklyReview } = await import('@/features/weekly-review/weeklyReview.executor');
    expect(db).toBeTruthy();

    const result = await executeWeeklyReview({
      summary: makeSummary(),
      draft: {
        weekKey: WEEK.weekKey,
        todoDecisions: [],
        priorities: [{ id: 'p1', text: 'Protect deep work' }],
        newCommitments: [],
        reflection: 'W12 oracle',
      },
    });
    expect(result.reviewId).toBeTruthy();

    const rows = await db.getAllAsync<{ status: string; reflection: string; plan_payload: string }>(
      `SELECT status, reflection, plan_payload FROM weekly_reviews WHERE deleted_at IS NULL`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('completed');
    expect(rows[0].reflection).toBe('W12 oracle');
    // The plan payload persists the priority the Plan step collected.
    expect(JSON.parse(rows[0].plan_payload).priorities).toEqual([
      { id: 'p1', text: 'Protect deep work' },
    ]);

    const intents = await db.getAllAsync<{ operation: string; entity: string }>(
      `SELECT operation, entity FROM sync_outbox WHERE entity = 'weekly_reviews'`,
    );
    expect(intents).toEqual([{ operation: 'create', entity: 'weekly_reviews' }]);
  });

  it('a rejected review INSERT leaves no row and no outbox intent', async () => {
    const db: TestDatabase = await freshDatabase();
    await db.execAsync(`
      CREATE TRIGGER w12_reject_review_insert
      BEFORE INSERT ON weekly_reviews
      BEGIN SELECT RAISE(ABORT, 'review-write-blocked'); END;
    `);
    const { executeWeeklyReview } = await import('@/features/weekly-review/weeklyReview.executor');

    await expect(
      executeWeeklyReview({
        summary: makeSummary(),
        draft: {
          weekKey: WEEK.weekKey,
          todoDecisions: [],
          priorities: [{ id: 'p1', text: 'Rejected' }],
          newCommitments: [],
          reflection: '',
        },
      }),
    ).rejects.toThrow(/review-write-blocked/);

    expect(await db.getAllAsync(`SELECT id FROM weekly_reviews`)).toHaveLength(0);
    expect(
      await db.getAllAsync(`SELECT id FROM sync_outbox WHERE entity = 'weekly_reviews'`),
    ).toHaveLength(0);
  });

  it('re-saving the same week updates in place rather than duplicating the row', async () => {
    const db: TestDatabase = await freshDatabase();
    const { executeWeeklyReview } = await import('@/features/weekly-review/weeklyReview.executor');
    const base = {
      weekKey: WEEK.weekKey,
      todoDecisions: [],
      priorities: [{ id: 'p1', text: 'First' }],
      newCommitments: [],
      reflection: 'first',
    };
    const first = await executeWeeklyReview({ summary: makeSummary(), draft: { ...base } });
    const second = await executeWeeklyReview({
      summary: makeSummary(),
      draft: { ...base, reflection: 'second' },
    });

    expect(second.reviewId).toBe(first.reviewId);
    const rows = await db.getAllAsync<{ reflection: string }>(
      `SELECT reflection FROM weekly_reviews WHERE deleted_at IS NULL`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].reflection).toBe('second');
    // The coalesced outbox intent is the latest mutation, not two rows.
    const intents = await db.getAllAsync<{ operation: string }>(
      `SELECT operation FROM sync_outbox WHERE entity = 'weekly_reviews'`,
    );
    expect(intents).toHaveLength(1);
    expect(intents[0].operation).toBe('update');
  });
});
