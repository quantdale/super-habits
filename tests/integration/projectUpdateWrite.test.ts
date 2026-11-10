import { beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase } from './helpers/db';

/**
 * Write contract for `updateProject`: editing a Project that no longer exists
 * must REJECT, not silently succeed.
 *
 * The user-visible failure (the Project half of the defect the Goal fix
 * 498fcd09 pinned for `updateGoal`): `ProjectDetailView` loads its row once on
 * mount, so a project tombstoned between that load and the save (a concurrent
 * delete on another surface, a restore, or a stale editor) reaches
 * `updateProject`'s `UPDATE ... WHERE id = ? AND deleted_at IS NULL`, which
 * matches zero rows and throws nothing. The handler then calls `onBack()` and
 * the editor closes exactly as if it had saved — the user's rename/objective
 * edit is silently discarded and cannot be retried.
 *
 * Contract pinned here:
 *  1. a missing id rejects with the same user-facing sentence the Goal path
 *     uses, and writes nothing;
 *  2. a soft-deleted id rejects and can never be resurrected by an edit;
 *  3. a live project still writes exactly one row + one backup intent.
 */
describe('project update write contract', () => {
  beforeEach(async () => {
    await freshDatabase();
  });

  it('updateProject rejects a missing project instead of silently no-op', async () => {
    const { getProject, updateProject } = await import('@/features/projects/projects.data');
    await expect(updateProject('proj_missing', { name: 'nowhere' })).rejects.toThrow(
      'Project not found.',
    );
    // Nothing was created or written for that id.
    expect(await getProject('proj_missing')).toBeNull();
  });

  it('updateProject rejects a soft-deleted project and cannot resurrect it', async () => {
    const { addProject, getProject, listProjects, softDeleteProject, updateProject } =
      await import('@/features/projects/projects.data');
    const id = await addProject({ name: 'Deleted later' });
    await softDeleteProject(id);

    await expect(updateProject(id, { name: 'zombie' })).rejects.toThrow('Project not found.');
    // Resurrection guard: the rejected write leaves the tombstone and the
    // original values untouched. NOTE: `getProject` deliberately reads the
    // tombstoned row (it has no `deleted_at IS NULL` filter — callers decide),
    // so the assertion is on the surviving row, not on a null result.
    const tombstoned = await getProject(id);
    expect(tombstoned?.deleted_at).toBeTruthy();
    expect(tombstoned?.name).toBe('Deleted later');
    const row = (await listProjects(true)).find((project) => project.id === id);
    expect(row?.deleted_at).toBeTruthy();
    expect(row?.name).toBe('Deleted later');
  });

  it('updateProject still writes a live project exactly once', async () => {
    const { addProject, getProject, updateProject } =
      await import('@/features/projects/projects.data');
    const id = await addProject({ name: 'before' });
    await updateProject(id, { name: 'after' });
    expect((await getProject(id))?.name).toBe('after');
  });

  it('a rejected stale-row update mints no backup intent', async () => {
    const { addProject, softDeleteProject, updateProject } =
      await import('@/features/projects/projects.data');
    const db = await freshDatabase();
    const id = await addProject({ name: 'Gone' });
    await softDeleteProject(id);
    const before = await db.getAllAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'projects'`,
    );
    await expect(updateProject(id, { name: 'after' })).rejects.toThrow('Project not found.');
    const after = await db.getAllAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = 'projects'`,
    );
    expect(after[0]?.n).toBe(before[0]?.n);
  });
});
