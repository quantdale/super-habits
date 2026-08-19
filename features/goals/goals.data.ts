import { getDatabase } from '@/core/db/client';
import { runLocalMutation } from '@/core/db/localMutation';
import { createId } from '@/lib/id';
import { nowIso } from '@/lib/time';
import {
  clampProgressPercent,
  normalizeGoalHorizon,
  normalizeGoalProgress,
  normalizeGoalStatus,
  validateGoalInput,
  validateGoalTargetDate,
} from '@/features/goals/goals.domain';
import type { Goal } from '@/core/db/types';
import type { GoalInput, GoalUpdate } from '@/features/goals/goals.types';

const GOAL_SELECT = `id, project_id, title, description, horizon, target_date, status, progress_percent, created_at, updated_at, deleted_at`;
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

  await runLocalMutation(db, async (tx) => {
    await tx.runAsync(
      `INSERT INTO goals
         (id, project_id, title, description, horizon, target_date, status, progress_percent, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        id,
        input.projectId ?? null,
        input.title.trim(),
        input.description ?? null,
        normalizeGoalHorizon(input.horizon),
        validateGoalTargetDate(input.targetDate),
        normalizeGoalStatus(input.status),
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

  const fields: string[] = ['updated_at = ?'];
  const values: (string | number | null)[] = [now];
  if (updates.projectId !== undefined) {
    fields.push('project_id = ?');
    values.push(updates.projectId);
  }
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
    values.push(normalizeGoalStatus(updates.status));
  }
  if (updates.progressPercent !== undefined) {
    fields.push('progress_percent = ?');
    values.push(clampProgressPercent(updates.progressPercent));
  }
  values.push(id);

  await runLocalMutation(db, async (tx) => {
    await tx.runAsync(
      `UPDATE goals SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      values,
    );
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
    await tx.runAsync(
      'UPDATE goals SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      [now, now, id],
    );
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
