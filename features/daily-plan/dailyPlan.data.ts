import { getDatabase } from '@/core/db/client';
import { runLocalMutation } from '@/core/db/localMutation';
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
} from '@/features/daily-plan/dailyPlan.domain';
import { INTENTION_MAX, NOTES_MAX, REFLECTION_MAX } from '@/features/daily-plan/dailyPlan.types';
import type { DailyPlanAdherence } from '@/features/daily-plan/dailyPlan.domain';
import { listPendingTodos } from '@/features/todos/todos.data';

const DAILY_PLAN_SELECT = `id, date_key, intention, top_todo_ids, focus_target_minutes, notes, reflection, energy_score, status, completed_at, created_at, updated_at, deleted_at`;

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
 */
async function filterExistingTodoIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return ids;
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM todos WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
    ids,
  );
  const existingSet = new Set(rows.map((r) => r.id));
  return ids.filter((id) => existingSet.has(id));
}

export async function upsertDailyPlan(
  dateKey: string,
  updates: DailyPlanUpdate,
): Promise<DailyPlan> {
  if (!isValidDateKey(dateKey)) {
    throw new Error('Invalid date key.');
  }
  const db = await getDatabase();
  const now = nowIso();
  const existing = await getDailyPlan(dateKey);
  const rawNextTopTodoIds = updates.topTodoIds
    ? serializeTopTodoIds(updates.topTodoIds)
    : (existing?.top_todo_ids ?? '[]');
  const nextTopTodoIds = updates.topTodoIds
    ? serializeTopTodoIds(await filterExistingTodoIds(parseTopTodoIds(rawNextTopTodoIds)))
    : rawNextTopTodoIds;

  const nextStatus = updates.status ?? existing?.status ?? 'draft';
  const willComplete = nextStatus === 'completed';
  const wasCompleted = existing?.status === 'completed';

  if (!existing) {
    const id = createId('dplan');
    const completedAt = willComplete ? now : null;
    await runLocalMutation(db, async (tx) => {
      await tx.runAsync(
        `INSERT INTO daily_plans
           (id, date_key, intention, top_todo_ids, focus_target_minutes, notes, reflection, energy_score, status, completed_at, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          id,
          dateKey,
          clampText(updates.intention, INTENTION_MAX),
          nextTopTodoIds,
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
    });
    return (await getDailyPlan(dateKey)) as DailyPlan;
  }

  const fields: string[] = ['updated_at = ?'];
  const values: (string | number | null)[] = [now];
  if (updates.intention !== undefined) {
    fields.push('intention = ?');
    values.push(clampText(updates.intention, INTENTION_MAX));
  }
  if (updates.topTodoIds !== undefined) {
    fields.push('top_todo_ids = ?');
    values.push(nextTopTodoIds);
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
    if (!wasCompleted && willComplete) {
      fields.push('completed_at = ?');
      values.push(now);
    } else if (wasCompleted && !willComplete) {
      fields.push('completed_at = ?');
      values.push(null);
    }
  }
  values.push(existing.id);

  await runLocalMutation(db, async (tx) => {
    await tx.runAsync(`UPDATE daily_plans SET ${fields.join(', ')} WHERE id = ?`, values);
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
  await runLocalMutation(db, async (tx) => {
    await tx.runAsync(
      'UPDATE daily_plans SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      [now, now, id],
    );
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

function shiftDateKeyByDays(dateKey: string, days: number): string {
  const d = toDateKey(new Date(`${dateKey}T00:00:00`));
  const date = new Date(`${d}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

/**
 * Carry unfinished priority todos from the previous day's plan into the plan
 * for `dateKey`. Idempotent: already-selected or completed todos are skipped,
 * so repeated invocations add nothing new. Returns the updated plan, or null
 * when there is no previous-day plan (nothing to pull from).
 */
export async function carryForwardFromPreviousDay(dateKey: string): Promise<DailyPlan | null> {
  const previousKey = shiftDateKeyByDays(dateKey, -1);
  const [previousPlan, currentPlan, pendingTodos] = await Promise.all([
    getDailyPlan(previousKey),
    getDailyPlan(dateKey),
    listPendingTodos(),
  ]);
  if (!previousPlan) return null;

  const unfinishedById = new Map(pendingTodos.map((t) => [t.id, t]));
  const candidates = computeCarryForwardIds({
    previousPlanTopTodoIds: parseTopTodoIds(previousPlan.top_todo_ids),
    currentPlanTopTodoIds: parseTopTodoIds(currentPlan?.top_todo_ids ?? '[]'),
    isTodoUnfinished: (todoId) => unfinishedById.has(todoId),
  });
  if (candidates.length === 0) {
    return currentPlan;
  }
  return setDailyPlanTopTodos(dateKey, [
    ...parseTopTodoIds(currentPlan?.top_todo_ids ?? '[]'),
    ...candidates,
  ]);
}

/** Adherence streaks over the trailing `days` window ending today. */
export async function getDailyPlanAdherence(days = 30): Promise<DailyPlanAdherence> {
  const today = toDateKey();
  const start = shiftDateKeyByDays(today, -(days - 1));
  const plans = await listDailyPlansInRange(start, today);
  return computeAdherenceStreaks(plans, today);
}

export { parseTopTodoIds };
