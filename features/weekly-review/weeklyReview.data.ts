import { getDatabase } from '@/core/db/client';
import { createId } from '@/lib/id';
import { nowIso } from '@/lib/time';
import { syncEngine } from '@/core/sync/sync.engine';
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
 * Enqueues a sync record inside the same logical write.
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

  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM weekly_reviews WHERE week_key = ? AND deleted_at IS NULL`,
    [input.weekKey],
  );

  if (existing) {
    await db.runAsync(
      `UPDATE weekly_reviews
         SET summary_payload = ?, plan_payload = ?, reflection = ?,
             completed_at = ?, status = 'completed', updated_at = ?
       WHERE id = ? AND deleted_at IS NULL`,
      [input.summaryPayload, input.planPayload, input.reflection, now, now, existing.id],
    );
    syncEngine.enqueue({
      entity: 'weekly_reviews',
      id: existing.id,
      updatedAt: now,
      operation: 'update',
    });
    return existing.id;
  }

  const id = createId('wrev');
  await db.runAsync(
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
  syncEngine.enqueue({
    entity: 'weekly_reviews',
    id,
    updatedAt: now,
    operation: 'create',
  });
  return id;
}

/** Soft-delete a review (future use). */
export async function deleteWeeklyReview(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  await db.runAsync(
    `UPDATE weekly_reviews SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`,
    [now, now, id],
  );
  syncEngine.enqueue({
    entity: 'weekly_reviews',
    id,
    updatedAt: now,
    operation: 'delete',
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

/** Apply remote weekly reviews (for restore/portable import). Inert — no side effects. */
export async function applyRemoteWeeklyReviews(reviews: WeeklyReview[]): Promise<void> {
  const db = await getDatabase();
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
