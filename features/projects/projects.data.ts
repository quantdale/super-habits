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

const PROJECT_SELECT = `id, name, description, color, status, target_date, sort_order, created_at, updated_at, deleted_at`;
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

  await runLocalMutation(db, async (tx) => {
    await tx.runAsync(
      `INSERT INTO projects
         (id, name, description, color, status, target_date, sort_order, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      [
        id,
        input.name.trim(),
        input.description ?? null,
        normalizeProjectColor(input.color),
        normalizeProjectStatus(input.status),
        validateTargetDate(input.targetDate),
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
    values.push(normalizeProjectStatus(updates.status));
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
    await tx.runAsync(
      'UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL',
      [now, now, id],
    );
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
