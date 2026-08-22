import type * as SQLite from 'expo-sqlite';
import { getDatabase } from '@/core/db/client';
import { runBackupMutation } from '@/core/sync/syncedMutation';
import type { SyncRecord } from '@/core/sync/sync.engine';
import { createId } from '@/lib/id';
import { isValidDateKey, nowIso, toDateKey } from '@/lib/time';
import type { DailyPlan } from '@/core/db/types';
import {
  clampFocusTargetMinutes,
  clampText,
  computeAdherenceStreaks,
  computeCarryForwardIds,
  normalizeEnergyScore,
  parseTopTodoIds,
  serializeTopTodoIds,
  shiftDateKeyByDays,
} from '@/features/daily-plan/dailyPlan.domain';
import { INTENTION_MAX, NOTES_MAX, REFLECTION_MAX } from '@/features/daily-plan/dailyPlan.types';
import type { DailyPlanAdherence } from '@/features/daily-plan/dailyPlan.domain';
import { listPendingTodos } from '@/features/todos/todos.data';

const DAILY_PLAN_SELECT = `id, date_key, intention, top_todo_ids, top_todo_titles, focus_target_minutes, notes, reflection, energy_score, status, completed_at, created_at, updated_at, deleted_at`;

export async function getDailyPlan(dateKey: string): Promise<DailyPlan | null> {
  const db = await getDatabase();
  return db.getFirstAsync<DailyPlan>(
    `SELECT ${DAILY_PLAN_SELECT} FROM daily_plans WHERE date_key = ? AND deleted_at IS NULL`,
    [dateKey],
  );
}

export async function getOrCreateDailyPlan(dateKey: string = toDateKey()): Promise<DailyPlan> {
  // Deprecated for UI use: preserved for internal callers/tests only.
  // UI (DailyPlanView) must use getDailyPlan (read-only) + in-memory draft and
  // explicit upsertDailyPlan on save to keep pristine devices safe.
  const existing = await getDailyPlan(dateKey);
  if (existing) return existing;
  return upsertDailyPlan(dateKey, {});
}

export type DailyPlanUpdate = {
  intention?: string;
  topTodoIds?: string[];
  focusTargetMinutes?: number;
  notes?: string;
  reflection?: string;
  energyScore?: number | null;
  status?: DailyPlan['status'];
};

/**
 * Prune topTodoIds to existing Todo ids at save time (H10 referential
 * validation). Dropped stale/deleted ids are silent; ordering is preserved.
 * Takes the caller's connection so the read stays inside the write
 * transaction.
 */
async function filterExistingTodoIdsInTx(
  tx: SQLite.SQLiteDatabase,
  ids: string[],
): Promise<string[]> {
  if (ids.length === 0) return ids;
  const placeholders = ids.map(() => '?').join(',');
  const rows = await tx.getAllAsync<{ id: string }>(
    `SELECT id FROM todos WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
    ids,
  );
  const existingSet = new Set(rows.map((r) => r.id));
  return ids.filter((id) => existingSet.has(id));
}

/**
 * Title snapshots for the plan's priority ids, taken at save time inside the
 * write transaction (migration 21). Output is a JSON string[] aligned
 * index-wise with `ids`; a title missing mid-snapshot (todo hard-gone between
 * filtering and this read — same transaction, so practically impossible)
 * stores '' and readers fall through to the live lookup.
 */
async function snapshotTopTodoTitlesInTx(
  tx: SQLite.SQLiteDatabase,
  ids: string[],
): Promise<string> {
  if (ids.length === 0) return '[]';
  const placeholders = ids.map(() => '?').join(',');
  const rows = await tx.getAllAsync<{ id: string; title: string }>(
    `SELECT id, title FROM todos WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
    ids,
  );
  const titleById = new Map(rows.map((r) => [r.id, r.title] as const));
  return JSON.stringify(ids.map((id) => titleById.get(id) ?? ''));
}

