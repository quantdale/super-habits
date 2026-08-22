import type * as SQLite from 'expo-sqlite';
import { getDatabase } from '@/core/db/client';
import { runBackupMutation } from '@/core/sync/syncedMutation';
import { createId } from '@/lib/id';
import { isValidDateKey, nowIso } from '@/lib/time';
import { upsertDailyPlanInTx } from '@/features/daily-plan/dailyPlan.data';
import { parseTopTodoIds } from '@/features/daily-plan/dailyPlan.domain';
import { MAX_TOP_PRIORITIES } from '@/features/daily-plan/dailyPlan.types';
import type { NextWeekPlanSuggestion } from './weeklyReview.domain';
import type { WeeklyReview } from './weeklyReview.types';

/** List recent completed reviews, newest first. */
export async function listWeeklyReviews(limit = 20): Promise<WeeklyReview[]> {
  const db = await getDatabase();
  return db.getAllAsync<WeeklyReview>(
    `SELECT * FROM weekly_reviews WHERE deleted_at IS NULL ORDER BY week_start_date DESC LIMIT ?`,
    [limit],
  );
}

/** Get a review by its canonical week key. */
export async function getWeeklyReviewByWeekKey(weekKey: string): Promise<WeeklyReview | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<WeeklyReview>(
    `SELECT * FROM weekly_reviews WHERE week_key = ? AND deleted_at IS NULL`,
    [weekKey],
  );
  return row ?? null;
}

/** Get a review by ID. */
export async function getWeeklyReviewById(id: string): Promise<WeeklyReview | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<WeeklyReview>(
    `SELECT * FROM weekly_reviews WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );
  return row ?? null;
}

/**
 * Save (create or update) a completed weekly review.
 * Idempotent by week_key — updates if one already exists for that week.
 * The sync intent is created through the runBackupMutation boundary so the
 * outbox row lands in the SAME transaction as the review row and carries the
 * durable dataset owner (a bare enqueue would write an unowned intent that
 * backfill could never rebind).
 */
export async function saveWeeklyReview(input: {
  weekKey: string;
  weekStartDate: string;
  weekEndDate: string;
  nextWeekStartDate: string;
  summaryPayload: string;
  planPayload: string;
  reflection: string;
}): Promise<string> {
  const db = await getDatabase();
  const now = nowIso();

  const outcome = await runBackupMutation<string>({
    db,
    mutate: async (transactionDb, enqueue) => {
      const existing = await transactionDb.getFirstAsync<{ id: string }>(
        `SELECT id FROM weekly_reviews WHERE week_key = ? AND deleted_at IS NULL`,
        [input.weekKey],
      );

      if (existing) {
        await transactionDb.runAsync(
          `UPDATE weekly_reviews
             SET summary_payload = ?, plan_payload = ?, reflection = ?,
                 completed_at = ?, status = 'completed', updated_at = ?
           WHERE id = ? AND deleted_at IS NULL`,
          [input.summaryPayload, input.planPayload, input.reflection, now, now, existing.id],
        );
        enqueue({
          entity: 'weekly_reviews',
          id: existing.id,
          updatedAt: now,
          operation: 'update',
        });
        return { value: existing.id, changed: true };
      }

      const id = createId('wrev');
      await transactionDb.runAsync(
        `INSERT INTO weekly_reviews
           (id, week_key, week_start_date, week_end_date, next_week_start_date,
            completed_at, status, summary_payload, plan_payload, reflection,
            created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, NULL)`,
        [
          id,
          input.weekKey,
          input.weekStartDate,
          input.weekEndDate,
          input.nextWeekStartDate,
          now,
          input.summaryPayload,
          input.planPayload,
          input.reflection,
          now,
          now,
        ],
      );
      enqueue({
        entity: 'weekly_reviews',
        id,
        updatedAt: now,
        operation: 'create',
      });
      return { value: id, changed: true };
    },
  });
  return outcome.value;
}

/** Soft-delete a review (future use). */
export async function deleteWeeklyReview(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  await runBackupMutation<void>({
    db,
    mutate: async (transactionDb, enqueue) => {
      await transactionDb.runAsync(
        `UPDATE weekly_reviews SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
        [now, now, id],
      );
      enqueue({
        entity: 'weekly_reviews',
        id,
        updatedAt: now,
        operation: 'delete',
      });
      return { value: undefined, changed: true };
    },
  });
}

