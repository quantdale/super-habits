import { getDatabase } from '@/core/db/client';
import { runLocalMutation } from '@/core/db/localMutation';
import { createId } from '@/lib/id';
import { nowIso, toDateKey } from '@/lib/time';
import {
  clampProgressPercent,
  GOAL_HORIZON_WINDOW_DAYS,
  normalizeGoalHorizon,
  normalizeGoalProgress,
  normalizeGoalStatus,
  validateGoalInput,
  validateGoalTargetDate,
} from '@/features/goals/goals.domain';
import type { Goal } from '@/core/db/types';
import type { GoalInput, GoalUpdate } from '@/features/goals/goals.types';

const GOAL_SELECT = `id, project_id, title, description, horizon, target_date, status, completed_at, progress_percent, created_at, updated_at, deleted_at`;
const GOAL_ORDER = `CASE WHEN status IN ('completed', 'archived') THEN 1 ELSE 0 END, created_at DESC`;

export async function listGoals(includeDeleted = false): Promise<Goal[]> {
  const db = await getDatabase();
  const where = includeDeleted ? '' : 'WHERE deleted_at IS NULL';
  return db.getAllAsync<Goal>(`SELECT ${GOAL_SELECT} FROM goals ${where} ORDER BY ${GOAL_ORDER}`);
}

export async function getGoal(id: string): Promise<Goal | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Goal>(`SELECT ${GOAL_SELECT} FROM goals WHERE id = ?`, [id]);
}