function readActivePlanByDateKey(
  tx: SQLite.SQLiteDatabase,
  dateKey: string,
): Promise<DailyPlan | null> {
  return tx.getFirstAsync<DailyPlan>(
    `SELECT ${DAILY_PLAN_SELECT} FROM daily_plans WHERE date_key = ? AND deleted_at IS NULL`,
    [dateKey],
  );
}

/**
 * Recognize the unique-violation raised by idx_daily_plans_date_key_active so
 * a lost create race can fall back to the UPDATE path instead of surfacing a
 * raw SQLITE_CONSTRAINT error. Covers better-sqlite3 (code property), Expo
 * native, and web WASM error shapes.
 */
function isUniqueConstraintError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT') && code.includes('UNIQUE')) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /UNIQUE constraint failed/i.test(message);
}

/**
 * Transaction-scoped create-or-update for one day's plan. The existence read,
 * Todo-id validation, and write all run on the caller's transaction so the
 * create-vs-update decision and completed_at transitions key off
 * in-transaction state — never a pre-transaction snapshot (F6). When `enqueue`
 * is provided, the matching owner-scoped outbox record is created in the SAME
 * transaction (F1). A create that loses a race against a concurrent active row
 * for the same date_key falls back to the UPDATE path; the partial unique
 * index guarantees at most one active row per date_key.
 *
 * Exported for canonical-boundary callers that must apply several days (or a
 * read-modify-write merge) inside ONE transaction: weekly-review next-week
 * application and daily-plan carry-forward.
 */