/** Check if a review exists for a given week. */
export async function hasWeeklyReviewForWeek(weekKey: string): Promise<boolean> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM weekly_reviews WHERE week_key = ? AND deleted_at IS NULL`,
    [weekKey],
  );
  return (row?.count ?? 0) > 0;
}

/**
 * Apply remote weekly reviews (for restore/portable import). Inert — no side
 * effects. Takes the caller's database connection so restore can run it on the
 * import transaction.
 */
export async function applyRemoteWeeklyReviews(
  db: SQLite.SQLiteDatabase,
  reviews: WeeklyReview[],
): Promise<void> {
  for (const review of reviews) {
    await db.runAsync(
      `INSERT OR REPLACE INTO weekly_reviews
         (id, week_key, week_start_date, week_end_date, next_week_start_date,
          completed_at, status, summary_payload, plan_payload, reflection,
          created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        review.id,
        review.week_key,
        review.week_start_date,
        review.week_end_date,
        review.next_week_start_date,
        review.completed_at,
        review.status,
        review.summary_payload,
        review.plan_payload,
        review.reflection,
        review.created_at,
        review.updated_at,
        review.deleted_at,
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Next-week plan application (moved here from weeklyReview.applyNextWeek.ts:
// it touches SQLite directly; that module is now a pure re-export barrel).
// ---------------------------------------------------------------------------

export type ApplyNextWeekSkippedReason = 'already_selected' | 'capacity_full';

export type ApplyNextWeekSkipped = {
  dateKey: string;
  todoId: string;
  reason: ApplyNextWeekSkippedReason;
};

export type ApplyNextWeekFailed = {
  dateKey: string;
  todoId: string;
  error: string;
};

export type ApplyNextWeekSuggestionsResult = {
  /** Date keys whose plans were updated. */
  appliedDateKeys: string[];
  /** Total todo ids actually added (deduped against existing selections). */
  addedCount: number;
  /** Ids not added, with the reason (already selected or day capacity full). */
  skipped: ApplyNextWeekSkipped[];
  /** Ids that could not be applied at all (e.g. invalid date key). */
  failed: ApplyNextWeekFailed[];
  /**
   * Candidates dropped by buildNextWeekPlanSuggestions' 3/day × 7-day cap —
   * they were never scheduled and need manual placement.
   */
  truncatedCandidateCount: number;
};

export async function applyNextWeekPlanSuggestions(
  suggestions: NextWeekPlanSuggestion[],
): Promise<ApplyNextWeekSuggestionsResult> {
  // Candidates beyond the suggestion cap never appear in `suggestions`; report
  // them so the UI can tell the user how many were left out.
  const uniqueCandidateCount = new Set(suggestions.flatMap((s) => s.todoIds)).size;
  const scheduledCandidateCount = suggestions.reduce((sum, s) => sum + s.todoIds.length, 0);
  const truncatedCandidateCount = Math.max(0, uniqueCandidateCount - scheduledCandidateCount);

  const appliedDateKeys: string[] = [];
  const skipped: ApplyNextWeekSkipped[] = [];
  const failed: ApplyNextWeekFailed[] = [];
  let addedCount = 0;

  const db = await getDatabase();
  await runBackupMutation<void>({
    db,
    mutate: async (transactionDb, enqueue) => {
      for (const suggestion of suggestions) {
        if (suggestion.todoIds.length === 0) continue;

        if (!isValidDateKey(suggestion.dateKey)) {
          for (const todoId of suggestion.todoIds) {
            failed.push({ dateKey: suggestion.dateKey, todoId, error: 'Invalid date key.' });
          }
          continue;
        }

        // In-transaction read of current selections: all days share one
        // transaction, so every merge sees transactionally consistent state.
        const existing = await transactionDb.getFirstAsync<{ top_todo_ids: string | null }>(
          `SELECT top_todo_ids FROM daily_plans WHERE date_key = ? AND deleted_at IS NULL`,
          [suggestion.dateKey],
        );
        const merged = [...parseTopTodoIds(existing?.top_todo_ids ?? '[]')];
        let dayChanged = false;
        for (const todoId of suggestion.todoIds) {
          if (merged.includes(todoId)) {
            skipped.push({ dateKey: suggestion.dateKey, todoId, reason: 'already_selected' });
            continue;
          }
          if (merged.length >= MAX_TOP_PRIORITIES) {
            skipped.push({ dateKey: suggestion.dateKey, todoId, reason: 'capacity_full' });
            continue;
          }
          merged.push(todoId);
          addedCount++;
          dayChanged = true;
        }
        if (!dayChanged) continue;
        await upsertDailyPlanInTx(
          transactionDb,
          suggestion.dateKey,
          { topTodoIds: merged },
          enqueue,
        );
        appliedDateKeys.push(suggestion.dateKey);
      }
      return { value: undefined, changed: appliedDateKeys.length > 0 };
    },
  });

  return { appliedDateKeys, addedCount, skipped, failed, truncatedCandidateCount };
}