export async function addGoal(input: GoalInput): Promise<string> {
  const validation = validateGoalInput(input);
  if (!validation.ok || !input.title || input.title.trim().length === 0) {
    throw new Error(validation.title ?? 'Invalid goal.');
  }
  const db = await getDatabase();
  const id = createId('goal');
  const now = nowIso();

  const completedAt = normalizeGoalStatus(input.status) === 'completed' ? now : null;
  await runLocalMutation(db, async (tx) => {
    await tx.runAsync(
      `INSERT INTO goals
         (id, project_id, title, description, horizon, target_date, status, completed_at, progress_percent, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        id,
        input.projectId ?? null,
        input.title.trim(),
        input.description ?? null,
        normalizeGoalHorizon(input.horizon),
        validateGoalTargetDate(input.targetDate),
        normalizeGoalStatus(input.status),
        completedAt,
        normalizeGoalProgress(input.progressPercent),
        now,
        now,
      ],
    );
  });
  return id;
}

export async function updateGoal(id: string, updates: GoalUpdate): Promise<void> {
  const validation = validateGoalInput(updates);
  if (!validation.ok) {
    throw new Error(
      validation.title ??
        validation.description ??
        validation.status ??
        validation.progressPercent ??
        'Invalid goal update.',
    );
  }
  const db = await getDatabase();
  const now = nowIso();

  const existing = await db.getFirstAsync<Pick<Goal, 'status' | 'completed_at'>>(
    `SELECT status, completed_at FROM goals WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );
  const nextStatus =
    updates.status !== undefined ? normalizeGoalStatus(updates.status) : existing?.status;

  const fields: string[] = ['updated_at = ?'];
  const values: (string | number | null)[] = [now];
  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title.trim());
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.horizon !== undefined) {
    fields.push('horizon = ?');
    values.push(normalizeGoalHorizon(updates.horizon));
  }
  if (updates.targetDate !== undefined) {
    fields.push('target_date = ?');
    values.push(validateGoalTargetDate(updates.targetDate));
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(nextStatus!);
    const wasCompleted = existing?.status === 'completed';
    const willBeCompleted = nextStatus === 'completed';
    if (!wasCompleted && willBeCompleted) {
      fields.push('completed_at = ?');
      values.push(now);
    } else if (wasCompleted && !willBeCompleted) {
      fields.push('completed_at = ?');
      values.push(null);
    }
  }
  if (updates.progressPercent !== undefined) {
    fields.push('progress_percent = ?');
    values.push(clampProgressPercent(updates.progressPercent));
  }
  await runLocalMutation(db, async (tx) => {
    // H9: validate the target Project and reconcile linked children atomically.
    if (updates.projectId !== undefined) {
      const nextProjectId = updates.projectId;
      if (nextProjectId !== null) {
        const project = await tx.getFirstAsync<{ id: string }>(
          `SELECT id FROM projects WHERE id = ? AND deleted_at IS NULL`,
          [nextProjectId],
        );
        if (!project) throw new Error('Project not found.');
      }
      // Hierarchical consistency: Todos/Habits that reference this Goal follow
      // its Project (including becoming unassigned when the goal is detached).
      await tx.runAsync(
        `UPDATE todos SET project_id = ?, updated_at = ?
         WHERE goal_id = ? AND deleted_at IS NULL`,
        [nextProjectId, now, id],
      );
      await tx.runAsync(
        `UPDATE habits SET project_id = ?, updated_at = ?
         WHERE goal_id = ? AND deleted_at IS NULL`,
        [nextProjectId, now, id],
      );
      fields.push('project_id = ?');
      values.push(nextProjectId);
    }
    values.push(id);
    await tx.runAsync(
      `UPDATE goals SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      values,
    );
    // Outbox coherence (pending remote integration): Projects/Goals/Daily Plans
    // remain local-only this wave, so no outbox records are enqueued here. Once
    // these entities gain a Supabase contract, the goal update and every
    // reconciled child above must enqueue coherent owner-scoped outbox records
    // in this same transaction.
  });
}

export async function setGoalStatus(id: string, status: Goal['status']): Promise<void> {
  await updateGoal(id, { status });
}

export async function setGoalProgress(id: string, percent: number): Promise<void> {
  await updateGoal(id, { progressPercent: clampProgressPercent(percent) });
}

export async function softDeleteGoal(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  await runLocalMutation(db, async (tx) => {
    // H9 reconciliation: clear goal_id from linked Todos/Habits so no item keeps
    // a dangling reference to the deleted Goal. The item's current project_id
    // (if any) is preserved, including one auto-aligned to this goal's project.
    await tx.runAsync(
      `UPDATE todos SET goal_id = NULL, updated_at = ?
       WHERE goal_id = ? AND deleted_at IS NULL`,
      [now, id],
    );
    await tx.runAsync(
      `UPDATE habits SET goal_id = NULL, updated_at = ?
       WHERE goal_id = ? AND deleted_at IS NULL`,
      [now, id],
    );
    await tx.runAsync(
      'UPDATE goals SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      [now, now, id],
    );
    // Outbox coherence (pending remote integration): Projects/Goals/Daily Plans
    // remain local-only this wave. Once these entities gain a Supabase contract,
    // the goal tombstone and each cleared child above must enqueue coherent
    // owner-scoped outbox records in this same transaction.
  });
}

export async function listTodosForGoal(
  goalId: string,
): Promise<{ id: string; title: string; completed: 0 | 1 }[]> {
  const db = await getDatabase();
  return db.getAllAsync<{ id: string; title: string; completed: 0 | 1 }>(
    `SELECT id, title, completed FROM todos WHERE goal_id = ? AND deleted_at IS NULL ORDER BY completed ASC, sort_order ASC`,
    [goalId],
  );
}

export async function countActiveGoals(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM goals WHERE deleted_at IS NULL AND status NOT IN ('completed', 'archived')`,
  );
  return row?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Linked-entity rollups (bounded aggregate queries)
// ---------------------------------------------------------------------------

export type GoalRollupData = {
  todos: { total: number; done: number };
  habits: { habitCount: number; completionsInWindow: number; windowDays: number };
};

/**
 * Bounded rollup inputs for one goal: linked-todo done/total and linked-habit
 * completion counts over the goal's horizon window (custom horizons fall back
 * to 30 days). Small aggregate queries, no row loads.
 */
export async function getGoalRollup(goalId: string): Promise<GoalRollupData> {
  const db = await getDatabase();
  const goal = await db.getFirstAsync<Pick<Goal, 'horizon'>>(
    `SELECT horizon FROM goals WHERE id = ? AND deleted_at IS NULL`,
    [goalId],
  );
  const windowDays = GOAL_HORIZON_WINDOW_DAYS[goal?.horizon ?? 'month'] ?? 30;
  const effectiveDays = windowDays ?? 30;
  const windowStart = toDateKey(new Date(Date.now() - (effectiveDays - 1) * 86_400_000));

  const todoRow = await db.getFirstAsync<{ total: number; done: number }>(
    `SELECT COUNT(*) AS total, COALESCE(SUM(completed), 0) AS done
     FROM todos WHERE goal_id = ? AND deleted_at IS NULL`,
    [goalId],
  );
  const habitCountRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM habits WHERE goal_id = ? AND deleted_at IS NULL`,
    [goalId],
  );
  const completionRow = await db.getFirstAsync<{ completions: number }>(
    `SELECT COUNT(*) AS completions
     FROM habit_completions hc
     JOIN habits h ON h.id = hc.habit_id
     WHERE h.goal_id = ? AND h.deleted_at IS NULL AND hc.date_key >= ?
       AND hc.count > 0`,
    [goalId, windowStart],
  );

  return {
    todos: { total: todoRow?.total ?? 0, done: todoRow?.done ?? 0 },
    habits: {
      habitCount: habitCountRow?.count ?? 0,
      completionsInWindow: completionRow?.completions ?? 0,
      windowDays: effectiveDays,
    },
  };
}

/** Habits linked to a goal (for the goal detail rollup section). */
export async function listHabitsForGoal(
  goalId: string,
): Promise<{ id: string; name: string }[]> {
  const db = await getDatabase();
  return db.getAllAsync<{ id: string; name: string }>(
    `SELECT id, name FROM habits WHERE goal_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [goalId],
  );
}