export async function upsertDailyPlanInTx(
  tx: SQLite.SQLiteDatabase,
  dateKey: string,
  updates: DailyPlanUpdate,
  enqueue?: (record: SyncRecord) => void,
): Promise<DailyPlan> {
  if (!isValidDateKey(dateKey)) {
    throw new Error('Invalid date key.');
  }
  const now = nowIso();
  let existing = await readActivePlanByDateKey(tx, dateKey);

  if (!existing) {
    const id = createId('dplan');
    const nextTopTodoIdList = updates.topTodoIds
      ? await filterExistingTodoIdsInTx(tx, updates.topTodoIds)
      : [];
    const nextTopTodoIds = serializeTopTodoIds(nextTopTodoIdList);
    const nextTopTodoTitles = await snapshotTopTodoTitlesInTx(tx, nextTopTodoIdList);
    const nextStatus = updates.status ?? 'draft';
    const completedAt = nextStatus === 'completed' ? now : null;
    try {
      await tx.runAsync(
        `INSERT INTO daily_plans
           (id, date_key, intention, top_todo_ids, top_todo_titles, focus_target_minutes, notes, reflection, energy_score, status, completed_at, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          id,
          dateKey,
          clampText(updates.intention, INTENTION_MAX),
          nextTopTodoIds,
          nextTopTodoTitles,
          clampFocusTargetMinutes(updates.focusTargetMinutes ?? 0),
          clampText(updates.notes, NOTES_MAX),
          clampText(updates.reflection, REFLECTION_MAX),
          normalizeEnergyScore(updates.energyScore),
          nextStatus,
          completedAt,
          now,
          now,
        ],
      );
      enqueue?.({ entity: 'daily_plans', id, updatedAt: now, operation: 'create' });
      return (await readActivePlanByDateKey(tx, dateKey)) as DailyPlan;
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      // Lost a create race: an active row for this date_key committed after
      // our in-tx existence read. Fall through to the UPDATE path.
      existing = await readActivePlanByDateKey(tx, dateKey);
      if (!existing) throw error;
    }
  }

  let nextTopTodoIds = existing.top_todo_ids ?? '[]';
  let nextTopTodoIdList: string[] | null = null;
  if (updates.topTodoIds !== undefined) {
    nextTopTodoIdList = await filterExistingTodoIdsInTx(
      tx,
      parseTopTodoIds(serializeTopTodoIds(updates.topTodoIds)),
    );
    nextTopTodoIds = serializeTopTodoIds(nextTopTodoIdList);
  }

  const nextStatus = updates.status ?? existing.status;
  const willComplete = nextStatus === 'completed';
  const wasCompleted = existing.status === 'completed';

  const fields: string[] = ['updated_at = ?'];
  const values: (string | number | null)[] = [now];
  if (updates.intention !== undefined) {
    fields.push('intention = ?');
    values.push(clampText(updates.intention, INTENTION_MAX));
  }
  if (nextTopTodoIdList !== null) {
    fields.push('top_todo_ids = ?');
    values.push(nextTopTodoIds);
    // Keep the title snapshot aligned index-wise with the ids just written.
    fields.push('top_todo_titles = ?');
    values.push(await snapshotTopTodoTitlesInTx(tx, nextTopTodoIdList));
  }
  if (updates.focusTargetMinutes !== undefined) {
    fields.push('focus_target_minutes = ?');
    values.push(clampFocusTargetMinutes(updates.focusTargetMinutes));
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    values.push(clampText(updates.notes, NOTES_MAX));
  }
  if (updates.reflection !== undefined) {
    fields.push('reflection = ?');
    values.push(clampText(updates.reflection, REFLECTION_MAX));
  }
  if (updates.energyScore !== undefined) {
    fields.push('energy_score = ?');
    values.push(normalizeEnergyScore(updates.energyScore));
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(nextStatus);
    // Stable completion fact: set on entering completed, clear on leaving.
    if (!wasCompleted && willComplete) {
      fields.push('completed_at = ?');
      values.push(now);
    } else if (wasCompleted && !willComplete) {
      fields.push('completed_at = ?');
      values.push(null);
    }
  }
  values.push(existing.id);

  await tx.runAsync(`UPDATE daily_plans SET ${fields.join(', ')} WHERE id = ?`, values);
  enqueue?.({ entity: 'daily_plans', id: existing.id, updatedAt: now, operation: 'update' });
  return (await readActivePlanByDateKey(tx, dateKey)) as DailyPlan;
}

export async function upsertDailyPlan(
  dateKey: string,
  updates: DailyPlanUpdate,
): Promise<DailyPlan> {
  if (!isValidDateKey(dateKey)) {
    throw new Error('Invalid date key.');
  }
  const db = await getDatabase();
  await runBackupMutation<DailyPlan>({
    db,
    mutate: async (transactionDb, enqueue) => {
      const plan = await upsertDailyPlanInTx(transactionDb, dateKey, updates, enqueue);
      return { value: plan, changed: true };
    },
  });
  return (await getDailyPlan(dateKey)) as DailyPlan;
}

export async function setDailyPlanTopTodos(dateKey: string, todoIds: string[]): Promise<DailyPlan> {
  return upsertDailyPlan(dateKey, { topTodoIds: todoIds });
}

export async function commitDailyPlan(dateKey: string): Promise<DailyPlan> {
  return upsertDailyPlan(dateKey, { status: 'committed' });
}

export async function completeDailyPlan(
  dateKey: string,
  extras: { reflection?: string; energyScore?: number | null } = {},
): Promise<DailyPlan> {
  return upsertDailyPlan(dateKey, {
    status: 'completed',
    ...(extras.reflection !== undefined ? { reflection: extras.reflection } : {}),
    ...(extras.energyScore !== undefined ? { energyScore: extras.energyScore } : {}),
  });
}

export async function softDeleteDailyPlan(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  await runBackupMutation<void>({
    db,
    mutate: async (transactionDb, enqueue) => {
      const result = await transactionDb.runAsync(
        'UPDATE daily_plans SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
        [now, now, id],
      );
      if (result.changes > 0) {
        enqueue({ entity: 'daily_plans', id, updatedAt: now, operation: 'delete' });
      }
      return { value: undefined, changed: result.changes > 0 };
    },
  });
}

export async function listRecentDailyPlans(days = 14): Promise<DailyPlan[]> {
  const db = await getDatabase();
  const since = toDateKey(new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000));
  return db.getAllAsync<DailyPlan>(
    `SELECT ${DAILY_PLAN_SELECT} FROM daily_plans WHERE deleted_at IS NULL AND date_key >= ? ORDER BY date_key DESC`,
    [since],
  );
}

/** Bounded plan history lookup for read-only browsing (inclusive range). */
export async function listDailyPlansInRange(
  startKey: string,
  endKey: string,
): Promise<DailyPlan[]> {
  const db = await getDatabase();
  return db.getAllAsync<DailyPlan>(
    `SELECT ${DAILY_PLAN_SELECT} FROM daily_plans
     WHERE deleted_at IS NULL AND date_key >= ? AND date_key <= ?
     ORDER BY date_key DESC`,
    [startKey, endKey],
  );
}

/**
 * Carry unfinished priority todos from the previous day's plan into the plan
 * for `dateKey`. Idempotent: already-selected or completed todos are skipped,
 * so repeated invocations add nothing new. Returns the updated plan, or null
 * when there is no previous-day plan (nothing to pull from).
 *
 * The merge runs inside the write transaction and re-reads BOTH plans there
 * (F7): candidates are computed against fresh current selections, so a
 * concurrent plan edit between the outer reads and the write is never
 * reverted. The outbox record rides the same transaction (F1).
 */
export async function carryForwardFromPreviousDay(dateKey: string): Promise<DailyPlan | null> {
  const previousKey = shiftDateKeyByDays(dateKey, -1);
  const [previousPlan, pendingTodos] = await Promise.all([
    getDailyPlan(previousKey),
    listPendingTodos(),
  ]);
  if (!previousPlan) return null;

  const db = await getDatabase();
  const outcome = await runBackupMutation<DailyPlan | null>({
    db,
    mutate: async (transactionDb, enqueue) => {
      const freshPrevious = await readActivePlanByDateKey(transactionDb, previousKey);
      if (!freshPrevious) return { value: null, changed: false };
      const freshCurrent = await readActivePlanByDateKey(transactionDb, dateKey);

      const unfinishedById = new Map(pendingTodos.map((t) => [t.id, t]));
      const candidates = computeCarryForwardIds({
        previousPlanTopTodoIds: parseTopTodoIds(freshPrevious.top_todo_ids),
        currentPlanTopTodoIds: parseTopTodoIds(freshCurrent?.top_todo_ids ?? '[]'),
        isTodoUnfinished: (todoId) => unfinishedById.has(todoId),
      });
      if (candidates.length === 0) {
        return { value: freshCurrent, changed: false };
      }
      const merged = [...parseTopTodoIds(freshCurrent?.top_todo_ids ?? '[]'), ...candidates];
      const plan = await upsertDailyPlanInTx(
        transactionDb,
        dateKey,
        { topTodoIds: merged },
        enqueue,
      );
      return { value: plan, changed: true };
    },
  });
  return outcome.value;
}

/** Adherence streaks over the trailing `days` window ending today. */
export async function getDailyPlanAdherence(days = 30): Promise<DailyPlanAdherence> {
  const today = toDateKey();
  const start = shiftDateKeyByDays(today, -(days - 1));
  const plans = await listDailyPlansInRange(start, today);
  return computeAdherenceStreaks(plans, today);
}

export { parseTopTodoIds };

/**
 * Restore-only import for daily plans. Plain INSERT OR REPLACE preserving ids,
 * date keys, tombstones, and timestamps — data reconstruction only; no
 * carry-forward, no completion events.
 */
export async function applyRemoteDailyPlans(
  db: Awaited<ReturnType<typeof getDatabase>>,
  rows: DailyPlan[],
): Promise<void> {
  for (const row of rows) {
    await db.runAsync(
      `INSERT OR REPLACE INTO daily_plans (
         id,
         date_key,
         intention,
         top_todo_ids,
         top_todo_titles,
         focus_target_minutes,
         notes,
         reflection,
         energy_score,
         status,
         created_at,
         updated_at,
         deleted_at,
         completed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.date_key,
        row.intention,
        row.top_todo_ids,
        row.top_todo_titles ?? null,
        row.focus_target_minutes,
        row.notes,
        row.reflection,
        row.energy_score,
        row.status,
        row.created_at,
        row.updated_at,
        row.deleted_at,
        row.completed_at ?? null,
      ],
    );
  }
}
