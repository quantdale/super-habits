/** Shared by migration 26 and side-effect-free legacy restore reconstruction. */
export const BACKFILL_TODO_RECURRENCE_SERIES_SQL = `
  INSERT OR IGNORE INTO todo_recurrence_series
    (id, title, notes, priority, created_at, updated_at, deleted_at)
  SELECT t.recurrence_id, t.title, t.notes, t.priority,
         (SELECT MIN(h.created_at) FROM todos h WHERE h.recurrence_id = t.recurrence_id),
         t.updated_at, NULL
  FROM todos t
  WHERE t.recurrence = 'daily' AND t.recurrence_id IS NOT NULL
    AND t.id = (
      SELECT candidate.id FROM todos candidate
      WHERE candidate.recurrence_id = t.recurrence_id AND candidate.recurrence = 'daily'
      ORDER BY (candidate.deleted_at IS NULL) DESC, (candidate.completed = 0) DESC,
               candidate.updated_at DESC, candidate.created_at DESC, candidate.id DESC
      LIMIT 1
    );
`;
