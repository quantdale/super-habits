import { getDatabase } from '@/core/db/client';
import { runLocalMutation } from '@/core/db/localMutation';
import { createId } from '@/lib/id';
import { nowIso } from '@/lib/time';
import {
  normalizeProjectColor,
  normalizeProjectStatus,
  validateProjectInput,
  validateTargetDate,
} from '@/features/projects/projects.domain';
import type { Project } from '@/core/db/types';
import type { ProjectInput, ProjectUpdate } from '@/features/projects/projects.types';

const PROJECT_SELECT = `id, name, description, color, status, target_date, completed_at, sort_order, created_at, updated_at, deleted_at`;
const PROJECT_ORDER = `CASE WHEN status IN ('completed', 'archived') THEN 1 ELSE 0 END, sort_order ASC, created_at DESC`;

export async function listProjects(includeDeleted = false): Promise<Project[]> {
  const db = await getDatabase();
  const where = includeDeleted ? '' : 'WHERE deleted_at IS NULL';
  return db.getAllAsync<Project>(
    `SELECT ${PROJECT_SELECT} FROM projects ${where} ORDER BY ${PROJECT_ORDER}`,
  );
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Project>(`SELECT ${PROJECT_SELECT} FROM projects WHERE id = ?`, [id]);
}

export async function addProject(input: ProjectInput): Promise<string> {
  const validation = validateProjectInput(input);
  if (!validation.ok || !input.name || input.name.trim().length === 0) {
    throw new Error(validation.name ?? 'Invalid project.');
  }
  const db = await getDatabase();
  const id = createId('proj');
  const now = nowIso();
  const maxRow = await db.getFirstAsync<{ maxOrder: number }>(
    `SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM projects WHERE deleted_at IS NULL`,
  );
  const sortOrder = (maxRow?.maxOrder ?? 0) + 1;

  const completedAt = normalizeProjectStatus(input.status) === 'completed' ? now : null;
  await runLocalMutation(db, async (tx) => {
    await tx.runAsync(
      `INSERT INTO projects
         (id, name, description, color, status, target_date, completed_at, sort_order, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        id,
        input.name.trim(),
        input.description ?? null,
        normalizeProjectColor(input.color),
        normalizeProjectStatus(input.status),
        validateTargetDate(input.targetDate),
        completedAt,
        sortOrder,
        now,
        now,
      ],
    );
  });
  return id;
}

export async function updateProject(id: string, updates: ProjectUpdate): Promise<void> {
  const validation = validateProjectInput(updates);
  if (!validation.ok) {
    throw new Error(
      validation.name ?? validation.description ?? validation.status ?? 'Invalid project update.',
    );
  }
  const db = await getDatabase();
  const now = nowIso();

  // Load current status to manage completed_at transitions without extra races.
  // If id not found, the UPDATE will be a no-op.
  const existing = await db.getFirstAsync<Pick<Project, 'status' | 'completed_at'>>(
    `SELECT status, completed_at FROM projects WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );
  const nextStatus =
    updates.status !== undefined ? normalizeProjectStatus(updates.status) : existing?.status;

  const fields: string[] = ['updated_at = ?'];
  const values: (string | null)[] = [now];
  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name.trim());
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }
  if (updates.color !== undefined) {
    fields.push('color = ?');
    values.push(normalizeProjectColor(updates.color));
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(nextStatus!);
    // Stable completion fact: set on entering completed, clear on leaving, preserve otherwise.
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
  if (updates.targetDate !== undefined) {
    fields.push('target_date = ?');
    values.push(validateTargetDate(updates.targetDate));
  }
  values.push(id);

  await runLocalMutation(db, async (tx) => {
    await tx.runAsync(
      `UPDATE projects SET ${fields.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      values,
    );
  });
}

export async function setProjectStatus(id: string, status: Project['status']): Promise<void> {
  await updateProject(id, { status });
}

export async function softDeleteProject(id: string): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  await runLocalMutation(db, async (tx) => {
    // H9 reconciliation: clear child references before marking the project
    // deleted, so no Todo/Habit/Goal keeps a dangling project_id. Children are
    // never soft-deleted. A Goal under this Project loses only its project
    // assignment and survives as an unassigned Goal; linked Todos/Habits keep
    // their goal_id (if any) and only drop the now-deleted project_id, which
    // keeps the parent→child hierarchy consistent.
    await tx.runAsync(
      `UPDATE goals SET project_id = NULL, updated_at = ?
       WHERE project_id = ? AND deleted_at IS NULL`,
      [now, id],
    );
    await tx.runAsync(
      `UPDATE todos SET project_id = NULL, updated_at = ?
       WHERE project_id = ? AND deleted_at IS NULL`,
      [now, id],
    );
    await tx.runAsync(
      `UPDATE habits SET project_id = NULL, updated_at = ?
       WHERE project_id = ? AND deleted_at IS NULL`,
      [now, id],
    );
    await tx.runAsync(
      'UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      [now, now, id],
    );
    // Outbox coherence (pending remote integration): Projects/Goals/Daily Plans
    // remain local-only this wave, so no outbox records are enqueued here. Once
    // these entities gain a Supabase contract, each cleared/updated child above
    // must also enqueue a coherent owner-scoped outbox record in this same
    // transaction.
  });
}

export async function reorderProjects(orderedIds: string[]): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  await runLocalMutation(db, async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.runAsync('UPDATE projects SET sort_order = ?, updated_at = ? WHERE id = ?', [
        i + 1,
        now,
        orderedIds[i],
      ]);
    }
  });
}

export async function listTodosForProject(
  projectId: string,
): Promise<{ id: string; title: string; completed: 0 | 1 }[]> {
  const db = await getDatabase();
  return db.getAllAsync<{ id: string; title: string; completed: 0 | 1 }>(
    `SELECT id, title, completed FROM todos WHERE project_id = ? AND deleted_at IS NULL ORDER BY completed ASC, sort_order ASC`,
    [projectId],
  );
}

export async function listHabitsForProject(
  projectId: string,
): Promise<{ id: string; name: string }[]> {
  const db = await getDatabase();
  return db.getAllAsync<{ id: string; name: string }>(
    `SELECT id, name FROM habits WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [projectId],
  );
}

export async function listGoalsForProject(
  projectId: string,
): Promise<{ id: string; title: string; status: Project['status']; progress_percent: number }[]> {
  const db = await getDatabase();
  return db.getAllAsync<{
    id: string;
    title: string;
    status: Project['status'];
    progress_percent: number;
  }>(
    `SELECT id, title, status, progress_percent FROM goals WHERE project_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`,
    [projectId],
  );
}

/** Active (non-completed, non-archived) project count for Progress Insights. */
export async function countActiveProjects(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM projects WHERE deleted_at IS NULL AND status NOT IN ('completed', 'archived')`,
  );
  return row?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Progress rollups (bounded aggregate queries)
// ---------------------------------------------------------------------------

/** Recent habit-completion window for project rollups, in days. */
export const PROJECT_HABIT_WINDOW_DAYS = 30;

export type ProjectRollup = {
  todos: { total: number; done: number };
  goals: { count: number; averageProgressPercent: number };
  habits: { habitCount: number; recentCompletions: number; windowDays: number };
};

/**
 * Bounded per-project rollup inputs using aggregate queries (no row loads).
 * Habit recency is measured over the last
 * {@link PROJECT_HABIT_WINDOW_DAYS} local calendar days via habit_completions.
 */
export async function getProjectRollup(projectId: string): Promise<ProjectRollup> {
  const db = await getDatabase();
  const windowStart = toDateKey(
    new Date(Date.now() - (PROJECT_HABIT_WINDOW_DAYS - 1) * 86_400_000),
  );

  const todoRow = await db.getFirstAsync<{ total: number; done: number }>(
    `SELECT COUNT(*) AS total, COALESCE(SUM(completed), 0) AS done
     FROM todos WHERE project_id = ? AND deleted_at IS NULL`,
    [projectId],
  );
  const goalRow = await db.getFirstAsync<{ count: number; avgProgress: number | null }>(
    `SELECT COUNT(*) AS count, AVG(progress_percent) AS avgProgress
     FROM goals WHERE project_id = ? AND deleted_at IS NULL AND status != 'archived'`,
    [projectId],
  );
  const habitCountRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM habits WHERE project_id = ? AND deleted_at IS NULL`,
    [projectId],
  );
  const completionRow = await db.getFirstAsync<{ completions: number }>(
    `SELECT COUNT(*) AS completions
     FROM habit_completions hc
     JOIN habits h ON h.id = hc.habit_id
     WHERE h.project_id = ? AND h.deleted_at IS NULL AND hc.date_key >= ?
       AND hc.count > 0`,
    [projectId, windowStart],
  );

  return {
    todos: { total: todoRow?.total ?? 0, done: todoRow?.done ?? 0 },
    goals: {
      count: goalRow?.count ?? 0,
      averageProgressPercent: goalRow?.avgProgress ?? 0,
    },
    habits: {
      habitCount: habitCountRow?.count ?? 0,
      recentCompletions: completionRow?.completions ?? 0,
      windowDays: PROJECT_HABIT_WINDOW_DAYS,
    },
  };
}

/**
 * Rollup inputs for every non-deleted project in three grouped queries —
 * bounded regardless of project count (no N+1).
 */
export async function listProjectRollups(): Promise<Record<string, ProjectRollup>> {
  const db = await getDatabase();
  const windowStart = toDateKey(
    new Date(Date.now() - (PROJECT_HABIT_WINDOW_DAYS - 1) * 86_400_000),
  );

  const todoRows = await db.getAllAsync<{ project_id: string; total: number; done: number }>(
    `SELECT project_id, COUNT(*) AS total, COALESCE(SUM(completed), 0) AS done
     FROM todos WHERE deleted_at IS NULL AND project_id IS NOT NULL
     GROUP BY project_id`,
  );
  const goalRows = await db.getAllAsync<{
    project_id: string;
    count: number;
    avgProgress: number | null;
  }>(
    `SELECT project_id, COUNT(*) AS count, AVG(progress_percent) AS avgProgress
     FROM goals WHERE deleted_at IS NULL AND project_id IS NOT NULL AND status != 'archived'
     GROUP BY project_id`,
  );
  const habitRows = await db.getAllAsync<{
    project_id: string;
    count: number;
    completions: number;
  }>(
    `SELECT h.project_id AS project_id, COUNT(DISTINCT h.id) AS count,
            COALESCE(SUM(CASE WHEN hc.date_key >= ? AND hc.count > 0 THEN 1 ELSE 0 END), 0) AS completions
     FROM habits h
     LEFT JOIN habit_completions hc ON hc.habit_id = h.id
     WHERE h.deleted_at IS NULL AND h.project_id IS NOT NULL
     GROUP BY h.project_id`,
    [windowStart],
  );

  const rollups: Record<string, ProjectRollup> = {};
  const ensure = (id: string): ProjectRollup => {
    if (!rollups[id]) {
      rollups[id] = {
        todos: { total: 0, done: 0 },
        goals: { count: 0, averageProgressPercent: 0 },
        habits: { habitCount: 0, recentCompletions: 0, windowDays: PROJECT_HABIT_WINDOW_DAYS },
      };
    }
    return rollups[id];
  };

  for (const r of todoRows) {
    if (!r.project_id) continue;
    ensure(r.project_id).todos = { total: r.total, done: r.done };
  }
  for (const r of goalRows) {
    if (!r.project_id) continue;
    ensure(r.project_id).goals = { count: r.count, averageProgressPercent: r.avgProgress ?? 0 };
  }
  for (const r of habitRows) {
    if (!r.project_id) continue;
    ensure(r.project_id).habits = {
      habitCount: r.count,
      recentCompletions: r.completions,
      windowDays: PROJECT_HABIT_WINDOW_DAYS,
    };
  }
  return rollups;
}
